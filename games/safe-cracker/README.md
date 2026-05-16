# Safe Cracker

숫자 코드를 잠깐 보고 그대로 입력해 금고를 해제하는 기억력 퍼즐 게임입니다. 스테이지가 올라갈수록 코드 길이는 길어지고, 공개 시간과 입력 시간은 짧아집니다.

## 규칙

- 스테이지마다 여러 개의 금고 코드를 연속으로 해제해야 합니다.
- 공개된 숫자 코드를 외운 뒤 입력창이나 숫자 버튼으로 그대로 입력합니다.
- 스테이지 목표 수만큼 성공하면 점수 보너스를 얻고 다음 스테이지로 넘어갑니다.
- 오답 3회 또는 시간초과 시 게임이 종료됩니다.

## 조작

- `0` ~ `9`: 숫자 입력
- `Enter`: 제출
- `Backspace`: 마지막 숫자 삭제
- `Mouse` / `Touch`: 숫자 패드, 제출, 초기화

## 실행

```bash
corepack pnpm --dir games/safe-cracker install
corepack pnpm --dir games/safe-cracker run dev
```

브라우저에서 `http://127.0.0.1:5198`을 열면 됩니다.

## 테스트

```bash
corepack pnpm --dir games/safe-cracker exec vitest --run
corepack pnpm --dir games/safe-cracker exec tsc --noEmit
corepack pnpm --dir games/safe-cracker exec vite build
```
