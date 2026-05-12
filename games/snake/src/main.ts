import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>SNAKE</p>
        <h1>Snake</h1>
      </div>
      <button type="button">Start</button>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong>000</strong>
      </div>
      <div>
        <span>BEST</span>
        <strong>000</strong>
      </div>
      <div>
        <span>SPEED</span>
        <strong>01</strong>
      </div>
    </section>

    <section class="board" aria-label="Snake board">
      ${Array.from({ length: 225 }, (_, index) => {
        const snake = [112, 113, 114, 115].includes(index);
        const food = index === 92;
        return `<span class="${snake ? 'cell cell--snake' : food ? 'cell cell--food' : 'cell'}"></span>`;
      }).join('')}
    </section>
  </main>
`;
