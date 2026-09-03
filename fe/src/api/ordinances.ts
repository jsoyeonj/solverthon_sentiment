/**
 * 화면이 쓰는 유일한 데이터 진입점.
 *
 * 컴포넌트는 여기 있는 함수만 부르고, HTTP인지 mock인지는 알지 못한다.
 * BE 응답(한글 키)은 `mapper.ts` 가 도메인 타입으로 옮긴다.
 *
 * 엔드포인트 규격은 docs/api-contract.md 참고.
 */

import type { JudgmentStatus, OrdinanceDetail, Region, SearchParams, SearchResult } from '../types';
import type { JudgmentDto, OrdinanceRecordDto, RegionDto, SearchResponseDto } from './dto';
import { USE_MOCK, apiGet } from './client';
import { toOrdinance, toRegion, toSearchResult } from './mapper';
import * as mock from './mock';

/** BE는 판정을 전부 한글로 받는다(dto.ts 기준) — 화면 내부 영어 상태값을 쿼리 전에 되돌린다. */
const STATUS_TO_JUDGMENT: Record<JudgmentStatus, JudgmentDto> = {
  overlap_candidate: '겹침후보',
  need_check: '확인필요',
  no_overlap: '겹침없음',
};

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
          status: params.statuses.map((s) => STATUS_TO_JUDGMENT[s]),
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
