(()=>{
  // ===== Canvas full-screen & resize =====
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function resizeCanvas(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(window.innerWidth  * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width  = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    rebuildLayout();
  }
  window.addEventListener('resize', resizeCanvas);
  function viewW(){ return window.innerWidth; }
  function viewH(){ return window.innerHeight; }

  // ===== Joueur =====
  const player = { x: 200, y: 300, w: 40, h: 40, speed: 5.2 };
  const keys = {};
  document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

  // ===== Layout =====
  let HQ, WAIT, MISSION, WALLS, BTN_HELP, WAIT_DOOR; // WAIT_DOOR = porte
  const GROUP_SIZE_PX = 30;

  // Salles
  const ROOM_W = 120, ROOM_H = 60;
  const rooms = [];
  let MISSION_GRID = [];

  // Slots d'attente
  let waitingSlots = []; // {x,y,w,h, occupiedBy, reserved}

  // Chaise
  const chairPath = (() => { const p=new Path2D(); p.rect(2,10,16,6); p.rect(2,4,16,4); p.rect(3,16,3,4); p.rect(14,16,3,4); return p; })();
  function drawChair(x, y, size, state="empty"){
    const s = size / 20;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = state==="occupied" ? "#c9c9c9" : state==="reserved" ? "#e6d07a" : "#efefef";
    ctx.strokeStyle = "#888"; ctx.lineWidth = 1.2 / s;
    ctx.fill(chairPath); ctx.stroke(chairPath);
    ctx.restore();
  }

  function rebuildLayout(){
    const w = viewW(), h = viewH();
    HQ   = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.29), h: Math.round(h*0.22) };
    WAIT = { x: w - Math.round(w*0.35), y: Math.round(h*0.06), w: Math.round(w*0.29), h: Math.round(h*0.22) };
    MISSION = { x: Math.round(w*0.06), y: Math.round(h*0.42), w: w - Math.round(w*0.12), h: h - Math.round(h*0.50) };

    // Mur horizontal avec ouverture centrale
    const wallY = Math.round(h*0.36);
    const gapW = Math.max(160, Math.floor(w*0.14));
    const segW = Math.floor((w - gapW - 40) / 2);
    WALLS = [
      {x:0, y:0, w:w, h:20}, {x:0, y:h-20, w:w, h:20},
      {x:0, y:0, w:20, h:h}, {x:w-20, y:0, w:20, h:h},
      {x:20, y:wallY, w:segW, h:10},
      {x:20 + segW + gapW, y:wallY, w: segW, h:10},
    ];
    // Porte : juste un rectangle dans l'ouverture, en bas du mur
    WAIT_DOOR = { x: 20 + segW + Math.floor((gapW-60)/2), y: wallY-2, w: 60, h: 14 };

    BTN_HELP = { x: HQ.x + Math.floor(HQ.w/2) - 60, y: HQ.y + Math.floor(HQ.h/2) - 18, w:120, h:36 };

    rebuildMissionGrid();
    rebuildWaitingSlots();

    player.x = Utils.clamp(player.x, 20, w-20-player.w);
    player.y = Utils.clamp(player.y, 20, h-20-player.h);
  }

  function missionGridPositions(){
    const pad = 10, gap = 20;
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
    return pts;
  }
  function rebuildMissionGrid(){
    MISSION_GRID = missionGridPositions();
    rooms.forEach((r,i)=>{ if (i < MISSION_GRID.length){ r.x = MISSION_GRID[i].x; r.y = MISSION_GRID[i].y; } });
  }

  function rebuildWaitingSlots(){
    const pad = 16;
    const cell = GROUP_SIZE_PX + 12;
    const cols = Math.max(1, Math.floor((WAIT.w - pad*2) / cell));
    const rows = Math.max(1, Math.floor((WAIT.h - pad*2) / cell));
    waitingSlots = [];
    const ox = WAIT.x + pad;
    const oy = WAIT.y + pad;
    for (let r=0; r<rows; r++){
      for (let c=0; c<cols; c++){
        const x = Math.round(ox + c*cell);
        const y = Math.round(oy + r*cell);
        waitingSlots.push({ x, y, w: GROUP_SIZE_PX, h: GROUP_SIZE_PX, occupiedBy: null, reserved: false });
      }
    }
    // Reflow des groupes en attente
    const allWaiting = [...groupsWaiting, ...groupsMoving.filter(g=>g.state==='waiting'), ...(selectedGroup?[selectedGroup]:[])];
    waitingSlots.forEach(s=>{ s.occupiedBy=null; s.reserved=false; });
    let i=0;
    for (const g of allWaiting){
      if (i >= waitingSlots.length) break;
      const s = waitingSlots[i++];
      g.x = s.x; g.y = s.y; g.slotIndex = waitingSlots.indexOf(s);
      s.occupiedBy = g;
    }
  }

  // ===== Économie & Jour =====
  let day=1, money=120, groupsNeeded=8, groupsSpawned=0, groupsServed=0;
  const GROUP_SPEED = 140;
  const GROUP_SPAWN_DELAY = 3;
  let spawnTimer = 0;

  // Timer de journée
  const DAY_DURATION = 120; // secondes
  let dayTimeLeft = DAY_DURATION;
  let dayOver = false; // plus de spawns quand true
  function fmtTime(t){
    const s = Math.max(0, Math.floor(t));
    const m = Math.floor(s/60), r = s%60;
    return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
  }

  // ===== Groupes =====
  const groupsMoving = [];   // {x,y,w,h,clients,targetX,targetY,speed,state,satisfaction,slotIndex,byEmployee}
  const groupsWaiting = [];
  let selectedGroup = null;

  function findFreeSlot(){ return waitingSlots.findIndex(s => !s.occupiedBy && !s.reserved); }

  function spawnGroup(){
    if (dayOver) return;
    if (groupsSpawned >= groupsNeeded) return;
    const slotIdx = findFreeSlot();
    if (slotIdx === -1) return; // pas de place
    const s = waitingSlots[slotIdx];
    s.reserved = true;
    const gx = WAIT.x + 20, gy = -GROUP_SIZE_PX;
    const g = {
      x: gx, y: gy, w: GROUP_SIZE_PX, h: GROUP_SIZE_PX,
      clients: 2 + Math.floor(Math.random()*5),
      speed: GROUP_SPEED,
      targetX: s.x, targetY: s.y, state: 'moving',
      satisfaction: 100, slotIndex: slotIdx,
      byEmployee: null // id employé si pris en charge
    };
    groupsMoving.push(g);
    groupsSpawned++;
  }

  // ===== Salles / Missions =====
  function addRoomAtNext(info){
    const idx = rooms.length;
    if (idx >= MISSION_GRID.length) return false;
    const p = MISSION_GRID[idx];
    rooms.push({
      x:p.x, y:p.y, w:ROOM_W, h:ROOM_H,
      name:info.name, class:info.class,
      occupied:false, timer:0, group:null,
      needHelp:false, helpTimer:0,
      assignedBy: null // employeeId or 'player'
    });
    return true;
  }
  addRoomAtNext(Utils.randRoom());
  addRoomAtNext(Utils.randRoom());

  function updateRooms(dt){
    for (const r of rooms){
      if (!r.occupied) continue;
      r.timer -= dt;
      if (r.group) r.group.satisfaction = Utils.clamp(r.group.satisfaction - 2*dt, 0, 100);

      // pas de "need help" pour missions gérées par un employé
      const noHelp = r.assignedBy !== 'player' && r.assignedBy !== null;
      if (!noHelp){
        if (!r.needHelp && Math.random() < (0.06 * dt)){
          r.needHelp = true; r.helpTimer = 30;
        }
        if (r.needHelp){
          r.helpTimer -= dt;
          if (r.helpTimer <= 0){
            r.group.satisfaction = Utils.clamp(r.group.satisfaction - 10, 0, 100);
            r.needHelp = false;
          }
        }
      }

      if (r.timer <= 0){
        const pay = PRICE[r.class] * (r.group.satisfaction/100);
        money += Math.round(pay*100)/100;
        groupsServed++;
        // libère la charge employé si besoin
        if (r.assignedBy && r.assignedBy !== 'player'){
          const emp = employees.find(e=>e.id===r.assignedBy);
          if (emp){ emp.activeTeams = Math.max(0, emp.activeTeams - 1); emp.state = 'idle'; emp.waitX = r.x + r.w/2 - 8; emp.waitY = r.y + r.h + 8; }
        }
        r.occupied=false; r.group=null; r.needHelp=false; r.helpTimer=0; r.timer=0; r.assignedBy=null;
      }
    }
  }

  // ===== Porte & fin de journée =====
  function canEndDay(){
    if (!dayOver) return false; // journée doit être terminée (timer écoulé)
    if (groupsWaiting.length>0 || groupsMoving.length>0) return false;
    if (rooms.some(r=>r.occupied)) return false;
    return true;
  }
  function tryCloseDayAtDoor(){
    if (!Utils.rectsIntersect(player, Utils.inflateRect(WAIT_DOOR, 16, 16))) return false;
    if (!canEndDay()) return false;
    openShop(); // pause + boutique
    return true;
  }

  // ===== IA Employés =====
  let nextEmpId = 1;
  const employees = []; // {id,name,x,y,w,h,speed,capacity,breakTime,activeTeams,state,target,timer,waitX,waitY}
  const EMP_COST = 80;

  function randName(){
    const first = ['Alex','Sam','Lina','Max','Noa','Eli','Zoé','Kim','Iris','Milo','Nora','Léo'];
    const last  = ['Roux','Martin','Bern','Klein','Morel','Dubois','Fabre','Mercier','Robin','Dupont'];
    return first[Math.floor(Math.random()*first.length)] + ' ' + last[Math.floor(Math.random()*last.length)];
  }

  // génère 2 candidats
  function generateEmployeeCandidates(){
    const arr = [];
    for (let i=0;i<2;i++){
      arr.push({
        id: 0, // assigned on hire
        name: randName(),
        speed: 110 + Math.floor(Math.random()*60),    // px/s
        capacity: 1 + Math.floor(Math.random()*2),    // 1..2
        breakTime: 6 + Math.floor(Math.random()*6),   // s
      });
    }
    return arr;
  }
  let empCandidates = [];

  // apply upgrade to a chosen employee
  function applyUpgradeToEmployee(emp, upg){
    if (!emp) return;
    if (upg.stat === 'capacity') emp.capacity += upg.value;
    if (upg.stat === 'speed') emp.speed += upg.value * 5; // 1 pt = +5 px/s
    if (upg.stat === 'break') emp.breakTime = Math.max(0, emp.breakTime - Math.floor(upg.value/3)); // réduire
  }

  // In-game hired employee object
  function hireEmployee(proto){
    if (money < EMP_COST) return false;
    money -= EMP_COST;
    const e = {
      id: nextEmpId++,
      name: proto.name,
      x: WAIT.x + WAIT.w/2 - 8,
      y: WAIT.y + WAIT.h + 10,
      w: 16, h: 16,
      speed: proto.speed,
      capacity: proto.capacity,
      breakTime: proto.breakTime,
      activeTeams: 0,
      waitX: WAIT.x + WAIT.w/2 - 8,
      waitY: WAIT.y + WAIT.h + 10,
      state: 'idle', // idle | movingToGroup | movingToRoom | waiting
      target: null,
      timer: 0
    };
    employees.push(e);
    return true;
  }

  function updateEmployees(dt){
    for (const e of employees){
      // s'il peut prendre une nouvelle équipe
      const canTake = e.activeTeams < e.capacity && !dayPaused; // dayPaused quand overlay ouvert
      if (canTake && e.state==='idle'){
        // trouver un groupe en attente + une salle libre
        const g = groupsWaiting[0];
        const room = rooms.find(r=>!r.occupied);
        if (g && room){
          // prendre le groupe
          // libère son slot
          const s = waitingSlots[g.slotIndex];
          if (s) s.occupiedBy = null;
          // retirer du waiting
          groupsWaiting.shift();
          // l'employé transporte le groupe (virtuel) vers la salle
          e.state = 'movingToRoom';
          e.target = { x: room.x + room.w/2 - 8, y: room.y + room.h/2 - 8, group: g, room };
        }
      }

      // Déplacements employés
      if (e.state==='movingToRoom' && e.target){
        moveEntityTowards(e, e.target.x, e.target.y, e.speed*dt);
        if (Math.hypot(e.x-e.target.x, e.y-e.target.y) < 2){
          // déposer le groupe dans la salle
          const room = e.target.room;
          const g = e.target.group;
          room.occupied = true;
          room.group = g;
          room.timer = 20;
          room.needHelp = false;
          room.helpTimer = 0;
          room.assignedBy = e.id; // géré par employé ⇒ jamais besoin d'aide
          e.activeTeams++;
          // se place sous la salle
          e.waitX = room.x + room.w/2 - 8;
          e.waitY = room.y + room.h + 8;
          e.state = 'waiting';
          e.timer = e.breakTime; // petite pause
          e.target = null;
        }
      } else if (e.state==='waiting'){
        // temporisation de pause
        e.timer -= dt;
        moveEntityTowards(e, e.waitX, e.waitY, e.speed*dt);
        if (e.timer <= 0){
          e.state = 'idle';
        }
      } else if (e.state==='idle'){
        // retourne à sa position d’attente
        moveEntityTowards(e, e.waitX, e.waitY, e.speed*dt);
      }
    }
  }
  function moveEntityTowards(ent, tx, ty, step){
    const vx = tx - ent.x, vy = ty - ent.y;
    const d = Math.hypot(vx,vy);
    if (d <= step || d < 0.1){ ent.x = tx; ent.y = ty; return; }
    ent.x += (vx/d)*step;
    ent.y += (vy/d)*step;
  }

  // ===== Interactions joueur =====
  function tryPickOrAssign(){
    if (!selectedGroup){
      // prendre un groupe en attente
      for (let i=0;i<groupsWaiting.length;i++){
        const g = groupsWaiting[i];
        if (Utils.rectsIntersect(player, Utils.inflateRect(g, 20, 20))){
          const s = waitingSlots[g.slotIndex];
          if (s) s.occupiedBy = null;
          selectedGroup = g;
          groupsWaiting.splice(i,1);
          return;
        }
      }
      // fermer la journée via la porte si possible
      if (tryCloseDayAtDoor()) return;
    } else {
      // poser dans une salle libre
      for (const r of rooms){
        if (!r.occupied && Utils.rectsIntersect(player, Utils.inflateRect(r, 20, 20))){
          r.occupied = true;
          r.group = selectedGroup;
          r.timer = 20;
          r.needHelp = false;
          r.helpTimer = 0;
          r.assignedBy = 'player';
          selectedGroup = null;
          return;
        }
      }
      // sinon reposer en attente
      const idx = findFreeSlot();
      if (idx !== -1){
        const s = waitingSlots[idx];
        s.occupiedBy = selectedGroup;
        selectedGroup.x = s.x; selectedGroup.y = s.y; selectedGroup.slotIndex = idx;
        groupsWaiting.push(selectedGroup);
        selectedGroup = null;
        s.reserved = false;
      }
    }
  }
  function helpIfInHQ(){
    if (!Utils.rectsIntersect(player, HQ)) return;
    for (const r of rooms){
      if (r.occupied && r.needHelp) r.needHelp = false;
    }
  }

  // ===== Boutique étendue (salles + employés + upgrade) =====
  const overlay = document.getElementById('overlay');
  const shopChoicesBox = document.getElementById('shopChoices');
  const skipBtn = document.getElementById('skipBtn');
  const empChoicesBox = document.getElementById('empChoices');
  const upgradeRow = document.getElementById('upgradeRow');
  let shopOpen = false, shopChoices = [];
  let dayPaused = false;

  function renderRoomsShop(){
    shopChoicesBox.innerHTML = shopChoices.map((c,i)=>{
      const price = PRICE[c.class];
      const cls = c.class==='S'?'clsS':c.class==='A'?'clsA':c.class==='B'?'clsB':'clsC';
      return `
        <div class="choice">
          <div class="badge ${cls}">${c.class}</div>
          <div style="flex:1">
            <div><b>${c.name}</b></div>
            <div class="small">Prix : ${price}€</div>
          </div>
          <button data-room="${i}" class="btn">Acheter</button>
        </div>
      `;
    }).join('');
    // bind
    shopChoicesBox.querySelectorAll('button[data-room]').forEach(b=>{
      b.addEventListener('click', e=>{
        const idx = parseInt(e.currentTarget.getAttribute('data-room'));
        const c = shopChoices[idx];
        if (c && money >= PRICE[c.class]){
          if (addRoomAtNext(c)) money -= PRICE[c.class];
          e.currentTarget.disabled = true;
        }
      });
    });
  }

  function renderEmployeeShop(){
    empChoicesBox.innerHTML = empCandidates.map((c,i)=>`
      <div class="emp-card">
        <div class="row"><b>${c.name}</b><span class="emp-tag">Candidat</span></div>
        <div class="row"><span>Capacité</span><b>${c.capacity}</b></div>
        <div class="row"><span>Vitesse</span><b>${c.speed} px/s</b></div>
        <div class="row"><span>Pause</span><b>${c.breakTime}s</b></div>
        <div class="actions">
          <button data-emp="${i}" class="btn">Embaucher (${EMP_COST}€)</button>
        </div>
      </div>
    `).join('');
    empChoicesBox.querySelectorAll('button[data-emp]').forEach(b=>{
      b.addEventListener('click', e=>{
        const idx = parseInt(e.currentTarget.getAttribute('data-emp'));
        const proto = empCandidates[idx];
        if (hireEmployee(proto)){
          // disable card
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = 'Embauché';
        }
      });
    });
  }

  let upgrades = []; // [{stat:'capacity'|'speed'|'break', value:int}]
  function randUpgrade(){
    const stats = ['capacity','speed','break'];
    const stat = stats[Math.floor(Math.random()*stats.length)];
    const value = Utils.biasedInt(0, 15, 2.3); // biais vers bas
    return {stat, value};
  }

  function renderUpgrades(){
    upgradeRow.innerHTML = '';
    upgrades.forEach((u, i)=>{
      const label = u.stat==='capacity' ? 'Capacité +'
                   : u.stat==='speed'   ? 'Vitesse +'
                   : 'Pause -';
      const vtxt = u.stat==='speed' ? `${u.value*5}px/s` : `${u.value}`;
      const card = document.createElement('div');
      card.className = 'upg';
      card.innerHTML = `<b>${label}${u.stat==='break'?'': ''}</b> <span>(${vtxt})</span>`;
      card.addEventListener('click', ()=>{
        if (employees.length===0){ card.classList.add('disabled'); return; }
        // Appliquer à l'employé avec la capacité la plus faible (par défaut)
        let target = employees[0];
        for (const e of employees) if (e.capacity < target.capacity) target = e;
        applyUpgradeToEmployee(target, u);
        // désactiver toutes les upgrades (une par jour)
        Array.from(upgradeRow.children).forEach(c=>c.classList.add('disabled'));
      });
      upgradeRow.appendChild(card);
    });
  }

  function openShop(){
    shopChoices = [Utils.randRoom(), Utils.randRoom(), Utils.randRoom()];
    empCandidates = generateEmployeeCandidates();
    upgrades = [randUpgrade(), randUpgrade(), randUpgrade()];
    renderRoomsShop();
    renderEmployeeShop();
    renderUpgrades();
    overlay.classList.remove('hidden');
    shopOpen = true;
    dayPaused = true;
  }
  function closeShop(){
    overlay.classList.add('hidden');
    shopOpen = false;
    dayPaused = false;
    // Prépare prochain jour
    day += 1;
    groupsNeeded += 2;
    groupsSpawned = 0;
    groupsServed = 0;
    spawnTimer = 0;
    dayTimeLeft = DAY_DURATION;
    dayOver = false;
  }
  skipBtn.addEventListener('click', closeShop);

  // Raccourcis rooms shop
  document.addEventListener('keydown', e=>{
    if (!shopOpen) return;
    if (e.key === 'Escape') closeShop();
    const mapKey = {'1':0,'2':1,'3':2};
    if (e.key in mapKey){
      const idx = mapKey[e.key];
      const c = shopChoices[idx];
      if (c && money >= PRICE[c.class]){
        if (addRoomAtNext(c)) money -= PRICE[c.class];
        renderRoomsShop();
      }
    }
  });

  // ===== Stats Panel =====
  const elDay = document.getElementById('stat-day');
  const elMoney = document.getElementById('stat-money');
  const elRooms = document.getElementById('stat-rooms');
  const elNeeded = document.getElementById('stat-needed');
  const elSpawned = document.getElementById('stat-spawned');
  const elServed = document.getElementById('stat-served');
  const elSpeed = document.getElementById('stat-speed');
  const elPos = document.getElementById('stat-pos');
  const elFollowing = document.getElementById('stat-following');
  const elDayTime = document.getElementById('stat-daytime');

  function updateStatsPanel(){
    elDay.textContent = String(day);
    elMoney.textContent = `${money.toFixed(2)}€`;
    elRooms.textContent = String(rooms.length);
    elNeeded.textContent = String(groupsNeeded);
    elSpawned.textContent = String(groupsSpawned);
    elServed.textContent = String(groupsServed);
    elSpeed.textContent = player.speed.toFixed(1);
    elPos.textContent = `${Math.round(player.x)}, ${Math.round(player.y)}`;
    elFollowing.textContent = selectedGroup ? `${selectedGroup.clients}p` : 'Non';
    elDayTime.textContent = fmtTime(dayTimeLeft);
  }

  // ===== Loop =====
  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now - last)/1000);
    last = now;

    // Timer de journée
    if (!dayPaused && !shopOpen){
      if (!dayOver){
        dayTimeLeft -= dt;
        if (dayTimeLeft <= 0){
          dayTimeLeft = 0;
          dayOver = true; // stop spawns
        }
      }
    }

    // Inputs ZQSD + flèches
    let dx=0, dy=0;
    if (keys['q'] || keys['arrowleft'])  dx -= player.speed;
    if (keys['d'] || keys['arrowright']) dx += player.speed;
    if (keys['z'] || keys['arrowup'])    dy -= player.speed;
    if (keys['s'] || keys['arrowdown'])  dy += player.speed;

    // Actions (one-shot)
    if (keys['e']) { tryPickOrAssign(); keys['e']=false; }
    if (keys['h']) { helpIfInHQ(); keys['h']=false; }
    if (keys['m'] && !shopOpen) { openShop(); keys['m']=false; }

    // Mouvements + collisions murs (si pas en pause)
    if (!dayPaused) moveWithWalls(player, dx, dy);

    // Spawning
    if (!shopOpen && !dayPaused && !dayOver){
      spawnTimer += dt;
      if (spawnTimer >= GROUP_SPAWN_DELAY && groupsSpawned < groupsNeeded){
        spawnTimer = 0; spawnGroup();
      }
    }

    // Avancée des groupes vers leur slot
    const arrived = [];
    for (const g of groupsMoving){
      if (g.state!=='moving') continue;
      const vx = g.targetX - g.x, vy = g.targetY - g.y;
      const dist = Math.hypot(vx,vy), step = g.speed * dt;
      if (dist <= step){
        g.x = g.targetX; g.y = g.targetY; g.state = 'waiting';
        arrived.push(g);
      } else {
        g.x += (vx/dist)*step; g.y += (vy/dist)*step;
      }
    }
    for (const g of arrived){
      const s = waitingSlots[g.slotIndex];
      if (s){ s.occupiedBy = g; s.reserved = false; }
      groupsMoving.splice(groupsMoving.indexOf(g),1);
      groupsWaiting.push(g);
    }

    // Groupe suivi par le joueur
    if (selectedGroup){
      selectedGroup.x = player.x - selectedGroup.w - 6;
      selectedGroup.y = player.y + (player.h - selectedGroup.h)/2;
    }

    // Update salles & employés
    if (!shopOpen && !dayPaused){
      updateRooms(dt);
      updateEmployees(dt);
    }

    // Rendu
    drawScene();
    updateStatsPanel();

    requestAnimationFrame(loop);
  }

  function moveWithWalls(ent, dx, dy){
    ent.x += dx;
    for (const w of WALLS){
      if (Utils.rectsIntersect(ent, w)){
        if (dx > 0) ent.x = w.x - ent.w;
        else if (dx < 0) ent.x = w.x + w.w;
      }
    }
    ent.y += dy;
    for (const w of WALLS){
      if (Utils.rectsIntersect(ent, w)){
        if (dy > 0) ent.y = w.y - ent.h;
        else if (dy < 0) ent.y = w.y + w.h;
      }
    }
    ent.x = Utils.clamp(ent.x, 20, viewW()-20-ent.w);
    ent.y = Utils.clamp(ent.y, 20, viewH()-20-ent.h);
  }

  // ===== Dessins =====
  function drawScene(){
    ctx.clearRect(0,0,viewW(),viewH());
    drawLayout();
    drawWaitingChairs();
    drawRooms();
    drawRoomTimers();
    drawGroups();
    drawEmployees();
    drawPlayer();
    drawDoorHint();
  }
  function drawLayout(){
    ctx.strokeStyle = COLORS.green; ctx.lineWidth=3; Utils.roundRect(ctx, WAIT.x, WAIT.y, WAIT.w, WAIT.h, 6, false);
    ctx.strokeStyle = COLORS.red;   Utils.roundRect(ctx, HQ.x, HQ.y, HQ.w, HQ.h, 6, false);
    ctx.strokeStyle = COLORS.blue;  Utils.roundRect(ctx, MISSION.x, MISSION.y, MISSION.w, MISSION.h, 6, false);
    ctx.fillStyle = COLORS.wall;
    for (const w of WALLS) ctx.fillRect(w.x,w.y,w.w,w.h);

    // Porte
    ctx.fillStyle = '#5c8cff';
    ctx.fillRect(WAIT_DOOR.x, WAIT_DOOR.y, WAIT_DOOR.w, WAIT_DOOR.h);

    // Bouton aider
    ctx.fillStyle = '#f0f0f0'; Utils.roundRect(ctx, BTN_HELP.x, BTN_HELP.y, BTN_HELP.w, BTN_HELP.h, 6, true);
    ctx.strokeStyle = COLORS.black; Utils.roundRect(ctx, BTN_HELP.x, BTN_HELP.y, BTN_HELP.w, BTN_HELP.h, 6, false);
    ctx.fillStyle = COLORS.black; ctx.font='16px Segoe UI, Arial';
    ctx.fillText('Aider (H)', BTN_HELP.x + 20, BTN_HELP.y + 23);
  }
  function drawWaitingChairs(){
    for (const s of waitingSlots){
      const state = s.occupiedBy ? 'occupied' : (s.reserved ? 'reserved' : 'empty');
      drawChair(s.x + (s.w-20)/2, s.y + (s.h-20)/2, 20, state);
    }
  }
  function drawRooms(){
    ctx.font = '14px Segoe UI, Arial';
    for (const r of rooms){
      const base = CLASS_COLOR[r.class];
      const fill = r.occupied ? Utils.darken(base, 0.35) : base;
      ctx.fillStyle = fill; ctx.fillRect(r.x,r.y,r.w,r.h);
      ctx.strokeStyle = COLORS.black; ctx.lineWidth=2; ctx.strokeRect(r.x,r.y,r.w,r.h);
      const name = r.name.length>18 ? r.name.slice(0,18)+'…' : r.name;
      ctx.fillStyle = COLORS.black;
      ctx.fillText(name, r.x+6, r.y+18);
      ctx.fillText(`(${r.class})`, r.x+6, r.y+36);
      if (r.occupied && r.needHelp){
        ctx.fillStyle = COLORS.orange;
        ctx.beginPath(); ctx.arc(r.x+r.w-12, r.y+r.h-12, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = COLORS.black; ctx.fillText('!', r.x+r.w-15, r.y+r.h-8);
      }
    }
  }
  function drawRoomTimers(){
    // barre sous chaque salle si occupée + texte
    ctx.font = '12px Segoe UI, Arial';
    for (const r of rooms){
      if (!r.occupied) continue;
      const total = 20; // s
      const rem = Math.max(0, r.timer);
      const pct = Utils.clamp(rem/total, 0, 1);
      const barW = r.w, barH = 10, x = r.x, y = r.y + r.h + 6;
      // fond
      ctx.fillStyle = '#e6e6e6'; Utils.roundRect(ctx, x, y, barW, barH, 4, true);
      // fill
      ctx.fillStyle = '#6ac36a'; Utils.roundRect(ctx, x, y, Math.floor(barW*pct), barH, 4, true);
      // contour
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1; Utils.roundRect(ctx, x, y, barW, barH, 4, false);
      // texte
      ctx.fillStyle = '#222';
      ctx.fillText(`${Math.ceil(rem)}s`, x + barW/2 - 10, y + barH + 12);
    }
  }
  function drawGroups(){
    ctx.font = '14px Segoe UI, Arial';
    for (const g of groupsMoving){
      ctx.fillStyle = COLORS.red; ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.fillStyle = COLORS.black; ctx.fillText(`${g.clients}p`, g.x+4, g.y-4);
    }
    for (const g of groupsWaiting){
      ctx.fillStyle = COLORS.red; ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.fillStyle = COLORS.black; ctx.fillText(`${g.clients}p`, g.x+4, g.y-4);
    }
    if (selectedGroup){
      const g = selectedGroup;
      ctx.fillStyle = '#ff8c8c'; ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.fillStyle = COLORS.black; ctx.fillText(`${g.clients}p`, g.x+4, g.y-4);
    }
  }
  function drawEmployees(){
    for (const e of employees){
      ctx.fillStyle = '#333';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      // petit indicateur capacité
      ctx.fillStyle = '#7fe0e0';
      for (let i=0;i<e.capacity;i++){
        const filled = i < e.activeTeams;
        ctx.globalAlpha = filled ? 1 : 0.3;
        ctx.fillRect(e.x + i*4, e.y - 6, 3, 4);
        ctx.globalAlpha = 1;
      }
    }
  }
  function drawPlayer(){
    ctx.fillStyle = '#5078ff';
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }
  function drawDoorHint(){
    if (dayOver && Utils.rectsIntersect(player, Utils.inflateRect(WAIT_DOOR, 18, 18)) && canEndDay()){
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(WAIT_DOOR.x - 40, WAIT_DOOR.y - 36, 180, 28);
      ctx.fillStyle = '#fff'; ctx.font = '14px Segoe UI, Arial';
      ctx.fillText('E : Fermer l’escape (finir la journée)', WAIT_DOOR.x - 34, WAIT_DOOR.y - 16);
    } else if (dayOver && Utils.rectsIntersect(player, Utils.inflateRect(WAIT_DOOR, 18, 18)) && !canEndDay()){
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(WAIT_DOOR.x - 40, WAIT_DOOR.y - 36, 210, 28);
      ctx.fillStyle = '#fff'; ctx.font = '14px Segoe UI, Arial';
      ctx.fillText('Attendez que toutes les salles soient vides', WAIT_DOOR.x - 34, WAIT_DOOR.y - 16);
    }
  }

  // ===== Start =====
  resizeCanvas();
  requestAnimationFrame(loop);
})();
