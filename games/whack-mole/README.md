# Whack Mole

3x3 구멍에 나타나는 두더지를 빠르게 잡아 점수를 올리는 반응 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5184`를 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- 마우스 또는 터치: 두더지 잡기
- 숫자키 `1`부터 `9`: 대응되는 구멍 공격
- `Space`: 시작 또는 일시정지
- `Enter`: 새 게임

## 규칙

- 제한 시간 안에 나타나는 두더지를 잡으면 점수를 얻습니다.
- 금색 두더지는 일반 두더지보다 높은 점수를 줍니다.
- 연속으로 두더지를 잡으면 콤보 점수가 붙습니다.
- 빈 구멍을 치거나 두더지를 놓치면 목숨이 1개 줄어듭니다.
- 점수가 오를수록 레벨이 올라가고 두더지 출현 시간이 짧아집니다.
- 목숨이 0개가 되면 게임이 종료되고, 시간이 끝나면 클리어됩니다.
- 최고 점수는 브라우저 `localStorage`에 저장됩니다.
- 실행기에서 보내는 `start`, `pause`, `gameOver`, `reset` 제어 메시지를 처리할 수 있습니다.

## 구조

```text
src/
  game.ts       두더지 생성, 시간, 잡기 판정, 점수 엔진
  game.test.ts  게임 엔진 단위 테스트
  main.ts       브라우저 진입점과 기본 UI
  styles.css    Whack Mole 화면 스타일
```

이 게임은 `games/whack-mole` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
