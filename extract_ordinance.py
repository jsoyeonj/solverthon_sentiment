"""
조례 스키마 추출 (파일 기반 / Claude Code CLI 버전)

  본청+5개 기초(광주북구/장흥군/목포시/여수시/해남군) 원본 raw 데이터는
  프로젝트 루트에 이미 6개 파일로 존재한다 (RAW_FILES 참고).
  이 원본 파일들은 절대 수정/이동하지 않는다 — 읽기 전용으로만 사용.

사용법:
    .env 파일에 필요하면 LAW_OC를 넣어둔다 (재수집 시에만 사용, 현재 기본
    경로에서는 불필요).
    pip install python-dotenv

    Claude Code CLI가 설치되어 있고(`claude`) 로그인(`claude login`)되어 있어야
    합니다. 별도 ANTHROPIC_API_KEY나 API 과금 없이 Pro/Max 구독 사용량으로
    처리됩니다. (subprocess로 `claude -p`를 헤드리스 모드 호출)

    # 전 지역 추출 (이미 처리된 건은 건너뜀)
    python extract_ordinance.py

    # 지역 하나만 (샘플/검증용)
    python extract_ordinance.py --slug boncheong

    # 광역-기초 제목 매칭 / 우선순위 조항만 뽑기 (LLM 호출 없음, 즉시 끝남)
    python extract_ordinance.py --build-links
    python extract_ordinance.py --build-priority
"""

import os
import re
import json
import time
import hashlib
import tempfile
import argparse
import subprocess

import requests
from dotenv import load_dotenv

load_dotenv()

LAW_OC = os.environ.get("LAW_OC")   # 재수집(fetch_articles 라이브 버전)에만 필요
SEARCH_URL = "https://www.law.go.kr/DRF/lawSearch.do"
DETAIL_URL = "https://www.law.go.kr/DRF/lawService.do"
LAW_BASE   = "https://www.law.go.kr"

CLAUDE_CODE_MODEL = os.environ.get("CLAUDE_CODE_MODEL")   # 미지정 시 CLI 기본 모델
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")        # PATH에 없으면 전체 경로 지정

KND_조례      = "30001"        # 자치법규종류
RRCLS_제정    = "300201"       # 제개정구분

# ---------------------------------------------------------------- 원본 raw 파일 (읽기 전용, 절대 수정 금지)
RAW_FILES = {
    "boncheong": "6130000_boncheong.json",
    "bukgu":     "5780000_bukgu.json",
    "mokpo":     "5780000_mokpo.json",
    "yeosu":     "5785000_yeosu.json",
    "jangheung": "5860000_jangheung.json",
    "haenam":    "5870000_haenam.json",
}
WIDE_SLUG = "boncheong"   # 본청(광역) — 나머지는 기초

DATA_DIR      = "data"
EXTRACTED_DIR = os.path.join(DATA_DIR, "extracted")
LINKS_PATH    = os.path.join(DATA_DIR, "links.json")
PRIORITY_PATH = os.path.join(DATA_DIR, "priority.json")
CACHE_DIR     = os.path.join(DATA_DIR, ".cache")


