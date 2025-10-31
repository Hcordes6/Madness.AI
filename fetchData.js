import fs from "fs";
import fetch from "node-fetch";

// Configuration for each stat to fetch
const STATS_CONFIG = [
  {
    name: "Assist/Turnover Ratio",
    apiEndpoint: "474",
    fileName: "assist-turnover-ratio.json",
    pages: 8
  },
  {
    name: "Assists Per Game",
    apiEndpoint: "216",
    fileName: "assists-per-game.json",
    pages: 8
  },
  {
    name: "Bench Points Per Game",
    apiEndpoint: "1284",
    fileName: "bench-points-per-game.json",
    pages: 8
  },
  {
    name: "Blocks Per Game",
    apiEndpoint: "214",
    fileName: "blocks-per-game.json",
    pages: 8
  },
  {
    name: "Effective Field Goal Percentage",
    apiEndpoint: "1288",
    fileName: "effective-field-goal-percentage.json",
    pages: 8
  },
  {
    name: "FastBreak Points",
    apiEndpoint: "1285",
    fileName: "fastbreak-points.json",
    pages: 8
  },
  {
    name: "Field Goal Percentage",
    apiEndpoint: "148",
    fileName: "field-goal-percentage.json",
    pages: 8
  },
  {
    name: "Field Goal Percentage Defense",
    apiEndpoint: "149",
    fileName: "field-goal-percentage-defense.json",
    pages: 8
  },
  {
    name: "Fouls Per Game",
    apiEndpoint: "286",
    fileName: "fouls-per-game.json",
    pages: 8
  },
  {
    name: "Free Throw Attempts Per Game",
    apiEndpoint: "638",
    fileName: "free-throw-attempts-per-game.json",
    pages: 8
  },
  {
    name: "Free Throw Percentage",
    apiEndpoint: "150",
    fileName: "free-throw-percentage.json",
    pages: 8
  },
  {
    name: "Free Throws Made Per Game",
    apiEndpoint: "633",
    fileName: "free-throws-made-per-game.json",
    pages: 8
  },
  {
    name: "Rebound Margin",
    apiEndpoint: "151",
    fileName: "rebound-margin.json",
    pages: 8
  },
  {
    name: "Defensive Rebounds Per Game",
    apiEndpoint: "859",
    fileName: "defensive-rebounds-per-game.json",
    pages: 8
  },
  {
    name: "Offensive Rebounds Per Game",
    apiEndpoint: "857",
    fileName: "offensive-rebounds-per-game.json",
    pages: 8
  },
  {
    name: "Rebounds Per Game",
    apiEndpoint: "932",
    fileName: "rebounds-per-game.json",
    pages: 8
  },
  {
    name: "Scoring Defense",
    apiEndpoint: "146",
    fileName: "scoring-defense.json",
    pages: 8
  },
  {
    name: "Scoring Margin",
    apiEndpoint: "147",
    fileName: "scoring-margin.json",
    pages: 8
  },
  {
    name: "Scoring Offense",
    apiEndpoint: "145",
    fileName: "scoring-offense.json",
    pages: 8
  },
  {
    name: "Steals Per Game",
    apiEndpoint: "215",
    fileName: "steals-per-game.json",
    pages: 8
  },
  {
    name: "Three-Point Attempts Per Game",
    apiEndpoint: "625",
    fileName: "three-point-attempts-per-game.json",
    pages: 8
  },
  {
    name: "Three-Point Percentage",
    apiEndpoint: "152",
    fileName: "three-point-percentage.json",
    pages: 8
  },
  {
    name: "Three-Point Percentage Defense",
    apiEndpoint: "518",
    fileName: "three-point-percentage-defense.json",
    pages: 8
  },
  {
    name: "Three Pointers Per Game",
    apiEndpoint: "153",
    fileName: "three-pointers-per-game.json",
    pages: 8
  },
  {
    name: "Turnover Margin",
    apiEndpoint: "519",
    fileName: "turnover-margin.json",
    pages: 8
  },
  {
    name: "Turnovers Forced Per Game",
    apiEndpoint: "931",
    fileName: "turnovers-forced-per-game.json",
    pages: 8
  },
  {
    name: "Turnovers Per Games",
    apiEndpoint: "217",
    fileName: "turnovers-per-game.json",
    pages: 8
  },
  {
    name: "Winning Percentage",
    apiEndpoint: "168",
    fileName: "winning-percentage.json",
    pages: 8
  },
];

const baseUrl = "https://ncaa-api.henrygd.me/stats/basketball-men/d1/current/team";
const outputDir = "public/data";
const RATE_LIMIT_MS = 250; // 250ms = 4 requests per second (safe buffer)

/**
 * Sleep function for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches all pages for a given stat endpoint
 */
async function fetchStatData(endpoint, pages) {
  let allData = [];
  const statUrl = `${baseUrl}/${endpoint}`;

  for (let i = 0; i < pages; i++) {
    const url = i === 0 ? statUrl : `${statUrl}/p${i + 1}`;
    console.log(`📡 Fetching ${url}`);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Combine arrays or single objects
      if (Array.isArray(data)) {
        allData = allData.concat(data);
      } else {
        allData.push(data);
      }

      console.log(`✅ Got ${Array.isArray(data) ? data.length : 1} items (total: ${allData.length})`);

      // Rate limiting: wait before next request (except for last page)
      if (i < pages - 1) {
        await sleep(RATE_LIMIT_MS);
      }

    } catch (err) {
      console.error(`❌ Error fetching ${url}: ${err.message}`);
    }
  }

  return allData;
}

/**
 * Fetches and saves all configured stats
 */
async function fetchAllStats() {
  // Make sure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n🏀 Starting data fetch for ${STATS_CONFIG.length} stat categories...\n`);

  for (const stat of STATS_CONFIG) {
    console.log(`\n--- ${stat.name} ---`);
    
    const data = await fetchStatData(stat.apiEndpoint, stat.pages);
    const outputPath = `${outputDir}/${stat.fileName}`;
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${data.length} items to ${outputPath}`);
  }

  // Fetch historical winners and store raw data as-is; frontend will compute counts
  try {
    console.log(`\n--- Historical winners ---`);
    const historyUrl = 'https://ncaa-api.henrygd.me/history/basketball-men/d1';
    const res = await fetch(historyUrl);
    console.log('History fetch status:', res.status, res.statusText);
    const raw = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse JSON from history endpoint; saving empty array. Error:', e.message);
      parsed = [];
    }
    const outPath = `${outputDir}/historical-winners.json`;
    fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2));
    console.log(`💾 Saved raw historical data to ${outPath} (${Array.isArray(parsed) ? parsed.length : 1} items)`);
  } catch (err) {
    console.error('❌ Error fetching historical winners:', err.message);
  }

  console.log(`\n✨ All data fetched and saved successfully!`);
}

fetchAllStats();