"""
Voyage AI로 조례 임베딩 만들기 (Phase 4)

data/extracted/<slug>.json (목적+대상.요약)을 읽어서 지역별 임베딩 인덱스를
data/embeddings/<slug>.npy(벡터) + data/embeddings/<slug>_ids.json(조례ID 순서)로 저장한다.
raw 원본 파일도, extracted 파일도 여기서는 읽기만 하고 절대 쓰지 않는다.

사용법:
    .env에 VOYAGE_API_KEY 추가 (voyageai.com 발급)
    pip install numpy requests

    python build_embeddings.py                 # data/extracted/에 있는 지역 전부 (document 인덱스)
    python build_embeddings.py boncheong bukgu  # 지정한 지역만
    python build_embeddings.py boncheong --query  # 본청을 질의용으로 임베딩 (Phase 5 매칭 전 미리 캐시)

유사도 비교/후보 추출은 여기서 하지 않는다. match_ordinances.py에서 이 인덱스들만 불러다 계산한다.
"""

import os
import sys
import json
import time

import requests
import numpy as np
from dotenv import load_dotenv

import extract_ordinance as m

load_dotenv()

VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")
VOYAGE_MODEL = os.environ.get("VOYAGE_MODEL", "voyage-multilingual-2")
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"

# Voyage 계정에 결제수단 미등록 시 3 RPM / 10K TPM으로 제한됨(실측).
# 결제수단 등록 후엔 .env에서 VOYAGE_BATCH_SIZE↑, VOYAGE_REQUEST_INTERVAL↓로 완화 가능.
BATCH_SIZE = int(os.environ.get("VOYAGE_BATCH_SIZE", "25"))
REQUEST_INTERVAL = float(os.environ.get("VOYAGE_REQUEST_INTERVAL", "21"))
MAX_RETRIES = 5

EMBED_DIR = os.path.join(m.DATA_DIR, "embeddings")


def embed_texts(texts, input_type="document"):
    """Voyage AI로 텍스트 목록을 임베딩. BATCH_SIZE개씩 배치로 나눠서 호출.
    429(레이트리밋)를 만나면 대기 후 재시도하고, 배치 사이에도 간격을 둬서 미리 피한다."""
    if not VOYAGE_API_KEY:
        raise RuntimeError("VOYAGE_API_KEY가 .env에 없습니다. voyageai.com에서 발급받아 추가하세요.")

    vectors = []
    for i in range(0, len(texts), BATCH_SIZE):
        chunk = texts[i:i + BATCH_SIZE]
        for attempt in range(MAX_RETRIES):
            resp = requests.post(
                VOYAGE_URL,
                headers={"Authorization": f"Bearer {VOYAGE_API_KEY}"},
                json={"input": chunk, "model": VOYAGE_MODEL, "input_type": input_type},
                timeout=60,
            )
            if resp.status_code == 429 and attempt < MAX_RETRIES - 1:
                wait = REQUEST_INTERVAL * (attempt + 1)
                print(f"    !! 429 레이트리밋, {wait:.0f}초 대기 후 재시도")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            break
        items = sorted(resp.json()["data"], key=lambda d: d["index"])
        vectors.extend(item["embedding"] for item in items)
        print(f"    임베딩 {min(i + BATCH_SIZE, len(texts))}/{len(texts)}")
        if i + BATCH_SIZE < len(texts):
            time.sleep(REQUEST_INTERVAL)
    return vectors


def embedding_text(data):
    """extracted 레코드 하나에서 임베딩할 텍스트를 조립: 목적 + 대상.요약."""
    parts = [
        data.get("목적") or "",
        (data.get("대상") or {}).get("요약") or "",
    ]
    return " ".join(p for p in parts if p).strip()


def save_index(slug, ids, vectors):
    os.makedirs(EMBED_DIR, exist_ok=True)
    vec_path = os.path.join(EMBED_DIR, f"{slug}.npy")
    ids_path = os.path.join(EMBED_DIR, f"{slug}_ids.json")

    arr = np.array(vectors, dtype=np.float32)
    tmp_vec_path = os.path.join(EMBED_DIR, f".tmp-{slug}.npy")
    np.save(tmp_vec_path, arr)   # 이미 .npy로 끝나므로 numpy가 확장자 중복 안 붙임
    os.replace(tmp_vec_path, vec_path)

    m.atomic_write_json(ids_path, ids)
    return vec_path, arr.shape


def _load_texts(slug):
    """extracted/<slug>.json에서 (조례ID 목록, 임베딩 텍스트 목록)을 뽑는다."""
    extracted = m.load_extracted(slug)
    if not extracted:
        print(f"[{slug}] !! data/extracted/{slug}.json 비어있음, 스킵")
        return [], []

    ids, texts, skipped = [], [], 0
    for law_id, data in extracted.items():
        text = embedding_text(data)
        if not text:
            skipped += 1
            continue
        ids.append(law_id)
        texts.append(text)

    if skipped:
        print(f"[{slug}] !! {skipped}건 스킵 (목적/대상 없음 — 스키마 확인 필요)")
    return ids, texts


def build_index(slug):
    """slug 지역 조례 전체를 document로 임베딩해 <slug>.npy로 저장 (Phase 4/6: 지역 전체 인덱스)."""
    ids, texts = _load_texts(slug)
    if not texts:
        print(f"[{slug}] 임베딩할 텍스트 없음")
        return

    print(f"[{slug}] {len(texts)}건 임베딩 시작")
    vectors = embed_texts(texts, input_type="document")
    vec_path, shape = save_index(slug, ids, vectors)
    print(f"[{slug}] 완료: {vec_path} {shape}")


def build_query_index(slug):
    """slug 지역 조례 전체를 query로 임베딩해 <slug>_query.npy로 저장
    (Phase 5: 이 지역을 다른 지역 인덱스에 대한 질의로 쓸 때 미리 계산해두는 캐시)."""
    ids, texts = _load_texts(slug)
    if not texts:
        print(f"[{slug}] 임베딩할 텍스트 없음")
        return

    print(f"[{slug}] {len(texts)}건 쿼리 임베딩 시작")
    vectors = embed_texts(texts, input_type="query")
    vec_path, shape = save_index(f"{slug}_query", ids, vectors)
    print(f"[{slug}] 완료: {vec_path} {shape}")


def embed_query(text):
    """Phase 6 실시간 검색용 — 검색어 하나를 쿼리로 임베딩해서 벡터 하나를 반환."""
    return embed_texts([text], input_type="query")[0]


def load_index(slug):
    """저장된 인덱스를 다시 불러올 때 씀 (Phase 5/6에서 사용)."""
    vec_path = os.path.join(EMBED_DIR, f"{slug}.npy")
    ids_path = os.path.join(EMBED_DIR, f"{slug}_ids.json")
    vectors = np.load(vec_path)
    ids = m.read_json(ids_path, [])
    return ids, vectors


if __name__ == "__main__":
    args = sys.argv[1:]
    as_query = "--query" in args
    slugs = [a for a in args if a != "--query"] or list(m.RAW_FILES)
    for slug in slugs:
        build_query_index(slug) if as_query else build_index(slug)
