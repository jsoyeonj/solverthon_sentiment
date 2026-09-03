/**
 * mock 백엔드.
 *
 * 실제 BE가 해야 할 일(지역 전체 인덱스 검색 → 매칭 정보 결합 → 관련도순 정렬 →
 * 페이지네이션)을 프론트에서 흉내 낸다. 응답 모양은 실제 BE와 동일한 DTO라
 * `src/api/mapper.ts` 를 똑같이 거친다.
 */

import type { JudgmentDto, OrdinanceRecordDto, RegionDto, SearchResponseDto } from '../dto';
import type { SearchParams } from '../../types';
import { ORDINANCES, REGIONS } from './fixtures';

/** 네트워크 왕복이 있는 것처럼 보이게 하는 최소 지연 — 로딩 UI가 실제로 동작하는지 확인용. */
const LATENCY_MS = 120;

const STATUS_TO_JUDGMENT = {
  overlap_candidate: '겹침후보',
  need_check: '확인필요',
  no_overlap: '겹침없음',
} as const satisfies Record<SearchParams['statuses'][number], JudgmentDto>;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

export function getRegions(): Promise<RegionDto[]> {
  return delay(REGIONS);
}

/**
 * 검색어를 조례의 여러 필드에 걸쳐 매칭한다.
 * 실제 BE는 여기서 임베딩 유사도를 쓰고, 이건 그 자리를 채우는 문자열 매칭이다.
 */
function matchesQuery(item: OrdinanceRecordDto, q: string): boolean {
  if (!q) return true;
  const haystack = [
    item.조례명,
    item.목적,
    item.효과,
    item.대상.요약,
    ...(item.대상.상세조건 ?? []),
    item.분야 ?? '',
    item.담당부서,
    item.본청조례?.조례명 ?? '',
    item.본청조례?.겹침요지 ?? '',
  ];
  return haystack.some((field) => field.toLowerCase().includes(q));
}

export function searchOrdinances(params: SearchParams): Promise<SearchResponseDto> {
  const regionItems = ORDINANCES.filter((it) => it.지역 === params.region);

  const statusCounts: Record<JudgmentDto, number> = {
    겹침후보: regionItems.filter((it) => it.판정 === '겹침후보').length,
    확인필요: regionItems.filter((it) => it.판정 === '확인필요').length,
    겹침없음: regionItems.filter((it) => it.판정 === '겹침없음').length,
  };

  const wanted = params.statuses.map((s) => STATUS_TO_JUDGMENT[s]);
  const q = params.query.trim().toLowerCase();
  const filtered = regionItems.filter((it) => wanted.includes(it.판정) && matchesQuery(it, q));

  const sorted = [...filtered].sort((a, b) => {
    if (params.sortBy === 'latest') return (b.시행일 || '').localeCompare(a.시행일 || '');
    if (params.sortBy === 'name') return a.조례명.localeCompare(b.조례명, 'ko');
    return (b.관련도 ?? 0) - (a.관련도 ?? 0);
  });

  const start = (params.page - 1) * params.pageSize;

  return delay({
    items: sorted.slice(start, start + params.pageSize),
    total: sorted.length,
    regionTotal: regionItems.length,
    statusCounts,
  });
}

export function getOrdinance(id: string): Promise<OrdinanceRecordDto> {
  const found = ORDINANCES.find((it) => it.자치법규일련번호 === id);
  if (!found) {
    return Promise.reject(new Error(`조례를 찾을 수 없습니다: ${id}`));
  }
  return delay(found);
}
