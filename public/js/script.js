


const STAT_FILES = {
  assistTurnoverRatio: 'assist-turnover-ratio',
  assistsPerGame: 'assists-per-game',
  benchPoints: 'bench-points-per-game',
  blocksPerGame: 'blocks-per-game',
  defensiveReboundsPerGame: 'defensive-rebounds-per-game',
  effectiveFieldGoalPercentage: 'effective-field-goal-percentage',
  fastbreakPoints: 'fastbreak-points',
  fieldGoalPercentageDefense: 'field-goal-percentage-defense',
  fieldGoalPercentage: 'field-goal-percentage',
  foulsPerGame: 'fouls-per-game',
  freeThrowAttemptsPerGame: 'free-throw-attempts-per-game',
  freeThrowPercentage: 'free-throw-percentage',
  freeThrowsMadePerGame: 'free-throws-made-per-game',
  offensiveReboundsPerGame: 'offensive-rebounds-per-game',
  reboundMargin: 'rebound-margin',
  reboundsPerGame: 'rebounds-per-game',
  scoringDefense: 'scoring-defense',
  scoringMargin: 'scoring-margin',
  scoringOffense: 'scoring-offense',
  stealsPerGame: 'steals-per-game',
  threePointAttemptsPerGame: 'three-point-attempts-per-game',
  threePointPercentageDefense: 'three-point-percentage-defense',
  threePointPercentage: 'three-point-percentage',
  threePointersPerGame: 'three-pointers-per-game',
  turnoverMargin: 'turnover-margin',
  turnoversForcedPerGame: 'turnovers-forced-per-game',
  turnoversPerGame: 'turnovers-per-game',
  winningPercentage: 'winning-percentage',
  historicalWinners: 'historical-winners',
};

async function loadStat(key) {
  const file = STAT_FILES[key] ?? key; // allows passing a key or direct filename base
  const res = await fetch(`data/${file}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${file}.json: ${res.status}`);
  return res.json();
}

// --- Helpers for merging pages, parsing numbers, and building lookups ---
function mergePages(paged) {
  // paged may be either:
  // - an array of page objects like { data: [...] }
  // - an array of row objects already (e.g. [{ Team, PPG }, ...])
  if (!Array.isArray(paged)) return [];
  const hasDataPages = paged.some(p => Array.isArray(p?.data));
  if (hasDataPages) return paged.flatMap(p => Array.isArray(p?.data) ? p.data : []);
  // otherwise assume paged is already the array of rows
  return paged;
}

function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/%/g, '').trim();
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function buildMetric(spec, pagedDataset) {
  // spec = { id, label, datasetKey, valueField, invert? }
  const rows = mergePages(pagedDataset);
  const map = new Map();
  const normMap = new Map();
  const values = [];
  for (const r of rows) {
    const team = r?.Team;
    const raw = r?.[spec.valueField];
    const num = parseNumber(raw);
    if (!team || num == null) continue;
    map.set(team, num);
    try { normMap.set(normalizeName(team), num); } catch {}
    values.push(num);
  }
  const min = Math.min(...values);
  const max = Math.max(...values);

  const normalize = (v) => {
    if (v == null || !Number.isFinite(min) || !Number.isFinite(max) || max === min) return 0.5;
    const base = (v - min) / (max - min);
    return spec.invert ? (1 - base) : base;
  };

  return { id: spec.id, label: spec.label, map, normMap, min, max, normalize };
}

