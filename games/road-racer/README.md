# Road Racer

칸 단위로 좌우 이동하며 마주 오는 차와 장애물을 피하는 고전 레이싱 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5175`를 사용합니다.

## 게임 규칙

- 왼쪽/오른쪽 방향키로 차선을 한 칸씩 이동합니다.
- 점수는 생존 시간에 따라 증가합니다.
- 시간이 지날수록 도로 오브젝트가 내려오는 속도가 빨라집니다.
- 마주 오는 차나 장애물과 같은 차선에서 충돌하면 게임이 종료됩니다.
- 게임 종료 후 Top 10에 들어가는 점수는 대문자 알파벳 세 글자로 등록합니다.
- 순위는 브라우저 저장소에 JSON 문자열로 보관하며, 11위 기록은 제거합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 구조

```text
src/
  game.ts      차선 이동, 점수, 속도, 충돌 엔진
  game.test.ts 게임 엔진 테스트
  leaderboard.ts      JSON 순위 저장 엔진
  leaderboard.test.ts 순위 저장 엔진 테스트
  main.ts      브라우저 진입점
  styles.css   게임 화면 스타일
```

이 게임은 `games/road-racer` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
