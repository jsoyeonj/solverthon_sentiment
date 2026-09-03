export function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer__inner">
        <div className="footer__row">
          <span>지방자치단체 조례 입법 행정 지원 시스템</span>
          <span className="sep">|</span>
          <span style={{ color: 'var(--text-4)' }}>공공행정 표준 업무망 전용</span>
        </div>
        <div className="footer__row">
          <span className="dot dot--sm" />
          <span>국가법령정보센터 Open API 연계 운영 중</span>
        </div>
      </div>
    </footer>
  );
}
