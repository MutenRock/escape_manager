// Employees with colored appearance and names + pathing with walls

const EMP_COLORS = ['#e57373','#64b5f6','#81c784','#ffb74d','#ba68c8','#4db6ac'];
const EMP_COST = 80;

function randName(){
  const first = ['Alex','Sam','Lina','Max','Noa','Eli','Zoé','Kim','Iris','Milo','Nora','Léo'];
  const last  = ['Roux','Martin','Bern','Klein','Morel','Dubois','Fabre','Mercier','Robin','Dupont'];
  return first[Math.floor(Math.random()*first.length)] + ' ' + last[Math.floor(Math.random()*last.length)];
}

function generateEmployeeCandidates(){
  const arr = [];
  for (let i=0;i<2;i++){
    arr.push({
      name: randName(),
      speed: 110 + Math.floor(Math.random()*60),
      capacity: 1 + Math.floor(Math.random()*2),
      breakTime: 6 + Math.floor(Math.random()*6),
      color: EMP_COLORS[Math.floor(Math.random()*EMP_COLORS.length)]
    });
  }
  return arr;
}

function hireEmployee(proto, WAIT){
  if (GameState.money < EMP_COST) return false;
  GameState.money -= EMP_COST;
  const id = GameState.employees.length ? Math.max(...GameState.employees.map(e=>e.id))+1 : 1;
  GameState.employees.push({
    id, name: proto.name, color: proto.color,
    x: WAIT.x + WAIT.w/2 - 8, y: WAIT.y + WAIT.h + 10, w:16, h:16,
    speed: proto.speed, capacity: proto.capacity, breakTime: proto.breakTime,
    activeTeams: 0, waitX: WAIT.x + WAIT.w/2 - 8, waitY: WAIT.y + WAIT.h + 10,
    state: 'idle', target: null, timer: 0
  });
  return true;
}

function moveWithWalls(ent, tx, ty, step, WALLS){
  // try to move towards target respecting axis & walls (simple greedy resolver)
  const dx = tx - ent.x, dy = ty - ent.y;
  const dist = Math.hypot(dx,dy);
  if (dist < 0.001) return;
  const ux = dx/dist * step, uy = dy/dist * step;
  // try X
  ent.x += ux;
  for (const w of WALLS){
    if (Utils.rectsIntersect(ent, w)){
      if (ux>0) ent.x = w.x - ent.w; else ent.x = w.x + w.w;
    }
  }
  // try Y
  ent.y += uy;
  for (const w of WALLS){
    if (Utils.rectsIntersect(ent, w)){
      if (uy>0) ent.y = w.y - ent.h; else ent.y = w.y + w.h;
    }
  }
}

function updateEmployees(dt, WAIT, rooms, WALLS, groupsWaiting){
  for (const e of GameState.employees){
    const canTake = e.activeTeams < e.capacity && !GameState.paused && GameState.runActive;
    if (canTake && e.state==='idle'){
      // pick first waiting + first free room
      const g = groupsWaiting[0];
      const room = rooms.find(r=>!r.occupied);
      if (g && room){
        // revalidate room availability later too
        const s = g.slotIndex != null ? g.slotIndex : -1;
        if (s>=0) ; // slot will be freed
        // remove from waiting
        groupsWaiting.shift();
        e.state = 'movingToRoom';
        e.target = { x: room.x + room.w/2 - 8, y: room.y + room.h/2 - 8, group: g, roomIndex: rooms.indexOf(room) };
      }
    }

    // movement
    if (e.state==='movingToRoom' && e.target){
      moveWithWalls(e, e.target.x, e.target.y, e.speed*dt, WALLS);
      if (Math.hypot(e.x-e.target.x, e.y-e.target.y) < 4){
        const r = rooms[e.target.roomIndex];
        const g = e.target.group;
        // re-validate room is still free
        if (r && !r.occupied){
          r.occupied = true; r.group = g; r.timer = 20; r.needHelp=false; r.helpTimer=0; r.assignedBy = e.id;
          e.activeTeams++; e.waitX = r.x + r.w/2 - 8; e.waitY = r.y + r.h + 8;
          e.state = 'waiting'; e.timer = e.breakTime; e.target = null;
        } else {
          // find another free room or drop back to waiting slots
          const alt = rooms.find(rr=>!rr.occupied);
          if (alt){
            e.target.x = alt.x + alt.w/2 - 8; e.target.y = alt.y + alt.h/2 - 8; e.target.roomIndex = rooms.indexOf(alt);
          } else {
            // no room -> put group back to waiting if slot exists
            e.state='idle'; e.target=null;
          }
        }
      }
    } else if (e.state==='waiting'){
      e.timer -= dt;
      moveWithWalls(e, e.waitX, e.waitY, e.speed*dt, WALLS);
      if (e.timer <= 0) e.state = 'idle';
    } else if (e.state==='idle'){
      moveWithWalls(e, e.waitX, e.waitY, e.speed*dt, WALLS);
    }
  }
}

window.Emps = { EMP_COST, generateEmployeeCandidates, hireEmployee, updateEmployees, moveWithWalls, EMP_COLORS };
