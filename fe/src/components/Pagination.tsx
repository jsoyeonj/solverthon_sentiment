interface Props {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onChange: (page: number) => void;
}

const ELLIPSIS = 'ellipsis' as const;
type PageToken = number | typeof ELLIPSIS;

/**
 * 첫 페이지·마지막 페이지·현재 페이지 주변만 보여주고 나머지는 "…"로 접는다.
 * 실 데이터는 지역당 수백 건이라 페이지가 수십~수백 개가 될 수 있어
 * 버튼을 전부 그리면 안 된다 (본청 366건, 북구 533건 등 — 설계서 3장 참고).
 */
function buildPageWindow(page: number, totalPages: number, siblings = 3): PageToken[] {
  const first = 1;
  const last = totalPages;
  const start = Math.max(first + 1, page - siblings);
  const end = Math.min(last - 1, page + siblings);

  const tokens: PageToken[] = [first];
  if (start > first + 1) tokens.push(ELLIPSIS);
  for (let p = start; p <= end; p++) tokens.push(p);
  if (end < last - 1) tokens.push(ELLIPSIS);
  if (last > first) tokens.push(last);
  return tokens;
}

export function Pagination({ page, totalPages, from, to, total, onChange }: Props) {
  const tokens = buildPageWindow(page, totalPages);

  return (
    <div className="pager">
      <span>
        표시 건수: {from} - {to} / 총 {total}건
      </span>
      <div className="pager__nav">
        <button
          type="button"
          className="pager__btn"
          disabled={page === 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          이전
        </button>
        {tokens.map((token, i) =>
          token === ELLIPSIS ? (
            <span key={`ellipsis-${i}`} className="pager__ellipsis">
              …
            </span>
          ) : (
            <button
              key={token}
              type="button"
              className={token === page ? 'pager__num is-current' : 'pager__num'}
              aria-current={token === page ? 'page' : undefined}
              onClick={() => onChange(token)}
            >
              {token}
            </button>
          ),
        )}
        <button
          type="button"
          className="pager__btn"
          disabled={page === totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
        >
          다음
        </button>
      </div>
    </div>
  );
}
