// GameState central + save/load localStorage
const LS_KEY = 'escape_manager_save_v1';
const LS_HISTORY = 'escape_manager_history_v1';
const LS_ACH = 'escape_manager_ach_v1';

window.GameState = {
  brand: 'Mon Escape',
  day: 1,
  money: 120,
  groupsNeededBase: 3,
  groupsNeeded: 3,
  dayDurationBase: 100,
  dayTimeLeft: 100,
  dayOver: false,
  groupsSpawned: 0,
  groupsServed: 0,
  player: {
    x:200, y:300, w:40, h:40, speed:5.2,
    carryCapacity: 1,
  },
  meta: { tokens: 0, score: 0 },
  rooms: [],     // set in rooms.js
  roomGrid: [],  // positions
  employees: [], // set in employees.js
  particles: [], // room effects
  settings: { keys:'ZQSD', sound:true },
  unlocked: {},  // achievements unlocked flags
  runActive: false, // active gameplay (false in menu)
  paused: true,
  mgmtOpen: false
};

function saveGame(){
  const data = {
    brand: GameState.brand, day: GameState.day, money: GameState.money,
    groupsNeededBase: GameState.groupsNeededBase,
    dayDurationBase: GameState.dayDurationBase,
    player: GameState.player,
    unlocked: GameState.unlocked,
    meta: GameState.meta,
    rooms: GameState.rooms.map(r=>({ name:r.name, class:r.class })), // structure minimal
  };
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}
function loadGame(){
  const s = localStorage.getItem(LS_KEY);
  if (!s) return false;
  try{
    const d = JSON.parse(s);
    Object.assign(GameState, {
      brand: d.brand ?? GameState.brand,
      day: d.day ?? 1,
      money: d.money ?? 120,
      groupsNeededBase: d.groupsNeededBase ?? 3,
      dayDurationBase: d.dayDurationBase ?? 100,
      player: Object.assign(GameState.player, d.player||{}),
      unlocked: d.unlocked || {},
      meta: Object.assign(GameState.meta, d.meta||{})
    });
    return d;
  }catch{ return false; }
}
function saveHistoryEntry(entry){
  const arr = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
  arr.unshift(entry);
  localStorage.setItem(LS_HISTORY, JSON.stringify(arr.slice(0,50)));
}
function getHistory(){ return JSON.parse(localStorage.getItem(LS_HISTORY)||'[]'); }
function saveAchievements(){ localStorage.setItem(LS_ACH, JSON.stringify(GameState.unlocked)); }
function loadAchievements(){ Object.assign(GameState.unlocked, JSON.parse(localStorage.getItem(LS_ACH)||'{}')); }

window.Persistence = { saveGame, loadGame, saveHistoryEntry, getHistory, saveAchievements, loadAchievements, LS_KEY };
