


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
  bracket: 'bracket-2025',
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

// Build historical titles metric from championship history data
function buildHistoryTitlesMetric(historyData) {
  console.log('[HISTORY BUILD] Starting fresh build...');
  
  // Step 1: Extract the data array from the wrapped response
  let dataArray = [];
  if (Array.isArray(historyData)) {
    dataArray = historyData;
  } else if (historyData && Array.isArray(historyData.data)) {
    dataArray = historyData.data;
  } else {
    console.warn('[HISTORY BUILD] No valid data array found');
    return buildEmptyHistoryMetric();
  }
  
  console.log('[HISTORY BUILD] Found', dataArray.length, 'championship records');
  
  // Step 2: Extract champion names and count titles
  const titleCounts = new Map(); // normalized name -> count
  
  for (const record of dataArray) {
    if (!record || typeof record !== 'object') continue;
    
    // Look for "Champion (Record)" field
    let championStr = record['Champion (Record)'];
    if (!championStr || typeof championStr !== 'string') {
      // Try alternate keys
      championStr = record['champion'] || record['Champion'];
    }
    
    if (!championStr) continue;
    
    // Extract team name by removing record in parentheses: "UConn (37-3)" -> "UConn"
    const teamName = championStr.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!teamName) continue;
    
    // Normalize the name for counting
    const normalized = normalizeName(teamName);
    titleCounts.set(normalized, (titleCounts.get(normalized) || 0) + 1);
  }
  
  console.log('[HISTORY BUILD] Extracted', titleCounts.size, 'unique champions');
  
  // Step 3: Log top champions for verification
  const topChamps = Array.from(titleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log('[HISTORY BUILD] Top 10 champions:', topChamps.map(([name, cnt]) => `${name}(${cnt})`).join(', '));
  
  // Step 4: Build the metric object
  if (titleCounts.size === 0) {
    return buildEmptyHistoryMetric();
  }
  
  const counts = Array.from(titleCounts.values());
  const min = 0; // Teams with no titles get 0
  const max = Math.max(...counts);
  
  const normalize = (titleCount) => {
    if (titleCount == null) return 0;
    if (max === 0) return 0;
    return titleCount / max; // Simple 0-1 normalization
  };
  
  console.log('[HISTORY BUILD] Min:', min, 'Max:', max);
  
  return {
    id: 'history',
    label: 'Historical Titles',
    map: new Map(), // Not used - we look up by normalized name only
    normMap: titleCounts, // normalized name -> title count
    min,
    max,
    normalize
  };
}

function buildEmptyHistoryMetric() {
  return {
    id: 'history',
    label: 'Historical Titles',
    map: new Map(),
    normMap: new Map(),
    min: 0,
    max: 0,
    normalize: () => 0
  };
}

