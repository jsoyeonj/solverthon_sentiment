interface Props {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, from, to, total, onChange }: Props) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

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
        {pages.map((num) => (
          <button
            key={num}
            type="button"
            className={num === page ? 'pager__num is-current' : 'pager__num'}
            aria-current={num === page ? 'page' : undefined}
            onClick={() => onChange(num)}
          >
            {num}
          </button>
        ))}
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
