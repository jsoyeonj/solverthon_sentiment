import type { OrdinanceCore, OrdinanceDetail } from '../types';
import { statusBadgeClass } from '../lib/status';
import { isMetroRegion } from '../lib/region';
import { Disclaimer } from '../components/Disclaimer';
import { Icon } from '../components/Icon';

interface Props {
  ordinance: OrdinanceDetail;
  onBack: () => void;
  /** "검색 결과 목록으로 돌아가기" | "이전 화면으로 돌아가기" — 이력이 남아있는지에 따라 달라진다 */
  backLabel: string;
  /** 대조표의 본청 조례명을 누르면 그 조례의 상세 화면으로 이동한다 */
  onOpenOrdinance: (id: string) => void;
}

/** 구조화 추출 3항목(목적/대상/효과) 표. 대상의 상세조건은 조문 순서대로 나열한다. */
function CoreTable({ core }: { core: OrdinanceCore }) {
  return (
    <div className="deftable">
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

/** 표 아래에 붙는 소관부서·전화번호·원문 링크. 대조표 양쪽과 단독 개요에서 공용으로 쓴다. */
function ContactBlock({
  department,
  phone,
  sourceUrl,
  linkLabel,
}: {
  department?: string;
  phone?: string;
  sourceUrl: string;
  linkLabel: string;
}) {
  return (
    <div className="contact-block">
      {(department || phone) && (
        <div className="contact-block__row">
          {department && <span>소관부서: {department}</span>}
          {phone && <span>{phone}</span>}
        </div>
      )}
      <a className="btn contact-block__link" href={sourceUrl} target="_blank" rel="noreferrer noopener">
        <Icon name="open_in_new" />
        <span>{linkLabel}</span>
      </a>
    </div>
  );
}

export function DetailView({ ordinance, onBack, backLabel, onOpenOrdinance }: Props) {
  const isNeedCheck = ordinance.status === 'need_check';
  const isNoOverlap = ordinance.status === 'no_overlap';
  const metro = ordinance.matchedMetropolitanOrdinance;

  const showComparison = !isNoOverlap && !!metro;

  // 겹침요지가 판정근거 문단 중 하나와 글자 그대로 같으면(실데이터에서 자주 그렇다)
  // 같은 문장을 두 번 보여주는 셈이라 인용 블록은 생략한다.
  const overlapNoteIsDuplicate =
    !!metro?.overlapNote &&
    ordinance.judgmentBasis.some((line) => line.trim() === metro.overlapNote.trim());
  const showOverlapNote = !!metro?.overlapNote && !overlapNoteIsDuplicate;
  const hasBasis = ordinance.judgmentBasis.length > 0 || showOverlapNote;

  // "고유 자치사무 확인 안건"(겹침없음)·"광역-기초 정합성 검토 대상"(일반 비교) 문구는
  // 뺐다 — 내부 조문 충돌처럼 실제로 주의가 필요한 경우에만 서브헤드를 보여준다.
  const subheadNote = '내부 조문 경합 검토 대상 안건';

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
            </div>
            {/* 내부 조문 충돌처럼 실제로 확인이 필요한 경우에만 보여준다 */}
            {ordinance.hasInternalConflict && (
              <div className="detail__subhead">
                <span className="dot" style={{ background: dotColor }} />
                <span className="wrap-ok">{subheadNote}</span>
              </div>
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

          {/* "본청과 겹치는 조례 없음" 문구는 지방조례를 본청과 대조한 결과라 본청 자기 조례에는 안 맞는다 */}
          {isNoOverlap && !isMetroRegion(ordinance.region) && (
            <div className="no-overlap-panel">
              <div className="no-overlap-panel__head">
                <Icon name="verified_user" />
                <h2>본청과 겹치는 조례 없음</h2>
              </div>
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
                  <span className="badge badge--square badge--gray">본청</span>
                  <button
                    type="button"
                    className="compare__colhead-title-btn"
                    onClick={() => onOpenOrdinance(metro.id)}
                  >
                    {metro.name}
                  </button>
                  <span className="compare__colhead-meta">
                    시행 {metro.enforcementDate} · 자치법규 {metro.id}
                  </span>
                </div>
                {metro.core && <CoreTable core={metro.core} />}
                <ContactBlock
                  department={metro.department}
                  phone={metro.phone}
                  sourceUrl={metro.sourceUrl}
                  linkLabel="본청 원문 열기"
                />
              </div>
              <div className="compare__col compare__col--local">
                <div className="compare__colhead">
                  <span className="badge badge--square badge--blue">{ordinance.region}</span>
                  <h3>{ordinance.title}</h3>
                  <span className="compare__colhead-meta">
                    시행 {ordinance.enforcementDate} · 자치법규 {ordinance.id}
                  </span>
                </div>
                <CoreTable core={ordinance.core} />
                <ContactBlock
                  department={ordinance.department}
                  phone={ordinance.phone}
                  sourceUrl={ordinance.sourceUrl}
                  linkLabel={`${ordinance.region} 원문 열기`}
                />
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
            <ContactBlock
              department={ordinance.department}
              phone={ordinance.phone}
              sourceUrl={ordinance.sourceUrl}
              linkLabel={`${ordinance.region} 원문 열기`}
            />
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
            {showOverlapNote && metro && (
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
              {ordinance.priorityClauses.map((clause, index) => (
                <article className="article" key={`${clause.clause}-${index}`}>
                  <div className="article__title">
                    {clause.source && (
                      <span
                        className={`badge badge--square ${
                          clause.source === '본청' ? 'badge--gray' : 'badge--blue'
                        }`}
                      >
                        {clause.source === '본청' ? '본청' : ordinance.region}
                      </span>
                    )}
                    <span>{clause.clause}</span>
                  </div>
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
              <span>{backLabel}</span>
            </button>
          </div>
        </section>

        <Disclaimer />
      </div>
    </div>
  );
}
