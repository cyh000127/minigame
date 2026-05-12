import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="game-shell">
    <header class="hero">
      <div>
        <h1>2048</h1>
        <p>Join the numbers and get to the <strong>2048 tile!</strong></p>
      </div>
      <aside class="score-panel" aria-label="Score board">
        <div>
          <span>SCORE</span>
          <strong>0</strong>
        </div>
        <div>
          <span>BEST</span>
          <strong>0</strong>
        </div>
      </aside>
    </header>

    <section class="action-row">
      <p>Use arrow keys or swipe to move every tile on the board.</p>
      <button type="button">New Game</button>
    </section>

    <section class="board" aria-label="2048 board">
      ${Array.from({ length: 16 }, (_, index) => {
        const previewValues = [4, 16, 4, 2, 0, 4, 32, 16, 2, 2, 8, 2, 0, 0, 0, 2];
        const value = previewValues[index] ?? 0;
        return `<div class="cell">${value > 0 ? `<span data-value="${value}">${value}</span>` : ''}</div>`;
      }).join('')}
    </section>
  </main>
`;
