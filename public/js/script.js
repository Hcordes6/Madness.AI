


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

 

    // Safely populate DOM elements if they exist
    assistTurnoverRatio.forEach(element => {
      console.log(element);
    });


  } catch (err) {
    console.error('Failed to load stats:', err);
  }
});