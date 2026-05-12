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

## 구조

```text
src/
  main.ts      브라우저 진입점과 기본 UI
  styles.css   Whack Mole 화면 스타일
```

이 게임은 `games/whack-mole` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
