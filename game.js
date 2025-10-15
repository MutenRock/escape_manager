(()=>{
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // === Resize & Layout ===
  function resizeCanvas(){ const dpr=Math.max(1, window.devicePixelRatio||1);
    canvas.width = Math.floor(window.innerWidth*dpr); canvas.height = Math.floor(window.innerHeight*dpr);
    canvas.style.width = window.innerWidth+'px'; canvas.style.height = window.innerHeight+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    rebuildLayout();
  }
  window.addEventListener('resize', resizeCanvas);

  let HQ, WAIT, MISSION, WALLS, BTN_HELP, WAIT_DOOR;
  const GROUP_SIZE_PX = 30;

  function rebuildLayout(){
    const w=window.innerWidth, h=window.innerHeight;
    HQ   = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.29), h: Math.round(h*0.22) };
    WAIT = { x: w - Math.round(w*0.35), y: Math.round(h*0.06), w: Math.round(w*0.29), h: Math.round(h*0.22) };
    MISSION = { x: Math.round(w*0.06), y: Math.round(h*0.42), w: w - Math.round(w*0.12), h: h - Math.round(h*0.50) };
    const wallY = Math.round(h*0.36);
    const gapW = Math.max(160, Math.floor(w*0.14));
    const segW = Math.floor((w - gapW - 40) / 2);
    WALLS = [
      {x:0,y:0,w:w,h:20},{x:0,y:h-20,w:w,h:20},{x:0,y:0,w:20,h:h},{x:w-20,y:0,w:20,h:h},
      {x:20,y:wallY,w:segW,h:10},{x:20+segW+gapW,y:wallY,w:segW,h:10}
    ];
    WAIT_DOOR = { x: 20 + segW + Math.floor((gapW-60)/2), y: wallY-2, w: 60, h: 14 };
    BTN_HELP = { x: HQ.x + Math.floor(HQ.w/2) - 60, y: HQ.y + Math.floor(HQ.h/2) - 18, w:120, h:36 };

    Rooms.initRoomGrid(MISSION);
    if (GameState.rooms.length===0){
      Rooms.addRoomAtNextSlot(Utils.randRoom());
    } else {
      // re-clamp rooms to new grid indices by nearest cell
      GameState.rooms.forEach(r=>{
        // find nearest
        let best=0, bd=1e9;
        GameState.roomGrid.forEach((p,i)=>{
          const d=Math.hypot((p.x-r.x),(p.y-r.y));
          if (d<bd){bd=d;best=i;}
        });
        const p = GameState.roomGrid[best]; r.x=p.x; r.y=p.y;
      });
    }
  }

  // === Player & Input ===
  const player = GameState.player;
  const keys={};
  document.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; });
  document.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

  // === Waiting Slots (grid chairs) ===
  let waitingSlots=[];
  function rebuildWaitingSlots(){
    const pad=16, cell=GROUP_SIZE_PX+12;
    const cols = Math.max(1, Math.floor((WAIT.w - pad*2)/cell));
    const rows = Math.max(1, Math.floor((WAIT.h - pad*2)/cell));
    waitingSlots=[]; const ox=WAIT.x+pad, oy=WAIT.y+pad;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const x=Math.round(ox+c*cell), y=Math.round(oy+r*cell);
      waitingSlots.push({x,y,w:GROUP_SIZE_PX,h:GROUP_SIZE_PX,occupiedBy:null,reserved:false});
    }
  }

  // === Groups ===
  const groupsMoving=[], groupsWaiting=[];
  let selectedGroups=[]; // player can carry multiple up to capacity

  function findFreeSlot(){ return waitingSlots.findIndex(s=>!s.occupiedBy && !s.reserved); }
  const GROUP_SPEED=140, GROUP_SPAWN_DELAY=3; let spawnTimer=0;

  function spawnGroup(){
    if (GameState.dayOver) return;
    if (GameState.groupsSpawned >= GameState.groupsNeeded) return;
    const slotIdx = findFreeSlot(); if (slotIdx===-1) return;
    const s = waitingSlots[slotIdx]; s.reserved=true;
    const g = { x:WAIT.x+20, y:-GROUP_SIZE_PX, w:GROUP_SIZE_PX, h:GROUP_SIZE_PX,
      clients: 2+Math.floor(Math.random()*5), speed:GROUP_SPEED,
      targetX:s.x, targetY:s.y, state:'moving', satisfaction:100, slotIndex:slotIdx, byEmployee:null };
    groupsMoving.push(g); GameState.groupsSpawned++; GameState.meta.totalClients=(GameState.meta.totalClients||0)+g.clients;
  }

  // === Interactions ===
  function tryPickOrAssign(){
    // End-day door action
    if (!selectedGroups.length){
      if (tryCloseDayAtDoor()) return;
    }
    // pick
    if (selectedGroups.length < GameState.player.carryCapacity){
      for (let i=0;i<groupsWaiting.length;i++){
        const g = groupsWaiting[i];
        if (Utils.rectsIntersect(player, Utils.inflateRect(g,20,20))){
          const s = waitingSlots[g.slotIndex]; if (s) s.occupiedBy = null;
          selectedGroups.push(g);
          groupsWaiting.splice(i,1);
          return;
        }
      }
    }
    // assign to a free room (first in hand)
    if (selectedGroups.length){
      for (const r of GameState.rooms){
        if (!r.occupied && Utils.rectsIntersect(player, Utils.inflateRect(r,20,20))){
          const g = selectedGroups.shift();
          // assign
          r.occupied=true; r.group=g; r.timer=20; r.needHelp=false; r.helpTimer=0; r.assignedBy='player';
          return;
        }
      }
      // else drop back to waiting
      const idx = findFreeSlot();
      if (idx!==-1){
        const g = selectedGroups.shift(); const s = waitingSlots[idx];
        s.occupiedBy=g; g.x=s.x; g.y=s.y; g.slotIndex=idx; groupsWaiting.push(g); s.reserved=false;
      }
    }
  }

  function helpIfInHQ(){
    if (!Utils.rectsIntersect(player, HQ)) return;
    for (const r of GameState.rooms){
      if (r.occupied && r.needHelp) r.needHelp=false;
    }
  }

  function tryCloseDayAtDoor(){
    if (!Utils.rectsIntersect(player, Utils.inflateRect(WAIT_DOOR,18,18))) return false;
    if (!canEndDay()) return false;
    openManagement();
    return true;
  }

  // === Room Logic ===
  function updateRooms(dt){
    for (const r of GameState.rooms){
      if (!r.occupied) continue;
      r.timer -= dt;
      if (r.group) r.group.satisfaction = Utils.clamp(r.group.satisfaction - 2*dt, 0, 100);

      const noHelp = r.assignedBy && r.assignedBy!=='player';
      if (!noHelp){
        if (!r.needHelp && Math.random() < (0.06 * dt)){ r.needHelp=true; r.helpTimer=30; }
        if (r.needHelp){ r.helpTimer -= dt; if (r.helpTimer<=0){ r.group.satisfaction=Utils.clamp(r.group.satisfaction-10,0,100); r.needHelp=false; GameState.dayNoHelpFailed=true; } }
      } else {
        // emit particles more often because auto-run
        if (Math.random()<0.08*dt) Rooms.spawnRoomParticle(r);
      }
      if (Math.random()<0.04*dt) Rooms.spawnRoomParticle(r);

      if (r.timer <= 0){
        const pay = PRICE[r.class] * (r.group.satisfaction/100);
        GameState.money += Math.round(pay*100)/100;
        GameState.groupsServed++;
        GameState.meta.totalServed = (GameState.meta.totalServed||0) + 1;

        // free employee capacity
        if (r.assignedBy && r.assignedBy!=='player'){
          const e = GameState.employees.find(e=>e.id===r.assignedBy);
          if (e){ e.activeTeams=Math.max(0, e.activeTeams-1); e.state='idle'; e.waitX = r.x+r.w/2-8; e.waitY = r.y+r.h+8; }
        }
        r.occupied=false; r.group=null; r.needHelp=false; r.helpTimer=0; r.timer=0; r.assignedBy=null;
      }
    }
  }

  function canEndDay(){
    if (!GameState.dayOver) return false;
    if (groupsWaiting.length>0 || groupsMoving.length>0) return false;
    if (GameState.rooms.some(r=>r.occupied)) return false;
    return true;
  }

  // === Employees update ===
  function updateEmployees(dt){
    Emps.updateEmployees(dt, WAIT, GameState.rooms, WALLS, groupsWaiting);
  }

  // === Day / Mgmt flow ===
  let shopRooms=[], empCands=[], upgrades=[];

  function openManagement(){
    // compute recap
    const gross = 0; // already added live to money, but we simulate display diff
    const roomCost = GameState.rooms.length * 2; // daily maintenance
    const empCost = GameState.employees.length * 6; // wages
    const total = - roomCost - empCost;
    // animate “add to cash” counter
    const recap = {
      served: GameState.groupsServed,
      gross: gross,
      roomCost, empCost, total
    };
    // prepare choices
    shopRooms = [Utils.randRoom(), Utils.randRoom(), Utils.randRoom()];
    empCands = Emps.generateEmployeeCandidates();
    upgrades = [
      {stat:'capacity', value: Utils.biasedInt(0,15,2.3)},
      {stat:'speed', value: Utils.biasedInt(0,15,2.3)},
      {stat:'break', value: Utils.biasedInt(0,15,2.3)}
    ];

    GameState.paused = true; GameState.mgmtOpen = true;

    // Fill recap UI
    const elS = document.getElementById('recap-served');
    const elG = document.getElementById('recap-gross');
    const elRC = document.getElementById('recap-roomcost');
    const elEC = document.getElementById('recap-empcost');
    const elT = document.getElementById('recap-total');
    const elCounter = document.getElementById('recap-counter');
    elS.textContent = String(recap.served);
    elG.textContent = `${recap.gross}€`;
    elRC.textContent = `-${recap.roomCost}€`;
    elEC.textContent = `-${recap.empCost}€`;
    elT.textContent = `${recap.total}€`;
    document.getElementById('overlayMgmt').classList.remove('hidden');

    // Animated counter
    let target = recap.total;
    let shown = 0;
    function tickCounter(){
      if (!GameState.mgmtOpen) return;
      if (shown < target){
        const step = Math.max(1, Math.floor((target-shown)*0.15));
        shown += step;
        elCounter.textContent = `${shown>=0?'+':''}${shown}€`;
        requestAnimationFrame(tickCounter);
      } else {
        // apply to money
        GameState.money += target;
        // Show upgrade section
        document.getElementById('upgradeSection').classList.remove('hidden');
        AppUI.renderUpgradesUI(upgrades);
      }
    }
    requestAnimationFrame(tickCounter);

    // render shops
    AppUI.UI.editorRooms = shopRooms.slice();
    AppUI.renderRoomsShopUI();
    AppUI.renderEmpShopUI(empCands, WAIT);
    AppUI.initEditorDraw(MISSION);

    // Bind continue buttons
    document.getElementById('recap-continue').onclick = ()=>{
      // skip to upgrades if not already
      document.getElementById('upgradeSection').classList.remove('hidden');
      AppUI.renderUpgradesUI(upgrades);
    };
    document.getElementById('upgrade-continue').onclick = ()=> {
      // proceed to free browsing of shop; user clicks "Lancer journée suivante" when ready
    };
    document.getElementById('mgmt-finish').onclick = ()=>{
      // Close overlay and prepare next day
      Ach.endOfDayAchievements();
      GameState.day += 1;
      GameState.groupsNeeded = GameState.groupsNeededBase + (GameState.day-1)*2;
      GameState.dayTimeLeft = GameState.dayDurationBase + (GameState.day-1)*5;
      GameState.groupsSpawned = 0; GameState.groupsServed = 0; spawnTimer=0;
      GameState.dayOver = false;
      document.getElementById('overlayMgmt').classList.add('hidden');
      GameState.mgmtOpen=false; GameState.paused=false;
      AppUI.setSignForDay(GameState.day);
      Persistence.saveGame();
    };
  }

  // === Stats panel ===
  const elBrand = document.getElementById('stat-brand');
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

  function updateStats(){
    elBrand.textContent = GameState.brand;
    elDay.textContent = String(GameState.day);
    elMoney.textContent = `${GameState.money.toFixed(2)}€`;
    elRooms.textContent = String(GameState.rooms.length);
    elNeeded.textContent = String(GameState.groupsNeeded);
    elSpawned.textContent = String(GameState.groupsSpawned);
    elServed.textContent = String(GameState.groupsServed);
    elSpeed.textContent = GameState.player.speed.toFixed(1);
    elPos.textContent = `${Math.round(GameState.player.x)}, ${Math.round(GameState.player.y)}`;
    elFollowing.textContent = `${selectedGroups.length}/${GameState.player.carryCapacity}`;
    elDayTime.textContent = Utils.fmtTime(GameState.dayTimeLeft);
  }

  // === Draw ===
  const chairPath = (()=>{ const p=new Path2D(); p.rect(2,10,16,6); p.rect(2,4,16,4); p.rect(3,16,3,4); p.rect(14,16,3,4); return p; })();
  function drawChair(x,y,size,state='empty'){
    const s = size/20; ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
    ctx.fillStyle = state==='occupied'?'#c9c9c9': state==='reserved'?'#e6d07a':'#efefef';
    ctx.strokeStyle='#888'; ctx.lineWidth=1.2/s; ctx.fill(chairPath); ctx.stroke(chairPath); ctx.restore();
  }

  function drawScene(){
    ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
    // zones
    ctx.strokeStyle=COLORS.green; ctx.lineWidth=3; Utils.roundRect(ctx, WAIT.x,WAIT.y,WAIT.w,WAIT.h,6,false);
    ctx.strokeStyle=COLORS.red; Utils.roundRect(ctx, HQ.x,HQ.y,HQ.w,HQ.h,6,false);
    ctx.strokeStyle=COLORS.blue; Utils.roundRect(ctx, MISSION.x, MISSION.y, MISSION.w, MISSION.h, 6, false);
    // walls
    ctx.fillStyle = COLORS.wall; for (const w of WALLS) ctx.fillRect(w.x,w.y,w.w,w.h);
    // door
    ctx.fillStyle = '#5c8cff'; ctx.fillRect(WAIT_DOOR.x, WAIT_DOOR.y, WAIT_DOOR.w, WAIT_DOOR.h);

    // chairs
    for (const s of waitingSlots){
      const state = s.occupiedBy ? 'occupied' : (s.reserved?'reserved':'empty');
      drawChair(s.x+(s.w-20)/2, s.y+(s.h-20)/2, 20, state);
    }

    // rooms
    ctx.font='14px Segoe UI, Arial';
    for (const r of GameState.rooms){
      const base = CLASS_COLOR[r.class];
      const fill = r.occupied ? Utils.darken(base, 0.35) : base;
      ctx.fillStyle = fill; ctx.fillRect(r.x,r.y,r.w,r.h);
      ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.strokeRect(r.x,r.y,r.w,r.h);
      const name = r.name.length>18? r.name.slice(0,18)+'…': r.name;
      ctx.fillStyle='#000'; ctx.fillText(name, r.x+6, r.y+18); ctx.fillText(`(${r.class})`, r.x+6, r.y+36);
      if (r.occupied && r.needHelp){
        ctx.fillStyle = COLORS.orange; ctx.beginPath(); ctx.arc(r.x+r.w-12, r.y+r.h-12, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='#000'; ctx.fillText('!', r.x+r.w-15, r.y+r.h-8);
      }
      // timer bar
      if (r.occupied){
        const total=20, rem=Math.max(0,r.timer), pct=Utils.clamp(rem/total,0,1);
        const barW=r.w, barH=10, x=r.x, y=r.y+r.h+6;
        ctx.fillStyle='#e6e6e6'; Utils.roundRect(ctx,x,y,barW,barH,4,true);
        ctx.fillStyle='#6ac36a'; Utils.roundRect(ctx,x,y,Math.floor(barW*pct),barH,4,true);
        ctx.strokeStyle='#333'; ctx.lineWidth=1; Utils.roundRect(ctx,x,y,barW,barH,4,false);
        ctx.fillStyle='#222'; ctx.fillText(`${Math.ceil(rem)}s`, x+barW/2-10, y+barH+12);
      }
    }

    // particles
    ctx.font='16px Segoe UI, Arial';
    for (const p of GameState.particles){
      ctx.globalAlpha = Math.max(0, p.life/1.2);
      ctx.fillStyle = p.color; ctx.fillText(p.icon, p.x, p.y);
      ctx.globalAlpha = 1;
    }

    // groups
    ctx.font='14px Segoe UI, Arial';
    for (const g of groupsMoving){ ctx.fillStyle=COLORS.red; ctx.fillRect(g.x,g.y,g.w,g.h); ctx.fillStyle='#000'; ctx.fillText(`${g.clients}p`, g.x+4, g.y-4); }
    for (const g of groupsWaiting){ ctx.fillStyle=COLORS.red; ctx.fillRect(g.x,g.y,g.w,g.h); ctx.fillStyle='#000'; ctx.fillText(`${g.clients}p`, g.x+4, g.y-4); }
    for (let i=0;i<selectedGroups.length;i++){
      const g=selectedGroups[i]; ctx.fillStyle='#ff8c8c'; ctx.fillRect(g.x,g.y,g.w,g.h); ctx.fillStyle='#000'; ctx.fillText(`${g.clients}p`, g.x+4, g.y-4);
    }

    // employees
    for (const e of GameState.employees){
      ctx.fillStyle = e.color; ctx.fillRect(e.x, e.y, e.w, e.h);
      // capacity pips
      ctx.fillStyle='#000'; for(let i=0;i<e.capacity;i++){ const filled=i<e.activeTeams; ctx.globalAlpha=filled?1:0.3; ctx.fillRect(e.x+i*4, e.y-6, 3,4); ctx.globalAlpha=1; }
      // name
      ctx.fillStyle='#000'; ctx.font='12px Segoe UI, Arial'; ctx.fillText(e.name, e.x-6, e.y+e.h+12);
    }

    // player
    ctx.fillStyle='#5078ff'; ctx.fillRect(player.x, player.y, player.w, player.h);

    // help button
    ctx.fillStyle = '#f0f0f0'; Utils.roundRect(ctx, BTN_HELP.x, BTN_HELP.y, BTN_HELP.w, BTN_HELP.h, 6, true);
    ctx.strokeStyle = '#000'; Utils.roundRect(ctx, BTN_HELP.x, BTN_HELP.y, BTN_HELP.w, BTN_HELP.h, 6, false);
    ctx.fillStyle='#000'; ctx.font='16px Segoe UI, Arial'; ctx.fillText('Aider (H)', BTN_HELP.x+20, BTN_HELP.y+23);
  }

  // === Movement & collisions ===
  function moveEntityWalls(ent, dx, dy){
    ent.x += dx; for (const w of WALLS){ if (Utils.rectsIntersect(ent, w)){ if (dx>0) ent.x=w.x-ent.w; else if (dx<0) ent.x=w.x+w.w; } }
    ent.y += dy; for (const w of WALLS){ if (Utils.rectsIntersect(ent, w)){ if (dy>0) ent.y=w.y-ent.h; else if (dy<0) ent.y=w.y+w.h; } }
    ent.x = Utils.clamp(ent.x, 20, window.innerWidth-20-ent.w);
    ent.y = Utils.clamp(ent.y, 20, window.innerHeight-20-ent.h);
  }

  // === Loop ===
  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now-last)/1000); last = now;

    if (GameState.runActive && !GameState.paused){
      // Day timer
      if (!GameState.dayOver){ GameState.dayTimeLeft -= dt; if (GameState.dayTimeLeft<=0){ GameState.dayTimeLeft=0; GameState.dayOver=true; } }

      // Input
      let dx=0, dy=0;
      if (keys['q']||keys['arrowleft']) dx -= player.speed;
      if (keys['d']||keys['arrowright']) dx += player.speed;
      if (keys['z']||keys['arrowup']) dy -= player.speed;
      if (keys['s']||keys['arrowdown']) dy += player.speed;

      if (keys['e']){ tryPickOrAssign(); keys['e']=false; }
      if (keys['h']){ helpIfInHQ(); keys['h']=false; }

      moveEntityWalls(player, dx, dy);

      // Spawns
      if (!GameState.dayOver){
        spawnTimer += dt; if (spawnTimer>=GROUP_SPAWN_DELAY && GameState.groupsSpawned<GameState.groupsNeeded){ spawnTimer=0; spawnGroup(); }
      }

      // Groups moving
      const arrived=[];
      for (const g of groupsMoving){
        if (g.state!=='moving') continue;
        const vx=g.targetX-g.x, vy=g.targetY-g.y; const d=Math.hypot(vx,vy), step=g.speed*dt;
        if (d<=step){ g.x=g.targetX; g.y=g.targetY; g.state='waiting'; arrived.push(g); }
        else { g.x += (vx/d)*step; g.y += (vy/d)*step; }
      }
      for (const g of arrived){ const s=waitingSlots[g.slotIndex]; if (s){ s.occupiedBy=g; s.reserved=false; } groupsMoving.splice(groupsMoving.indexOf(g),1); groupsWaiting.push(g); }

      // Carry groups follow player
      for (let i=0;i<selectedGroups.length;i++){
        const g=selectedGroups[i];
        g.x = player.x - g.w - 6 - i*(g.w+4);
        g.y = player.y + (player.h - g.h)/2;
      }

      // Rooms & Employees & Particles
      Rooms.updateParticles(dt);
      updateRooms(dt);
      Emps.updateEmployees(dt, WAIT, GameState.rooms, WALLS, groupsWaiting);
    }

    drawScene();
    updateStats();
    requestAnimationFrame(loop);
  }

  // === Init ===
  function firstSetup(){
    Persistence.loadAchievements();
    const loaded = Persistence.loadGame();
    if (loaded){
      GameState.brand = loaded.brand || GameState.brand;
      // Rebuild initial room(s)
      GameState.rooms.length = 0;
      (loaded.rooms||[{name:'Départ - C', class:'C'}]).forEach(r=> Rooms.addRoomAtNextSlot(r));
    } else {
      // default one room
      Rooms.addRoomAtNextSlot({name:'Salle Départ - C', class:'C'});
    }
    document.getElementById('statsPanel').classList.add('hidden');
    AppUI.initMenu();
    AppUI.initMgmtUI();
  }

  function rebuildAll(){
    rebuildLayout(); rebuildWaitingSlots();
  }

  resizeCanvas(); rebuildAll(); firstSetup(); requestAnimationFrame(loop);

  // Expose for UI
  window.__GAME_LAYOUT__ = { getHQ:()=>HQ, getWAIT:()=>WAIT, getMISSION:()=>MISSION };
})();
