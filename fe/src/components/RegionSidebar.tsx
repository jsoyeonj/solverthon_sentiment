import type { JudgmentStatus, Region } from '../types';
import { ALL_STATUSES, STATUS_LABEL, STATUS_TONE } from '../lib/status';
import { Icon } from './Icon';

interface Props {
  regions: Region[];
  selectedRegion: string;
  onSelectRegion: (id: string) => void;
  statuses: JudgmentStatus[];
  statusCounts: Record<JudgmentStatus, number>;
  onToggleStatus: (status: JudgmentStatus) => void;
  regionTotal: number;
}

export function RegionSidebar({
  regions,
  selectedRegion,
  onSelectRegion,
  statuses,
  statusCounts,
  onToggleStatus,
  regionTotal,
}: Props) {
  const unitLabel = selectedRegion === '본청' ? '광역단위' : '기초단위';

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
              const isSelected = region.id === selectedRegion;
              return (
                <button
                  key={region.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={isSelected ? 'region-row is-selected' : 'region-row'}
                  onClick={() => onSelectRegion(region.id)}
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
