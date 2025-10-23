const url = 'https://ncaa-api.henrygd.me/stats/basketball-men/d1/current/team/474/';
const appendP2 = 'p2'; 
const proxy = 'https://corsbypassproxy.hcordesmn.workers.dev/?url='; // or use https://api.allorigins.win/raw?url=

fetch(proxy + encodeURIComponent(url))
  .then(res => res.json())
  .then(data => {
      console.log(data);
      document.body.innerHTML += `<h1>${data.pages} </h1>`;
      data.data.forEach(element => {
          const rank = element.Rank;
          document.body.innerHTML += `<h1>${rank} </h1>`;
      });
      document.body.innerHTML = `<h1>${teamStats} Statistics</h1>`;
      // Do something with teamStats
  })
  .catch(err => console.error(err));




