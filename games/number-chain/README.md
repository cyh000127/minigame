# Number Chain

보드 위 숫자 중 `1`부터 순서대로 인접한 칸을 찾아 클릭하는 스테이지형 퍼즐 게임입니다. 스테이지가 오를수록 보드가 커지고 연결해야 하는 숫자 길이도 길어집니다.

## 규칙

- 각 스테이지에는 `1`부터 시작하는 정답 체인이 보드에 숨어 있습니다.
- 숫자는 상하좌우와 대각선까지 포함한 인접 칸으로 이어집니다.
- `1 -> 2 -> 3 ...` 순서로 정확히 클릭하면 스테이지를 클리어합니다.
- 오답 3회 또는 시간초과 시 게임이 종료됩니다.

## 조작

- `Mouse` / `Touch`: 숫자 칸 선택
- `Start`: 새 게임 시작
- `Pause`: 일시정지 / 재개
- `Reset`: 현재 진행 초기화

## 실행

```bash
corepack pnpm --dir games/number-chain install
corepack pnpm --dir games/number-chain run dev
```

브라우저에서 `http://127.0.0.1:5199`를 열면 됩니다.

## 테스트

```bash
corepack pnpm --dir games/number-chain exec vitest --run
corepack pnpm --dir games/number-chain exec tsc --noEmit
corepack pnpm --dir games/number-chain exec vite build
```
