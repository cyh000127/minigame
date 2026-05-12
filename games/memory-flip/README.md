# Memory Flip

4x4 카드판에서 같은 그림 쌍을 찾아 모든 카드를 맞추는 기억력 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5186`을 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- 마우스 또는 터치: 카드 뒤집기
- 숫자키 `1`부터 `9`, `Q`, `W`, `E`, `A`, `S`, `D`, `F`: 카드 선택
- `Space`: 시작 또는 일시정지
- `Enter`: 새 게임

## 구조

```text
src/
  main.ts      브라우저 진입점과 기본 UI
  styles.css   Memory Flip 화면 스타일
```

이 게임은 `games/memory-flip` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