// Specialized builder for historical winners: compute titles per team from raw history array
function buildHistoryTitlesMetric(pagedDataset) {
  const rows = mergePages(pagedDataset);
  const countsByNorm = new Map();
  const displayMap = new Map(); // map of some representative display name -> count

  // Prefer 'champion' fields explicitly; then fall back to winner/team if needed
  const primaryChampionKeys = ['champion', 'Champion'];
  const fallbackChampionKeys = ['winner', 'Winner', 'team', 'Team', 'champion_team', 'winner_team'];

  function extractChampion(item) {
    if (!item) return null;
    if (typeof item === 'string') return item;
    if (typeof item !== 'object') return null;
    // First, try champion keys strictly
    for (const k of primaryChampionKeys) {
      const v = item[k];
      if (!v) continue;
      if (typeof v === 'string') return v;
      if (typeof v === 'object') {
        // common nested shapes
        if (typeof v.team === 'string') return v.team;
        if (typeof v.name === 'string') return v.name;
        if (typeof v.school === 'string') return v.school;
      }
    }
    // Then, fall back to other possible labels if champion not present
    for (const k of fallbackChampionKeys) {
      const v = item[k];
      if (!v) continue;
      if (typeof v === 'string') return v;
      if (typeof v === 'object') {
        if (typeof v.team === 'string') return v.team;
        if (typeof v.name === 'string') return v.name;
        if (typeof v.school === 'string') return v.school;
      }
    }
    return null; // don't guess from arbitrary string fields to avoid false positives
  }

  for (const item of rows) {
    const teamName = extractChampion(item);
    if (!teamName) continue; // only count explicit champion/winner entries
    const norm = normalizeName(teamName);
    const cur = (countsByNorm.get(norm) || 0) + 1;
    countsByNorm.set(norm, cur);
    // keep a representative display value (longest encountered string)
    const prevDisp = displayMap.get(norm);
    const trimmed = teamName.trim();
    if (!prevDisp || trimmed.length > prevDisp.length) displayMap.set(norm, trimmed);
  }

  const values = Array.from(countsByNorm.values());
  // Ensure teams not present are treated as 0 by setting min to 0 explicitly
  const min = 0;
  const max = values.length ? Math.max(...values) : 1;
  const normalize = (v) => {
    const val = v == null ? 0 : v;
    if (max === min) return 0.5;
    return (val - min) / (max - min);
  };

  // Build both maps to satisfy resolveTeamValue lookup behavior
  const map = new Map();
  const normMap = new Map();
  for (const [norm, cnt] of countsByNorm.entries()) {
    const disp = displayMap.get(norm) || norm;
    map.set(disp, cnt);
    normMap.set(norm, cnt);
  }
  return { id: 'history', label: 'Historical Titles', map, normMap, min, max, normalize };
}

function topNByWinningPct(pagedWinningPct, n = 64) {
  const rows = mergePages(pagedWinningPct)
    .map(r => ({ team: r.Team, pct: parseNumber(r['Pct']) }))
    .filter(x => x.team && x.pct != null)
    .sort((a, b) => b.pct - a.pct);
  return rows.slice(0, n).map(x => x.team);
}

function pairSeedsForRoundOne(seeds) {
  // Simple 1v64, 2v63, ... ordering
  const matchups = [];
  for (let i = 0; i < seeds.length / 2; i++) {
    matchups.push([seeds[i], seeds[seeds.length - 1 - i]]);
  }
  return matchups;
}

function scoreTeam(team, metrics, weights) {
  // weights: { [metric.id]: number from 0..100 }
  let totalWeight = 0;
  let score = 0;
  for (const m of metrics) {
    const w = (weights[m.id] ?? 0);
    if (w <= 0) continue;
    totalWeight += w;
    const val = resolveTeamValue(m, team);
    const norm = m.normalize(val);
    score += norm * w;
  }
  if (totalWeight === 0) return 0; // avoid NaN
  return score / totalWeight; // keep score 0..1-ish scale
}

function playRound(matchups, metrics, weights) {
  const r = Math.max(0, Math.min(1, (weights?.randomness ?? 0) / 100));
  return matchups.map(([a, b]) => {
    const dsa = scoreTeam(a, metrics, weights);
    const dsb = scoreTeam(b, metrics, weights);
    const ra = Math.random();
    const rb = Math.random();
    const ca = (1 - r) * dsa + r * ra;
    const cb = (1 - r) * dsb + r * rb;
    const winner = ca >= cb ? a : b;
    const loser = ca >= cb ? b : a;
    return { a, b, sa: +ca.toFixed(3), sb: +cb.toFixed(3), winner, loser };
  });
}

function nextRoundFromResults(results) {
  const winners = results.map(r => r.winner);
  const matchups = [];
  for (let i = 0; i < winners.length; i += 2) {
    matchups.push([winners[i], winners[i + 1]]);
  }
  return matchups;
}

