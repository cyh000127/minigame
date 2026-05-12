import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>PONG DUEL</p>
        <h1>Pong Duel</h1>
      </div>
      <button type="button">Start</button>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>PLAYER</span>
        <strong>00</strong>
      </div>
      <div>
        <span>ROUND</span>
        <strong>01</strong>
      </div>
      <div>
        <span>AI</span>
        <strong>00</strong>
      </div>
    </section>

    <section class="arena" aria-label="Pong Duel arena">
      <span class="net"></span>
      <span class="paddle paddle--player"></span>
      <span class="paddle paddle--ai"></span>
      <span class="ball"></span>
    </section>
  </main>
`;
