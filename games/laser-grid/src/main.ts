import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>LASER GRID</p>
        <h1>Laser Grid</h1>
      </div>
      <button type="button">Start</button>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong>0000</strong>
      </div>
      <div>
        <span>ENERGY</span>
        <strong>3</strong>
      </div>
      <div>
        <span>LEVEL</span>
        <strong>1</strong>
      </div>
    </section>

    <section class="grid" aria-label="Laser Grid board">
      ${Array.from({ length: 25 }, (_, index) => {
        const isPlayer = index === 12;
        return `<button class="${isPlayer ? 'cell is-player' : 'cell'}" type="button">${isPlayer ? 'CORE' : ''}</button>`;
      }).join('')}
    </section>
  </main>
`;
