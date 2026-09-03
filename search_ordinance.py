"""
검색어 -> 지역 조례 매칭 테스트 (Phase 6 프로토타입)

build_embeddings.py로 미리 만들어둔 <slug>.npy 문서 인덱스에 대해, 검색어 하나를
그 자리에서 쿼리로 임베딩(embed_query)해 코사인 유사도가 threshold 이상인 결과를
뽑고, data/matches.json에 이미 계산된 본청 겹침 판정이 있으면 같이 붙인다.

반환값은 docs/api-contract.md의 GET /api/ordinances 응답(SearchResponseDto)과
같은 모양이다 — 실제 BE 엔드포인트를 만들 때 search()를 그대로 갖다 쓸 수 있게.
결과를 파일로 저장하지는 않는다.

주의: data/extracted/<slug>.json의 바깥쪽 키(자치법규ID)와 안쪽 "자치법규일련번호"
(MST) 필드는 값이 다르다. 프론트 id / 원문링크의 ordinSeq는 후자를 기준으로 하므로,
내보낼 때는 안쪽 "자치법규일련번호" 필드를 쓴다 (바깥쪽 키는 인덱스/매칭 내부 조회용).

사용법:
    python build_embeddings.py mokpo          # 대상 지역 document 인덱스가 없으면 먼저 생성
    python search_ordinance.py mokpo "노인 일자리 지원"
    python search_ordinance.py jangheung "청년 창업 지원금" --threshold 0.35
"""

import argparse
import os

import numpy as np

import extract_ordinance as m
import build_embeddings as be

MATCHES_PATH = os.path.join(m.DATA_DIR, "matches.json")

VERDICT_NORMALIZE = {
    "겹침 후보": "겹침후보",
    "확인 필요": "확인필요",
}


def cosine_sims(query_vec, vectors):
    q = np.asarray(query_vec, dtype=np.float32)
    q = q / (np.linalg.norm(q) + 1e-8)
    v = vectors / (np.linalg.norm(vectors, axis=1, keepdims=True) + 1e-8)
    return v @ q


def _matches_by_region_id(slug):
    """data/matches.json에서 slug 지역 겹침 판정을 지역조례ID(=인덱스 키) 기준으로 묶는다."""
    by_id = {}
    for entry in m.read_json(MATCHES_PATH, []):
        if entry.get("지역명") == slug:
            by_id[entry["지역조례ID"]] = entry
    return by_id


def _to_metro(boncheong_id, boncheong_extracted, note):
    b = boncheong_extracted.get(boncheong_id)
    if not b:
        return None
    return {
        "자치법규일련번호": b.get("자치법규일련번호", boncheong_id),
        "조례명": b.get("조례명"),
        "시행일": b.get("시행일"),
        "목적": b.get("목적"),
        "대상": b.get("대상"),
        "효과": b.get("효과"),
        "원문링크": b.get("원문링크"),
        "담당부서": b.get("담당부서"),
        "전화번호": b.get("전화번호"),
        "겹침요지": note,
    }


def build_record(law_id, data, relevance, match_entry, boncheong_extracted):
    """extracted 레코드 + (있으면) matches.json 판정을 OrdinanceRecordDto 모양으로 합친다."""
    record = {
        "자치법규일련번호": data.get("자치법규일련번호", law_id),
        "조례명": data.get("조례명"),
        "지역": data.get("지역"),
        "목적": data.get("목적"),
        "대상": data.get("대상"),
        "효과": data.get("효과"),
        "우선순위조항": data.get("우선순위조항") or [],
        "내부충돌여부": data.get("내부충돌여부", False),
        "추출특이사항": data.get("추출특이사항"),
        "원문링크": data.get("원문링크"),
        "공포일": data.get("공포일"),
        "시행일": data.get("시행일"),
        "담당부서": data.get("담당부서"),
        "전화번호": data.get("전화번호"),
        "관련도": round(relevance * 100) if relevance is not None else None,
    }
    if match_entry:
        verdict = VERDICT_NORMALIZE.get(match_entry["판정"], match_entry["판정"])
        record["판정"] = verdict
        record["판정근거"] = [match_entry["근거"]] if match_entry.get("근거") else []
        record["본청조례"] = _to_metro(
            match_entry["본청조례ID"], boncheong_extracted, match_entry.get("근거")
        )
    else:
        record["판정"] = "겹침없음"
        record["판정없음사유"] = "본청 조례와 겹침 판정 이력 없음"
    return record


def search(slug, query_text, threshold=0.3):
    ids, vectors = be.load_index(slug)
    extracted = m.load_extracted(slug)
    matches_by_id = _matches_by_region_id(slug)
    boncheong_extracted = m.load_extracted("boncheong") if matches_by_id else {}

    query_vec = be.embed_query(query_text)
    sims = cosine_sims(query_vec, vectors)
    order = np.argsort(-sims)

    items = []
    for idx in order:
        sim = float(sims[idx])
        if sim < threshold:
            continue
        law_id = ids[idx]
        data = extracted.get(law_id, {})
        items.append(build_record(law_id, data, sim, matches_by_id.get(law_id), boncheong_extracted))

    status_counts = {"겹침후보": 0, "확인필요": 0, "겹침없음": 0}
    for item in items:
        status_counts[item["판정"]] = status_counts.get(item["판정"], 0) + 1

    return {
        "items": items,
        "total": len(items),
        "regionTotal": len(extracted),
        "statusCounts": status_counts,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("slug", choices=list(m.RAW_FILES), help="검색 대상 지역")
    parser.add_argument("query", help="검색어")
    parser.add_argument("--threshold", type=float, default=0.3, help="이 값 이상만 출력 (기본 0.3)")
    args = parser.parse_args()

    result = search(args.slug, args.query, args.threshold)
    print(
        f"[{args.slug}] \"{args.query}\" 검색 결과 (유사도 {args.threshold} 이상, "
        f"{result['total']}/{result['regionTotal']}건) — {result['statusCounts']}"
    )
    for rank, item in enumerate(result["items"], 1):
        print(f"  {rank}. ({item['관련도']}) [{item['판정']}] {item['조례명']}  [{item['자치법규일련번호']}]")
        if item.get("목적"):
            print(f"       목적: {item['목적']}")
        target = (item.get("대상") or {}).get("요약")
        if target:
            print(f"       대상: {target}")
