"""
센티멘트 BE — docs/api-contract.md의 3개 엔드포인트.

로직은 전부 search_ordinance.py(저장소 루트)에 있고, 여기서는 HTTP 라우팅과
CORS만 담당한다.

실행:
    python be/main.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import search_ordinance as so

app = FastAPI(title="센티멘트 BE")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://fe-gilt-phi.vercel.app",
    ],
    # Vercel의 fe 프로젝트가 커밋마다 새 preview URL을 만들기 때문에 그것도 허용한다.
    allow_origin_regex=r"https://fe-.*-jsoyeonjs-projects\.vercel\.app",
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/regions")
def get_regions():
    return so.get_regions()


@app.get("/api/ordinances")
def search_ordinances(
    region: str,
    q: str = "",
    status: list[str] = Query(default=[]),
    sort: str = "relevance",
    page: int = 1,
    pageSize: int = 10,
):
    return so.search_api(
        region_id=region,
        query=q,
        statuses=status,
        sort=sort,
        page=page,
        page_size=pageSize,
    )


@app.get("/api/ordinances/{law_id}")
def get_ordinance(law_id: str):
    record = so.get_ordinance_by_id(law_id)
    if record is None:
        raise HTTPException(status_code=404, detail="조례를 찾을 수 없습니다")
    return record


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
