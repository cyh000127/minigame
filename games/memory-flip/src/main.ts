import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>MEMORY FLIP</p>
        <h1>Memory Flip</h1>
      </div>
      <button type="button">Start</button>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong>0000</strong>
      </div>
      <div>
        <span>MOVES</span>
        <strong>00</strong>
      </div>
      <div>
        <span>TIME</span>
        <strong>90</strong>
      </div>
    </section>

    <section class="board" aria-label="Memory Flip board">
      ${Array.from({ length: 16 }, (_, index) => {
        const revealed = [1, 6, 9, 14].includes(index);
        return `<button class="${revealed ? 'card is-face-up' : 'card'}" type="button">${revealed ? 'STAR' : index + 1}</button>`;
      }).join('')}
    </section>
  </main>
`;
