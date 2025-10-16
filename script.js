const url = 'https://ncaa-api.henrygd.me/stats/basketball-men/d1/current/team/474/p2';
const proxy = 'https://corsproxy.io/?'; // or use https://api.allorigins.win/raw?url=

fetch(proxy + encodeURIComponent(url))
  .then(res => res.json())
  .then(data => {
      console.log(data);
      data.data.forEach(element => {
          const rank = element.Rank;
          document.body.innerHTML += `<h1>${rank} </h1>`;
      });
      document.body.innerHTML = `<h1>${teamStats} Statistics</h1>`;
      // Do something with teamStats
  })
  .catch(err => console.error(err));

