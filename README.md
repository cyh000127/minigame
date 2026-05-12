# Minigame

미니게임을 하나씩 독립적으로 만들어 나가는 저장소입니다. 각 게임은 서로 다른 게임의 코드를 참조하지 않고, 자기 디렉토리 안에서만 완결되도록 관리합니다.

## 기본 원칙

- 게임은 `games/<game-name>/` 아래에 하나씩 만든다.
- 각 게임은 다른 게임 디렉토리의 코드를 읽거나 import하지 않는다.
- 게임별 소스, 에셋, 테스트, 실행 문서는 해당 게임 디렉토리 안에 둔다.
- 코드 구현은 TypeScript로 진행한다.
- 공통 유틸, 공통 컴포넌트, 공유 에셋 디렉토리는 만들지 않는다.
- 루트에는 저장소 운영 문서와 전체 설정만 둔다.

## 권장 구조

```text
minigame/
  games/
    game-name/
      README.md
      package.json
      src/
      assets/
      tests/
  docs/
    development-guide.md
    commit-convention.md
```

## 문서

- [개발 가이드](docs/development-guide.md)
- [커밋 컨벤션](docs/commit-convention.md)
- [미니게임 허브 연동 가이드](docs/minigame-hub.md)

## 메인 실행기

루트 실행기는 게임 목록을 보여주고 선택한 게임을 `games/<game-name>/index.html`에서 실행합니다.

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 주소는 `http://127.0.0.1:5173`입니다.

## 게임

- [Quoridor](games/quoridor/README.md)
- [Road Racer](games/road-racer/README.md)
- [Brick Breaker](games/brick-breaker/README.md)
- [Color Match](games/color-match/README.md)
- [2048](games/2048/README.md)
