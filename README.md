# 센티멘트 — 광역·기초 조례 겹침 확인

2026 전남광주 청년(Youth) AI 솔버톤 · A트랙 [A-08] 지역 사회 서비스 개선
팀 **센티멘트**

전남광주통합특별시 출범 이후 본청 신규 조례와 27개 시·군·구 기존 조례가 겹치는지를
담당 공무원이 민원 응대 **전에** 확인하는 내부 사무 지원 도구입니다.
AI 판정은 확정이 아니라 **후보 제시**이며, 모든 결과에 법제처 원문 링크를 함께 보여줍니다.

## 저장소 구조

```
fe/                              프론트엔드 (React + Vite + TS)
be/                              백엔드 — 아직 없음
docs/api-contract.md             FE ↔ BE API 계약
조례 검색 프로토타입.dc.html      원본 디자인 프로토타입
```

수집·구조화 추출 파이프라인은 별도 저장소입니다.

## 프론트엔드 실행

```bash
cd fe && pnpm install
```

```bash
cd fe && pnpm dev
```

`http://localhost:5173` 에서 열립니다. 빌드는 `cd fe && pnpm build`.

### 백엔드 없이도 돌아갑니다

`fe/.env` 의 `VITE_API_BASE_URL` 이 비어 있으면 `fe/src/api/mock/` 의 고정 데이터로 동작합니다.
BE가 준비되면 `.env.example` 을 복사해서 주소만 채우면 됩니다.

```bash
cd fe && cp .env.example .env
```

```
VITE_API_BASE_URL=http://localhost:8000
```

발표 당일 API가 불안하면 `VITE_FORCE_MOCK=true` 로 즉시 mock으로 되돌릴 수 있습니다.

**BE에 넘길 규격은 [docs/api-contract.md](docs/api-contract.md)** 에 정리해 뒀습니다.
구조화 추출 스키마(`목적`/`대상`/`효과`/`우선순위조항`/`내부충돌여부`/`원문링크`…)를
한글 키 그대로 받고, `fe/src/api/mapper.ts` 에서 화면 타입으로 옮깁니다.

## 화면

| 화면 | 내용 |
|---|---|
| 포털 | 관할 지자체 선택 + 자연어 검색어 입력. 판정 3분류 범례 |
| 검색 결과 | 지역 전체 조례 인덱스 검색 → 카드 목록. 판정 필터 / 정렬 / 페이지네이션 |
| 상세 | 광역·기초 대조표(목적·대상·효과), 판정 근거, 우선순위 조항, 내부 조문 충돌 경고, 추출 특이사항 |

조례 원문은 앱 안에서 흉내 내지 않고 `원문링크` 로 법제처 국가법령정보센터를 새 탭에 엽니다.

## fe/ 안쪽 구조

```
fe/src/
  App.tsx              화면 전환 + 상태(선택 지역/검색어/필터/정렬/페이지) 전부 여기
  api/
    dto.ts             BE가 실제로 내려주는 모양 (한글 키)
    mapper.ts          DTO → 화면 타입. BE 스키마가 바뀌면 여기만 고친다
    client.ts          fetch 래퍼. VITE_API_BASE_URL 없으면 mock 모드
    ordinances.ts      화면이 쓰는 유일한 데이터 진입점
    mock/              BE 없을 때 쓰는 고정 데이터(DTO 형태) + 검색·정렬·페이징 흉내
  types.ts             화면 도메인 타입
  views/               포털 / 결과 / 상세
  components/          헤더·푸터·카드·사이드바 등 재사용 조각
  lib/status.ts        판정 3분류의 라벨·배지 톤 (색상 하드코딩 금지)
  lib/judgment.ts      판정 내용 복사 텍스트
  hooks/               useAsync(요청 취소 포함), useDebounced
  index.css            디자인 토큰 + 컴포넌트 클래스
```

원칙 세 가지.

1. **컴포넌트는 `fetch` 를 직접 부르지 않는다** — `src/api/ordinances.ts` 만 통해서.
2. **컴포넌트는 BE 한글 필드명을 모른다** — `mapper.ts` 가 경계다.
3. **색상은 `src/index.css` 의 CSS 변수에서만 가져온다** — 컴포넌트에 hex 값을 쓰지 않는다.

## 데이터 출처

법제처 국가법령정보 OPEN API (`target=ordin`).

`fe/src/api/mock/fixtures.ts` 의 조례 내용은 **화면 확인용 예시이며 실제 판정 결과가 아닙니다.**
(본청 국기게양 조례 1건만 실제 추출 결과입니다.)
공개 배포 URL에는 이 더미데이터만 노출하고, 실데이터 화면은 접근을 제한합니다.
