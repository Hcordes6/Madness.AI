


const STAT_FILES = {
  assists: 'assists-per-game',
  benchPoints: 'bench-points-per-game',
  blocks: 'blocks-per-game',
};

async function loadStat(key) {
  const file = STAT_FILES[key] ?? key; // allows passing a key or direct filename base
  const res = await fetch(`data/${file}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${file}.json: ${res.status}`);
  return res.json();
}


document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [assists, bench, blocks] = await Promise.all([
      loadStat('assists'),
      loadStat('benchPoints'),
      loadStat('blocks'),
    ]);
    console.log({ assists, bench, blocks });
    // TODO: render into the DOM

    const assistsContainer = document.getElementById('assists');
    const benchContainer = document.getElementById('bench');
    const blocksContainer = document.getElementById('blocks');

    assistsContainer.textContent = JSON.stringify(assists, null, 2);
    benchContainer.textContent = JSON.stringify(bench, null, 2);
    blocksContainer.textContent = JSON.stringify(blocks, null, 2);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
});