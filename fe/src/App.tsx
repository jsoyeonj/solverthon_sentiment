import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JudgmentStatus, SortKey } from './types';
import { fetchOrdinance, fetchRegions, fetchSearch } from './api/ordinances';
import { ALL_STATUSES } from './lib/status';
import { buildJudgmentText, copyText } from './lib/judgment';
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
const DEFAULT_REGION = '장흥';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('portal');
  const [selectedRegion, setSelectedRegion] = useState<string>(DEFAULT_REGION);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<JudgmentStatus[]>(ALL_STATUSES);
  const [sortBy, setSortBy] = useState<SortKey>('relevance');
  const [page, setPage] = useState(1);
  const [selectedOrdinanceId, setSelectedOrdinanceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const debouncedQuery = useDebounced(query);

  // ---- 데이터 로딩 -------------------------------------------------------

  const regionsState = useAsync((signal) => fetchRegions(signal), []);
  const regions = useMemo(() => regionsState.data ?? [], [regionsState.data]);

  const canSearch = viewMode === 'results';
  const statusKey = statuses.join(',');

  const searchState = useAsync(
    (signal) =>
      canSearch
        ? fetchSearch(
            {
              region: selectedRegion,
              query: debouncedQuery,
              statuses,
              sortBy,
              page,
              pageSize: PAGE_SIZE,
            },
            signal,
          )
        : Promise.resolve(null),
    [canSearch, selectedRegion, debouncedQuery, statusKey, sortBy, page],
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

  const handleSelectRegion = useCallback((id: string) => {
    setSelectedRegion(id);
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

  const openOrdinance = useCallback((id: string) => {
    setSelectedOrdinanceId(id);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 상세가 다른 지역 조례면 선택 지역도 맞춘다 —
  // 안 맞추면 "검색 결과 목록으로 돌아가기"가 엉뚱한 지역 목록을 보여준다.
  const detailRegion = detailState.data?.region;
  useEffect(() => {
    if (detailRegion && detailRegion !== selectedRegion) {
      setSelectedRegion(detailRegion);
      setPage(1);
    }
  }, [detailRegion, selectedRegion]);

  const handleCopyJudgment = useCallback(async () => {
    if (!detailState.data) return;
    await copyText(buildJudgmentText(detailState.data));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }, [detailState.data]);

  const handlePrint = useCallback(() => window.print(), []);

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
          selectedRegion={selectedRegion}
          onSelectRegion={handleSelectRegion}
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
          onBack={() => setViewMode('results')}
          onPrint={handlePrint}
          onCopy={handleCopyJudgment}
          copied={copied}
        />
      );
    }

    return (
      <ResultsView
        regions={regions}
        selectedRegion={selectedRegion}
        onSelectRegion={handleSelectRegion}
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