function renderBracket(rounds) {
  const bracketEl = document.getElementById('bracket');
  if (!bracketEl) return;
  bracketEl.innerHTML = '';
  rounds.forEach((round, i) => {
    const col = document.createElement('div');
    col.className = 'round';
    const h = document.createElement('h3');
    h.textContent = i === 0 ? 'Round of 64' : i === 1 ? 'Round of 32' : i === 2 ? 'Sweet 16' : i === 3 ? 'Elite 8' : i === 4 ? 'Final 4' : 'Championship';
    col.appendChild(h);
    round.forEach(m => {
      const card = document.createElement('div');
      card.className = 'matchup';
      const rowA = document.createElement('div');
      rowA.className = 'team ' + (m.winner === m.a ? 'winner' : 'loser');
      rowA.innerHTML = `<span>${m.a}</span><span>${m.sa}</span>`;
      const rowB = document.createElement('div');
      rowB.className = 'team ' + (m.winner === m.b ? 'winner' : 'loser');
      rowB.innerHTML = `<span>${m.b}</span><span>${m.sb}</span>`;
      card.appendChild(rowA);
      card.appendChild(rowB);
      col.appendChild(card);
    });
    bracketEl.appendChild(col);
  });
  const lastRound = rounds[rounds.length - 1];
  const champEl = document.getElementById('champion');
  if (lastRound && lastRound[0] && champEl) {
    const champ = lastRound[0].winner;
    champEl.textContent = `Champion: ${champ}`;
  }
}

// --- Region bracket rendering (per-tab) ---
function labelSeedTeam(region, team) {
  const entry = region.teams.find(t => t.team === team);
  if (!entry) return team;
  return `(${entry.seed}) ${entry.team}`;
}

function renderRegionTab(region, rounds) {
  const content = document.getElementById('tab-content');
  if (!content) return;
  content.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'bracket';
  const labels = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8'];
  rounds.forEach((round, idx) => {
    const col = document.createElement('div');
    col.className = 'round';
    const h = document.createElement('h3');
    h.textContent = labels[idx];
    col.appendChild(h);
    round.forEach(m => {
      const card = document.createElement('div');
      card.className = 'matchup';
      const rowA = document.createElement('div');
      rowA.className = 'team ' + (m.winner === m.a ? 'winner' : 'loser');
      rowA.innerHTML = `<span>${labelSeedTeam(region, m.a)}</span><span>${m.sa}</span>`;
      const rowB = document.createElement('div');
      rowB.className = 'team ' + (m.winner === m.b ? 'winner' : 'loser');
      rowB.innerHTML = `<span>${labelSeedTeam(region, m.b)}</span><span>${m.sb}</span>`;
      card.appendChild(rowA);
      card.appendChild(rowB);
      col.appendChild(card);
    });
    grid.appendChild(col);
  });
  content.appendChild(grid);
}

function seedForTeam(regions, team) {
  for (const r of regions) {
    const found = r.teams.find(t => t.team === team);
    if (found) return { region: r.name, seed: found.seed };
  }
  return { region: '', seed: '' };
}

function renderFinalFourTab(regions, rFF, rChamp) {
  const content = document.getElementById('tab-content');
  if (!content) return;
  content.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'final4';

  const semis = document.createElement('div');
  semis.className = 'round';
  const h1 = document.createElement('h3');
  h1.textContent = 'Final Four';
  semis.appendChild(h1);
  rFF.forEach(m => {
    const aSeed = seedForTeam(regions, m.a);
    const bSeed = seedForTeam(regions, m.b);
    const card = document.createElement('div');
    card.className = 'matchup';
    const rowA = document.createElement('div');
    rowA.className = 'team ' + (m.winner === m.a ? 'winner' : 'loser');
    rowA.innerHTML = `<span>(${aSeed.seed}) ${m.a}</span><span>${m.sa}</span>`;
    const rowB = document.createElement('div');
    rowB.className = 'team ' + (m.winner === m.b ? 'winner' : 'loser');
    rowB.innerHTML = `<span>(${bSeed.seed}) ${m.b}</span><span>${m.sb}</span>`;
    card.appendChild(rowA);
    card.appendChild(rowB);
    semis.appendChild(card);
  });

  const finals = document.createElement('div');
  finals.className = 'round';
  const h2 = document.createElement('h3');
  h2.textContent = 'Championship';
  finals.appendChild(h2);
  rChamp.forEach(m => {
    const aSeed = seedForTeam(regions, m.a);
    const bSeed = seedForTeam(regions, m.b);
    const card = document.createElement('div');
    card.className = 'matchup';
    const rowA = document.createElement('div');
    rowA.className = 'team ' + (m.winner === m.a ? 'winner' : 'loser');
    rowA.innerHTML = `<span>(${aSeed.seed}) ${m.a}</span><span>${m.sa}</span>`;
    const rowB = document.createElement('div');
    rowB.className = 'team ' + (m.winner === m.b ? 'winner' : 'loser');
    rowB.innerHTML = `<span>(${bSeed.seed}) ${m.b}</span><span>${m.sb}</span>`;
    card.appendChild(rowA);
    card.appendChild(rowB);
    finals.appendChild(card);
  });

  grid.appendChild(semis);
  grid.appendChild(finals);
  content.appendChild(grid);
}

