import type { OrdinanceDetail } from '../types';

/**
 * 담당자가 민원 응대·감사 대응 문서에 그대로 붙여 넣을 수 있는 형태의 판정 요약.
 * 근거 없는 문장은 넣지 않는다 — 데이터에 있는 것만 옮긴다.
 */
export function buildJudgmentText(o: OrdinanceDetail): string {
  const lines = [
    '[조례 경합 검토 판정 결과]',
    `- 안건명: ${o.title} (자치법규일련번호 ${o.id})`,
    `- 관할: ${o.region} | 소관: ${o.department}`,
    `- 시행일: ${o.enforcementDate}`,
    `- 상태: ${o.statusLabel}`,
  ];

  if (o.hasInternalConflict && o.conflictDetails) {
    lines.push(
      '- 내부 충돌 조항:',
      `  1) ${o.conflictDetails.clauseA.tag}: ${o.conflictDetails.clauseA.text}`,
      `  2) ${o.conflictDetails.clauseB.tag}: ${o.conflictDetails.clauseB.text}`,
    );
  }

  const metro = o.matchedMetropolitanOrdinance;
  lines.push(`- 대조 본청 조례: ${metro ? `${metro.name} — ${metro.overlapNote}` : '해당 없음'}`);

  if (o.judgmentBasis.length > 0) {
    lines.push(`- 검토 의견: ${o.judgmentBasis.join(' ')}`);
  } else if (o.noOverlapReason) {
    lines.push(`- 검토 의견: ${o.noOverlapReason}`);
  }

  lines.push(
    `- 원문: ${o.sourceUrl}`,
    '- 시스템: 센티멘트 - 광역·기초 조례 겹침 확인 (법제처 Open API 연계)',
  );

  return lines.join('\n');
}

/** 클립보드 API가 막힌 환경(비 https 등)에서도 조용히 실패하도록 감싼다. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // 복사에 실패해도 화면 흐름은 막지 않는다.
  }
}
