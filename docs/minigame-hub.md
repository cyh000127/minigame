# 미니게임 허브 연동 가이드

루트 실행기는 `http://127.0.0.1:5173`에서 게임 목록을 보여주고, 선택한 게임을 `games/<game-name>/index.html` 경로로 iframe에 로드합니다.

## 목표

- 게임 선택과 실행 진입점은 루트 허브에서 담당한다.
- 각 게임의 실제 구현 코드는 계속 `games/<game-name>/` 내부에 둔다.
- 게임끼리는 서로 import하지 않는다.
- 루트 허브는 게임 코드가 아니라 게임 메타데이터와 실행 URL만 관리한다.

## 실행 방법

```bash
corepack pnpm install
corepack pnpm run dev
```

기본 주소는 `http://127.0.0.1:5173`입니다.

Quoridor처럼 별도 서버가 필요한 게임은 서버도 함께 실행합니다.

```bash
corepack pnpm run dev:quoridor-server
```

## 새 게임을 허브에 추가하는 절차

1. `games/<game-name>/`에 게임을 만든다.
2. 게임의 `index.html`은 엔트리 스크립트를 상대 경로로 선언한다.

```html
<script type="module" src="./src/main.ts"></script>
```

React/TSX 엔트리도 같은 원칙을 적용합니다.

```html
<script type="module" src="./src/client/main.tsx"></script>
```

3. `src/launcher.ts`의 `GAMES` 배열에 게임 메타데이터를 추가한다.

```ts
{
  slug: 'sample-game',
  title: 'Sample Game',
  genre: 'Arcade',
  description: '게임 선택기에 표시될 짧은 설명',
  controls: ['Arrow Keys', 'Space'],
  accent: '#58f08b',
  status: 'playable',
}
```

4. 별도 서버가 필요한 게임은 `status: 'needs-server'`로 표시하고, 루트 `package.json`에 필요한 서버 실행 스크립트를 추가한다.
5. 루트와 해당 게임의 빌드/테스트를 실행한다.

```bash
corepack pnpm run test
corepack pnpm run build
corepack pnpm --dir games/<game-name> run build
```

## 공통 lifecycle 계약

게임은 독립 디렉토리 안에서 다음 메서드를 가진 runtime을 둘 수 있습니다.

```ts
interface MiniGameLifecycle {
  start(): void;
  pause(): void;
  gameOver(): void;
}
```

루트 허브는 게임 iframe에 다음 메시지를 보냅니다.

```ts
type MiniGameCommand = 'start' | 'pause' | 'gameOver';

interface MiniGameLifecycleMessage {
  source: 'minigame-hub';
  command: MiniGameCommand;
  gameSlug: string;
}
```

새 게임은 필요하면 자기 디렉토리 안에서만 메시지 어댑터를 구현합니다.

```ts
const runtime: MiniGameLifecycle = {
  start() {
    // 게임 시작 또는 재개
  },
  pause() {
    // requestAnimationFrame 중지, 입력 비활성화 등
  },
  gameOver() {
    // 게임 종료 상태 처리
  },
};

window.addEventListener('message', (event: MessageEvent<MiniGameLifecycleMessage>) => {
  if (event.data?.source !== 'minigame-hub') {
    return;
  }

  if (event.data.command === 'start') {
    runtime.start();
  }

  if (event.data.command === 'pause') {
    runtime.pause();
  }

  if (event.data.command === 'gameOver') {
    runtime.gameOver();
  }
});
```

이 계약은 문서 기반 규칙입니다. 게임은 루트 코드를 import하지 않고, 필요한 타입과 어댑터는 해당 게임 디렉토리 안에 둡니다.

## 유지보수 규칙

- 허브에 추가되는 정보는 게임 제목, 장르, 설명, 조작키, 실행 상태까지만 둔다.
- 점수 계산, 저장소, 에셋, 입력 처리, 엔진 코드는 각 게임 내부에 둔다.
- 루트 허브에서 특정 게임의 내부 모듈을 import하지 않는다.
- 새 게임을 추가할 때는 README의 게임 목록과 `src/launcher.ts`의 `GAMES` 배열을 함께 갱신한다.

## 게임별 고도화 원칙

- 기존 게임을 고도화할 때도 다른 게임 디렉토리의 코드를 참고하거나 공유하지 않는다.
- 새 규칙, 난이도 모드, 보너스 점수, 효과음, 저장소 키는 해당 게임 디렉토리 내부에서만 정의한다.
- 허브 계약은 `start`, `pause`, `gameOver` 메시지와 실행 URL까지만 유지한다.
- 여러 게임에 비슷한 기능이 필요해도 공통 모듈로 올리지 않고, 각 게임의 장르와 UI에 맞게 별도 구현한다.
- 고도화 내용을 추가하면 해당 게임의 `README.md`에 조작법과 규칙 변화를 함께 기록한다.
