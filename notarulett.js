(() => {
  const songs = window.NOTARULETT_SONGS || [];
  const categoryResult = document.getElementById('categoryResult');
  const songResult = document.getElementById('songResult');
  const spinButton = document.getElementById('spinButton');
  const againButton = document.getElementById('againButton');
  if (!categoryResult || !songResult || !spinButton || !songs.length) return;

  const categories = [...new Set(songs.map((song) => song.category))];
  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const categorySongs = (category) => songs.filter((song) => song.category === category);

  async function spin() {
    spinButton.disabled = true;
    againButton.hidden = true;
    songResult.textContent = 'A kategória forog…';
    categoryResult.classList.add('spinning');
    for (let i = 0; i < 12; i += 1) {
      categoryResult.textContent = pick(categories);
      await wait(70 + i * 8);
    }
    const category = pick(categories);
    categoryResult.textContent = category;
    categoryResult.classList.remove('spinning');
    await wait(400);
    songResult.classList.add('spinning');
    const eligible = categorySongs(category);
    for (let i = 0; i < 16; i += 1) {
      songResult.textContent = pick(eligible).title;
      await wait(55 + i * 7);
    }
    songResult.textContent = pick(eligible).title;
    songResult.classList.remove('spinning');
    spinButton.textContent = 'Új kategória';
    againButton.hidden = false;
    spinButton.disabled = false;
  }
  spinButton.addEventListener('click', spin);
  againButton.addEventListener('click', spin);
})();
