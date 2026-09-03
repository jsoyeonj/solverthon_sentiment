/**
 * 화면이 쓰는 도메인 타입.
 *
 * BE가 내려주는 원본 JSON(한글 키)은 `src/api/dto.ts` 에 따로 있고,
 * `src/api/mapper.ts` 가 그걸 이 타입으로 옮긴다.
 * 컴포넌트는 BE 필드명을 절대 직접 알지 못하게 유지할 것.
 */

/** 판정 상태 — 설계서 5장의 3분류. 확정이 아니라 "후보 제시"임에 유의. */
export type JudgmentStatus = 'overlap_candidate' | 'need_check' | 'no_overlap';

export type RegionType = '광역' | '기초';

export interface Region {
  /** 지역 식별자. BE의 지자체코드(org/sborg)와 1:1로 매핑되어야 한다. */
  id: string;
  /** 짧은 표시명 (예: '여수시') */
  name: string;
  /** 사이드바용 전체 표시명 */
  fullName: string;
  /** 포털 화면의 칩 라벨 */
  label: string;
  type: RegionType;
  /** 해당 지자체가 보유한 전체 조례 수 */
  totalCount: number;
}

/** 지원·적용 대상. 요약 한 줄 + 조문에 열거된 상세조건. */
export interface TargetSpec {
  summary: string;
  conditions: string[];
}

/** 구조화 추출의 핵심 3항목 — 목적 / 대상 / 효과. 겹침 판정의 근거가 되는 부분. */
export interface OrdinanceCore {
  purpose: string;
  target: TargetSpec;
  effect: string;
}

/** '다른 조례와의 관계' · '우선 적용' 류 조항 */
export interface PriorityClause {
  /** 조문 번호 (예: '제8조③') */
  clause: string;
  /** 조문 원문 */
  text: string;
}

/** 한 조례 안에서 우선순위 조문끼리 충돌하는 경우 (장흥군 제4조 vs 제8조③ 케이스) */
export interface InternalConflict {
  title: string;
  clauseA: ConflictClause;
  clauseB: ConflictClause;
  note: string;
}

export interface ConflictClause {
  /** 조문 번호 + 요지 */
  tag: string;
  /** 조문 위치 라벨 (예: '제3항 단서') */
  label: string;
  text: string;
}

/** 매칭 테이블에서 결합된 본청(광역) 조례 */
export interface MatchedMetropolitanOrdinance {
  id: string;
  name: string;
  enforcementDate: string;
  core?: OrdinanceCore;
  sourceUrl: string;
  /** 왜 겹침 후보로 묶였는지에 대한 한 줄 근거 */
  overlapNote: string;
}

/** 검색 결과 카드에 필요한 최소 필드 */
export interface OrdinanceSummary {
  /** 자치법규일련번호 */
  id: string;
  title: string;
  region: string;
  /** 분야 — 매칭 테이블에서 붙는 값이라 없을 수 있다 */
  category?: string;
  status: JudgmentStatus;
  statusLabel: string;
  proclamationDate: string;
  enforcementDate: string;
  department: string;
  phone?: string;
  /** 목적. 카드의 요약 문장으로도 쓴다 */
  purpose: string;
  /** 법제처 국가법령정보센터 원문 링크 */
  sourceUrl: string;
  /** 임베딩 관련도. 화면에 숫자로 노출하지 않고 정렬에만 쓴다(설계서 Phase 6). */
  relevanceScore?: number;
  matchedMetropolitanOrdinance?: MatchedMetropolitanOrdinance;
  /** 겹치는 본청 조례가 없을 때의 사유. "겹치는 게 없다"도 유효한 정보다. */
  noOverlapReason?: string;
}

/** 상세 화면까지 채우는 전체 필드 */
export interface OrdinanceDetail extends OrdinanceSummary {
  core: OrdinanceCore;
  hasInternalConflict: boolean;
  conflictDetails?: InternalConflict;
  priorityClauses: PriorityClause[];
  /** 판정 근거 문단들 */
  judgmentBasis: string[];
  /** 추출특이사항 — 자동 추출이 애매하게 판단한 지점을 담당자에게 그대로 알린다 */
  extractionNote?: string;
}

/** 검색 파라미터 — BE 검색 API 쿼리스트링과 1:1 대응 */
export interface SearchParams {
  /** 하나 이상. 여러 개를 함께 선택하면 그 지역들을 합쳐서 검색한다. */
  regions: string[];
  /** 자연어 검색어. 비어 있으면 브라우징 모드(선택 지역 전체). */
  query: string;
  statuses: JudgmentStatus[];
  sortBy: SortKey;
  page: number;
  pageSize: number;
}

export type SortKey = 'relevance' | 'latest' | 'name';

export interface SearchResult {
  items: OrdinanceSummary[];
  /** 필터 적용 후 전체 건수 (페이지네이션용) */
  total: number;
  /** 필터와 무관한 해당 지역 전체 조례 수 */
  regionTotal: number;
  /** 상태별 건수 — 필터 체크박스 옆 뱃지에 쓴다 */
  statusCounts: Record<JudgmentStatus, number>;
}
