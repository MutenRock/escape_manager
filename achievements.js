const ACHIEVEMENTS = [
  { id:'first_day', name:'Première journée', desc:'Finir la première journée.' },
  { id:'rich_500', name:'Caissier', desc:'Atteindre 500€.' },
  { id:'serv_20', name:'Service efficace', desc:'Servir 20 équipes au total.' },
  { id:'no_help_day', name:'Autonomes', desc:'Aucune demande d’aide non traitée sur une journée.' },
];

function checkAndUnlock(conditionId){
  if (GameState.unlocked[conditionId]) return;
  GameState.unlocked[conditionId] = true;
  Persistence.saveAchievements();
}

function endOfDayAchievements(){
  if (GameState.day === 1) checkAndUnlock('first_day');
  if (GameState.money >= 500) checkAndUnlock('rich_500');
  if (GameState.meta.totalServed && GameState.meta.totalServed >= 20) checkAndUnlock('serv_20');
  // no_help_day: flag from game tick (set in GameState.dayNoHelpFailed)
  if (!GameState.dayNoHelpFailed) checkAndUnlock('no_help_day');
}

function scoreForRun(){
  const dayMul = 1 + 0.1 * (GameState.day - 1);
  const rooms = GameState.rooms.length;
  const emps = GameState.employees.length;
  const clients = (GameState.meta.totalClients || 0);
  const served = (GameState.meta.totalServed || 0);
  const base = served*10 + clients*2 + rooms*8 + emps*12;
  return Math.floor(base * dayMul);
}

function grantMetaForRun(score){
  const tokens = Math.max(1, Math.floor(score / 100));
  GameState.meta.tokens += tokens;
  return tokens;
}

window.Ach = { ACHIEVEMENTS, checkAndUnlock, endOfDayAchievements, scoreForRun, grantMetaForRun };
