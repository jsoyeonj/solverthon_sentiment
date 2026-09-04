/**
 * 이 지역명이 본청(광역) 자체를 가리키는지 판별한다.
 *
 * BE가 각 조례 레코드에 실어 보내는 `지역` 필드는 지자체 목록 API의 짧은
 * id("본청")가 아니라 원본 지자체기관명이다 — 본청은 "전남광주통합특별시"
 * 그대로, 기초 지자체는 "전남광주통합특별시 장흥군"처럼 뒤에 구·군명이
 * 붙는다(docs/api-contract.md 참고). 그래서 접미사 없이 정확히 일치할 때만
 * 본청으로 본다. mock 데이터의 짧은 값 '본청'도 함께 인정한다.
 */
export function isMetroRegion(region: string): boolean {
  const trimmed = region.trim();
  return trimmed === '본청' || trimmed === '전남광주통합특별시';
}
