import { Icon } from './Icon';

/**
 * 모든 결과 화면 하단에 붙는 고정 문구.
 * AI 판정은 확정이 아니라 후보 제시라는 설계 원칙을 화면에서 계속 드러낸다.
 */
export function Disclaimer() {
  return (
    <section className="disclaimer">
      <div className="disclaimer__main">
        <Icon name="verified_user" />
        <span>이 결과는 확정이 아닌 후보 제시입니다. 최종 판단은 담당자가 하십시오.</span>
      </div>
      <div className="disclaimer__sub">
        지방자치단체 조례 입법 행정 지원 시스템 | 공공행정 표준 업무망 전용 | 국가법령정보센터 Open
        API 연계 운영 중
      </div>
    </section>
  );
}
