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

## 구조

```text
src/
  main.ts      브라우저 진입점과 기본 UI
  styles.css   지뢰찾기 화면 스타일
```

이 게임은 `games/minesweeper` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
