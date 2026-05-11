import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="game-shell">
    <header class="scoreboard" aria-label="Game status">
      <div>
        <span class="label">SCORE</span>
        <strong>000000</strong>
      </div>
      <div>
        <span class="label">SPEED</span>
        <strong>01</strong>
      </div>
      <div>
        <span class="label">BEST</span>
        <strong>---</strong>
      </div>
    </header>
    <section class="cabinet" aria-label="Road Racer">
      <div class="road" aria-hidden="true">
        <div class="lane"></div>
        <div class="lane"></div>
        <div class="lane lane--player">CAR</div>
        <div class="lane"></div>
      </div>
      <div class="screen-message">
        <p class="kicker">ROAD RACER</p>
        <h1>READY</h1>
        <p>Press Enter to start after gameplay is implemented.</p>
      </div>
    </section>
  </main>
`;
