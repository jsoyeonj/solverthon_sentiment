import { useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * deps가 바뀔 때마다 loader를 다시 실행하고, 이전 요청은 abort 한다.
 * 검색어를 빠르게 바꿀 때 늦게 도착한 응답이 최신 결과를 덮어쓰는 것을 막는다.
 */
export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    loader(controller.signal)
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!alive || controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      alive = false;
      controller.abort();
    };
    // loader는 매 렌더 새로 만들어지므로 의존성에서 제외하고, 호출부가 deps를 명시한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
