# Quoridor

TypeScript로 구현된 독립 쿼리도 게임입니다. React 클라이언트, Socket.IO 서버, 공유 게임 엔진을 이 디렉토리 안에서 함께 관리합니다.

## 기술 스택

- TypeScript
- React
- Vite
- Socket.IO
- Vitest

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev:server
corepack pnpm run dev:client
```

기본 포트는 다음과 같습니다.

- 클라이언트: `http://127.0.0.1:5174`
- 서버: `http://127.0.0.1:10002`

## 스크립트

```bash
corepack pnpm run test
corepack pnpm run build
corepack pnpm run start
```

## 구조

```text
src/
  client/   React 클라이언트
  server/   Socket.IO 기반 룸 서버
  shared/   쿼리도 타입, 스키마, 게임 엔진
```

이 게임은 `games/quoridor` 내부 코드만 사용하며, 다른 게임 디렉토리의 코드를 참조하지 않습니다.