# ---------------------------------------------------------------- 원자적 파일 쓰기
def _atomic_write(path, data_bytes):
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=directory, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data_bytes)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)   # 같은 디렉터리라 Windows에서도 원자적
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def atomic_write_json(path, obj):
    _atomic_write(path, json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8"))


def atomic_write_text(path, text):
    _atomic_write(path, text.encode("utf-8"))


def read_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------- 유틸
def unwrap(node, key):
    """응답 JSON 어디에 있든 해당 키의 값을 찾아 반환"""
    if isinstance(node, dict):
        if key in node:
            return node[key]
        for v in node.values():
            r = unwrap(v, key)
            if r is not None:
                return r
    elif isinstance(node, list):
        for v in node:
            r = unwrap(v, key)
            if r is not None:
                return r
    return None


def as_list(x):
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


# ---------------------------------------------------------------- 1. 목록 조회 (재수집용, 현재 기본 경로 미사용)
def search(query=None, org=None, sborg=None, anc=None,
           enacted=False, page=1, display=100):
    """
    반환: [{id, mst, name, org, kind, rrcls, anc_date, enforce_date, field, link}]
    """
    params = {
        "OC": LAW_OC, "target": "ordin", "type": "JSON",
        "display": display, "page": page,
        "knd": KND_조례,            # 조례만 (규칙·훈령·고시 제외)
        "nw": 1,                    # 현행
    }
    if query:   params["query"]   = query
    if org:     params["org"]     = org
    if sborg:   params["sborg"]   = sborg
    if anc:     params["ancYd"]   = anc          # 20260701~20260831
    if enacted: params["rrClsCd"] = RRCLS_제정   # 제정만

    r = requests.get(SEARCH_URL, params=params, timeout=20)
    r.raise_for_status()
    d = r.json()

    total = unwrap(d, "totalCnt")
    items = as_list(unwrap(d, "law"))

    out = []
    for it in items:
        link = it.get("자치법규상세링크") or ""
        out.append({
            "id":           str(it.get("자치법규ID") or ""),
            "mst":          str(it.get("자치법규일련번호") or ""),
            "name":         it.get("자치법규명"),
            "org":          it.get("지자체기관명"),
            "kind":         it.get("자치법규종류"),
            "rrcls":        it.get("제개정구분명"),
            "anc_date":     it.get("공포일자"),
            "enforce_date": it.get("시행일자"),
            "field":        it.get("자치법규분야명"),
            "link":         (LAW_BASE + link) if link.startswith("/") else link,
        })
    return out, int(total or 0)


def search_all(**kw):
    """(재수집용, 현재 기본 경로에서는 미사용) 페이지 끝까지 긁기 (display 최대 100)"""
    page, seen = 1, []
    while True:
        rows, total = search(page=page, **kw)
        if not rows:
            break
        seen += rows
        print(f"    {len(seen)}/{total}")
        if len(seen) >= total:
            break
        page += 1
        time.sleep(0.3)
    return seen


# ---------------------------------------------------------------- 2. 조문 파싱 (재수집 라이브 버전 + raw 덤프 어댑터 공용)
def parse_articles(d):
    """법제처 lawService.do 응답(dict)에서 조문 배열을 뽑는다.
    반환: [{"조문": "제4조", "제목": "다른 조례와의 관계", "내용": "..."}]"""
    found = []
    def walk(n):
        if isinstance(n, dict):
            if "조내용" in n:
                found.append(n)
            for v in n.values():
                walk(v)
        elif isinstance(n, list):
            for v in n:
                walk(v)
    walk(d)

    articles = []
    for a in found:
        # 조문여부 N = 편/장/절/관 (제목만 있고 실체 없음) -> 제외
        if str(a.get("조문여부", "Y")).upper() == "N":
            continue
        no_raw = a.get("조문번호")
        if isinstance(no_raw, list):
            no_raw = no_raw[0] if no_raw else None
        no_raw = str(no_raw or "").strip()
        # 조문번호는 "조번호(4자리)+가지번호(2자리)" 6자리 코드 (예: 000100 -> 제1조, 000401 -> 제4조의1)
        if len(no_raw) == 6 and no_raw.isdigit():
            main, sub = int(no_raw[:4]), int(no_raw[4:6])
            label = f"제{main}조" if sub == 0 else f"제{main}조의{sub}"
        else:
            label = f"제{no_raw}조" if no_raw else ""
        articles.append({
            "조문": label,
            "제목": (a.get("조제목") or "").strip(),
            "내용": re.sub(r"\s+", " ", str(a.get("조내용") or "")).strip(),
        })
    return articles


def fetch_articles(law_id=None, mst=None):
    """(재수집용, 현재 기본 경로에서는 미사용) 라이브 API 호출 버전."""
    params = {"OC": LAW_OC, "target": "ordin", "type": "JSON"}
    if law_id:
        params["ID"] = law_id
    else:
        params["MST"] = mst
    r = requests.get(DETAIL_URL, params=params, timeout=20)
    r.raise_for_status()
    return parse_articles(r.json())


def load_raw_dump(slug):
    """루트의 원본 raw 파일(법제처 lawService.do 응답 원본)을 읽기 전용으로 로드해서
    extract()가 쓰는 정규화된 레코드 리스트로 변환한다. 원본 파일은 절대 쓰지 않는다."""
    path = RAW_FILES[slug]
    with open(path, "r", encoding="utf-8") as f:
        dump = json.load(f)

    records = []
    for item in dump:
        basic = item.get("LawService", {}).get("자치법규기본정보", {})
        records.append({
            "id":           str(item.get("_자치법규ID") or basic.get("자치법규ID") or ""),
            "mst":          str(basic.get("자치법규일련번호") or ""),
            "name":         basic.get("자치법규명"),
            "org":          basic.get("지자체기관명"),
            "kind":         basic.get("자치법규종류"),
            "rrcls":        basic.get("제개정구분명"),    # 이 소스엔 없음 -> 항상 None
            "anc_date":     basic.get("공포일자"),
            "enforce_date": basic.get("시행일자"),
            "field":        basic.get("자치법규분야명"),   # 이 소스엔 없음 -> 항상 None
            "dept":         basic.get("담당부서명"),
            "phone":        basic.get("전화번호"),
            "link":         item.get("_원문링크"),
            "articles":     parse_articles(item.get("LawService", {})),
        })
    return records


# ---------------------------------------------------------------- 3. 스키마 추출
PROMPT = """다음은 지방자치단체 조례 조문입니다. 아래 JSON 스키마에 맞춰 정리하세요.

## 규칙
- 조문에 근거가 없는 항목은 반드시 null. 추측 금지.
- "우선순위조항"의 유형: "타조례관계" (다른 조례/법령과의 관계를 정한 조문). 없으면 빈 배열 [].
- "추출특이사항"에는 스키마에 깔끔히 안 들어맞는 애매한 부분이 있으면 짧게 메모. 없으면 null.
- JSON만 출력. 설명·코드펜스 금지.

## 스키마 (자치법규일련번호/조례명/지역은 채우지 마세요 — 시스템이 별도로 채웁니다)
{{
  "목적": "...",
  "대상": {{
    "요약": "...",
    "상세조건": ["...", "..."]
  }},
  "효과": "...",
  "우선순위조항": [
    {{"조문번호": "제3조", "원문": "조문 원문 그대로", "유형": "타조례관계"}}
  ],
  "내부충돌여부": false,
  "추출특이사항": null
}}

## 조례
제명: {제명}
지자체: {지자체}

{조문}
"""


def ask_claude_code(prompt):
    """Claude Code CLI를 헤드리스 모드(`claude -p`)로 호출.
    API 키/종량제 과금 없이 로그인된 Pro/Max 구독 사용량으로 처리됨."""
    key = hashlib.sha256(prompt.encode()).hexdigest()
    cached = cache_get(key)
    if cached is not None:
        return cached

    cmd = [CLAUDE_BIN, "-p"]
    if CLAUDE_CODE_MODEL:
        cmd += ["--model", CLAUDE_CODE_MODEL]

    try:
        result = subprocess.run(
            cmd, input=prompt, capture_output=True,
            text=True, encoding="utf-8", timeout=180,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"    !! claude -p 호출 실패: {e}")
        return None

    if result.returncode != 0:
        print(f"    !! claude -p 오류 (exit {result.returncode}): {result.stderr[:300]}")
        return None

    text = result.stdout.strip()
    cache_set(key, text)
    return text


def extract(record):
    articles = record.get("articles") or []
    if not articles:
        print(f"    !! 조문 없음: {record['name']}")
        return None

    joined = "\n\n".join(
        f"{a['조문']}({a['제목']}) {a['내용']}" for a in articles
    )
    prompt = PROMPT.format(제명=record["name"], 지자체=record["org"], 조문=joined)
    raw = ask_claude_code(prompt)
    if raw is None:
        return None
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.M).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print(f"    !! JSON 파싱 실패: {record['name']}\n{raw[:300]}")
        return None

    # API가 이미 아는 값은 LLM한테 안 물어보고 그대로 채움
    data = {
        "자치법규일련번호": record["mst"],
        "조례명": record["name"],
        "지역": record["org"],
        "목적": data.get("목적"),
        "대상": data.get("대상"),
        "효과": data.get("효과"),
        "우선순위조항": data.get("우선순위조항", []),
        "내부충돌여부": data.get("내부충돌여부"),
        "추출특이사항": data.get("추출특이사항"),
    }

    # 그 외 참조용 메타데이터 (LLM 거치지 않고 API 원본에서 바로)
    data.update({
        "원문링크": record["link"],
        "공포일": record["anc_date"], "시행일": record["enforce_date"],
        "담당부서": record["dept"], "전화번호": record["phone"],
    })

    return data


