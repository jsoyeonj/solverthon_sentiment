/**
 * BE 원본 JSON(한글 키) → 화면 도메인 타입.
 *
 * BE 필드명이 바뀌면 여기만 고친다. 컴포넌트는 이 함수 결과만 본다.
 */

import type {
  JudgmentStatus,
  OrdinanceCore,
  OrdinanceDetail,
  Region,
  SearchResult,
  TargetSpec,
} from '../types';
import type {
  JudgmentDto,
  MetroOrdinanceDto,
  OrdinanceRecordDto,
  RegionDto,
  SearchResponseDto,
} from './dto';
import { STATUS_LABEL } from '../lib/status';

const JUDGMENT_TO_STATUS: Record<JudgmentDto, JudgmentStatus> = {
  겹침후보: 'overlap_candidate',
  확인필요: 'need_check',
  겹침없음: 'no_overlap',
};

/** '20260701' → '2026. 07. 01'. 형식이 다르면 원본을 그대로 돌려준다. */
export function formatDate(raw: string | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 8) return raw;
  return `${digits.slice(0, 4)}. ${digits.slice(4, 6)}. ${digits.slice(6, 8)}`;
}

function toTarget(dto: { 요약: string; 상세조건?: string[] } | undefined): TargetSpec {
  return {
    summary: dto?.요약 ?? '',
    conditions: dto?.상세조건 ?? [],
  };
}

function toMetro(dto: MetroOrdinanceDto) {
  const hasCore = !!(dto.목적 || dto.대상 || dto.효과);
  const core: OrdinanceCore | undefined = hasCore
    ? {
        purpose: dto.목적 ?? '',
        target: toTarget(dto.대상),
        effect: dto.효과 ?? '',
      }
    : undefined;

  return {
    id: dto.자치법규일련번호,
    name: dto.조례명,
    enforcementDate: formatDate(dto.시행일),
    core,
    sourceUrl: dto.원문링크,
    department: dto.담당부서,
    phone: dto.전화번호,
    overlapNote: dto.겹침요지,
  };
}

export function toOrdinance(dto: OrdinanceRecordDto): OrdinanceDetail {
  const status = JUDGMENT_TO_STATUS[dto.판정] ?? 'no_overlap';
  const conflict = dto.내부충돌;

  return {
    id: dto.자치법규일련번호,
    title: dto.조례명,
    region: dto.지역,
    category: dto.분야,
    status,
    statusLabel: STATUS_LABEL[status],
    proclamationDate: formatDate(dto.공포일),
    enforcementDate: formatDate(dto.시행일),
    department: dto.담당부서,
    phone: dto.전화번호,
    purpose: dto.목적,
    sourceUrl: dto.원문링크,
    relevanceScore: dto.관련도,
    matchedMetropolitanOrdinance: dto.본청조례 ? toMetro(dto.본청조례) : undefined,
    noOverlapReason: dto.판정없음사유,

    core: {
      purpose: dto.목적,
      target: toTarget(dto.대상),
      effect: dto.효과,
    },
    // 내부충돌여부만 true고 상세가 안 왔으면 경고를 띄우지 않는다 — 근거 없이 단정하지 않기 위해.
    hasInternalConflict: dto.내부충돌여부 && !!conflict,
    conflictDetails: conflict
      ? {
          title: conflict.제목,
          clauseA: {
            tag: conflict.조항A.조문,
            label: conflict.조항A.위치,
            text: conflict.조항A.내용,
          },
          clauseB: {
            tag: conflict.조항B.조문,
            label: conflict.조항B.위치,
            text: conflict.조항B.내용,
          },
          note: conflict.비고,
        }
      : undefined,
    priorityClauses: (dto.우선순위조항 ?? []).map((c) => ({
      clause: c.조문번호,
      text: c.원문,
      source: c.출처,
    })),
    judgmentBasis: dto.판정근거 ?? [],
    extractionNote: dto.추출특이사항,
  };
}

export function toSearchResult(dto: SearchResponseDto): SearchResult {
  return {
    items: dto.items.map(toOrdinance),
    total: dto.total,
    regionTotal: dto.regionTotal,
    statusCounts: {
      overlap_candidate: dto.statusCounts?.겹침후보 ?? 0,
      need_check: dto.statusCounts?.확인필요 ?? 0,
      no_overlap: dto.statusCounts?.겹침없음 ?? 0,
    },
  };
}

export function toRegion(dto: RegionDto): Region {
  return {
    id: dto.id,
    name: dto.name,
    fullName: dto.fullName,
    label: dto.label,
    type: dto.type,
    totalCount: dto.totalCount,
  };
}
