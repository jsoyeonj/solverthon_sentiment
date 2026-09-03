import { Icon } from './Icon';

export function Header({ onGoHome }: { onGoHome: () => void }) {
  return (
    <header className="hdr">
      <div className="hdr__inner">
        <div className="hdr__left">
          <button type="button" className="brand" onClick={onGoHome} title="홈으로 이동">
            <span className="brand__name">센티멘트</span>
            <span className="brand__sub">광역·기초 조례 겹침 확인</span>
          </button>
          <nav className="hdr__nav">
            <button type="button" className="tab is-active" onClick={onGoHome}>
              조례 대조 분석
            </button>
          </nav>
        </div>
        <div className="hdr__badge">
          <Icon name="verified_user" />
          법제처 국가법령정보 기반
        </div>
      </div>
    </header>
  );
}
