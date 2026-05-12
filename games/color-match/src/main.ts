import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="scoreboard" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong>000000</strong>
      </div>
      <div>
        <span>STREAK</span>
        <strong>00</strong>
      </div>
      <div>
        <span>SPEED</span>
        <strong>01</strong>
      </div>
    </header>
    <section class="arena" aria-label="Color Match board">
      <button class="direction direction--up" type="button">
        <span>UP</span>
      </button>
      <button class="direction direction--right" type="button">
        <span>RIGHT</span>
      </button>
      <button class="direction direction--down" type="button">
        <span>DOWN</span>
      </button>
      <button class="direction direction--left" type="button">
        <span>LEFT</span>
      </button>
      <div class="character" aria-label="Target character">
        <div class="character__face"></div>
      </div>
      <div class="prompt">
        <p>COLOR MATCH</p>
        <h1>READY</h1>
        <button type="button">START</button>
      </div>
    </section>
  </main>
`;