// --- Name normalization & alias helpers ---
function normalizeName(s) {
  if (!s) return '';
  let t = s.toLowerCase();
  t = t.replace(/\([^)]*\)/g, '');
  t = t.replace(/[.'’&-]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

// Map variant -> canonical normalized name (one-way!).
// Values must be normalized (use normalizeName on literals when editing).
const NAME_ALIASES = new Map([
  ['saint johns', 'st johns'],
  ['st marys', 'saint marys'],
  ['uncw', 'unc wilmington'],
  ['siue', 'siu edwardsville'],
  ['iowa st', 'iowa state'],
  ['utah st', 'utah state'],
  ['michigan st', 'michigan state'],
  ['uconn', 'connecticut'],
  ['byu', 'brigham young'],
  ['tcu', 'texas christian'],
  ['lsu', 'louisiana state'],
  ['usc', 'southern california'],
  ['unlv', 'nevada las vegas'],
  ['ole miss', 'mississippi'],
  ['pitt', 'pittsburgh'],
  ['smu', 'southern methodist'],
  ['nc state', 'north carolina state'],
  ['unc', 'north carolina'],
]);

function resolveTeamValue(metric, teamName) {
  const exact = metric.map.get(teamName);
  if (exact != null) return exact;
  const norm = normalizeName(teamName);
  const normVal = metric.normMap.get(norm);
  if (normVal != null) return normVal;
  const aliasCanon = NAME_ALIASES.get(norm);
  if (aliasCanon) {
    // alias values are canonical normalized names, ensure normalized
    const aliasVal = metric.normMap.get(aliasCanon);
    if (aliasVal != null) return aliasVal;
  }
  // For history metric, treat missing as 0 titles rather than neutral
  if (metric.id === 'history') return 0;
  return null;
}


document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load every stat defined in STAT_FILES
    const keys = Object.keys(STAT_FILES);
    const results = await Promise.all(keys.map(k => loadStat(k)));
    const stats = Object.fromEntries(keys.map((k, i) => [k, results[i]]));



    const assistTurnoverRatio = stats.assistTurnoverRatio;
    const assistsPerGame = stats.assistsPerGame;
    const benchPoints = stats.benchPoints;
    const blocksPerGame = stats.blocksPerGame;
    const defensiveReboundsPerGame = stats.defensiveReboundsPerGame;
    const effectiveFieldGoalPercentage = stats.effectiveFieldGoalPercentage;
    const fastbreakPoints = stats.fastbreakPoints;
    const fieldGoalPercentageDefense = stats.fieldGoalPercentageDefense;
    const fieldGoalPercentage = stats.fieldGoalPercentage;
    const foulsPerGame = stats.foulsPerGame;
    const freeThrowAttemptsPerGame = stats.freeThrowAttemptsPerGame;
    const freeThrowPercentage = stats.freeThrowPercentage;
    const freeThrowsMadePerGame = stats.freeThrowsMadePerGame;
    const offensiveReboundsPerGame = stats.offensiveReboundsPerGame;
    const reboundMargin = stats.reboundMargin;
    const reboundsPerGame = stats.reboundsPerGame;
    const scoringDefense = stats.scoringDefense;
    const scoringMargin = stats.scoringMargin;
    const scoringOffense = stats.scoringOffense;
    const stealsPerGame = stats.stealsPerGame;
    const threePointAttemptsPerGame = stats.threePointAttemptsPerGame;
    const threePointPercentageDefense = stats.threePointPercentageDefense;
    const threePointPercentage = stats.threePointPercentage;
    const threePointersPerGame = stats.threePointersPerGame;
    const turnoverMargin = stats.turnoverMargin;
    const turnoversForcedPerGame = stats.turnoversForcedPerGame;
    const turnoversPerGame = stats.turnoversPerGame;
    const winningPercentage = stats.winningPercentage;

    // --- Define metrics to use in weighted scoring ---
    const metricSpecs = [
      { id: 'winPct', label: 'Winning %', datasetKey: 'winningPercentage', valueField: 'Pct' },
      { id: 'scoringDefense', label: 'Opp PPG (lower better)', datasetKey: 'scoringDefense', valueField: 'OPP PPG', invert: true },
      { id: 'fgPct', label: 'FG%', datasetKey: 'fieldGoalPercentage', valueField: 'FG%' },
      { id: 'threePG', label: '3PG', datasetKey: 'threePointersPerGame', valueField: '3PG' },
      { id: 'rpg', label: 'RPG', datasetKey: 'reboundsPerGame', valueField: 'RPG' },
      { id: 'atr', label: 'Assist/Turnover Ratio', datasetKey: 'assistTurnoverRatio', valueField: 'Ratio' },
      { id: 'history', label: 'Historical Titles', datasetKey: 'historicalWinners', valueField: 'Titles' },
    ];

    const metrics = metricSpecs.map(spec => {
      if (spec.id === 'history') return buildHistoryTitlesMetric(stats[spec.datasetKey]);
      return buildMetric(spec, stats[spec.datasetKey]);
    });

    // --- UI: wire sliders and button ---
    const sliderIds = {
      winPct: 'w-winPct',
      scoringDefense: 'w-scoringDefense',
      fgPct: 'w-fgPct',
      threePG: 'w-3pg',
      rpg: 'w-rpg',
      atr: 'w-atr',
      history: 'w-history',
      randomness: 'w-randomness',
    };

  // --- Persistence: load/save slider weights, overview text, and bracket results ---
  const storageKey = 'madness_settings_v1';
  const bracketKey = 'madness_bracket_v1';
    let saveTimer = null;
    const saveIndicator = document.getElementById('save-indicator');
    function setIndicatorSaving() {
      if (!saveIndicator) return;
      saveIndicator.classList.add('saving');
      saveIndicator.textContent = 'Saving...';
    }
    function setIndicatorSaved() {
      if (!saveIndicator) return;
      const t = new Date();
      saveIndicator.classList.remove('saving');
      saveIndicator.textContent = `Saved • ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    }

    function loadSavedSettings() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const obj = JSON.parse(raw);
          for (const k of Object.keys(obj)) {
            const id = sliderIds[k];
            if (id) {
              const el = document.getElementById(id);
              if (el) el.value = String(obj[k]);
            }
          }
        }
        // Overview is intentionally not loaded from storage; always show the default content
      } catch (e) { /* ignore */ }
    }

    function doSave() {
      try {
        const obj = {};
        for (const k of Object.keys(sliderIds)) {
          const el = document.getElementById(sliderIds[k]);
          if (el) obj[k] = parseInt(el.value, 10) || 0;
        }
        localStorage.setItem(storageKey, JSON.stringify(obj));
        // Save bracket data if present
        if (window.cachedBracketData) {
          try { localStorage.setItem(bracketKey, JSON.stringify(window.cachedBracketData)); } catch (e) { console.error('Bracket save failed', e); }
        }
        setIndicatorSaved();
      } catch (e) {
        console.error('Save failed', e);
      }
    }

    function scheduleSave() {
      setIndicatorSaving();
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { doSave(); }, 800);
    }

    // load before wiring sliders so initial values reflect saved state
    loadSavedSettings();

    const weights = {};
    // Sync metric sliders
    for (const m of metrics) {
      const el = document.getElementById(sliderIds[m.id]);
      const valEl = document.querySelector(`[data-for="${sliderIds[m.id]}"]`);
      const sync = () => {
        weights[m.id] = parseInt(el.value, 10) || 0;
        if (valEl) valEl.textContent = String(weights[m.id]);
      };
      el?.addEventListener('input', sync);
      // also schedule save when user changes a slider
      el?.addEventListener('input', scheduleSave);
      sync();
    }

    // Sync randomness slider
    const randEl = document.getElementById(sliderIds.randomness);
    const randValEl = document.querySelector(`[data-for="${sliderIds.randomness}"]`);
    const syncRand = () => {
      weights.randomness = parseInt(randEl.value, 10) || 0;
      if (randValEl) randValEl.textContent = String(weights.randomness);
    };
    randEl?.addEventListener('input', syncRand);
    // save when randomness changes
    randEl?.addEventListener('input', scheduleSave);
    syncRand();

    // Overview edits are not persisted to storage; keep the default copy always visible.

    // Load official 2025 bracket (64-team main draw)
    const bracketRes = await fetch('data/bracket-2025.json', { cache: 'no-cache' });
    const bracket = await bracketRes.json();

    function teamBySeed(region, seed) {
      return region.teams.find(t => t.seed === seed)?.team;
    }
    function firstRoundMatchups(region) {
      const pairs = [
        [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]
      ];
      return pairs.map(([a, b]) => [teamBySeed(region, a), teamBySeed(region, b)]);
    }

    function simulateRegion(region) {
      const r64 = playRound(firstRoundMatchups(region), metrics, weights);
      const r32 = playRound(nextRoundFromResults(r64), metrics, weights);
      const r16 = playRound(nextRoundFromResults(r32), metrics, weights);
      const r8 = playRound(nextRoundFromResults(r16), metrics, weights);
      const champ = r8[0]?.winner;
      return { name: region.name, rounds: [r64, r32, r16, r8], winner: champ };
    }

    // Tab wiring
    const tabs = document.querySelectorAll('.tab');
    function activateTab(which) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === which));
      const cached = window.cachedBracketData;
      if (!cached) return;
      if (which === 'Final Four') {
        renderFinalFourTab(cached.regions, cached.finalFour, cached.championship);
      } else {
        const region = cached.regions.find(r => r.name === which);
        renderRegionTab(region, cached.regionalRounds[which]);
      }
    }

    tabs.forEach(el => {
      el.addEventListener('click', () => {
        activateTab(el.dataset.tab);
        try { localStorage.setItem('madness_lastTab_v1', el.dataset.tab); } catch(e){}
      });
    });

    // On load, restore a previously generated bracket and last active tab (if any)
    try {
      const raw = localStorage.getItem(bracketKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // set cached data so activateTab and other code can use it
        window.cachedBracketData = parsed;
        // restore champion display if present
        const champEl = document.getElementById('champion');
        if (parsed.championship && parsed.championship[0] && champEl) {
          champEl.textContent = `Champion: ${parsed.championship[0].winner}`;
        }
        // Overview is intentionally not restored from storage; always show the default copy in the HTML.
        // restore last tab or default to South
        const last = localStorage.getItem('madness_lastTab_v1') || 'South';
        // ensure the tab exists; fall back to first tab if not
        const tabExists = Array.from(tabs).some(t => t.dataset.tab === last);
        activateTab(tabExists ? last : (tabs[0]?.dataset.tab || 'South'));
        setIndicatorSaved();
      }
    } catch (e) {
      console.error('Failed to restore cached bracket/tab:', e);
    }

    const btn = document.getElementById('btn-generate');
    btn?.addEventListener('click', () => {
      try {
        const regionsSim = bracket.regions.map(simulateRegion);
        const byName = Object.fromEntries(regionsSim.map(r => [r.name, r.rounds]));
        const winners = Object.fromEntries(regionsSim.map(r => [r.name, r.winner]));
        // Final Four mapping for 2025: West vs South, East vs Midwest
        const sf1 = [winners['West'], winners['South']];
        const sf2 = [winners['East'], winners['Midwest']];
        const rFF = playRound([sf1, sf2], metrics, weights);
        const rChamp = playRound(nextRoundFromResults(rFF), metrics, weights);

        // Cache for tab renders
        window.cachedBracketData = {
          regions: bracket.regions,
          regionalRounds: byName,
          finalFour: rFF,
          championship: rChamp,
        };

        // Persist immediately after generation
        try { localStorage.setItem('madness_bracket_v1', JSON.stringify(window.cachedBracketData)); } catch(e) { console.error('Failed to persist bracket', e); }
        try { localStorage.setItem('madness_lastTab_v1', 'South'); } catch(e) {}
        setIndicatorSaved();

        // Update champion text
        const champEl = document.getElementById('champion');
        if (champEl && rChamp?.[0]) champEl.textContent = `Champion: ${rChamp[0].winner}`;

        // Show default tab
        activateTab('South');
      } catch (e) {
        console.error('Bracket generation failed:', e);
      }
    });


  } catch (err) {
    console.error('Failed to load stats:', err);
  }
});