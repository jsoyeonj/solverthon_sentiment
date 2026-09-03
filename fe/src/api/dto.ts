/**
 * BE가 그대로 내려주는 원본 JSON 형태 (한글 키).
 *
 * 여기 있는 타입은 "우리가 바라는 모양"이 아니라 "실제로 오는 모양"이다.
 * BE 스키마가 바뀌면 이 파일과 `mapper.ts` 만 고치면 되고, 화면 코드는 건드리지 않는다.
 */

/** 구조화 추출 결과 1건 (설계서 Phase 3 산출물) */
export interface OrdinanceDto {
  /** 법제처 자치법규일련번호. 원문링크의 ordinSeq 와 같은 값 */
  자치법규일련번호: string;
  조례명: string;
  지역: string;
  목적: string;
  대상: {
    요약: string;
    상세조건?: string[];
  };
  효과: string;
  /**
   * '다른 조례와의 관계' · '우선 적용' 류 조항.
   * 예시 레코드에서 빈 배열이라 내부 키 이름은 아직 확정 아님 — BE와 맞출 것.
   */
  우선순위조항: PriorityClauseDto[];
  내부충돌여부: boolean;
  추출특이사항?: string;
  원문링크: string;
  /** YYYYMMDD */
  공포일: string;
  /** YYYYMMDD */
  시행일: string;
  /** 여러 부서면 쉼표로 이어진 한 문자열로 온다 */
  담당부서: string;
  전화번호?: string;
}

export interface PriorityClauseDto {
  조문: string;
  내용: string;
}

/**
 * 매칭 테이블(설계서 Phase 5)에서 결합되는 부분.
 * 겹침 판정이 없는 조례에는 `판정: '겹침없음'` 만 오고 `본청조례` 는 비어 있다.
 */
export interface MatchDto {
  판정: JudgmentDto;
  분야?: string;
  /** 판정 근거 문단 */
  판정근거?: string[];
  /** 겹치는 본청 조례가 없을 때의 사유 */
  판정없음사유?: string;
  /** 임베딩 관련도. 화면에 숫자로 노출하지 않고 정렬에만 쓴다 */
  관련도?: number;
  본청조례?: MetroOrdinanceDto;
  내부충돌?: InternalConflictDto;
}

export type JudgmentDto = '겹침후보' | '확인필요' | '겹침없음';

export interface MetroOrdinanceDto {
  자치법규일련번호: string;
  조례명: string;
  시행일: string;
  목적?: string;
  대상?: { 요약: string; 상세조건?: string[] };
  효과?: string;
  원문링크: string;
  /** 왜 겹침 후보로 묶였는지 한 줄 */
  겹침요지: string;
}

export interface InternalConflictDto {
  제목: string;
  조항A: ConflictClauseDto;
  조항B: ConflictClauseDto;
  비고: string;
}

export interface ConflictClauseDto {
  조문: string;
  위치: string;
  내용: string;
}

/** 검색 API가 실제로 내려주는 한 건 = 추출 결과 + 매칭 결과 */
export type OrdinanceRecordDto = OrdinanceDto & MatchDto;

export interface SearchResponseDto {
  items: OrdinanceRecordDto[];
  total: number;
  regionTotal: number;
  statusCounts: Record<JudgmentDto, number>;
}

export interface RegionDto {
  id: string;
  name: string;
  fullName: string;
  label: string;
  type: '광역' | '기초';
  totalCount: number;
}
