// Rooms management + particles + placement editor
const ROOM_W = 120, ROOM_H = 60;
const PARTICLES_ICONS = ['⚙️','💡','❓'];
const PARTICLE_COLORS = ['#888','#ffdd55','#88aaff'];

function initRoomGrid(MISSION){
  const pad=10, gap=20;
  const cols = Math.max(1, Math.floor((MISSION.w - pad*2) / (ROOM_W + gap)));
  const rows = Math.max(1, Math.floor((MISSION.h - pad*2) / (ROOM_H + gap)));
  const pts = [];
  const sx = MISSION.x + pad;
  const sy = MISSION.y + pad;
  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      pts.push({ x: sx + c*(ROOM_W+gap), y: sy + r*(ROOM_H+gap) });
    }
  }
  GameState.roomGrid = pts;
}

function addRoomAtNextSlot(info){
  const idx = GameState.rooms.length;
  if (idx >= GameState.roomGrid.length) return false;
  const p = GameState.roomGrid[idx];
  GameState.rooms.push({
    x:p.x, y:p.y, w:ROOM_W, h:ROOM_H,
    name:info.name, class:info.class,
    occupied:false, timer:0, group:null,
    needHelp:false, helpTimer:0, assignedBy:null
  });
  return true;
}

function addRoomAtCell(info, cellIndex){
  if (cellIndex < 0 || cellIndex >= GameState.roomGrid.length) return false;
  const p = GameState.roomGrid[cellIndex];
  // ensure no overlap
  if (GameState.rooms.some(r => r.x===p.x && r.y===p.y)) return false;
  GameState.rooms.push({
    x:p.x, y:p.y, w:ROOM_W, h:ROOM_H,
    name:info.name, class:info.class,
    occupied:false, timer:0, group:null,
    needHelp:false, helpTimer:0, assignedBy:null
  });
  return true;
}

function moveRoomToCell(roomIndex, cellIndex){
  const p = GameState.roomGrid[cellIndex];
  if (!p) return false;
  if (GameState.rooms.some((r,i)=> i!==roomIndex && r.x===p.x && r.y===p.y)) return false;
  const r = GameState.rooms[roomIndex];
  r.x = p.x; r.y = p.y;
  return true;
}

function deleteRoom(roomIndex){
  const r = GameState.rooms[roomIndex];
  if (!r || r.occupied) return false;
  GameState.rooms.splice(roomIndex,1);
  return true;
}

function roomIndexAt(x,y){
  return GameState.rooms.findIndex(r => x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h);
}
function cellIndexAt(x,y){
  return GameState.roomGrid.findIndex(p => x>=p.x && x<=p.x+ROOM_W && y>=p.y && y<=p.y+ROOM_H);
}

function spawnRoomParticle(room){
  const i = Math.floor(Math.random()*PARTICLES_ICONS.length);
  const color = PARTICLE_COLORS[i];
  GameState.particles.push({
    x: room.x + room.w/2, y: room.y + 10,
    vx: (Math.random()-0.5)*20, vy: -30 - Math.random()*30,
    life: 1.2, icon: PARTICLES_ICONS[i], color
  });
}
function updateParticles(dt){
  for (const p of GameState.particles){
    p.life -= dt;
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vy += 20*dt; // gravity-ish
  }
  GameState.particles = GameState.particles.filter(p=>p.life>0);
}

window.Rooms = {
  ROOM_W, ROOM_H,
  initRoomGrid, addRoomAtNextSlot, addRoomAtCell, moveRoomToCell, deleteRoom,
  roomIndexAt, cellIndexAt,
  spawnRoomParticle, updateParticles
};
