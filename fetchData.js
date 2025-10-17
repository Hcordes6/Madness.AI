import fs from "fs";

const baseUrl = "https://ncaa-api.henrygd.me/stats/basketball-men/d1/current/team/474";
const outputPath = "public/data/team474.json";

async function getAllPages() {
  let allData = [];

  // Base URL = page 1
  for (let i = 0; i <= 8; i++) {
    // use base URL for page 0, then /p2, /p3, ...
    const url = i === 0 ? baseUrl : `${baseUrl}/p${i + 1}`;
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

    } catch (err) {
      console.error(`❌ Error fetching ${url}: ${err.message}`);
    }
  }

  return allData;
}

async function saveData() {
  const allData = await getAllPages();

  // Make sure /data directory exists
  fs.mkdirSync("public/data", { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2));
  console.log(`💾 Saved combined data to ${outputPath}`);
}

saveData();