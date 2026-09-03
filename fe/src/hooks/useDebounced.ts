import { useEffect, useState } from 'react';

/** 타이핑이 멈춘 뒤에만 값을 흘려보낸다 — 글자마다 검색 요청이 나가는 것을 막는다. */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
