


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
};

async function loadStat(key) {
  const file = STAT_FILES[key] ?? key; // allows passing a key or direct filename base
  const res = await fetch(`data/${file}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${file}.json: ${res.status}`);
  return res.json();
}

// --- Helpers for merging pages, parsing numbers, and building lookups ---
function mergePages(paged) {
  // paged is an array of { data: [...] }
  return paged.flatMap(p => Array.isArray(p?.data) ? p.data : []);
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
  const values = [];
  for (const r of rows) {
    const team = r?.Team;
    const raw = r?.[spec.valueField];
    const num = parseNumber(raw);
    if (!team || num == null) continue;
    map.set(team, num);
    values.push(num);
  }
  const min = Math.min(...values);
  const max = Math.max(...values);

  const normalize = (v) => {
    if (v == null || !Number.isFinite(min) || !Number.isFinite(max) || max === min) return 0.5;
    const base = (v - min) / (max - min);
    return spec.invert ? (1 - base) : base;
  };

  return { id: spec.id, label: spec.label, map, min, max, normalize };
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
    const val = m.map.get(team);
    const norm = m.normalize(val);
    score += norm * w;
  }
  if (totalWeight === 0) return 0; // avoid NaN
  return score / totalWeight; // keep score 0..1-ish scale
}

function playRound(matchups, metrics, weights) {
  return matchups.map(([a, b]) => {
    const sa = scoreTeam(a, metrics, weights);
    const sb = scoreTeam(b, metrics, weights);
    const winner = sa >= sb ? a : b;
    const loser = sa >= sb ? b : a;
    return { a, b, sa: +sa.toFixed(3), sb: +sb.toFixed(3), winner, loser };
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
    ];

    const metrics = metricSpecs.map(spec => buildMetric(spec, stats[spec.datasetKey]));

    // --- UI: wire sliders and button ---
    const sliderIds = {
      winPct: 'w-winPct',
      scoringDefense: 'w-scoringDefense',
      fgPct: 'w-fgPct',
      threePG: 'w-3pg',
      rpg: 'w-rpg',
      atr: 'w-atr',
    };

    const weights = {};
    for (const m of metrics) {
      const el = document.getElementById(sliderIds[m.id]);
      const valEl = document.querySelector(`[data-for="${sliderIds[m.id]}"]`);
      const sync = () => {
        weights[m.id] = parseInt(el.value, 10) || 0;
        if (valEl) valEl.textContent = String(weights[m.id]);
      };
      el?.addEventListener('input', sync);
      sync();
    }

    const btn = document.getElementById('btn-generate');
    btn?.addEventListener('click', () => {
      try {
        // Seeds based on top 64 winning percentage
        const seeds = topNByWinningPct(winningPercentage, 64);
        const r64 = playRound(pairSeedsForRoundOne(seeds), metrics, weights);
        const r32 = playRound(nextRoundFromResults(r64), metrics, weights);
        const r16 = playRound(nextRoundFromResults(r32), metrics, weights);
        const r8 = playRound(nextRoundFromResults(r16), metrics, weights);
        const r4 = playRound(nextRoundFromResults(r8), metrics, weights);
        const r2 = playRound(nextRoundFromResults(r4), metrics, weights);
        renderBracket([r64, r32, r16, r8, r4, r2]);
      } catch (e) {
        console.error('Bracket generation failed:', e);
      }
    });


  } catch (err) {
    console.error('Failed to load stats:', err);
  }
});