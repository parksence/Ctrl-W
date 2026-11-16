# 휘발

쓰고, 날리고, 잊는 디지털 대나무숲. 직장에서 쌓인 말을 로그인 없이 쏟아내고, 파쇄·소각·블랙홀로 날려버리는 웹 서비스입니다.
글은 브라우저 탭 안에서만 존재하고 서버로 전송되지 않습니다. 서버도 데이터베이스도 없습니다.

## 기능

- **바로 쓰기**: 접속하면 커서가 깜빡입니다. 가입도 버튼도 없이 바로 칩니다.
- **사라지는 방식 3가지**
  - 직접 날리기: 버튼이나 Enter로 날립니다. 글은 메모리에만 있어서 새로고침만 해도 사라집니다.
  - 멈추면 증발: 손을 멈추면 10초 / 30초 / 1분 뒤 서서히 흐려지다 증발합니다.
  - 탭 닫으면 증발: 새로고침에는 남고, 탭을 닫으면 사라집니다.
- **날리는 연출 3가지**: 파쇄, 소각, 블랙홀. 히트스톱, 섬광, 충격파가 지나가고 "347자 소각!" 스탬프가 찍힙니다.
- **타격감**: 글자마다 튀는 스파크, 콤보 카운터, 타이핑 속도에 따라 달아오르는 화면, 분노 게이지, 격한 표현에 터지는 크리티컬.
- **효과음**: Web Audio API로 그 자리에서 합성합니다. 콤보가 쌓일수록 타건음이 높아집니다. 기본은 꺼짐입니다.
- **위장 모드**: Esc 두 번이면 예산 스프레드시트 화면으로 바뀝니다. 탭 제목과 아이콘도 같이 바뀝니다. 다시 Esc 두 번이면 돌아옵니다. 휴대폰에서는 표 화면의 파일 이름을 빠르게 세 번 누릅니다.
- **오늘의 카운터**: "오늘 3번의 화를 참아냈습니다." 횟수 같은 숫자만 브라우저에 저장합니다.

## 실행

Node.js 20.9 이상이 필요합니다.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 정적 파일을 out/ 에 생성
npm run preview  # out/ 을 로컬에서 확인
```

## 구조

```
src/app/page.tsx             메인 화면
src/app/privacy/page.tsx     데이터 미수집 안내
src/app/globals.css          색, 글꼴, 화면 스타일 전부
src/components/Vent.tsx      입력창, 모드, 콤보, 날려버리기 흐름
src/components/Disguise.tsx  위장 화면(스프레드시트)
src/lib/fx.ts                캔버스 연출 엔진: 스파크, 흔들림, 파쇄·소각·블랙홀·증발
src/lib/sfx.ts               효과음 합성
src/lib/measure.ts           글자 좌표 측정
src/lib/hot.ts               격한 표현 감지 목록
src/lib/store.ts             설정, 카운터, 임시 글 저장
src/lib/site.ts              배포 주소, 저장소 주소
public/_headers              Cloudflare 응답 헤더(CSP)
scripts/subset-font.mjs      제목 글꼴 서브셋 생성
```

고치고 싶을 때 볼 곳:

| 바꾸고 싶은 것 | 파일 |
| --- | --- |
| 문구, 콤보 자막, 결과 한마디 | `src/components/Vent.tsx` 위쪽 상수들 |
| 색 | `src/app/globals.css`의 `@theme`, `src/lib/fx.ts`의 색 상수 |
| 크리티컬이 터지는 단어 | `src/lib/hot.ts` |
| 위장 화면의 표 내용 | `src/components/Disguise.tsx`의 `DATA` |
| 사이트 주소, 저장소 주소 | `src/lib/site.ts` |

## 개인정보 설계

- 글은 React 상태(메모리)에만 있습니다. 날려버리면 연출에 쓸 글자 좌표만 잠깐 남기고 원문은 그 즉시 지웁니다.
- "탭 닫으면 증발" 모드만 예외로 `sessionStorage`를 씁니다. 새로고침이 아닌 경로(닫은 탭 다시 열기, 세션 복원)로 돌아오면 버립니다.
- `localStorage`에는 설정과 숫자(오늘 횟수, 글자 수, 최고 콤보)만 들어갑니다.
- `public/_headers`의 CSP가 `connect-src 'none'`이라 스크립트가 어디로도 요청을 보낼 수 없습니다. 같은 이유로 페이지 이동에는 `next/link` 대신 `<a>`를 씁니다.
- 분석 도구, 쿠키, 외부 글꼴, 외부 스크립트가 없습니다. 입력창은 맞춤법 검사와 자동완성을 꺼 두었습니다.

## 배포 (Cloudflare)

정적 사이트라 둘 중 어느 방식으로든 올릴 수 있습니다. 두 방식 모두 `public/_headers`를 그대로 적용합니다.

**Workers**: Workers & Pages → Create → Import a repository

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` (`wrangler.jsonc`가 `out/`을 올리도록 되어 있습니다)

**Pages**: Workers & Pages → Create → Pages → Connect to Git

- Build command: `npm run build`
- Build output directory: `out`

배포 주소가 `https://hjparkk.com`이 아니면 `src/lib/site.ts`를 고치거나 빌드 환경 변수 `NEXT_PUBLIC_SITE_URL`을 넣으세요. 공유 미리보기(OG) 주소에 쓰입니다.

## 글꼴

제목에는 [Black Han Sans](https://github.com/zesstype/Black-Han-Sans)(SIL Open Font License 1.1)를 씁니다. 원본은 `fonts-src/`에 라이선스와 함께 있고, `npm run dev`와 `npm run build` 직전에 화면에 쓰는 글자만 골라 `src/fonts/display.woff2`(약 30KB)로 다시 만듭니다. 문구를 바꿔도 따로 할 일은 없습니다. 본문과 입력창은 기기 기본 글꼴을 씁니다.
