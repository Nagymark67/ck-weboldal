(() => {
  const normalizeTitle = (title) => title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
  const excludedTitles = new Set(
    (window.NOTARULETT_EXCLUDED_TITLES || []).map(normalizeTitle)
  );
  const songs = (window.NOTARULETT_SONGS || [])
    .filter((song) => !excludedTitles.has(normalizeTitle(song.title)));
  const songResult = document.getElementById('songResult');
  const spinButton = document.getElementById('spinButton');
  if (!songResult || !spinButton || !songs.length) return;

  const titles = songs.map((song) => song.title);
  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function spin() {
    spinButton.disabled = true;
    songResult.classList.add('spinning');
    for (let i = 0; i < 16; i += 1) {
      songResult.textContent = pick(titles);
      await wait(55 + i * 7);
    }
    songResult.textContent = pick(titles);
    songResult.classList.remove('spinning');
    spinButton.textContent = 'Új nóta';
    spinButton.disabled = false;
  }
  spinButton.addEventListener('click', spin);
})();
