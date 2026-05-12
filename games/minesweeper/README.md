# Minesweeper

지뢰가 없는 칸을 추론해서 모두 여는 클래식 퍼즐 게임입니다.

## 기술 스택

- TypeScript
- Vite
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 개발 서버는 `http://127.0.0.1:5179`를 사용합니다.

## 스크립트

```bash
corepack pnpm run build
corepack pnpm run preview
corepack pnpm run test
```

## 조작

- 좌클릭 또는 탭: 칸 열기
- 우클릭: 깃발 표시/해제
- 터치 길게 누르기: 깃발 표시/해제
- 난이도 버튼: 보드 크기와 지뢰 수 변경

## 게임 규칙

- 첫 클릭 지점과 주변 칸에는 지뢰를 배치하지 않습니다.
- 숫자는 주변 8칸에 있는 지뢰 수를 의미합니다.
- 숫자가 없는 빈 칸을 열면 연결된 안전 칸이 자동으로 열립니다.
- 모든 안전 칸을 열면 승리하고, 지뢰를 열면 패배합니다.
- 난이도별 최고 기록은 브라우저 `localStorage`에 저장합니다.
- 루트 실행기의 `start`, `pause`, `gameOver` lifecycle 메시지를 처리합니다.

## 구조

```text
src/
  game.ts       지뢰찾기 보드 생성, 클릭, 깃발, 승패 판정 엔진
  game.test.ts  게임 엔진 단위 테스트
  main.ts       브라우저 진입점, 입력, 렌더링, 기록 저장
  styles.css    지뢰찾기 화면 스타일
```

이 게임은 `games/minesweeper` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
