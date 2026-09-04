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
import glob
import os

import numpy as np

import extract_ordinance as m
import build_embeddings as be

MATCHES_GLOB = os.path.join(m.DATA_DIR, "matches*.json")

# 실측 데이터 기준: judge_matches.py 프롬프트는 "겹침 후보"를 요청하지만 Claude가 저장한
# data/matches*.json에는 전부 "겹침"(후보 없이)으로 들어있다. 둘 다 받아둔다.
VERDICT_NORMALIZE = {
    "겹침 후보": "겹침후보",
    "겹침": "겹침후보",
    "확인 필요": "확인필요",
}

# FE region id(한글) <-> 파이프라인 slug. fe/src/api/mock/fixtures.ts의 REGIONS와 동일한 값.
#
# 북구/여수/해남은 추출 데이터가 없거나(여수·해남) 극히 일부만 있어서(북구 38/533),
# 목포는 matches_mokpo.json이 현재 추출 데이터 기준과 어긋나서 데이터가 준비될 때까지
# 임시로 목록에서 뺀다. data/extracted, data/matches_mokpo.json 등 원본은 그대로 둔다 —
# 다시 준비되면 여기 항목만 되돌리면 된다.
REGION_INFO = {
    "boncheong": {"id": "본청", "name": "본청", "fullName": "본청 (전남광주통합특별시)",
                  "label": "본청(전남광주통합특별시)", "type": "광역", "totalCount": 366},
    "jangheung": {"id": "장흥", "name": "장흥군", "fullName": "장흥군",
                  "label": "장흥", "type": "기초", "totalCount": 455},
}
REGION_ID_TO_SLUG = {info["id"]: slug for slug, info in REGION_INFO.items()}


def get_regions():
    return list(REGION_INFO.values())


def cosine_sims(query_vec, vectors):
    q = np.asarray(query_vec, dtype=np.float32)
    q = q / (np.linalg.norm(q) + 1e-8)
    v = vectors / (np.linalg.norm(vectors, axis=1, keepdims=True) + 1e-8)
    return v @ q


def _load_all_matches():
    """data/matches.json, data/matches_<region>.json 등 매칭 결과 파일을 전부 합친다."""
    matches = []
    for path in sorted(glob.glob(MATCHES_GLOB)):
        matches.extend(m.read_json(path, []))
    return matches


