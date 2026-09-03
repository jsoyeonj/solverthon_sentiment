import type { JudgmentStatus, Region, SearchResult, SortKey } from '../types';
import { RECOMMENDED_TAGS, SUGGESTION_WORDS } from '../api/mock/fixtures';
import { Icon } from '../components/Icon';
import { OrdinanceCard } from '../components/OrdinanceCard';
import { Pagination } from '../components/Pagination';
import { RegionSidebar } from '../components/RegionSidebar';
import { ErrorBanner, LoadingBanner } from '../components/StateBanner';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'latest', label: '최신순' },
  { key: 'relevance', label: '관련도순' },
  { key: 'name', label: '조례명순' },
];

interface Props {
  regions: Region[];
  selectedRegions: string[];
  onToggleRegion: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onRerun: () => void;
  statuses: JudgmentStatus[];
  onToggleStatus: (status: JudgmentStatus) => void;
  sortBy: SortKey;
  onSortChange: (sort: SortKey) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  result: SearchResult | null;
  loading: boolean;
  error: string | null;
  onSelectOrdinance: (id: string) => void;
  onBackToPortal: () => void;
  onResetFilters: () => void;
}

/** 선택된 지역 이름 표시. 여러 개면 "장흥군 외 2곳" 형태로 줄인다. */
function regionLabel(regions: Region[], selectedRegions: string[]): string {
  const names = selectedRegions.map((id) => regions.find((r) => r.id === id)?.name ?? id);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names[0]} 외 ${names.length - 1}곳`;
}

export function ResultsView(props: Props) {
  const {
    regions,
    selectedRegions,
    onToggleRegion,
    query,
    onQueryChange,
    onRerun,
    statuses,
    onToggleStatus,
    sortBy,
    onSortChange,
    page,
    pageSize,
    onPageChange,
    result,
    loading,
    error,
    onSelectOrdinance,
    onBackToPortal,
    onResetFilters,
  } = props;

  const regionName = regionLabel(regions, selectedRegions);

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const regionTotal = result?.regionTotal ?? 0;
  const statusCounts =
    result?.statusCounts ?? ({ overlap_candidate: 0, need_check: 0, no_overlap: 0 } as Record<
      JudgmentStatus,
      number
    >);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="view">
      <div className="subbar">
        <div className="subbar__inner">
          <div className="subbar__line">
            <Icon name="account_balance" />
            <span className="subbar__strong">광역-기초 법령 정합성 검증</span>
            <span className="sep">/</span>
            <span className="wrap-ok">전라남도·광주광역시 통합 자치법규 통합 데이터베이스</span>
          </div>
          <div className="subbar__sync">
            <span className="dot" />
            <span className="wrap-ok">
              국가법령정보센터 실시간 동기화 (최근 갱신: 2025. 02. 24 09:30)
            </span>
          </div>
        </div>
      </div>

      <div className="results">
        <RegionSidebar
          regions={regions}
          selectedRegions={selectedRegions}
          onToggleRegion={onToggleRegion}
          statuses={statuses}
          statusCounts={statusCounts}
          onToggleStatus={onToggleStatus}
          regionTotal={regionTotal}
        />

        <main className="results__main">
          <div className="results__sticky">
            <div className="querybar">
              <div className="querybar__left">
                <span className="region-tag">
                  <Icon name="pin_drop" />
                  <span className="nowrap">지역: {regionName}</span>
                  <button
                    type="button"
                    className="region-tag__close"
                    title="지역 선택 초기화"
                    onClick={onBackToPortal}
                  >
                    <Icon name="close" />
                  </button>
                </span>
                <span className="sep">|</span>
                <div className="querybar__field">
                  <Icon name="search" />
                  <input
                    className="querybar__input"
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onRerun();
                      }
                    }}
                    placeholder="조례 제명, 조항 내용 또는 키워드를 입력하세요"
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
              </div>
              <button type="button" className="btn btn--primary" onClick={onRerun}>
                <Icon name="search" />
                <span>검색</span>
              </button>
            </div>
          </div>

          <div className="results__meta">
            <div className="results__meta-left">
              <h2>
                {regionName} 조례{' '}
                <span className={total > 0 ? 'results__count' : 'results__count is-empty'}>
                  {total}건
                </span>
              </h2>
              <span className="bullet" />
              <span className="results__meta-note">대조 기준: 전남광주통합특별시 자치법규</span>
            </div>
            <div className="sorts">
              {SORTS.map((sort, i) => (
                <span key={sort.key} style={{ display: 'inline-flex', gap: 8 }}>
                  {i > 0 && <span className="sep">|</span>}
                  <button
                    type="button"
                    className={sortBy === sort.key ? 'sort-btn is-active' : 'sort-btn'}
                    onClick={() => onSortChange(sort.key)}
                  >
                    {sort.label}
                    {sortBy === sort.key && ' ✓'}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {loading && <LoadingBanner label="조례를 검색하는 중입니다…" />}
          {error && <ErrorBanner message={error} />}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="cards">
                {items.map((item) => (
                  <OrdinanceCard key={item.id} item={item} onSelect={onSelectOrdinance} />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                from={from}
                to={to}
                total={total}
                onChange={onPageChange}
              />
            </>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="empty">
              <div className="empty__icon">
                <Icon name="search_off" />
              </div>
              <h3>검색 결과가 없습니다. 다른 표현으로 다시 검색해 보세요.</h3>
              <p>
                입력하신 검색어의 철자를 확인하시거나,{' '}
                {SUGGESTION_WORDS.map((word, i) => (
                  <span key={word}>
                    {i > 0 && ', '}
                    <button
                      type="button"
                      className="empty__word"
                      onClick={() => onQueryChange(word)}
                    >
                      '{word}'
                    </button>
                  </span>
                ))}{' '}
                등 보다 일반적인 행정 용어로 검색해 보세요.
              </p>
              <div className="empty__tags">
                <span className="empty__tags-label">추천 검색어:</span>
                {RECOMMENDED_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-btn"
                    onClick={() => onQueryChange(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="empty__reset">
                <button type="button" className="btn" onClick={onResetFilters}>
                  <Icon name="list_alt" />
                  <span>
                    {regionName} 전체 조례 목록 보기 ({regionTotal}건)
                  </span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
