import type { OrdinanceSummary } from '../types';
import { statusBadgeClass } from '../lib/status';
import { isMetroRegion } from '../lib/region';
import { Icon } from './Icon';

interface Props {
  item: OrdinanceSummary;
  onSelect: (id: string) => void;
}

export function OrdinanceCard({ item, onSelect }: Props) {
  const match = item.matchedMetropolitanOrdinance;
  const isNeedCheck = item.status === 'need_check';
  // 본청 자체 조례는 본청과 대조한다는 게 성립하지 않아 판정 배지·비교 버튼이 다 무의미하다.
  const isMetro = isMetroRegion(item.region);

  return (
    <article className="ord-card">
      <div className="ord-card__head">
        <div className="ord-card__titles">
          <div className="ord-card__meta">
            <span>자치법규 {item.id}</span>
            <span className="sep">·</span>
            <span>시행 {item.enforcementDate}</span>
          </div>
          <button type="button" className="ord-card__title" onClick={() => onSelect(item.id)}>
            {item.title}
          </button>
        </div>
        {!isMetro && <span className={statusBadgeClass(item.status)}>{item.statusLabel}</span>}
      </div>

      <p className="ord-card__summary">{item.purpose}</p>

      {match && (
        <div className={isNeedCheck ? 'match-box match-box--attention' : 'match-box'}>
          <Icon name={isNeedCheck ? 'priority_high' : 'sync_alt'} />
          <div className="match-box__content">
            <span className="badge badge--square badge--gray match-box__tag">본청</span>
            <span className="match-box__name wrap-ok">{match.name}</span>
          </div>
        </div>
      )}

      <div className="ord-card__foot">
        <div className="ord-card__dept">
          <span>소관부서: {item.department}</span>
          {item.phone && (
            <>
              <span>·</span>
              <span>{item.phone}</span>
            </>
          )}
        </div>
        {!isMetro && (
          <button type="button" className="btn btn--link" onClick={() => onSelect(item.id)}>
            <span>비교 보기</span>
            <Icon name="arrow_forward" />
          </button>
        )}
      </div>
    </article>
  );
}
