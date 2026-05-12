# Brick Breaker

HTML5 Canvas와 TypeScript로 구현하는 neon boardgame 스타일 벽돌깨기 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest
- HTML5 Canvas

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5176`을 사용합니다.

## 게임 규칙

- 마우스 또는 터치로 패들을 이동합니다.
- 클릭, 탭, Enter 또는 Space로 패들에 붙은 공을 발사합니다.
- 기본 생명은 3개이며, 모든 공이 하단으로 떨어지면 생명이 1개 줄어듭니다.
- 벽돌 5개를 깰 때마다 공 속도가 1.05배 증가합니다.
- 일반 벽돌은 100점, 단단한 벽돌은 파괴 시 250점입니다.
- 패들에 닿기 전 연속으로 벽돌을 깨면 `기본 점수 + 기본 점수 * 콤보 수`로 점수를 얻습니다.
- 스테이지 클리어 시 남은 생명 수마다 1000점 보너스를 얻습니다.
- 아이템은 벽돌 파괴 시 15% 확률로 드롭됩니다.
- 스테이지는 시드 기반 랜덤 알고리즘으로 생성되며, 생성 후 클리어 가능성 검증을 통과한 맵만 사용합니다.

## 아이템

- `EX`: 10초간 패들 확장
- `MB`: 현재 공 위치 기준 멀티볼 2개 추가
- `PS`: 5초간 벽돌을 관통하는 파워샷
- `MG`: 10초간 패들 자석 효과

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 구조

```text
src/
  engine.ts    물리, 점수, 스테이지 엔진
  engine.test.ts 엔진 테스트
  main.ts      Canvas 게임 루프, 입력, 렌더링
  styles.css   neon boardgame 화면 스타일
```

이 게임은 `games/brick-breaker` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
