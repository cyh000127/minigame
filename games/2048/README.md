# 2048

같은 숫자 타일을 합쳐 2048 타일을 만드는 퍼즐 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5178`을 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- `ArrowUp`: 위로 밀기
- `ArrowRight`: 오른쪽으로 밀기
- `ArrowDown`: 아래로 밀기
- `ArrowLeft`: 왼쪽으로 밀기
- 터치 화면에서는 스와이프로 이동

## 구조

```text
src/
  main.ts     브라우저 진입점과 기본 UI
  styles.css  2048 화면 스타일
```

이 게임은 `games/2048` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
