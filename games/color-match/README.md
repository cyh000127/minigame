# Color Match

화면 중앙 캐릭터의 색상과 규칙에 맞는 방향키를 빠르게 누르는 순발력 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5177`을 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- `ArrowUp`: 위쪽 색상 선택
- `ArrowRight`: 오른쪽 색상 선택
- `ArrowDown`: 아래쪽 색상 선택
- `ArrowLeft`: 왼쪽 색상 선택
- `Enter` 또는 `Space`: 시작 또는 재시작

## 게임 규칙

- 중앙 캐릭터의 색상과 같은 방향키를 누르면 점수와 제한 시간이 증가합니다.
- `OPPOSITE` 라운드에서는 중앙 색상의 반대 색상 방향키를 눌러야 합니다.
- 연속 성공이 8회 이상이면 피버 타임이 발동하고 점수 배율이 크게 증가합니다.
- 정답 수가 늘수록 제한 시간이 짧아지고 타이머 감소 속도가 빨라집니다.

## 구조

```text
src/
  game.ts       게임 상태, 점수, 타이머, 함정 패턴 엔진
  game.test.ts  게임 엔진 단위 테스트
  main.ts       브라우저 진입점과 기본 UI
  styles.css    color match 화면 스타일
```

이 게임은 `games/color-match` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