// Build seeding metric from bracket data (lower seed = better)
function buildSeedMetric(bracketData) {
  console.log('[SEED BUILD] Building seeding metric...');
  
  const seedMap = new Map();
  
  // Extract seeds from all regions
  for (const region of bracketData.regions) {
    for (const team of region.teams) {
      const normalized = normalizeName(team.team);
      seedMap.set(normalized, team.seed);
    }
  }
  
  console.log('[SEED BUILD] Loaded', seedMap.size, 'team seeds');
  
  // For seeding: lower seed number = better team
  // Seed 1 = best (should get highest score)
  // Seed 16 = worst (should get lowest score)
  // We invert: (17 - seed) so seed 1 becomes 16, seed 16 becomes 1
  const min = 1;  // Inverted seed 16
  const max = 16; // Inverted seed 1
  
  const normalize = (seed) => {
    if (seed == null) return 0.5; // Default to middle if seed not found
    const inverted = 17 - seed; // Invert so lower seed = higher score
    return (inverted - min) / (max - min); // Normalize to 0-1
  };
  
  return {
    id: 'seed',
    label: 'Seeding',
    map: new Map(),
    normMap: seedMap, // normalized name -> seed number
    min,
    max,
    normalize
  };
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
    champEl.innerHTML = `<div style="font-size: 18px; font-weight: 600; opacity: 0.8; margin-bottom: 8px; letter-spacing: 2px;">🎉 TOURNAMENT CHAMPION 🎉</div><div style="font-size: 36px; font-weight: 900; letter-spacing: 1px;">${champ}</div>`;
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

// Render full desktop bracket (all regions + final four) into #full-bracket
function renderFullBracket(cached) {
  const host = document.getElementById('full-bracket');
  if (!host) return;
  host.innerHTML = '';
  if (!cached?.regions || !cached?.regionalRounds) return;

  const grid = document.createElement('div');
  grid.className = 'full-bracket-grid';

  // Helper to build a region block columns
  function buildRegionBlock(regionName, sideClass, verticalClass) {
    const region = cached.regions.find(r => r.name === regionName);
    if (!region) return;
    const rounds = cached.regionalRounds[regionName]; // [r64,r32,r16,r8]
    const wrapper = document.createElement('div');
    wrapper.className = `region-block region-${regionName.toLowerCase()} ${sideClass} ${verticalClass}`;
    // Each round becomes a column
    rounds.forEach((round, idx) => {
      const col = document.createElement('div');
      col.className = `round col col-${idx+1}`;
      // Only show column labels for top quadrants
      if (verticalClass === 'region-top') {
        const h = document.createElement('h3');
        h.textContent = idx === 0 ? regionName : idx === 1 ? 'Round of 32' : idx === 2 ? 'Sweet 16' : 'Elite 8';
        col.appendChild(h);
      }
      const games = document.createElement('div');
      games.className = 'games';
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
        games.appendChild(card);
      });
      col.appendChild(games);
      wrapper.appendChild(col);
    });
    grid.appendChild(wrapper);
  }

  // Left side regions (South top, West bottom)
  buildRegionBlock('South', 'left-side', 'region-top');
  buildRegionBlock('West', 'left-side', 'region-bottom');
  // Right side regions (East top, Midwest bottom)
  buildRegionBlock('East', 'right-side', 'region-top');
  buildRegionBlock('Midwest', 'right-side', 'region-bottom');

  // Center column: Final Four + Championship
  if (cached.finalFour && cached.championship) {
    // Insert an empty spacer center column to preserve original grid spacing
    const spacer = document.createElement('div');
    spacer.className = 'center-col';
    grid.appendChild(spacer);

    // Finals overlay: absolutely centered box outside normal flow
    const overlay = document.createElement('div');
    overlay.className = 'finals-overlay';

    const ffHeader = document.createElement('h3');
    ffHeader.textContent = 'Final Four';
    overlay.appendChild(ffHeader);
    const ffGames = document.createElement('div');
    ffGames.className = 'ff-grid';
    cached.finalFour.forEach(m => {
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
      ffGames.appendChild(card);
    });
    overlay.appendChild(ffGames);

    const champHeader = document.createElement('h3');
    champHeader.textContent = 'Championship';
    overlay.appendChild(champHeader);
    const champGames = document.createElement('div');
    champGames.className = 'champ-grid';
    cached.championship.forEach(m => {
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
      champGames.appendChild(card);
    });
    overlay.appendChild(champGames);

    // Append overlay directly to host (positioned via CSS)
    host.appendChild(overlay);
  }

  host.appendChild(grid);
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
// This handles differences between bracket names and historical names
// Key = what appears in bracket, Value = what appears in history (both normalized)
const NAME_ALIASES = new Map([
  // St. vs State variations (bracket uses "St.", history uses "State")
  ['michigan st', 'michigan state'],
  ['iowa st', 'iowa state'],
  ['utah st', 'utah state'],
  ['oklahoma st', 'oklahoma state'],
  ['mississippi st', 'mississippi state'],
  ['norfolk st', 'norfolk state'],
  ['colorado st', 'colorado state'],
  
  // Saint vs St
  ['st johns', 'saint johns'],
  ['st marys', 'saint marys'],
  ['st josephs', 'saint josephs'],
  
  // Other common abbreviations
  ['ole miss', 'mississippi'],
  ['uconn', 'connecticut'],
  ['byu', 'brigham young'],
  ['lsu', 'louisiana state'],
  ['tcu', 'texas christian'],
  ['smu', 'southern methodist'],
  ['unlv', 'nevada las vegas'],
  ['uncw', 'unc wilmington'],
  ['siue', 'siu edwardsville'],
  ['unc', 'north carolina'],
  ['nc state', 'north carolina state'],
]);

