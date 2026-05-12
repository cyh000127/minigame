import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>PERFECT STOP</p>
        <h1>Perfect Stop</h1>
      </div>
      <button type="button">Start</button>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong>0000</strong>
      </div>
      <div>
        <span>ROUND</span>
        <strong>01</strong>
      </div>
      <div>
        <span>LIFE</span>
        <strong>03</strong>
      </div>
    </section>

    <section class="meter" aria-label="Timing meter">
      <span class="zone"></span>
      <span class="cursor"></span>
    </section>
  </main>
`;
