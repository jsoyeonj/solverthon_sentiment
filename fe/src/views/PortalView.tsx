import type { Region } from '../types';
import { ALL_STATUSES, STATUS_DESCRIPTION, STATUS_LABEL, STATUS_TONE } from '../lib/status';
import { Icon } from '../components/Icon';

interface Props {
  regions: Region[];
  selectedRegion: string | null;
  onSelectRegion: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  onBrowseAll: () => void;
  totalIndexed: number;
}

export function PortalView({
  regions,
  selectedRegion,
  onSelectRegion,
  query,
  onQueryChange,
  onSearch,
  onBrowseAll,
  totalIndexed,
}: Props) {
  const metro = regions.find((r) => r.type === '광역');
  const localTotal = regions
    .filter((r) => r.type === '기초')
    .reduce((sum, r) => sum + r.totalCount, 0);

  return (
    <div className="portal">
      <div className="portal__inner">
        <h1 className="portal__title">어느 지역의 민원을 처리하시나요?</h1>
        <p className="portal__lead">
          관할 지자체를 선택하시면 광역 및 기초 자치법규 겹침 현황을 대조합니다.
        </p>

        <div className="portal__regions">
          {regions.map((region) => {
            const isSelected = region.id === selectedRegion;
            return (
              <button
                key={region.id}
                type="button"
                className={isSelected ? 'chip is-selected' : 'chip'}
                onClick={() => onSelectRegion(region.id)}
              >
                {isSelected && <Icon name="check" />}
                <span>{region.label}</span>
              </button>
            );
          })}
        </div>

        <div className="searchbar">
          <div className="searchbar__field">
            <Icon name="search" />
            <input
              className="searchbar__input"
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearch();
                }
              }}
              placeholder="예: 귀농 지원금 문의가 들어왔습니다"
              aria-label="조례 검색어"
            />
            {query && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => onQueryChange('')}
                aria-label="검색어 지우기"
              >
                <Icon name="cancel" />
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onSearch}
            disabled={!selectedRegion}
          >
            <span>검색</span>
            <Icon name="arrow_forward" />
          </button>
        </div>

        <button
          type="button"
          className="portal__viewall"
          onClick={onBrowseAll}
          disabled={!selectedRegion}
        >
          검색어 없이 이 지역 전체 보기
        </button>

        <div className="legend">
          <div className="legend__head">
            <div className="legend__title">
              <Icon name="tune" />
              <span>조례 정합성 상태 분류 기준</span>
            </div>
            <span className="legend__note">표준 행정 검토 지침</span>
          </div>
          <div className="legend__grid">
            {ALL_STATUSES.map((status) => (
              <div key={status} className={`legend__cell legend__cell--${STATUS_TONE[status]}`}>
                <span className={`badge badge--square badge--${STATUS_TONE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
                <p>{STATUS_DESCRIPTION[status]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="portal__count">
          본청 {metro?.totalCount.toLocaleString() ?? 0}건 · 파일럿{' '}
          {regions.filter((r) => r.type === '기초').length}개 지자체{' '}
          {localTotal.toLocaleString()}건 · 총 {totalIndexed.toLocaleString()}건 색인
        </div>
      </div>
    </div>
  );
}
