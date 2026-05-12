# Snake

격자 위에서 뱀을 조종해 먹이를 먹고 길이를 늘리는 클래식 아케이드 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5180`을 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- 방향키 또는 WASD: 이동 방향 변경
- `Space`: 시작 또는 일시정지
- `Enter`: 새 게임

## 구조

```text
src/
  game.ts       Snake 이동, 성장, 먹이, 충돌, 속도 엔진
  game.test.ts  게임 엔진 단위 테스트
  main.ts       브라우저 진입점과 기본 UI
  styles.css    Snake 화면 스타일
```

이 게임은 `games/snake` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
