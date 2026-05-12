# Pong Duel

왼쪽 패들을 조작해 AI 패들과 공을 주고받는 클래식 Pong 대전 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5185`를 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- `ArrowUp` 또는 `W`: 패들을 위로 이동
- `ArrowDown` 또는 `S`: 패들을 아래로 이동
- `Space`: 시작 또는 일시정지
- `Enter`: 새 게임

## 구조

```text
src/
  main.ts      브라우저 진입점과 기본 UI
  styles.css   Pong Duel 화면 스타일
```

이 게임은 `games/pong-duel` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
