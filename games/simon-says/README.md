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
- 마우스 또는 터치: 패드 입력
- `Space`: 시작 또는 일시정지
- `Enter`: 새 게임

## 규칙

- 게임이 보여주는 패드 순서를 기억한 뒤 같은 순서로 입력합니다.
- 4라운드마다 `REV` 모드가 나오며, 이때는 보여준 순서를 역순으로 입력합니다.
- 각 패드는 서로 다른 톤 사운드를 재생합니다.
- 라운드를 클리어할 때마다 시퀀스가 1개씩 길어집니다.
- 정답 입력과 라운드 클리어 보너스로 점수를 획득합니다.
- 3라운드마다 표시 속도가 빨라집니다.
- 틀린 패드를 누르면 게임이 종료됩니다.
- 최고 점수는 브라우저 `localStorage`에 저장됩니다.
- 실행기에서 보내는 `start`, `pause`, `gameOver`, `reset` 제어 메시지를 처리할 수 있습니다.

## 구조

```text
src/
  game.ts       시퀀스, 입력 판정, 점수, 속도 엔진
  game.test.ts  게임 엔진 단위 테스트
  main.ts       브라우저 진입점과 기본 UI
  styles.css    Simon Says 화면 스타일
```

이 게임은 `games/simon-says` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
