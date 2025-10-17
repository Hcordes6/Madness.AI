import fs from "fs";
import fetch from "node-fetch";

const url = "https://ncaa-api.henrygd.me/stats/basketball-men/d1/current/team/474/p2";

const getData = async () => {
  const res = await fetch(url);
  const data = await res.json();
  fs.writeFileSync("public/data/team474.json", JSON.stringify(data, null, 2));
  console.log("✅ Saved data/team474.json");
};

getData();