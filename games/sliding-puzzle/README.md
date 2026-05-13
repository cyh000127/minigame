# Sliding Puzzle

빈 칸을 이용해 숫자 타일을 순서대로 맞추는 슬라이딩 퍼즐 게임입니다.

## 실행

```bash
pnpm --dir games/sliding-puzzle install
pnpm --dir games/sliding-puzzle dev
```

기본 주소는 `http://127.0.0.1:5189`입니다.

## 규칙

- Easy는 3x3, Normal은 4x4, Hard는 5x5 보드입니다.
- 빈 칸과 맞닿은 타일만 이동할 수 있습니다.
- 보드는 완성 상태에서 실제 이동을 반복해 섞으므로 항상 풀 수 있습니다.
- 숫자가 오름차순으로 정렬되고 빈 칸이 마지막에 오면 클리어입니다.

## 조작

- 마우스/터치: 빈 칸과 인접한 타일 클릭
- 방향키/WASD: 빈 칸 이동
- N: 새 게임

## 점수

클리어 시 난이도별 기본 점수에서 시간과 이동 횟수 페널티를 차감합니다. 클리어 점수는 허브에 `minigame:game-over` 메시지로 전달됩니다.
