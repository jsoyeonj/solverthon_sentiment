/**
 * 화면이 쓰는 유일한 데이터 진입점.
 *
 * 컴포넌트는 여기 있는 함수만 부르고, HTTP인지 mock인지는 알지 못한다.
 * BE 응답(한글 키)은 `mapper.ts` 가 도메인 타입으로 옮긴다.
 *
 * 엔드포인트 규격은 docs/api-contract.md 참고.
 */

import type { OrdinanceDetail, Region, SearchParams, SearchResult } from '../types';
import type { OrdinanceRecordDto, RegionDto, SearchResponseDto } from './dto';
import { USE_MOCK, apiGet } from './client';
import { toOrdinance, toRegion, toSearchResult } from './mapper';
import * as mock from './mock';

export async function fetchRegions(signal?: AbortSignal): Promise<Region[]> {
  const dto = USE_MOCK
    ? await mock.getRegions()
    : await apiGet<RegionDto[]>('/api/regions', undefined, signal);
  return dto.map(toRegion);
}

export async function fetchSearch(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const dto = USE_MOCK
    ? await mock.searchOrdinances(params)
    : await apiGet<SearchResponseDto>(
        '/api/ordinances',
        {
          region: params.region,
          q: params.query,
          status: params.statuses,
          sort: params.sortBy,
          page: params.page,
          pageSize: params.pageSize,
        },
        signal,
      );
  return toSearchResult(dto);
}

export async function fetchOrdinance(id: string, signal?: AbortSignal): Promise<OrdinanceDetail> {
  const dto = USE_MOCK
    ? await mock.getOrdinance(id)
    : await apiGet<OrdinanceRecordDto>(
        `/api/ordinances/${encodeURIComponent(id)}`,
        undefined,
        signal,
      );
  return toOrdinance(dto);
}
