# Laser Grid

5x5 격자에서 경고 표시 후 발사되는 행/열 레이저를 피해 오래 버티는 회피 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5188`을 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- 방향키 또는 `WASD`: 격자 한 칸 이동
- `Space`: 시작 또는 일시정지
- `Enter`: 새 게임

## 규칙

- 레이저는 행 또는 열 단위로 먼저 경고된 뒤 짧게 발사됩니다.
- 발사 중인 레이저 위에 있으면 에너지를 잃습니다.
- 시간이 지날수록 레이저 출현 간격이 줄어듭니다.
- 에너지가 0이 되면 게임이 종료됩니다.

## 구조

```text
src/
  main.ts      브라우저 진입점과 기본 UI
  styles.css   Laser Grid 화면 스타일
```

이 게임은 `games/laser-grid` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
