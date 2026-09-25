/* Clock Out — shared settings: names, areas, map bounds, deal filters and color themes.
   Loaded first, in <head>, so the saved theme applies before the page draws. check.html uses it too.

   How the code fits together: each file in js/ is a plain script that puts what it shares on window.CO
   (CO.util, CO.hours, ...) and uses what earlier files shared. index.html loads them in this order:
   config → data → util → hours → venues → state → cards → map → plan → lists → themes → share → app.
   A file may call into a later one (e.g. map → CO.lists.select) only inside an event handler, never at load. */
window.CO = {
  config: {
    DAYS: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    DS: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    WEEK: [1,2,3,4,5,6,0],   // Monday-first order for week displays

    TYPES: {bar:"Bars & pubs", rest:"Restaurants", chain:"Chains", brew:"Breweries & wine", lounge:"Lounges"},
    TYPE1: {bar:"Bar / pub", rest:"Restaurant", chain:"Chain", brew:"Brewery / wine bar", lounge:"Lounge"},
    CF: {1:"Confirmed", 2:"Likely", 3:"Unverified"},

    REPORT_TO: "bar@jp4mayor.com",   // "Something changed?" emails go here

    /* area filters; box = [south lat, north lat, west lng, east lng] the map zooms to */
    AREAS: {
      all: {name:"All areas", box:[42.118,42.492,-83.452,-83.122]},
      west: {name:"West Side", box:[42.255,42.492,-83.452,-83.122]},
      downriver: {name:"Downriver", box:[42.118,42.295,-83.415,-83.125]}
    },

    /* The map is a W × H drawing of this lat/lng box. Changing it means redrawing the roads in map.js. */
    MAP: {W:1000, H:1551, lat0:42.1179, lat1:42.492, lng0:-83.452, lng1:-83.122},

    /* deal filter chips; a venue gets one when its deals (d) or specials (sp) match re */
    DEALS: [
      {k:"marg", lab:"Margaritas", re:/margarit|\brita\b|ritas\b/i},
      {k:"wings", lab:"Wings", re:/\bwings?\b/i},
      {k:"half", lab:"Half-off", re:/half|½|50%/i},
      {k:"tacos", lab:"Tacos", re:/\btacos?\b/i},
      {k:"music", lab:"Music & karaoke", re:/live music|karaoke|\bdj\b|live shows|bingo|trivia|old-school/i},
      {k:"pool", lab:"Pool", re:/\bpool\b/i}
    ],

    /* color themes; the colors themselves live in css/styles.css under [data-pal="id"].
       sw = swatch colors for the picker, tc = the phone's browser-bar color */
    PALS: [
      {id:"classic", name:"Classic", dark:false, sw:["#EEF2EF","#1D6A4D","#DD9210"], tc:"#1D6A4D"},
      {id:"afterhours", name:"After Hours", dark:true, sw:["#0E1719","#56B88C","#F2B23A"], tc:"#0E1719"},
      {id:"coney", name:"Coney", dark:false, sw:["#FBF4E4","#B3261E","#E3A500"], tc:"#B3261E"},
      {id:"lastcall", name:"Last Call", dark:true, sw:["#1A0D12","#E8C07D","#FF5CAD"], tc:"#1A0D12"},
      {id:"belleisle", name:"Belle Isle", dark:false, sw:["#EEF4F8","#2C6E49","#F26B3A"], tc:"#2C6E49"},
      {id:"neondive", name:"Neon Dive", dark:true, sw:["#07080C","#8C9BFF","#00E0FF"], tc:"#07080C"},
      {id:"market", name:"Eastern Market", dark:false, sw:["#F6EFE9","#9E3B2C","#F0A202"], tc:"#9E3B2C"},
      {id:"chrome", name:"Chrome", dark:true, sw:["#16181B","#C9D1D9","#FFB000"], tc:"#16181B"},
      {id:"riverwalk", name:"Riverwalk", dark:false, sw:["#F5F1E8","#0F6E6E","#E4572E"], tc:"#0F6E6E"},
      {id:"lakeeffect", name:"Lake Effect", dark:true, sw:["#0B1626","#7FDBFF","#FFD166"], tc:"#0B1626"}
    ]
  }
};
