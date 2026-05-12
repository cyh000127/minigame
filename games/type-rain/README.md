# Type Rain

위에서 떨어지는 단어를 빠르게 입력해 제거하는 타이핑 반응 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5183`을 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- 알파벳 키: 현재 입력 버퍼에 문자 추가
- `Backspace`: 마지막 문자 삭제
- `Enter`: 입력 확정
- `Space`: 시작 또는 일시정지

## 규칙

- 위에서 떨어지는 단어와 같은 문자열을 입력한 뒤 `Enter`를 누르면 단어가 제거됩니다.
- 단어 길이, 현재 레벨, 연속 성공 수에 따라 점수가 증가합니다.
- 단어가 화면 아래에 닿으면 목숨이 1개 줄어듭니다.
- 목숨이 0개가 되면 게임이 종료됩니다.
- 점수가 오를수록 레벨이 올라가고, 단어 낙하 속도와 생성 간격이 빨라집니다.
- 최고 점수는 브라우저 `localStorage`에 저장됩니다.
- 실행기에서 보내는 `start`, `pause`, `gameOver`, `reset` 제어 메시지를 처리할 수 있습니다.

## 구조

```text
src/
  game.ts       단어 생성, 낙하, 입력 판정, 점수 엔진
  game.test.ts  게임 엔진 단위 테스트
  main.ts       브라우저 진입점과 기본 UI
  styles.css    Type Rain 화면 스타일
```

이 게임은 `games/type-rain` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