def _matches_by_region_id(slug):
    """slug 지역 겹침 판정을 지역조례ID(=인덱스 키) 기준으로 묶는다."""
    by_id = {}
    for entry in _load_all_matches():
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
    # 매칭이 있으면 judge_matches.py가 본청·지역 양쪽 우선순위조항을 "출처"로 표시해
    # 합쳐둔 목록을 쓴다(대조 맥락에서 더 유용) — 없으면 이 조례 자신의 조항만.
    priority_clauses = data.get("우선순위조항") or []
    if match_entry and match_entry.get("우선순위조항"):
        priority_clauses = match_entry["우선순위조항"]

    record = {
        "자치법규일련번호": data.get("자치법규일련번호", law_id),
        "조례명": data.get("조례명"),
        "지역": data.get("지역"),
        "목적": data.get("목적"),
        "대상": data.get("대상"),
        "효과": data.get("효과"),
        "우선순위조항": priority_clauses,
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


def _text_matches(data, q_lower):
    """임베딩 인덱스가 없는 지역용 폴백 — fe/src/api/mock/index.ts의 matchesQuery와 동일 기준."""
    haystack = [
        data.get("조례명") or "",
        data.get("목적") or "",
        data.get("효과") or "",
        (data.get("대상") or {}).get("요약") or "",
    ]
    haystack += (data.get("대상") or {}).get("상세조건") or []
    return any(q_lower in h.lower() for h in haystack)


def get_ordinance_by_id(law_serial_no):
    """자치법규일련번호(MST, extracted 안쪽 필드)로 6개 지역을 전부 뒤져 상세 레코드 1건을 찾는다."""
    for slug in m.RAW_FILES:
        extracted = m.load_extracted(slug)
        for law_id, data in extracted.items():
            if data.get("자치법규일련번호", law_id) != law_serial_no:
                continue
            matches_by_id = _matches_by_region_id(slug)
            match_entry = matches_by_id.get(law_id)
            boncheong_extracted = m.load_extracted("boncheong") if match_entry else {}
            relevance = match_entry.get("유사도") if match_entry else None
            return build_record(law_id, data, relevance, match_entry, boncheong_extracted)
    return None


def search_api(region_id, query="", statuses=None, sort="relevance", page=1, page_size=10, threshold=0.32:
    """GET /api/ordinances 구현. 반환값은 SearchResponseDto와 같은 모양.

    query가 비어 있으면 브라우징 모드(해당 지역 전체, 임베딩 호출 없음).
    임베딩 인덱스가 없는 지역은 부분 문자열 검색으로 대체한다(항상 응답이 나가야 함).
    statusCounts/regionTotal은 status 필터와 무관하게 지역 전체 기준으로 센다.
    """
    empty = {"items": [], "total": 0, "regionTotal": 0,
              "statusCounts": {"겹침후보": 0, "확인필요": 0, "겹침없음": 0}}
    slug = REGION_ID_TO_SLUG.get(region_id)
    if slug is None:
        return empty

    extracted = m.load_extracted(slug)
    matches_by_id = _matches_by_region_id(slug)
    boncheong_extracted = m.load_extracted("boncheong") if matches_by_id else {}

    def record_for(law_id, data, relevance=None):
        return build_record(law_id, data, relevance, matches_by_id.get(law_id), boncheong_extracted)

    region_items = [record_for(law_id, data) for law_id, data in extracted.items()]

    query = (query or "").strip()
    if not query:
        query_items = region_items
    else:
        query_items = []
        try:
            ids, vectors = be.load_index(slug)
        except FileNotFoundError:
            ids, vectors = None, None

        sims = None
        if vectors is not None and len(ids):
            try:
                sims = cosine_sims(be.embed_query(query), vectors)
            except Exception as exc:
                # Voyage 레이트리밋(무료 3RPM) 등으로 임베딩 호출이 끝내 실패해도
                # 검색 자체는 죽지 않아야 한다 — 문자열 검색으로 대체.
                print(f"[search_api] 임베딩 검색 실패, 문자열 검색으로 대체: {exc}")

        if sims is not None:
            for idx, law_id in enumerate(ids):
                sim = float(sims[idx])
                if sim < threshold:
                    continue
                query_items.append(record_for(law_id, extracted.get(law_id, {}), sim))
        else:
            q_lower = query.lower()
            for law_id, data in extracted.items():
                if _text_matches(data, q_lower):
                    query_items.append(record_for(law_id, data))

    # 검색어(브라우징 모드면 지역 전체) 결과 기준 — status 체크박스 필터는 반영하지 않는다.
    status_counts = {"겹침후보": 0, "확인필요": 0, "겹침없음": 0}
    for it in query_items:
        status_counts[it["판정"]] = status_counts.get(it["판정"], 0) + 1

    # statuses가 None이면(파라미터 자체를 안 보낸 호출) 필터 없이 전체를 보여준다.
    # statuses가 빈 리스트([])면 — FE 체크박스 3개를 전부 해제한 상태라는 뜻이므로
    # "필터 없음"이 아니라 "아무 것도 선택 안 함 = 결과 0건"으로 처리해야 한다.
    # (파이썬에서 빈 리스트는 falsy라 `if statuses`로만 판단하면 이 둘이 뒤섞인다.)
    if statuses is None:
        filtered = list(query_items)
    else:
        wanted = set(statuses)
        filtered = [it for it in query_items if it["판정"] in wanted]

    if sort == "latest":
        filtered.sort(key=lambda it: it.get("시행일") or "", reverse=True)
    elif sort == "name":
        filtered.sort(key=lambda it: it.get("조례명") or "")
    else:
        filtered.sort(key=lambda it: it.get("관련도") if it.get("관련도") is not None else -1, reverse=True)

    page = max(page, 1)
    start = (page - 1) * page_size
    return {
        "items": filtered[start:start + page_size],
        "total": len(filtered),
        "regionTotal": len(extracted),
        "statusCounts": status_counts,
    }


def search(slug, query_text, threshold=0.32:
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
    parser.add_argument("--threshold", type=float, default=0.32 help="이 값 이상만 출력 (기본 0.32")
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
