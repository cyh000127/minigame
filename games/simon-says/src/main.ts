import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>SIMON SAYS</p>
        <h1>Simon Says</h1>
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
        <span>BEST</span>
        <strong>0000</strong>
      </div>
    </section>

    <section class="pads" aria-label="Simon pads">
      <button class="pad pad--up" type="button">UP</button>
      <button class="pad pad--left" type="button">LEFT</button>
      <button class="pad pad--right" type="button">RIGHT</button>
      <button class="pad pad--down" type="button">DOWN</button>
    </section>
  </main>
`;
