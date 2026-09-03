/**
 * 얇은 fetch 래퍼.
 *
 * BE 주소(VITE_API_BASE_URL)가 비어 있으면 mock 모드로 동작한다 —
 * 친구분 BE가 아직 없어도 화면 전체가 돌아가고, 발표 당일 API 장애 시에도
 * VITE_FORCE_MOCK=true 하나로 안전하게 되돌릴 수 있다.
 */

const BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const FORCE_MOCK: boolean = import.meta.env.VITE_FORCE_MOCK === 'true';

/** true면 네트워크 호출 없이 src/api/mock 의 고정 데이터를 쓴다. */
export const USE_MOCK: boolean = FORCE_MOCK || BASE_URL === '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | undefined | null | string[];

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${BASE_URL}${path}`, BASE_URL || window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        // 여러 값은 같은 키를 반복해서 붙인다 (status=a&status=b).
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function apiGet<T>(
  path: string,
  query?: Record<string, QueryValue>,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildUrl(path, query);
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    throw new ApiError(`요청이 실패했습니다 (HTTP ${res.status})`, res.status, url);
  }

  return (await res.json()) as T;
}
