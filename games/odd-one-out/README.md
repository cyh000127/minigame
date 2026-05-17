# Odd One Out

제한시간 안에 미묘하게 다른 색 타일 하나를 찾아내는 시각 반응 퍼즐입니다. 정답을 연속으로 맞히면 점수가 빠르게 오르고, 스테이지를 클리어할 때마다 보드가 더 촘촘해지고 색 차이가 줄어듭니다.

## 규칙

- 한 라운드마다 보드 안에 다른 색 타일이 정확히 1개 존재합니다.
- 정답 타일을 누르면 점수를 얻고 다음 라운드로 즉시 넘어갑니다.
- 스테이지마다 요구 라운드 수를 채우면 점수 보너스를 받고 다음 스테이지로 리셋됩니다.
- 오답 3회 또는 시간초과 시 게임이 종료되며 최고 점수가 저장됩니다.

## 조작

- `Mouse` / `Touch`: 다른 색 타일 선택
- `Start`: 새 게임 시작
- `Pause`: 일시정지 / 재개
- `Reset`: 현재 진행 초기화

## 실행

```bash
corepack pnpm --dir games/odd-one-out install
corepack pnpm --dir games/odd-one-out run dev
```

브라우저에서 `http://127.0.0.1:5197`을 열면 됩니다.

## 테스트

```bash
corepack pnpm --dir games/odd-one-out run test
corepack pnpm --dir games/odd-one-out run build
```
