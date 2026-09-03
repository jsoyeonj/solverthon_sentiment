import type { JudgmentStatus, Region } from '../types';
import { ALL_STATUSES, STATUS_LABEL, STATUS_TONE } from '../lib/status';
import { Icon } from './Icon';

interface Props {
  regions: Region[];
  selectedRegions: string[];
  onToggleRegion: (id: string) => void;
  statuses: JudgmentStatus[];
  statusCounts: Record<JudgmentStatus, number>;
  onToggleStatus: (status: JudgmentStatus) => void;
  regionTotal: number;
}

export function RegionSidebar({
  regions,
  selectedRegions,
  onToggleRegion,
  statuses,
  statusCounts,
  onToggleStatus,
  regionTotal,
}: Props) {
  const selectedTypes = new Set(
    regions.filter((r) => selectedRegions.includes(r.id)).map((r) => r.type),
  );
  const unitLabel =
    selectedTypes.size > 1
      ? '광역+기초'
      : selectedTypes.has('광역')
        ? '광역단위'
        : '기초단위';

  return (
    <aside className="sidebar">
      <div className="sidebar__stack">
        <div>
          <div className="sidebar__head">
            <h2>
              <Icon name="location_city" />
              관할 지자체 선택
            </h2>
            <span className="sidebar__tag">{unitLabel}</span>
          </div>
          <div className="sidebar__list">
            {regions.map((region) => {
              const isSelected = selectedRegions.includes(region.id);
              const isLastOne = isSelected && selectedRegions.length === 1;
              return (
                <button
                  key={region.id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-disabled={isLastOne}
                  title={isLastOne ? '최소 1개 지역은 선택되어 있어야 합니다' : undefined}
                  className={
                    isSelected
                      ? isLastOne
                        ? 'region-row is-selected is-last'
                        : 'region-row is-selected'
                      : 'region-row'
                  }
                  onClick={() => onToggleRegion(region.id)}
                >
                  <span className="region-row__label">
                    <Icon
                      name={isSelected ? 'check' : region.type === '광역' ? 'apartment' : 'domain'}
                    />
                    <span className="region-row__name">{region.fullName}</span>
                  </span>
                  <span className="region-row__badge">{isSelected ? '선택됨' : region.type}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="divider" />

        <div>
          <div className="sidebar__head">
            <h2>
              <Icon name="tune" />
              판정 필터
            </h2>
            <span className="sidebar__hint">선택 {statuses.length}건</span>
          </div>
          <div className="filter-list">
            {ALL_STATUSES.map((status) => (
              <label key={status} className="filter-row">
                <span className="filter-row__left">
                  <input
                    type="checkbox"
                    checked={statuses.includes(status)}
                    onChange={() => onToggleStatus(status)}
                  />
                  <span className="filter-row__text">{STATUS_LABEL[status]}</span>
                </span>
                <span className={`filter-row__count badge--${STATUS_TONE[status]} badge`}>
                  {statusCounts[status] ?? 0}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="notice">
          <div className="notice__head">
            <Icon name="info" />
            <span>법제 검토 지침 안내</span>
          </div>
          <p>
            광역 자치단체의 위임사무 및 자치사무와 기초자치단체 조례 간 조항 충돌 또는 권한 침해
            여부를 자동 대조합니다.
          </p>
        </div>
      </div>

      <div className="sidebar__foot">
        <div className="sidebar__foot-main">
          <Icon name="verified" />
          <span>전체 {regionTotal}건 조례 정합성 분석 완료</span>
        </div>
        <div className="sidebar__foot-sub">분석엔진 버전: K-Ordinance LexScan v3.2</div>
      </div>
    </aside>
  );
}
