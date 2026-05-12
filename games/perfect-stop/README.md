# Perfect Stop

움직이는 커서를 목표 구간 안에서 정확히 멈추는 타이밍 반응 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5182`를 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- `Space`: 커서 정지 또는 시작
- `Enter`: 새 게임
- 마우스 또는 터치: 커서 정지

## 구조

```text
src/
  main.ts      브라우저 진입점과 기본 UI
  styles.css   Perfect Stop 화면 스타일
```

이 게임은 `games/perfect-stop` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