function resolveTeamValue(metric, teamName) {
  // For history metric, use special logic
  if (metric.id === 'history') {
    const norm = normalizeName(teamName);
    
    // Try direct lookup first
    let titleCount = metric.normMap.get(norm);
    if (titleCount != null) return titleCount;
    
    // Try alias lookup
    const aliasedName = NAME_ALIASES.get(norm);
    if (aliasedName) {
      titleCount = metric.normMap.get(aliasedName);
      if (titleCount != null) return titleCount;
    }
    
    // Not found - return 0 for history metric
    return 0;
  }
  
  // For seed metric, use special logic
  if (metric.id === 'seed') {
    const norm = normalizeName(teamName);
    
    // Try direct lookup first
    let seed = metric.normMap.get(norm);
    if (seed != null) return seed;
    
    // Try alias lookup
    const aliasedName = NAME_ALIASES.get(norm);
    if (aliasedName) {
      seed = metric.normMap.get(aliasedName);
      if (seed != null) return seed;
    }
    
    // Not found - return middle seed (8.5) as default
    return 8.5;
  }
  
  // For other metrics, use standard logic
  const exact = metric.map.get(teamName);
  if (exact != null) return exact;
  const norm = normalizeName(teamName);
  const normVal = metric.normMap.get(norm);
  if (normVal != null) return normVal;
  const aliasCanon = NAME_ALIASES.get(norm);
  if (aliasCanon) {
    const aliasVal = metric.normMap.get(aliasCanon);
    if (aliasVal != null) return aliasVal;
  }
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
      { id: 'seed', label: 'Seeding', datasetKey: 'bracket', valueField: 'Seed' },
    ];

    // --- Metric toggles (persisted) ---
    const enabledKey = 'madness_metrics_enabled_v1';
    const allMetricIds = ['winPct','scoringDefense','fgPct','threePG','rpg','atr','history','seed','randomness'];
    function loadEnabledMetrics() {
      try {
        const raw = localStorage.getItem(enabledKey);
        if (!raw) return allMetricIds.slice();
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.enabled)) return parsed.enabled;
      } catch {}
      return allMetricIds.slice();
    }
    function saveEnabledMetrics(list) {
      try { localStorage.setItem(enabledKey, JSON.stringify(list)); } catch {}
    }
    function applyEnabledToUI(enabledList) {
      const set = new Set(enabledList);
      for (const id of allMetricIds) {
        const card = document.querySelector(`label[data-metric="${id}"]`);
        if (card) card.style.display = set.has(id) ? '' : 'none';
        const cb = document.getElementById(`toggle-${id}`);
        if (cb) cb.checked = set.has(id);
      }
    }

    // Persist collapsible open/closed state
    const collapseStateKey = 'madness_collapse_state_v1';
    function loadCollapseState() {
      try { return JSON.parse(localStorage.getItem(collapseStateKey)) || {}; } catch { return {}; }
    }
    function saveCollapseState(state) {
      try { localStorage.setItem(collapseStateKey, JSON.stringify(state)); } catch {}
    }
    const collapseState = loadCollapseState();
    const menus = [
      { id: 'menu-metrics', el: document.getElementById('menu-metrics') },
      { id: 'menu-sliders', el: document.getElementById('menu-sliders') },
    ];
    menus.forEach(m => {
      if (!m.el) return;
      if (collapseState[m.id] === false) m.el.removeAttribute('open');
      m.el.addEventListener('toggle', () => {
        collapseState[m.id] = m.el.open;
        saveCollapseState(collapseState);
      });
    });
    function readEnabledFromUI() {
      const out = [];
      for (const id of allMetricIds) {
        const cb = document.getElementById(`toggle-${id}`);
        if (!cb || cb.checked) out.push(id);
      }
      return out;
    }

    let enabledList = loadEnabledMetrics();
    applyEnabledToUI(enabledList);
    for (const id of allMetricIds) {
      document.getElementById(`toggle-${id}`)?.addEventListener('change', () => {
        enabledList = readEnabledFromUI();
        saveEnabledMetrics(enabledList);
        applyEnabledToUI(enabledList);
      });
    }

    const enabledSet = new Set(enabledList);
    const activeSpecs = metricSpecs.filter(s => enabledSet.has(s.id));
    const metrics = activeSpecs.map(spec => {
      if (spec.id === 'history') return buildHistoryTitlesMetric(stats[spec.datasetKey]);
      if (spec.id === 'seed') return buildSeedMetric(stats[spec.datasetKey]);
      return buildMetric(spec, stats[spec.datasetKey]);
    });

    // DEBUG: Log historical titles counts and bracket team mappings
    (function debugLogHistoricalTitles() {
      const hist = metrics.find(m => m.id === 'history');
      if (!hist) return;
      try {
        // Log all teams with titles from the normMap
        const allCounts = Array.from(hist.normMap.entries()).map(([team, cnt]) => ({ team, cnt }));
        allCounts.sort((a, b) => b.cnt - a.cnt);
        console.log('[HISTORY] Total teams with at least one title:', allCounts.length);
        console.log('[HISTORY] Top 10 by titles:', allCounts.slice(0, 10));
        console.log('[HISTORY] Min/Max used for normalization:', { min: hist.min, max: hist.max });
        
        // Now check how bracket teams resolve
        console.log('[HISTORY] === Bracket Team Resolution Debug ===');
        const bracketTeams = [];
        for (const region of stats.bracket.regions) {
          for (const team of region.teams) {
            const normalized = normalizeName(team.team);
            const aliased = NAME_ALIASES.get(normalized);
            const titleCount = resolveTeamValue(hist, team.team);
            bracketTeams.push({
              original: team.team,
              normalized: normalized,
              alias: aliased || 'none',
              titles: titleCount
            });
          }
        }
        // Sort by titles descending to see who has most
        bracketTeams.sort((a, b) => b.titles - a.titles);
        console.log('[HISTORY] Bracket teams with titles (top 20):', bracketTeams.slice(0, 20));
        console.log('[HISTORY] Bracket teams with 0 titles:', bracketTeams.filter(t => t.titles === 0).map(t => t.original));
      } catch (e) {
        console.warn('[HISTORY] Debug listing failed:', e);
      }
    })();

    // --- UI: wire sliders and button ---
    const sliderIds = {
      winPct: 'w-winPct',
      scoringDefense: 'w-scoringDefense',
      fgPct: 'w-fgPct',
      threePG: 'w-3pg',
      rpg: 'w-rpg',
      atr: 'w-atr',
      history: 'w-history',
      seed: 'w-seed',
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

    // Sync randomness slider (respect toggle; if disabled, force 0)
    const randEl = document.getElementById(sliderIds.randomness);
    const randValEl = document.querySelector(`[data-for="${sliderIds.randomness}"]`);
    const syncRand = () => {
      const randEnabled = (document.getElementById('toggle-randomness')?.checked ?? true);
      weights.randomness = randEnabled ? (parseInt(randEl.value, 10) || 0) : 0;
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

    // DEBUG: For each bracket team, show resolved history count and alias path
    (function debugLogBracketHistory(bracketObj) {
      const hist = metrics.find(m => m.id === 'history');
      if (!hist || !bracketObj?.regions) return;
      const out = [];
      for (const region of bracketObj.regions) {
        for (const entry of region.teams) {
          const t = entry.team;
          const norm = normalizeName(t);
          const aliasCanon = NAME_ALIASES.get(norm);
          let cnt = hist.normMap.get(norm);
          if (cnt == null && aliasCanon) cnt = hist.normMap.get(aliasCanon);
          if (cnt == null) cnt = 0;
          out.push({ team: t, norm, aliasCanon: aliasCanon || '', titles: cnt });
        }
      }
      out.sort((a, b) => b.titles - a.titles || a.team.localeCompare(b.team));
      console.log('[HISTORY] Bracket team title counts (resolved):', out);
    })(bracket);

    function teamBySeed(region, seed) {
      return region.teams.find(t => t.seed === seed)?.team;
    }
    function firstRoundMatchups(region) {
      const pairs = [
        [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]
      ];
      return pairs.map(([a, b]) => [teamBySeed(region, a), teamBySeed(region, b)]);
    }

    function simulateRegion(region, metricsLocal, weightsLocal) {
      const r64 = playRound(firstRoundMatchups(region), metricsLocal, weightsLocal);
      const r32 = playRound(nextRoundFromResults(r64), metricsLocal, weightsLocal);
      const r16 = playRound(nextRoundFromResults(r32), metricsLocal, weightsLocal);
      const r8 = playRound(nextRoundFromResults(r16), metricsLocal, weightsLocal);
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
        // refresh scroll affordance after content swap
        updateTabScrollAffordance();
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
        // Render full bracket (desktop view)
        renderFullBracket(parsed);
        setIndicatorSaved();
      }
    } catch (e) {
      console.error('Failed to restore cached bracket/tab:', e);
    }

    const btn = document.getElementById('btn-generate');
    btn?.addEventListener('click', () => {
      try {
        // Rebuild active metrics and weights from current toggles and sliders
        const currentEnabled = readEnabledFromUI();
        saveEnabledMetrics(currentEnabled);
        applyEnabledToUI(currentEnabled);
        const cSet = new Set(currentEnabled);
        const cSpecs = metricSpecs.filter(s => cSet.has(s.id));
        const cMetrics = cSpecs.map(spec => {
          if (spec.id === 'history') return buildHistoryTitlesMetric(stats[spec.datasetKey]);
          if (spec.id === 'seed') return buildSeedMetric(stats[spec.datasetKey]);
          return buildMetric(spec, stats[spec.datasetKey]);
        });
        const cWeights = {};
        for (const spec of cSpecs) {
          const el = document.getElementById(sliderIds[spec.id]);
          cWeights[spec.id] = el ? (parseInt(el.value, 10) || 0) : 0;
        }
        cWeights.randomness = cSet.has('randomness')
          ? (parseInt(document.getElementById(sliderIds.randomness)?.value, 10) || 0)
          : 0;

        const regionsSim = bracket.regions.map(region => simulateRegion(region, cMetrics, cWeights));
        const byName = Object.fromEntries(regionsSim.map(r => [r.name, r.rounds]));
        const winners = Object.fromEntries(regionsSim.map(r => [r.name, r.winner]));
        // Final Four mapping for 2025: West vs South, East vs Midwest
        const sf1 = [winners['West'], winners['South']];
        const sf2 = [winners['East'], winners['Midwest']];
        const rFF = playRound([sf1, sf2], cMetrics, cWeights);
        const rChamp = playRound(nextRoundFromResults(rFF), cMetrics, cWeights);

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

        // Show default tab & full bracket
        activateTab('South');
        renderFullBracket(window.cachedBracketData);
        updateTabScrollAffordance();
      } catch (e) {
        console.error('Bracket generation failed:', e);
      }
    });

    // Mobile: show left gradient only after scroll begins
    function updateTabScrollAffordance() {
      const tc = document.getElementById('tab-content');
      if (!tc) return;
      if (tc.scrollLeft > 2) tc.classList.add('has-left-scroll'); else tc.classList.remove('has-left-scroll');
    }
    const tc = document.getElementById('tab-content');
    if (tc) {
      tc.addEventListener('scroll', updateTabScrollAffordance, { passive: true });
      // Run once on load/restore
      setTimeout(updateTabScrollAffordance, 0);
    }


  } catch (err) {
    console.error('Failed to load stats:', err);
  }
});