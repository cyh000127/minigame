# Brick Breaker

HTML5 Canvas와 TypeScript로 구현하는 neon boardgame 스타일 벽돌깨기 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest
- HTML5 Canvas

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5176`을 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 구조

```text
src/
  engine.ts    물리, 점수, 스테이지 엔진
  engine.test.ts 엔진 테스트
  main.ts      Canvas 초기화와 앱 진입점
  styles.css   neon boardgame 화면 스타일
```

이 게임은 `games/brick-breaker` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
