import type { JudgmentStatus } from '../types';

export type BadgeTone = 'blue' | 'amber' | 'gray';

/** 판정 상태 → 화면 라벨 */
export const STATUS_LABEL: Record<JudgmentStatus, string> = {
  overlap_candidate: '겹침',
  need_check: '확인 필요',
  no_overlap: '겹침 없음',
};

/** 판정 상태 → 배지 톤. 색상값은 CSS가 갖고 있고 여기선 의미만 정한다. */
export const STATUS_TONE: Record<JudgmentStatus, BadgeTone> = {
  overlap_candidate: 'blue',
  need_check: 'amber',
  no_overlap: 'gray',
};

export const ALL_STATUSES: JudgmentStatus[] = ['overlap_candidate', 'need_check', 'no_overlap'];

export function badgeClass(tone: BadgeTone): string {
  return `badge badge--${tone}`;
}

export function statusBadgeClass(status: JudgmentStatus): string {
  return badgeClass(STATUS_TONE[status]);
}

/** 판정 상태 분류 기준 설명 — 포털 하단 범례에서 쓴다. */
export const STATUS_DESCRIPTION: Record<JudgmentStatus, string> = {
  overlap_candidate: '동일 사무 또는 지원 기준의 범위가 중복되어 통합 검토가 권고되는 상태',
  need_check: '광역 기본조례와 기초 위임조례 간 수혜 대상·지원 비율 상충 소지 존재',
  no_overlap: '고유 자치사무에 국한되거나 상위 광역 조례의 위임 범위 내에서 적법 운용',
};
