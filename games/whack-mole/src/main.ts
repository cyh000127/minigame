import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>WHACK MOLE</p>
        <h1>Whack Mole</h1>
      </div>
      <button type="button">Start</button>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong>0000</strong>
      </div>
      <div>
        <span>TIME</span>
        <strong>30</strong>
      </div>
      <div>
        <span>LIFE</span>
        <strong>03</strong>
      </div>
    </section>

    <section class="board" aria-label="Whack Mole board">
      ${Array.from({ length: 9 }, (_, index) => {
        const active = index === 4;
        return `<button class="${active ? 'hole is-active' : 'hole'}" type="button">${active ? 'MOLE' : index + 1}</button>`;
      }).join('')}
    </section>
  </main>
`;
