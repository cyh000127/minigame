import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>MINESWEEPER</p>
        <h1>지뢰찾기</h1>
      </div>
      <button type="button">New Game</button>
    </header>

    <section class="status-panel" aria-label="Game status">
      <div>
        <span>MINES</span>
        <strong>010</strong>
      </div>
      <div>
        <span>TIME</span>
        <strong>000</strong>
      </div>
      <div>
        <span>BEST</span>
        <strong>--</strong>
      </div>
    </section>

    <section class="difficulty-panel" aria-label="Difficulty selector">
      <button type="button" class="is-selected">Easy</button>
      <button type="button">Normal</button>
      <button type="button">Hard</button>
    </section>

    <section class="board" aria-label="Minesweeper board">
      ${Array.from({ length: 81 }, (_, index) => {
        const preview = [10, 11, 12, 20, 21, 22, 30, 31, 40, 50];
        const opened = preview.includes(index);
        const number = opened ? (index % 3) + 1 : '';
        return `<button class="cell ${opened ? 'cell--open' : ''}" type="button">${number}</button>`;
      }).join('')}
    </section>
  </main>
`;
