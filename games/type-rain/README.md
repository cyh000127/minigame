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

## 구조

```text
src/
  main.ts      브라우저 진입점과 기본 UI
  styles.css   Type Rain 화면 스타일
```

이 게임은 `games/type-rain` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