# ---------------------------------------------------------------- 4. LLM 캐시 (파일 1개당 1키)
def cache_path(key):
    return os.path.join(CACHE_DIR, f"{key}.txt")


def cache_get(key):
    p = cache_path(key)
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return f.read()
    return None


def cache_set(key, text):
    atomic_write_text(cache_path(key), text)


# ---------------------------------------------------------------- 5. extracted/<slug>.json
def extracted_path(slug):
    return os.path.join(EXTRACTED_DIR, f"{slug}.json")


def load_extracted(slug):
    return read_json(extracted_path(slug), {})   # {law_id: data}


def save_extracted(slug, d):
    atomic_write_json(extracted_path(slug), d)


def run_extraction(slugs):
    total = 0
    for slug in slugs:
        print(f"[{slug}]")
        records = load_raw_dump(slug)      # 원본 읽기 전용
        extracted = load_extracted(slug)
        seen = set(extracted)
        pending = [r for r in records if r["id"] not in seen]

        print(f"  {slug}: 시작 시점 {len(seen)}/{len(records)}건 완료, {len(pending)}건 남음")
        elapsed_sum = 0.0
        for i, record in enumerate(pending, 1):
            t0 = time.time()
            data = extract(record)
            elapsed = time.time() - t0
            elapsed_sum += elapsed

            if data:
                extracted[record["id"]] = data
                save_extracted(slug, extracted)   # 성공할 때마다 그 지역 파일만 전체 재저장
                flag = "  <-- 내부충돌!" if data["내부충돌여부"] else ""
                avg = elapsed_sum / i
                remain = len(pending) - i
                eta_min = avg * remain / 60
                print(f"    ({len(seen)+i}/{len(records)}, {elapsed:.1f}초, 평균 {avg:.1f}초, 남은시간 약 {eta_min:.0f}분) "
                      f"{data['지역']} / {data['조례명']}{flag}")
            else:
                print(f"    ({len(seen)+i}/{len(records)}, {elapsed:.1f}초) !! 실패: {record['name']}")

        print(f"  {slug}: 누적 {len(extracted)}/{len(records)}건")
        total += len(extracted)

    print(f"\n완료. 전체 누적 {total}건")


