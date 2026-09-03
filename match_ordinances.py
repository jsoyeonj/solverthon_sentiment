"""
임베딩 유사도로 조례 후보 매칭 (Phase 5 — 후보 추출 단계)

build_embeddings.py가 미리 만들어둔 인덱스(<slug>.npy / <slug>_query.npy)만 불러다
코사인 유사도를 계산한다. 여기서는 Voyage API를 호출하지 않는다 — 임계값을 바꿔가며
몇 번을 다시 돌려도 API 요청이 발생하지 않는다.

겹침 여부의 최종 판정(Claude)은 이 스크립트의 범위 밖이다. 여기서는 "후보로 볼 가치가
있는 쌍"만 추려낸다.

사용법:
    python build_embeddings.py mokpo             # 1. 대상 지역 document 인덱스 미리 생성
    python build_embeddings.py boncheong --query  # 2. 질의 지역 query 인덱스 미리 생성
    python match_ordinances.py boncheong mokpo --threshold 0.4   # 3. 후보 추출
"""

import argparse
import json
import os

import numpy as np

import build_embeddings as be
import extract_ordinance as m


def cosine_sim_matrix(query_vecs, doc_vecs):
    q = query_vecs / np.linalg.norm(query_vecs, axis=1, keepdims=True)
    d = doc_vecs / np.linalg.norm(doc_vecs, axis=1, keepdims=True)
    return q @ d.T


def find_candidates(source_slug, target_slug, threshold):
    """source_slug의 query 인덱스 각 조례에 대해, target_slug의 document 인덱스에서
    threshold 이상인 후보를 전부 추출."""
    query_ids, query_vecs = be.load_index(f"{source_slug}_query")
    doc_ids, doc_vecs = be.load_index(target_slug)

    sims = cosine_sim_matrix(query_vecs, doc_vecs)

    candidates = []
    for qi, qid in enumerate(query_ids):
        for di in np.where(sims[qi] >= threshold)[0]:
            candidates.append({
                "source_region": source_slug,
                "source_id": qid,
                "target_region": target_slug,
                "target_id": doc_ids[di],
                "similarity": round(float(sims[qi][di]), 4),
            })
    return candidates


def save_candidates(source_slug, target_slug, candidates):
    out_path = os.path.join(be.EMBED_DIR, f"candidates_{source_slug}_{target_slug}.json")
    m.atomic_write_json(out_path, candidates)
    return out_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="질의 지역 slug — <source>_query.npy가 미리 있어야 함 (예: boncheong)")
    parser.add_argument("target", help="대상 지역 slug — <target>.npy가 미리 있어야 함 (예: mokpo)")
    parser.add_argument("--threshold", type=float, default=0.4)
    args = parser.parse_args()

    candidates = find_candidates(args.source, args.target, args.threshold)
    candidates.sort(key=lambda c: -c["similarity"])

    print(f"{args.source} -> {args.target}: 후보 {len(candidates)}건 (threshold={args.threshold})")
    for c in candidates[:20]:
        print(f"  {c['similarity']:.3f}  {c['source_id']} -> {c['target_id']}")

    out_path = save_candidates(args.source, args.target, candidates)
    print(f"저장: {out_path}")
