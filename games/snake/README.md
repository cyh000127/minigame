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
- 터치/마우스 드래그: 이동 방향 변경

## 규칙

- 먹이를 먹을 때마다 10점을 획득하고 뱀의 길이가 1칸 증가합니다.
- 분홍색 보너스 먹이는 30점을 획득합니다.
- 장애물 모드를 켜면 고정 장애물이 생기며, 장애물과 충돌해도 게임이 종료됩니다.
- 먹이 5개 단위로 이동 속도 단계가 올라갑니다.
- 벽이나 자신의 몸과 충돌하면 게임이 종료됩니다.
- 최고 점수는 브라우저 `localStorage`에 저장됩니다.
- 실행기에서 보내는 `start`, `pause`, `gameOver`, `reset` 제어 메시지를 처리할 수 있습니다.

## 구조

```text
src/
  game.ts       Snake 이동, 성장, 먹이, 충돌, 속도 엔진
  game.test.ts  게임 엔진 단위 테스트
  main.ts       브라우저 진입점과 기본 UI
  styles.css    Snake 화면 스타일
```

이 게임은 `games/snake` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
