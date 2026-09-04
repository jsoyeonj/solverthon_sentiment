import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JudgmentStatus, SortKey } from './types';
import { fetchOrdinance, fetchRegions, fetchSearch } from './api/ordinances';
import { ALL_STATUSES } from './lib/status';
import { useAsync } from './hooks/useAsync';
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

/** 브라우저 세션 히스토리 한 칸에 실어 보내는 스냅샷 — popstate 때 이걸로 화면을 복원한다. */
interface NavSnapshot {
  viewMode: ViewMode;
  selectedRegion: string;
  query: string;
  submittedQuery: string;
  statuses: JudgmentStatus[];
  sortBy: SortKey;
  page: number;
  ordinanceStack: string[];
}

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('portal');
  const [selectedRegion, setSelectedRegion] = useState<string>(DEFAULT_REGION);
  /** 입력창에 보이는 값. 타이핑만으로는 검색을 다시 부르지 않는다. */
  const [query, setQuery] = useState('');
  /** 실제로 검색에 쓰이는 확정된 검색어 — 엔터/검색 버튼/추천어 클릭 때만 바뀐다. */
  const [submittedQuery, setSubmittedQuery] = useState('');
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

  // ---- 브라우저 뒤로가기 연동 -----------------------------------------
  //
  // 화면 전환(포털→결과→상세, 상세 안에서 본청으로 이동)마다 history 엔트리를
  // 하나씩 쌓는다. 그래야 브라우저 자체 "뒤로가기" 버튼이 앱을 벗어나 곧장
  // 이전 사이트로 가버리지 않고, 방금 보던 화면으로 돌아온다. popstate로
  // 복원할 때 이 effect가 또 push하면 무한히 어긋나므로 skipNextPushRef로
  // "이건 되돌아온 거라 새로 쌓지 마" 표시를 해둔다.
  const skipNextPushRef = useRef(false);

  useEffect(() => {
    history.replaceState(
      {
        viewMode,
        selectedRegion,
        query,
        submittedQuery,
        statuses,
        sortBy,
        page,
        ordinanceStack,
      } satisfies NavSnapshot,
      '',
    );

    const onPopState = (e: PopStateEvent) => {
      const s = e.state as NavSnapshot | null;
      if (!s) return;
      skipNextPushRef.current = true;
      setViewMode(s.viewMode);
      setSelectedRegion(s.selectedRegion);
      setQuery(s.query);
      setSubmittedQuery(s.submittedQuery);
      setStatuses(s.statuses);
      setSortBy(s.sortBy);
      setPage(s.page);
      setOrdinanceStack(s.ordinanceStack);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // 최초 마운트 시점 스냅샷만 시작점으로 쓰면 되고, 리스너는 한 번만 붙인다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }
    history.pushState(
      {
        viewMode,
        selectedRegion,
        query,
        submittedQuery,
        statuses,
        sortBy,
        page,
        ordinanceStack,
      } satisfies NavSnapshot,
      '',
    );
    // 화면이 바뀔 때(portal/results/detail 전환, 혹은 상세 안에서 다른 조례로)만 쌓는다 —
    // 필터·정렬·페이지·검색어 변경마다 쌓으면 뒤로가기 한 번에 한 클릭씩만 되돌아가 버려 번거롭다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedOrdinanceId]);

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
              query: submittedQuery,
              statuses,
              sortBy,
              page,
              pageSize: PAGE_SIZE,
            },
            signal,
          )
        : Promise.resolve(null),
    [canSearch, selectedRegion, submittedQuery, statusKey, sortBy, page],
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

  /** 로고 클릭 — "뒤로" 개념이 아니라 포털로 바로 이동하는 새 탐색이라 이력을 쌓는다. */
  const goHome = useCallback(() => setViewMode('portal'), []);

  const handleSelectRegion = useCallback((id: string) => {
    setSelectedRegion(id);
    setPage(1);
  }, []);

  /** 입력창 표시값만 갱신 — 검색은 다시 부르지 않는다. */
  const handleQueryChange = useCallback((next: string) => setQuery(next), []);

  /** 지금 검색어로 실제 검색을 실행한다 (엔터/검색 버튼/추천어 클릭/지우기, 포털·결과 화면 공용). */
  const submitSearch = useCallback(
    (nextQuery?: string) => {
      const q = nextQuery !== undefined ? nextQuery : query;
      if (nextQuery !== undefined) setQuery(nextQuery);
      setSubmittedQuery(q);
      setViewMode('results');
      setPage(1);
    },
    [query],
  );

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
    setSubmittedQuery('');
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

  /**
   * "뒤로가기"류 버튼(상세 화면 하단, 결과 화면 지역 태그 X)은 전부
   * 브라우저 history.back()으로 보낸다 — popstate 핸들러가 상태를 복원하므로
   * 여기서 직접 state를 만지지 않는다. 이렇게 해야 앱 안 뒤로가기 버튼과
   * 브라우저 자체 뒤로가기가 똑같이 동작한다.
   */
  const goBack = useCallback(() => window.history.back(), []);

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
          onQueryChange={handleQueryChange}
          onSearch={() => submitSearch()}
          onBrowseAll={() => submitSearch('')}
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
          onBack={goBack}
          backLabel={isNestedDetail ? '이전 화면으로 돌아가기' : '검색 결과 목록으로 돌아가기'}
          onOpenOrdinance={openRelatedOrdinance}
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
        onQuerySubmit={submitSearch}
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
        onBackToPortal={goBack}
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