def show_status():
    print(f"{'지역':<10} {'완료':>6} / {'전체':<6}")
    grand_done, grand_total = 0, 0
    for slug in RAW_FILES:
        total = len(load_raw_dump(slug))
        done = len(load_extracted(slug))
        grand_done += done
        grand_total += total
        bar_len = 20
        filled = int(bar_len * done / total) if total else 0
        bar = "#" * filled + "-" * (bar_len - filled)
        print(f"{slug:<10} [{bar}] {done:>6} / {total:<6}")
    print(f"{'전체':<10} {grand_done:>6} / {grand_total:<6}")


# ---------------------------------------------------------------- 6. 광역-기초 제목 매칭
def _org_strip_tokens(org):
    toks = {org}
    toks.update(org.split())
    return toks


def _strip_title(title, tokens):
    pat = "|".join(re.escape(t) for t in sorted(tokens, key=len, reverse=True))
    return re.sub(pat, "", title).strip()


def build_links():
    wide = load_raw_dump(WIDE_SLUG)
    if not wide:
        print(f"!! {RAW_FILES[WIDE_SLUG]} 비어있음")
        return
    wide_org = wide[0]["org"]

    result = {"매칭방식": "제목에서 지자체명 제거 후 정확히 일치하는 것만 매칭", "지역별": {}}
    for slug in RAW_FILES:
        if slug == WIDE_SLUG:
            continue
        records = load_raw_dump(slug)
        if not records:
            continue
        tokens = _org_strip_tokens(wide_org) | _org_strip_tokens(records[0]["org"])

        buckets = {}
        for w in wide:
            buckets.setdefault(_strip_title(w["name"], tokens), {"wide": [], "district": []})["wide"].append(w)
        for d in records:
            buckets.setdefault(_strip_title(d["name"], tokens), {"wide": [], "district": []})["district"].append(d)

        matches = [{"핵심조례명": k, "본청": v["wide"], slug: v["district"]}
                   for k, v in buckets.items() if v["wide"] and v["district"]]
        result["지역별"][slug] = {
            "매칭건수": len(matches), "본청_전체": len(wide), f"{slug}_전체": len(records),
            "매칭목록": matches,
        }

    atomic_write_json(LINKS_PATH, result)
    print(f"{LINKS_PATH} 작성 완료")
    for slug, info in result["지역별"].items():
        print(f"    {slug}: {info['매칭건수']}쌍")


# ---------------------------------------------------------------- 7. 우선순위 조항만 추출
def build_priority():
    out = []
    for slug in RAW_FILES:
        extracted = load_extracted(slug)
        for law_id, data in extracted.items():
            for p in data.get("우선순위조항", []):
                out.append({
                    "지역슬러그": slug, "조례명": data.get("조례명"), "지역": data.get("지역"),
                    "내부충돌여부": data.get("내부충돌여부"),
                    **p,   # 조문번호, 유형, 원문
                })
    atomic_write_json(PRIORITY_PATH, out)
    print(f"{PRIORITY_PATH} 작성 완료 ({len(out)}건)")


# ---------------------------------------------------------------- 실행
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", choices=list(RAW_FILES), help="이 지역만 추출 (기본: 6개 전부)")
    ap.add_argument("--build-links", action="store_true", help="data/links.json만 재생성 (LLM 호출 없음)")
    ap.add_argument("--build-priority", action="store_true", help="data/priority.json만 재생성 (LLM 호출 없음)")
    ap.add_argument("--status", action="store_true", help="지역별 진행 상황만 조회하고 종료 (다른 터미널에서 실행 중에 확인용)")
    args = ap.parse_args()

    if args.status:
        show_status()
        return
    if args.build_links:
        build_links()
        return
    if args.build_priority:
        build_priority()
        return

    slugs = [args.slug] if args.slug else list(RAW_FILES)
    run_extraction(slugs)


if __name__ == "__main__":
    main()
