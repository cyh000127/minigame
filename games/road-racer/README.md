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

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 구조

```text
src/
  main.ts      브라우저 진입점
  styles.css   게임 화면 스타일
```

이 게임은 `games/road-racer` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
