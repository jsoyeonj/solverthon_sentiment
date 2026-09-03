"""
겹침 판정 (Phase 5 — 2단계: Claude 판정)

match_ordinances.py가 뽑아둔 후보(data/embeddings/candidates_<source>_<target>.json)를
Claude에 넣어 겹침 여부를 판정한다. extract_ordinance.py의 Claude Code 헤드리스
호출(`claude -p`)과 파일 캐시를 그대로 재사용한다 — 별도 API 키/과금 없음.

겹침 후보/확인 필요로 판정된 쌍만 data/matches.json에 누적 저장한다
(겹치지 않음은 저장 안 함 — 설계서 Phase 5 규칙).

사용법:
    python match_ordinances.py boncheong mokpo --threshold 0.4   # 먼저 후보 추출
    python judge_matches.py boncheong mokpo --limit 5            # 앞 5건만 (테스트용)
    python judge_matches.py boncheong mokpo                      # 후보 전체 판정
"""

import argparse
import json
import os
import re

import extract_ordinance as m

CANDIDATES_DIR = os.path.join(m.DATA_DIR, "embeddings")
MATCHES_PATH = os.path.join(m.DATA_DIR, "matches.json")

PROMPT = """다음 두 조례가 실질적으로 겹치는지 판정하세요.

## 판정 규칙 (순서대로 적용)
1. 먼저 목적ㆍ대상ㆍ효과를 비교해서 "이 두 조례가 같은 사안을 규율하는가"만 판단하세요.
   제명이 달라도 목적ㆍ대상ㆍ효과가 실질적으로 같으면 같은 사안, 제명이 비슷해도 대상이
   다르면 다른 사안입니다.
2. 다른 사안이면 무조건 "겹치지 않음"입니다. 이때 조례 A나 B에 (이 둘과 무관한) 다른
   조례와의 관계를 정한 우선순위조항이 있더라도 그건 이 판정과 무관하니 무시하세요.
   우선순위조항의 존재 자체가 "확인 필요"의 근거가 되지 않습니다.
3. 같은 사안이면 "겹침 후보"입니다. 단, 그 우선순위조항이 바로 이 두 조례(A와 B) 사이의
   관계를 가리키거나, 둘 중 어느 쪽이 우선 적용되는지 조문만으로 판단하기 애매하면
   "확인 필요"로 바꾸세요.
- "판정"은 "겹침 후보" / "겹치지 않음" / "확인 필요" 중 하나만
- "근거"는 목적ㆍ대상 비교를 바탕으로 1~2문장
- JSON만 출력. 설명ㆍ코드펜스 금지.

## 스키마
{{"판정": "...", "근거": "..."}}

## 조례 A (본청)
제명: {a_name}
목적: {a_purpose}
대상: {a_target}
효과: {a_effect}
우선순위조항: {a_priority}

## 조례 B (지역)
제명: {b_name}
목적: {b_purpose}
대상: {b_target}
효과: {b_effect}
우선순위조항: {b_priority}
"""


def build_prompt(a, b):
    return PROMPT.format(
        a_name=a.get("조례명"), a_purpose=a.get("목적"),
        a_target=(a.get("대상") or {}).get("요약"), a_effect=a.get("효과"),
        a_priority=a.get("우선순위조항") or "없음",
        b_name=b.get("조례명"), b_purpose=b.get("목적"),
        b_target=(b.get("대상") or {}).get("요약"), b_effect=b.get("효과"),
        b_priority=b.get("우선순위조항") or "없음",
    )


def judge_pair(a, b):
    prompt = build_prompt(a, b)
    raw = m.ask_claude_code(prompt)
    if raw is None:
        return None
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print(f"    !! JSON 파싱 실패: {raw[:200]}")
        return None


def run(source_slug, target_slug, limit=None):
    cand_path = os.path.join(CANDIDATES_DIR, f"candidates_{source_slug}_{target_slug}.json")
    candidates = m.read_json(cand_path, [])
    if not candidates:
        print(f"!! {cand_path} 없음 — 먼저 match_ordinances.py로 후보를 뽑으세요")
        return
    if limit:
        candidates = candidates[:limit]

    source_data = m.load_extracted(source_slug)
    target_data = m.load_extracted(target_slug)

    matches = m.read_json(MATCHES_PATH, [])
    done_keys = {(x["본청조례ID"], x["지역조례ID"]) for x in matches}

    saved = 0
    for i, c in enumerate(candidates, 1):
        key = (c["source_id"], c["target_id"])
        if key in done_keys:
            continue
        a = source_data[c["source_id"]]
        b = target_data[c["target_id"]]
        result = judge_pair(a, b)
        if result is None:
            print(f"  ({i}/{len(candidates)}) !! 판정 실패: {a['조례명']} <-> {b['조례명']}")
            continue

        verdict = result.get("판정")
        print(f"  ({i}/{len(candidates)}) [{verdict}] {a['조례명']} <-> {b['조례명']}")

        if verdict == "겹치지 않음":
            continue

        matches.append({
            "본청조례ID": c["source_id"],
            "지역조례ID": c["target_id"],
            "지역명": target_slug,
            "판정": verdict,
            "근거": result.get("근거"),
            "우선순위조항": (b.get("우선순위조항") or []) + (a.get("우선순위조항") or []),
            "본청원문링크": a.get("원문링크"),
            "지역원문링크": b.get("원문링크"),
            "유사도": c["similarity"],
        })
        m.atomic_write_json(MATCHES_PATH, matches)
        saved += 1

    print(f"완료: 이번 실행 {saved}건 저장 (누적 {len(matches)}건) -> {MATCHES_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("target")
    parser.add_argument("--limit", type=int, default=None, help="앞에서부터 N건만 (테스트용)")
    args = parser.parse_args()
    run(args.source, args.target, args.limit)
