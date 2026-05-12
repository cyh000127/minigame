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

## 규칙

- 좌우로 움직이는 커서를 목표 구간 안에서 멈추면 성공합니다.
- 목표 구간 중앙에 가까울수록 높은 점수를 얻습니다.
- 4라운드부터 목표 구간이 천천히 이동합니다.
- 파란색 보너스 구간 안에서 성공하면 추가 점수를 얻습니다.
- 연속 성공 시 스트릭 보너스가 붙습니다.
- 라운드가 오를수록 커서가 빨라지고 목표 구간이 좁아집니다.
- 실패하면 목숨이 1개 줄고, 목숨이 0개가 되면 게임이 종료됩니다.
- 12라운드를 넘기면 클리어입니다.
- 최고 점수는 브라우저 `localStorage`에 저장됩니다.
- 실행기에서 보내는 `start`, `pause`, `gameOver`, `reset` 제어 메시지를 처리할 수 있습니다.

## 구조

```text
src/
  game.ts       커서 이동, 판정, 점수, 라운드 엔진
  game.test.ts  게임 엔진 단위 테스트
  main.ts       브라우저 진입점과 기본 UI
  styles.css    Perfect Stop 화면 스타일
```

이 게임은 `games/perfect-stop` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
