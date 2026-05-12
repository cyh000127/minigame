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

## 규칙

- 플레이어는 왼쪽 패들을 조작하고 AI는 오른쪽 패들을 자동으로 움직입니다.
- 공이 상대편 뒤로 지나가면 1점을 얻습니다.
- 패들에 공이 닿을 때마다 랠리가 증가하고 공 속도가 조금씩 빨라집니다.
- 먼저 5점을 얻으면 승리합니다.
- 라운드가 끝나면 `Space`를 눌러 다음 랠리를 시작합니다.
- 실행기에서 보내는 `start`, `pause`, `gameOver`, `reset` 제어 메시지를 처리할 수 있습니다.

## 구조

```text
src/
  game.ts       패들, 공, 충돌, AI, 득점 엔진
  game.test.ts  게임 엔진 단위 테스트
  main.ts       브라우저 진입점과 기본 UI
  styles.css    Pong Duel 화면 스타일
```

이 게임은 `games/pong-duel` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
