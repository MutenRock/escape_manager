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
    ctx.setTransform(dpr,0,0,dpr,0,0); // coord en CSS pixels
    rebuildLayout(); // recalc zones & slots selon la taille
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ===== Layout dynamique =====
  let W = () => canvas.clientWidth;
  let H = () => canvas.clientHeight;

  // Zones recalculées (en fonction de l'écran)
  let HQ, WAIT, MISSION, WALLS, BTN_HELP;
  function rebuildLayout(){
    const w = W(), h = H();
    HQ  = { x: Math.round(w*0.06), y: Math.round(h*0.06), w: Math.round(w*0.29), h: Math.round(h*0.22) };
    WAIT= { x: w - Math.round(w*0.35), y: Math.round(h*0.06), w: Math.round(w*0.29), h: Math.round(h*0.22) };
    MISSION = { x: Math.round(w*0.06), y: Math.round(h*0.42), w: w - Math.round(w*0.12), h: h - Math.round(h*0.50) };
    // Mur horizontal séparateur avec OUVERURE CENTRALE
    const wallY = Math.round(h*0.36);
    const gapW = Math.max(140, Math.floor(w*0.12)); // ouverture centrale
    const segW = Math.floor((w - gapW - 40) / 2);
    WALLS = [
      {x:0, y:0, w:w, h:20}, {x:0, y:h-20, w:w, h:20},
      {x:0, y:0, w:20, h:h}, {x:w-20, y:0, w:20, h:h},
      // segments du mur horizontal (gauche et droite), gap au centre
      {x:20, y:wallY, w:segW, h:10},
      {x:20 + segW + gapW, y:wallY, w: segW, h:10},
    ];
    BTN_HELP = { x: HQ.x + Math.floor(HQ.w/2) - 60, y: HQ.y + Math.floor(HQ.h/2) - 18, w:120, h:36 };

    rebuildMissionGrid();
    rebuildWaitingSlots();
    // Clamp player dans les bornes si resize
    player.x = clamp(player.x, 20, w-20-player.w);
    player.y = clamp(player.y, 20, h-20-player.h);
  }

  // ===== Joueur (ZQSD par défaut + flèches) =====
  const player = { x: 200, y: 300, w: 40, h: 40, speed: 5.2 };
  const keys = {};
  document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

  // ===== Données gameplay minimales conservées =====
  const GROUP_SIZE_PX = 30;
  let day=1, money=120, groupsNeeded=8, groupsSpawned=0, groupsServed=0;

  // Groupes
  const groupsMoving = [];   // {x,y,w,h,clients,targetX,targetY,speed,state,satisfaction,slotIndex}
  const groupsWaiting = [];  // idem quand posés

  // ===== Slots de la salle d'attente (grille + chaises) =====
  let waitingSlots = []; // {x,y,w,h, occupiedBy: group|null, reserved:bool}
  function rebuildWaitingSlots(){
    const pad = 16;
    const cell = GROUP_SIZE_PX + 12; // taille de cellule (siège)
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
    // Re-dispatch des groupes si resize : on les recale dans les nouveaux slots
    const allWaiting = [...groupsWaiting, ...groupsMoving.filter(g=>g.state==='waiting'), ...(selectedGroup?[selectedGroup]:[])];
    // reset slots
    waitingSlots.forEach(s=>{ s.occupiedBy=null; s.reserved=false; });
    // ré-assigne en remplissant ligne par ligne
    let i=0;
    for (const g of allWaiting){
      if (i >= waitingSlots.length) break;
      const s = waitingSlots[i++];
      g.x = s.x; g.y = s.y; g.slotIndex = waitingSlots.indexOf(s);
      s.occupiedBy = g;
    }
  }

  // Dessin des chaises (SVG vector Path2D)
  const chairPath = (() => {
    // Petite chaise stylisée (siège + dossier + pieds), taille 20x20, on scale ensuite
    const p = new Path2D();
    // siège
    p.rect(2, 10, 16, 6);
    // dossier
    p.rect(2, 4, 16, 4);
    // pieds
    p.rect(3, 16, 3, 4);
    p.rect(14, 16, 3, 4);
    return p;
  })();
  function drawChair(x, y, size, state="empty"){
    // size ~ GROUP_SIZE_PX; on centre la chaise dans la cellule
    const s = size / 20; // scale 20->size
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = state==="occupied" ? "#c9c9c9" : state==="reserved" ? "#e6d07a" : "#efefef";
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.2 / s;
    ctx.fill(chairPath);
    ctx.stroke(chairPath);
    ctx.restore();
  }

  // ===== Salles (2 initiales + grille de mission) =====
  const ROOM_W = 120, ROOM_H = 60;
  const rooms = []; // {x,y,w,h,name,class,occupied,timer,group,needHelp,helpTimer}
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
  let MISSION_GRID = [];
  function rebuildMissionGrid(){
    MISSION_GRID = missionGridPositions();
    // reclampe salles si resize
    rooms.forEach((r,i) => {
      if (i < MISSION_GRID.length){
        r.x = MISSION_GRID[i].x; r.y = MISSION_GRID[i].y;
      }
    });
  }

  function addRoomAtNext(info){
    const idx = rooms.length;
    if (idx >= MISSION_GRID.length) return false;
    const p = MISSION_GRID[idx];
    rooms.push({
      x:p.x, y:p.y, w:ROOM_W, h:ROOM_H,
      name:info.name, class:info.class,
      occupied:false, timer:0, group:null,
      needHelp:false, helpTimer:0
    });
    return true;
  }

  // 2 salles initiales
  addRoomAtNext(Utils.randRoom());
  addRoomAtNext(Utils.randRoom());

  // ===== Spawning groupes avec slots =====
  const GROUP_SPEED = 140; // px/s
  const GROUP_SPAWN_DELAY = 3; // s
  let spawnTimer = 0;
  function findFreeSlot(){
    return waitingSlots.findIndex(s => !s.occupiedBy && !s.reserved);
  }
  function spawnGroup(){
    if (groupsSpawned >= groupsNeeded) return;
    const slotIdx = findFreeSlot();
    if (slotIdx === -1) return; // pas de place -> on n'ajoute pas pour éviter superposition
    const s = waitingSlots[slotIdx];
    s.reserved = true;
    const gx = WAIT.x + 20, gy = -GROUP_SIZE_PX; // spawn top
    const g = {
      x: gx, y: gy, w: GROUP_SIZE_PX, h: GROUP_SIZE_PX,
      clients: 2 + Math.floor(Math.random()*5), // 2..6
      speed: GROUP_SPEED,
      targetX: s.x, targetY: s.y, state: 'moving',
      satisfaction: 100, slotIndex: slotIdx
    };
    groupsMoving.push(g);
    groupsSpawned++;
  }

  // ===== Interaction E: prendre/poser =====
  let selectedGroup = null;
  function tryPickOrAssign(){
    if (!selectedGroup){
      // prendre un groupe depuis un slot de la salle d'attente
      for (let i=0;i<groupsWaiting.length;i++){
        const g = groupsWaiting[i];
        if (Utils.rectsIntersect(player, Utils.inflateRect(g, 20, 20))){
          // libère slot
          const s = waitingSlots[g.slotIndex];
          if (s) s.occupiedBy = null;
          selectedGroup = g;
          groupsWaiting.splice(i,1);
          return;
        }
      }
    } else {
      // poser dans une salle libre à proximité
      for (const r of rooms){
        if (!r.occupied && Utils.rectsIntersect(player, Utils.inflateRect(r, 20, 20))){
          r.occupied = true;
          r.group = selectedGroup;
          r.timer = 20; // 20s
          r.needHelp = false;
          r.helpTimer = 0;
          selectedGroup = null;
          return;
        }
      }
      // sinon reposer dans la salle d'attente sur un slot libre
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

  // ===== Aide (H) si dans le HQ =====
  function helpIfInHQ(){
    if (!Utils.rectsIntersect(player, HQ)) return;
    for (const r of rooms){
      if (r.occupied && r.needHelp) r.needHelp = false;
    }
  }

  // ===== Update salles =====
  function updateRooms(dt){
    for (const r of rooms){
      if (!r.occupied) continue;
      r.timer -= dt;
      if (r.group) r.group.satisfaction = Utils.clamp(r.group.satisfaction - 2*dt, 0, 100);
      // demande d'aide aléatoire
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
      if (r.timer <= 0){
        const pay = PRICE[r.class] * (r.group.satisfaction/100);
        money += Math.round(pay*100)/100;
        groupsServed++;
        r.occupied=false; r.group=null; r.needHelp=false; r.helpTimer=0; r.timer=0;
      }
    }
  }

  // ===== Boutique minimal (conservée) =====
  const overlay = document.getElementById('overlay');
  const shopChoicesBox = document.getElementById('shopChoices');
  const skipBtn = document.getElementById('skipBtn');
  let shopOpen = false, shopChoices = [];
  function openShop(){
    shopChoices = [Utils.randRoom(), Utils.randRoom(), Utils.randRoom()];
    shopChoicesBox.innerHTML = shopChoices.map((c,i)=>{
      const price = PRICE[c.class];
      const badgeColor = c.class==='S'?'#f8e46b':c.class==='A'?'#ffba73':c.class==='B'?'#7fe0e0':'#ddd';
      return `
        <div class="choice" style="display:flex;align-items:center;gap:12px;background:#f6f6f6;border:1px solid #cfcfcf;border-radius:10px;padding:12px;margin:10px 0;">
          <div class="badge" style="background:${badgeColor};padding:2px 8px;border-radius:6px;font-weight:700;">${c.class}</div>
          <div style="flex:1">
            <div><b>${c.name}</b></div>
            <div class="small">Prix : ${price}€</div>
          </div>
          <div class="small">Appuyez <span class="kbd">${i+1}</span></div>
        </div>
      `;
    }).join('');
    overlay.classList.remove('hidden');
    shopOpen = true;
  }
  function closeShop(){
    overlay.classList.add('hidden');
    shopOpen = false;
    day += 1; groupsNeeded += 2; groupsSpawned=0; groupsServed=0; spawnTimer=0;
  }
  skipBtn.addEventListener('click', closeShop);
  document.addEventListener('keydown', e=>{
    if (!shopOpen) return;
    if (e.key === 'Escape') closeShop();
    if (e.key === '1' || e.key === '2' || e.key === '3'){
      const idx = parseInt(e.key)-1;
      const c = shopChoices[idx];
      if (c && addRoomAtNext(c)){
        money -= PRICE[c.class];
      }
      closeShop();
    }
  });

  // ===== Fin de journée (auto) =====
  function canEndDay(){
    if (groupsServed < groupsNeeded) return false;
    if (groupsWaiting.length>0 || groupsMoving.length>0) return false;
    if (rooms.some(r=>r.occupied)) return false;
    return true;
  }

  // ===== Loop =====
  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now - last)/1000);
    last = now;

    // Input: ZQSD par défaut (+ flèches)
    let dx=0, dy=0;
    if (keys['q'] || keys['arrowleft'])  dx -= player.speed;
    if (keys['d'] || keys['arrowright']) dx += player.speed;
    if (keys['z'] || keys['arrowup'])    dy -= player.speed;
    if (keys['s'] || keys['arrowdown'])  dy += player.speed;

    // Actions
    if (keys['e']) { tryPickOrAssign(); keys['e']=false; } // onshot
    if (keys['h']) { helpIfInHQ(); keys['h']=false; }
    if (keys['m'] && !shopOpen) { openShop(); keys['m']=false; }

    // Mouvements avec collisions
    moveWithWalls(player, dx, dy);

    // Spawning
    if (!shopOpen){
      spawnTimer += dt;
      if (spawnTimer >= GROUP_SPAWN_DELAY && groupsSpawned < groupsNeeded){
        spawnTimer = 0; spawnGroup();
      }
    }

    // Avancée des groupes vers slot réservé
    const arrived = [];
    for (const g of groupsMoving){
      if (g.state!=='moving') continue;
      const vx = g.targetX - g.x;
      const vy = g.targetY - g.y;
      const dist = Math.hypot(vx,vy);
      const step = g.speed * dt;
      if (dist <= step){
        g.x = g.targetX; g.y = g.targetY;
        g.state = 'waiting';
        arrived.push(g);
      } else {
        g.x += (vx/dist)*step;
        g.y += (vy/dist)*step;
      }
    }
    for (const g of arrived){
      // pose dans slot
      const s = waitingSlots[g.slotIndex];
      if (s){ s.occupiedBy = g; s.reserved = false; }
      groupsMoving.splice(groupsMoving.indexOf(g),1);
      groupsWaiting.push(g);
    }

    // Groupe sélectionné suit le joueur
    if (selectedGroup){
      selectedGroup.x = player.x - selectedGroup.w - 6;
      selectedGroup.y = player.y + (player.h - selectedGroup.h)/2;
    }

    // Update salles
    if (!shopOpen) updateRooms(dt);

    // Fin de journée
    if (!shopOpen && canEndDay()) openShop();

    // Rendu
    drawScene();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ===== Collisions joueur avec murs =====
  function moveWithWalls(ent, dx, dy){
    // X
    ent.x += dx;
    for (const w of WALLS){
      if (Utils.rectsIntersect(ent, w)){
        if (dx > 0) ent.x = w.x - ent.w;
        else if (dx < 0) ent.x = w.x + w.w;
      }
    }
    // Y
    ent.y += dy;
    for (const w of WALLS){
      if (Utils.rectsIntersect(ent, w)){
        if (dy > 0) ent.y = w.y - ent.h;
        else if (dy < 0) ent.y = w.y + w.h;
      }
    }
    // Garde dans l'écran
    ent.x = clamp(ent.x, 20, W()-20-ent.w);
    ent.y = clamp(ent.y, 20, H()-20-ent.h);
  }

  // ===== Dessins =====
  function drawScene(){
    ctx.clearRect(0,0,W(),H());
    drawLayout();
    drawWaitingChairs();
    drawRooms();
    drawGroups();
    drawPlayer();
    drawHUD();
  }
  function drawLayout(){
    // Zones
    ctx.strokeStyle = COLORS.green; ctx.lineWidth=3; Utils.roundRect(ctx, WAIT.x, WAIT.y, WAIT.w, WAIT.h, 6, false);
    ctx.strokeStyle = COLORS.red;   Utils.roundRect(ctx, HQ.x, HQ.y, HQ.w, HQ.h, 6, false);
    ctx.strokeStyle = COLORS.blue;  Utils.roundRect(ctx, MISSION.x, MISSION.y, MISSION.w, MISSION.h, 6, false);
    // Murs
    ctx.fillStyle = COLORS.wall;
    for (const w of WALLS) ctx.fillRect(w.x,w.y,w.w,w.h);
    // Bouton aider (visuel)
    ctx.fillStyle = '#f0f0f0'; Utils.roundRect(ctx, BTN_HELP.x, BTN_HELP.y, BTN_HELP.w, BTN_HELP.h, 6, true);
    ctx.strokeStyle = COLORS.black; Utils.roundRect(ctx, BTN_HELP.x, BTN_HELP.y, BTN_HELP.w, BTN_HELP.h, 6, false);
    ctx.fillStyle = COLORS.black; ctx.font='16px Segoe UI, Arial';
    ctx.fillText('Aider (H)', BTN_HELP.x + 20, BTN_HELP.y + 23);
  }
  function drawWaitingChairs(){
    // Dessine chaises pour chaque slot
    for (const s of waitingSlots){
      const state = s.occupiedBy ? 'occupied' : (s.reserved ? 'reserved' : 'empty');
      drawChair(s.x + (s.w-20)/2, s.y + (s.h-20)/2, 20, state);
    }
  }
  function drawRooms(){
    ctx.font = '14px Segoe UI, Arial';
    for (const r of rooms){
      ctx.fillStyle = CLASS_COLOR[r.class]; ctx.fillRect(r.x,r.y,r.w,r.h);
      ctx.strokeStyle = COLORS.black; ctx.lineWidth=2; ctx.strokeRect(r.x,r.y,r.w,r.h);
      const name = r.name.length>18 ? r.name.slice(0,18)+'…' : r.name;
      ctx.fillStyle = COLORS.black;
      ctx.fillText(name, r.x+6, r.y+18);
      ctx.fillText(`(${r.class})`, r.x+6, r.y+36);
      if (r.occupied){
        ctx.fillText(`${Math.max(0, Math.floor(r.timer))}s`, r.x+r.w-32, r.y+18);
        if (r.needHelp){
          ctx.fillStyle = COLORS.orange;
          ctx.beginPath(); ctx.arc(r.x+r.w-12, r.y+r.h-12, 8, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = COLORS.black; ctx.fillText('!', r.x+r.w-15, r.y+r.h-8);
        }
      }
    }
  }
  function drawGroups(){
    ctx.font = '14px Segoe UI, Arial';
    // moving
    for (const g of groupsMoving){
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.fillStyle = COLORS.black;
      ctx.fillText(`${g.clients}p`, g.x+4, g.y-4);
    }
    // waiting
    for (const g of groupsWaiting){
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.fillStyle = COLORS.black;
      ctx.fillText(`${g.clients}p`, g.x+4, g.y-4);
    }
    // selected
    if (selectedGroup){
      const g = selectedGroup;
      ctx.fillStyle = '#ff8c8c';
      ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.fillStyle = COLORS.black;
      ctx.fillText(`${g.clients}p`, g.x+4, g.y-4);
    }
  }
  function drawPlayer(){
    ctx.fillStyle = '#5078ff';
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }
  function drawHUD(){
    const w=W(), h=H();
    const ph=86, pw=Math.min(900, w-40), px=(w-pw)/2, py=h-ph-16;
    ctx.fillStyle = COLORS.gray; Utils.roundRect(ctx, px,py,pw,ph,8, true);
    ctx.strokeStyle = COLORS.black; ctx.lineWidth=1; Utils.roundRect(ctx, px,py,pw,ph,8, false);
    ctx.fillStyle = COLORS.black; ctx.font='16px Segoe UI, Arial';
    ctx.fillText(`Jour: ${day}   Argent: ${money.toFixed(2)}€`, px+12, py+24);
    ctx.fillText(`Salles: ${rooms.length}   Groupes attendus: ${groupsNeeded}`, px+12, py+44);
    ctx.fillText(`Apparus: ${groupsSpawned}   Servis: ${groupsServed}`, px+12, py+64);
    ctx.fillText(`Contrôles: ZQSD / Flèches · E=prendre/poser · H=aider (QG) · M=boutique`, px+380, py+24);
  }

  // ===== Input ponctuel (E/H/M) via press unique (déjà géré dans loop), plus cliquer pour E =====
  document.addEventListener('keydown', e=>{
    if (e.key.toLowerCase()==='e') e.preventDefault();
    if (e.key.toLowerCase()==='h') e.preventDefault();
  });

  // ===== Helper pour chaise (déjà défini plus haut) =====
  function drawChair(x, y, size, state){ /* shadowed par haut mais nécessaire pour scope */ }
})();
