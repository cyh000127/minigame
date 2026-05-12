import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>TYPE RAIN</p>
        <h1>Type Rain</h1>
      </div>
      <button type="button">Start</button>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong>0000</strong>
      </div>
      <div>
        <span>LEVEL</span>
        <strong>01</strong>
      </div>
      <div>
        <span>LIFE</span>
        <strong>03</strong>
      </div>
    </section>

    <section class="playfield" aria-label="Type Rain playfield">
      <span class="word word--one">CODE</span>
      <span class="word word--two">GAME</span>
      <span class="word word--three">TYPE</span>
    </section>

    <section class="input-panel" aria-label="Current input">
      <span>INPUT</span>
      <strong>READY</strong>
    </section>
  </main>
`;
