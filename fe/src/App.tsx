import { useCallback, useMemo, useState } from 'react';
import type { JudgmentStatus, SortKey } from './types';
import { fetchOrdinance, fetchRegions, fetchSearch } from './api/ordinances';
import { ALL_STATUSES } from './lib/status';
import { useAsync } from './hooks/useAsync';
import { useDebounced } from './hooks/useDebounced';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ErrorBanner, LoadingBanner } from './components/StateBanner';
import { PortalView } from './views/PortalView';
import { ResultsView } from './views/ResultsView';
import { DetailView } from './views/DetailView';

/** 포털(지역 선택) → 결과 목록 → 상세. */
type ViewMode = 'portal' | 'results' | 'detail';

const PAGE_SIZE = 5;
const DEFAULT_REGIONS = ['장흥'];

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('portal');
  const [selectedRegions, setSelectedRegions] = useState<string[]>(DEFAULT_REGIONS);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<JudgmentStatus[]>(ALL_STATUSES);
  const [sortBy, setSortBy] = useState<SortKey>('relevance');
  const [page, setPage] = useState(1);
  /**
   * 상세 화면 이동 이력. 검색 결과에서 카드를 누르면 [id] 하나로 리셋되고,
   * 상세 화면 안에서 본청 조례 등 다른 조례로 넘어가면 뒤에 쌓인다 —
   * "뒤로가기"가 검색 결과가 아니라 방금 보던 조례로 돌아가야 하기 때문.
   */
  const [ordinanceStack, setOrdinanceStack] = useState<string[]>([]);
  const selectedOrdinanceId = ordinanceStack.at(-1) ?? null;
  const isNestedDetail = ordinanceStack.length > 1;

  const debouncedQuery = useDebounced(query);

  // ---- 데이터 로딩 -------------------------------------------------------

  const regionsState = useAsync((signal) => fetchRegions(signal), []);
  const regions = useMemo(() => regionsState.data ?? [], [regionsState.data]);

  const canSearch = viewMode === 'results';
  const statusKey = statuses.join(',');
  const regionsKey = selectedRegions.join(',');

  const searchState = useAsync(
    (signal) =>
      canSearch
        ? fetchSearch(
            {
              regions: selectedRegions,
              query: debouncedQuery,
              statuses,
              sortBy,
              page,
              pageSize: PAGE_SIZE,
            },
            signal,
          )
        : Promise.resolve(null),
    [canSearch, regionsKey, debouncedQuery, statusKey, sortBy, page],
  );

  const needsDetail = viewMode === 'detail' && selectedOrdinanceId !== null;
  const detailState = useAsync(
    (signal) =>
      needsDetail && selectedOrdinanceId
        ? fetchOrdinance(selectedOrdinanceId, signal)
        : Promise.resolve(null),
    [needsDetail, selectedOrdinanceId],
  );

  // ---- 이벤트 -----------------------------------------------------------

  const goHome = useCallback(() => setViewMode('portal'), []);

  /** 최소 1개는 남긴다 — 다 해제되면 검색할 지역이 없어진다. */
  const handleToggleRegion = useCallback((id: string) => {
    setSelectedRegions((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((r) => r !== id) : prev;
      }
      return [...prev, id];
    });
    setPage(1);
  }, []);

  const runSearch = useCallback((nextQuery?: string) => {
    if (nextQuery !== undefined) setQuery(nextQuery);
    setViewMode('results');
    setPage(1);
  }, []);

  const handleQueryChange = useCallback((next: string) => {
    setQuery(next);
    setPage(1);
  }, []);

  const handleToggleStatus = useCallback((status: JudgmentStatus) => {
    setStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
    setPage(1);
  }, []);

  const handleSortChange = useCallback((next: SortKey) => {
    setSortBy(next);
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setQuery('');
    setStatuses(ALL_STATUSES);
    setPage(1);
  }, []);

  /** 검색 결과 카드를 눌러 들어갈 때 — 새로 시작하는 것이므로 이력을 리셋한다. */
  const openOrdinance = useCallback((id: string) => {
    setOrdinanceStack([id]);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /** 상세 화면 안에서 다른 조례(본청 대조표 등)로 넘어갈 때 — 이력에 쌓는다. */
  const openRelatedOrdinance = useCallback((id: string) => {
    setOrdinanceStack((prev) => [...prev, id]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /** 이력이 남아있으면 그 조례로, 없으면 검색 결과로 돌아간다. */
  const goBackFromDetail = useCallback(() => {
    if (isNestedDetail) {
      setOrdinanceStack((prev) => prev.slice(0, -1));
    } else {
      setViewMode('results');
    }
  }, [isNestedDetail]);

  const totalIndexed = useMemo(
    () => regions.reduce((sum, region) => sum + region.totalCount, 0),
    [regions],
  );

  // ---- 렌더 -------------------------------------------------------------

  function renderBody() {
    if (regionsState.loading) return <LoadingBanner label="지자체 목록을 불러오는 중입니다…" />;
    if (regionsState.error) return <ErrorBanner message={regionsState.error} />;

    if (viewMode === 'portal') {
      return (
        <PortalView
          regions={regions}
          selectedRegions={selectedRegions}
          onToggleRegion={handleToggleRegion}
          query={query}
          onQueryChange={setQuery}
          onSearch={() => runSearch()}
          onBrowseAll={() => runSearch('')}
          totalIndexed={totalIndexed}
        />
      );
    }

    if (viewMode === 'detail') {
      if (detailState.loading) return <LoadingBanner label="조례 상세를 불러오는 중입니다…" />;
      if (detailState.error) return <ErrorBanner message={detailState.error} />;
      if (!detailState.data) return <ErrorBanner message="조례 정보를 찾을 수 없습니다." />;
      return (
        <DetailView
          ordinance={detailState.data}
          onBack={goBackFromDetail}
          backLabel={isNestedDetail ? '이전 화면으로 돌아가기' : '검색 결과 목록으로 돌아가기'}
          onOpenOrdinance={openRelatedOrdinance}
        />
      );
    }

    return (
      <ResultsView
        regions={regions}
        selectedRegions={selectedRegions}
        onToggleRegion={handleToggleRegion}
        query={query}
        onQueryChange={handleQueryChange}
        onRerun={() => setPage(1)}
        statuses={statuses}
        onToggleStatus={handleToggleStatus}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        result={searchState.data}
        loading={searchState.loading}
        error={searchState.error}
        onSelectOrdinance={openOrdinance}
        onBackToPortal={() => setViewMode('portal')}
        onResetFilters={handleResetFilters}
      />
    );
  }

  return (
    <div className="app">
      <Header onGoHome={goHome} />
      <main className="main">{renderBody()}</main>
      <Footer />
    </div>
  );
}
