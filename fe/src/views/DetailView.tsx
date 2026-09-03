import type { OrdinanceCore, OrdinanceDetail } from '../types';
import { statusBadgeClass } from '../lib/status';
import { Disclaimer } from '../components/Disclaimer';
import { Icon } from '../components/Icon';

interface Props {
  ordinance: OrdinanceDetail;
  onBack: () => void;
  onPrint: () => void;
  onCopy: () => void;
  copied: boolean;
}

/** 구조화 추출 3항목(목적/대상/효과) 표. 대상의 상세조건은 조문 순서대로 나열한다. */
function CoreTable({ caption, core }: { caption: string; core: OrdinanceCore }) {
  return (
    <div className="deftable">
      <div className="deftable__cap">{caption}</div>
      <table>
        <tbody>
          <tr>
            <th>목적</th>
            <td>{core.purpose}</td>
          </tr>
          <tr>
            <th>대상</th>
            <td>
              {core.target.summary}
              {core.target.conditions.length > 0 && (
                <ul className="cond-list">
                  {core.target.conditions.map((cond, i) => (
                    <li key={i}>{cond}</li>
                  ))}
                </ul>
              )}
            </td>
          </tr>
          <tr>
            <th>효과</th>
            <td>{core.effect}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function DetailView({ ordinance, onBack, onPrint, onCopy, copied }: Props) {
  const isNeedCheck = ordinance.status === 'need_check';
  const isNoOverlap = ordinance.status === 'no_overlap';
  const metro = ordinance.matchedMetropolitanOrdinance;

  const showComparison = !isNoOverlap && !!metro;
  const hasBasis = ordinance.judgmentBasis.length > 0 || !!metro?.overlapNote;

  const subheadNote = ordinance.hasInternalConflict
    ? '내부 조문 경합 검토 대상 안건'
    : isNoOverlap
      ? '고유 자치사무 확인 안건'
      : '광역-기초 정합성 검토 대상';

  const dotColor = isNeedCheck
    ? 'var(--amber-strong)'
    : isNoOverlap
      ? 'var(--green)'
      : 'var(--blue-text)';

  return (
    <div className="view detail">
      <div className="crumbbar">
        <div className="crumbbar__inner">
          <nav className="crumbs">
            <button type="button" onClick={onBack}>
              {ordinance.region}
            </button>
            <span className="sep">›</span>
            <button type="button" onClick={onBack}>
              검색 결과
            </button>
            <span className="sep">›</span>
            <span className="crumbs__current">상세</span>
          </nav>
          <div className="crumbbar__docid">
            <span>
              자치법규일련번호: <strong>{ordinance.id}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="detail__body">
        <section className="detail__hero">
          <div className="detail__hero-top">
            <div className="detail__hero-titles">
              <h1 className="detail__title">{ordinance.title}</h1>
              <span className={statusBadgeClass(ordinance.status)}>
                {isNeedCheck && <Icon name="warning" />}
                <span>{ordinance.statusLabel}</span>
              </span>
              {ordinance.category && (
                <span className="badge badge--square badge--gray">{ordinance.category}</span>
              )}
            </div>
            <div className="detail__subhead">
              <span className="dot" style={{ background: dotColor }} />
              <span className="wrap-ok">{subheadNote}</span>
            </div>
          </div>

          <div className="detail__facts">
            <span>시행 {ordinance.enforcementDate}</span>
            <span className="sep">·</span>
            <span>공포 {ordinance.proclamationDate}</span>
            <span className="sep">·</span>
            <span>소관부서: {ordinance.department}</span>
            {ordinance.phone && (
              <>
                <span className="sep">·</span>
                <span>{ordinance.phone}</span>
              </>
            )}
          </div>

          {ordinance.hasInternalConflict && ordinance.conflictDetails && (
            <div className="conflict">
              <div className="conflict__head">
                <Icon name="error" />
                <span>{ordinance.conflictDetails.title}</span>
              </div>
              <div className="conflict__grid">
                {[ordinance.conflictDetails.clauseA, ordinance.conflictDetails.clauseB].map(
                  (clause) => (
                    <div className="clause" key={clause.tag}>
                      <div className="clause__head">
                        <span className="clause__tag">{clause.tag}</span>
                        <span className="clause__label">{clause.label}</span>
                      </div>
                      <p className="clause__text">{clause.text}</p>
                    </div>
                  ),
                )}
              </div>
              <div className="conflict__note">
                <Icon name="info" />
                <span className="wrap-ok">{ordinance.conflictDetails.note}</span>
              </div>
            </div>
          )}

          {isNoOverlap && (
            <div className="no-overlap-panel">
              <div className="no-overlap-panel__head">
                <Icon name="verified_user" />
                <h2>본청과 겹치는 조례 없음</h2>
              </div>
              <p>{ordinance.noOverlapReason}</p>
              <div className="no-overlap-panel__foot">
                <Icon name="check_circle" />
                <span>광역·기초 조례 자동 교차 대조 완료</span>
              </div>
            </div>
          )}
        </section>

        {showComparison && metro && (
          <section className="compare">
            <div className="compare__head">
              <div className="compare__head-left">
                <Icon name="compare_arrows" />
                <h2>광역 · 기초 조례 대조 현황</h2>
              </div>
              <span className="compare__head-note">목적 · 대상 · 효과 직접 대조</span>
            </div>
            <div className="compare__grid">
              <div className="compare__col compare__col--metro">
                <div className="compare__colhead">
                  <div className="compare__colhead-row">
                    <span className="badge badge--square badge--gray">본청</span>
                    <span className="compare__colhead-meta">광역 자치입법</span>
                  </div>
                  <h3>{metro.name}</h3>
                  <span className="compare__colhead-meta">
                    시행 {metro.enforcementDate} · 자치법규 {metro.id}
                  </span>
                </div>
                {metro.core && <CoreTable caption="구조화 추출 결과" core={metro.core} />}
              </div>
              <div className="compare__col compare__col--local">
                <div className="compare__colhead">
                  <div className="compare__colhead-row">
                    <span className="badge badge--square badge--blue">{ordinance.region}</span>
                    <span className="compare__colhead-meta">기초 자치입법</span>
                  </div>
                  <h3>{ordinance.title}</h3>
                  <span className="compare__colhead-meta">
                    시행 {ordinance.enforcementDate} · 자치법규 {ordinance.id}
                  </span>
                </div>
                <CoreTable caption="구조화 추출 결과" core={ordinance.core} />
              </div>
            </div>
          </section>
        )}

        {!showComparison && (
          <section className="solo">
            <div className="solo__head">
              <h3>
                <Icon name="fact_check" />
                조례 핵심 규정 개요
              </h3>
              <span className="solo__head-note">목적 · 대상 · 효과</span>
            </div>
            <div className="solo__rows">
              <div className="solo__row">
                <div className="solo__key">목적</div>
                <div className="solo__val">{ordinance.core.purpose}</div>
              </div>
              <div className="solo__row">
                <div className="solo__key">대상</div>
                <div className="solo__val">
                  {ordinance.core.target.summary}
                  {ordinance.core.target.conditions.length > 0 && (
                    <ul className="cond-list">
                      {ordinance.core.target.conditions.map((cond, i) => (
                        <li key={i}>{cond}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="solo__row">
                <div className="solo__key">효과</div>
                <div className="solo__val">{ordinance.core.effect}</div>
              </div>
            </div>
          </section>
        )}

        {hasBasis && (
          <section className="panel">
            <div className="section-head">
              <Icon name="gavel" />
              <h2>판정 근거</h2>
            </div>
            {ordinance.judgmentBasis.length > 0 && (
              <div className="panel__desc">
                {ordinance.judgmentBasis.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
            {metro?.overlapNote && (
              <blockquote className="quote">
                <div className="quote__title">겹침 요지</div>
                <p>{metro.overlapNote}</p>
              </blockquote>
            )}
          </section>
        )}

        {ordinance.priorityClauses.length > 0 && (
          <section className="panel">
            <div className="section-head">
              <Icon name="rule" />
              <h2>우선순위 조항</h2>
            </div>
            <div className="clause-list">
              {ordinance.priorityClauses.map((clause) => (
                <article className="article" key={clause.clause}>
                  <div className="article__title">{clause.clause}</div>
                  <p>{clause.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {ordinance.extractionNote && (
          <div className="ref-note">
            <Icon name="info" />
            <div style={{ lineHeight: 1.6 }}>
              <strong>추출 특이사항:</strong> {ordinance.extractionNote}
            </div>
          </div>
        )}

        <section className="actions">
          <div className="actions__group">
            <button type="button" className="btn" onClick={onBack}>
              <Icon name="arrow_back" />
              <span>검색 결과 목록으로 돌아가기</span>
            </button>
            <a
              className="btn"
              href={ordinance.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Icon name="open_in_new" />
              <span>{ordinance.region} 원문 열기</span>
            </a>
            {metro && (
              <a className="btn" href={metro.sourceUrl} target="_blank" rel="noreferrer noopener">
                <Icon name="open_in_new" />
                <span>본청 원문 열기</span>
              </a>
            )}
          </div>
          <div className="actions__group actions__group--right">
            {copied && <span className="toast">✓ 판정 내용이 클립보드에 복사되었습니다</span>}
            <button type="button" className="btn" onClick={onPrint}>
              <Icon name="print" />
              <span>출력</span>
            </button>
            <button type="button" className="btn btn--primary" onClick={onCopy}>
              <Icon name="content_copy" />
              <span>판정 내용 복사</span>
            </button>
          </div>
        </section>

        <Disclaimer />
      </div>
    </div>
  );
}
