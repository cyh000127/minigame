# Simon Says

네 개의 패드가 보여주는 순서를 기억하고 같은 순서로 입력하는 클래식 기억력 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5181`을 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- 방향키 또는 WASD: 패드 입력
- `Space`: 시작 또는 일시정지
- `Enter`: 새 게임

## 구조

```text
src/
  main.ts      브라우저 진입점과 기본 UI
  styles.css   Simon Says 화면 스타일
```

이 게임은 `games/simon-says` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
