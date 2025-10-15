(() => {
  // Canvas
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const FPS = 60;

  // Zones & murs
  const HQ = { x:60, y:40, w:280, h:170 };
  const WAIT = { x: W-340, y:40, w:280, h:170 };
  const MISSION = { x:60, y:270, w: W-120, h: H-330 };
  const WALLS = [
    {x:0,y:0,w:W,h:20},{x:0,y:H-20,w:W,h:20},{x:0,y:0,w:20,h:H},{x:W-20,y:0,w:20,h:H},
    {x:20,y:230,w:W-40,h:10}, {x:20,y:230,w:30,h:10}, {x:W-50,y:230,w:30,h:10}
  ];
  const BTN_HELP = { x: HQ.x + HQ.w/2 - 60, y: HQ.y + HQ.h/2 - 18, w:120, h:36 };

  // Joueur
  const PLAYER = { x: HQ.x + HQ.w/2 - 20, y: HQ.y + HQ.h + 40, w:40, h:40, speed:5 };
  const keys = {};

  // Groupes
  const GROUP_SIZE_PX = 30;
  const groupsMoving = [];   // en approche
  const groupsWaiting = [];  // en salle d'attente
  let selectedGroup = null;
  const GROUP_SPAWN_DELAY = 3; // sec
  let spawnTimer = 0;

  // Tables d'accueil (capacité visuelle / slots de file)
  let tablesCount = 2; // commence avec 2 tables
  const TABLE_PRICE = 40;

  // Salles
  const ROOM_W = 120, ROOM_H = 60;
  const rooms = [];
  const ROOM_BASE_TIME = 20; // sec
  const SAT_LOSS_PER_SEC = 2.0;
  const HELP_WINDOW_SEC = 30;
  const HELP_CHANCE_PER_SEC = 0.06;

  function gridPositions(){
    const cols = Math.max(1, Math.floor((MISSION.w - 20) / (ROOM_W + 20)));
    const rows = Math.max(1, Math.floor((MISSION.h - 20) / (ROOM_H + 20)));
    const pts = [];
    const sx = MISSION.x + 10;
    const sy = MISSION.y + 10;
    for (let r=0;r<rows;r++){
      for (let c=0;c<cols;c++){
        pts.push({ x: sx + c*(ROOM_W+20), y: sy + r*(ROOM_H+20) });
      }
    }
    return pts;
  }
  const GRID = gridPositions();

  function addRoomAtNextSlot(info){
    const idx = rooms.length;
    if (idx >= GRID.length) return false;
    const p = GRID[idx];
    rooms.push({
      x:p.x, y:p.y, w:ROOM_W, h:ROOM_H,
      name:info.name, class:info.class,
      occupied:false, timer:0, group:null,
      needHelp:false, helpTimer:0
    });
    return true;
  }

  // 2 salles initiales
  addRoomAtNextSlot(Utils.randRoom());
  addRoomAtNextSlot(Utils.randRoom());

  // Jours / économie / loyer
  let day = 1;
  let money = 120;
  let groupsNeeded = 6;
  let groupsSpawned = 0;
  let groupsServed = 0;

  let rentEveryNDays = 3;
  let rentBase = 50;
  let rentIncrease = 20; // le loyer augmente à chaque paiement
  let rentsPaid = 0;

  // Overlay boutique
  const overlay = document.getElementById('overlay');
  const shopChoicesBox = document.getElementById('shopChoices');
  const buyTableBtn = document.getElementById('buyTableBtn');
  const skipBtn = document.getElementById('skipBtn');
  const rentInfo = document.getElementById('rentInfo');
  let shopOpen = false;
  let shopChoices = [];

  // Game Over overlay
  const overlayGameOver = document.getElementById('overlayGameOver');
  const reloadBtn = document.getElementById('reloadBtn');

  function openGameOver(){
    overlayGameOver.classList.remove('hidden');
  }
  reloadBtn.addEventListener('click', ()=> location.reload());

  function payRentIfDue(){
    if (day % rentEveryNDays !== 0) return;
    const rent = rentBase + rentIncrease * rentsPaid;
    rentInfo.classList.remove('hidden');
    rentInfo.textContent = `Loyer dû aujourd'hui : -${rent}€`;
    money -= rent;
    rentsPaid += 1;
    if (money < 0){
      // banqueroute
      overlay.classList.add('hidden');
      shopOpen = false;
      openGameOver();
    }
  }

  function renderShop(){
    shopChoicesBox.innerHTML = '';
    shopChoices.forEach((c,i)=>{
      const div = document.createElement('div');
      div.className = 'choice';
      const badgeClass = c.class==='S'?'clsS':c.class==='A'?'clsA':c.class==='B'?'clsB':'clsC';
      const price = PRICE[c.class];
      div.innerHTML = `
        <div class="badge ${badgeClass}">${c.class}</div>
        <div style="flex:1">
          <div><b>${c.name}</b></div>
          <div class="small">Prix : ${price}€</div>
        </div>
        <div class="small">Appuyez <span class="kbd">${i+1}</span></div>
      `;
      shopChoicesBox.appendChild(div);
    });
  }

  function openShop(){
    shopChoices = [Utils.randRoom(), Utils.randRoom(), Utils.randRoom()];
    rentInfo.classList.add('hidden');
    renderShop();
    overlay.classList.remove('hidden');
    shopOpen = true;
    // Payer le loyer si nécessaire
    payRentIfDue();
  }

  function closeShop(advanceDay=true){
    overlay.classList.add('hidden');
    shopOpen = false;
    if (advanceDay){
      day += 1;
      groupsNeeded += 2;
      groupsSpawned = 0;
      groupsServed = 0;
      spawnTimer = 0;
    }
  }

  function buyChoice(i){
    const choice = shopChoices[i];
    const price = PRICE[choice.class];
    if (money >= price){
      if (addRoomAtNextSlot(choice)){
        money -= price;
      }
    }
    closeShop(true);
  }

  buyTableBtn.addEventListener('click', ()=>{
    if (money >= TABLE_PRICE){
      money -= TABLE_PRICE;
      tablesCount += 1;
    }
    closeShop(true);
  });
  skipBtn.addEventListener('click', ()=> closeShop(true));

  // Entrées
  document.addEventListener('keydown', (e)=>{
    keys[e.key.toLowerCase()] = true;
    if (shopOpen){
      if (e.key === 'Escape'){ closeShop(true); }
      if (e.key === '1'){ buyChoice(0); }
      if (e.key === '2'){ buyChoice(1); }
      if (e.key === '3'){ buyChoice(2); }
      if (e.key.toLowerCase() === 't'){ buyTableBtn.click(); }
      return;
    }
    if (e.key.toLowerCase() === 'e') tryPickOrAssign();
    if (e.key.toLowerCase() === 'h') helpIfInHQ();
    if (e.key.toLowerCase() === 'm') openShop(); // forcer fin de journée (tests)
  });
  document.addEventListener('keyup', (e)=>{ keys[e.key.toLowerCase()] = false; });

  // Spawn groupes
  function nextWaitingSlotY(){
    // Slots = tablesCount (capacité "idéale" de file)
    const perSlot = GROUP_SIZE_PX + 10;
    let idx = Math.min(groupsWaiting.length + groupsMoving.filter(g=>g.state==='moving').length, tablesCount-1);
    if (idx < 0) idx = 0;
    let y = WAIT.y + 20 + idx*perSlot;
    y = Math.min(y, WAIT.y + WAIT.h - GROUP_SIZE_PX - 10);
    return y;
  }
  function spawnGroup(){
    if (groupsSpawned >= groupsNeeded) return;
    const gx = WAIT.x + 20, gy = -GROUP_SIZE_PX;
    const targetY = nextWaitingSlotY();
    groupsMoving.push({
      x:gx, y:gy, w:GROUP_SIZE_PX, h:GROUP_SIZE_PX,
      clients: 2 + Math.floor(Math.random()*5), // 2..6
      speed: 120,
      targetY,
      state:'moving',
      satisfaction: 100
    });
    groupsSpawned++;
  }

  // Interactions
  function tryPickOrAssign(){
    if (!selectedGroup){
      // prendre un groupe dans la salle d'attente
      for (let i=0;i<groupsWaiting.length;i++){
        const g = groupsWaiting[i];
        if (Utils.rectsIntersect(PLAYER, Utils.inflateRect(g, 20, 20))){
          selectedGroup = g;
          groupsWaiting.splice(i,1);
          return;
        }
      }
    } else {
      // poser dans une salle libre
      for (const r of rooms){
        if (!r.occupied && Utils.rectsIntersect(PLAYER, Utils.inflateRect(r, 20, 20))){
          r.occupied = true;
          r.group = selectedGroup;
          r.timer = ROOM_BASE_TIME;
          r.needHelp = false;
          r.helpTimer = 0;
          selectedGroup = null;
          return;
        }
      }
    }
  }

  function helpIfInHQ(){
    const inside = Utils.rectsIntersect(PLAYER, HQ);
    if (!inside) return;
    for (const r of rooms){
      if (r.occupied && r.needHelp){
        r.needHelp = false;
      }
    }
  }

  function canEndDay(){
    if (groupsServed < groupsNeeded) return false;
    if (groupsWaiting.length>0 || groupsMoving.length>0) return false;
    if (rooms.some(r=>r.occupied)) return false;
    return true;
  }

  // Mouvements & collisions
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
  }

  // Update salles & économie
  function updateRooms(dt){
    for (const r of rooms){
      if (!r.occupied) continue;
      r.timer -= dt;
      if (r.group){
        r.group.satisfaction = Utils.clamp(r.group.satisfaction - SAT_LOSS_PER_SEC*dt, 0, 100);
      }
      if (!r.needHelp && Math.random() < (HELP_CHANCE_PER_SEC*dt)){
        r.needHelp = true;
        r.helpTimer = HELP_WINDOW_SEC;
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
        groupsServed += 1;
        r.occupied = false;
        r.group = null;
        r.needHelp = false;
        r.helpTimer = 0;
        r.timer = 0;
      }
    }
  }

  // Rendu
  function roundRect(x,y,w,h,r,fill){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    if (fill) ctx.fill(); else ctx.stroke();
  }

  function drawLayout(){
    // zones
    ctx.strokeStyle = COLORS.green; ctx.lineWidth=3; roundRect(WAIT.x,WAIT.y,WAIT.w,WAIT.h,6,false);
    ctx.strokeStyle = COLORS.red;   roundRect(HQ.x,HQ.y,HQ.w,HQ.h,6,false);
    ctx.strokeStyle = COLORS.blue;  roundRect(MISSION.x, MISSION.y, MISSION.w, MISSION.h, 6, false);
    // murs
    ctx.fillStyle = COLORS.wall;
    for (const w of WALLS) ctx.fillRect(w.x,w.y,w.w,w.h);

    // tables en salle d'attente (indication)
    ctx.strokeStyle = '#6ac36a';
    for (let i=0;i<tablesCount;i++){
      const ty = WAIT.y + 20 + i*(GROUP_SIZE_PX+10);
      ctx.strokeRect(WAIT.x+12, ty-2, GROUP_SIZE_PX+6, GROUP_SIZE_PX+6);
    }

    // bouton aider
    ctx.fillStyle = '#f0f0f0'; roundRect(BTN_HELP.x,BTN_HELP.y,BTN_HELP.w,BTN_HELP.h,6,true);
    ctx.strokeStyle = COLORS.black; roundRect(BTN_HELP.x,BTN_HELP.y,BTN_HELP.w,BTN_HELP.h,6,false);
    ctx.fillStyle = COLORS.black; ctx.font='16px Segoe UI, Arial';
    ctx.fillText('Aider (H)', BTN_HELP.x + 20, BTN_HELP.y + 23);
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
    // approche
    for (const g of groupsMoving){
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.fillStyle = COLORS.black;
      ctx.fillText(`${g.clients}p`, g.x+4, g.y-4);
    }
    // attente
    for (const g of groupsWaiting){
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.fillStyle = COLORS.black;
      ctx.fillText(`${g.clients}p`, g.x+4, g.y-4);
    }
    // suivi
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
    ctx.fillRect(PLAYER.x, PLAYER.y, PLAYER.w, PLAYER.h);
  }

  function hudPanel(){
    const ph=92, pw=860, px=50, py=H-ph-20;
    ctx.fillStyle = COLORS.gray; roundRect(px,py,pw,ph,8,true);
    ctx.strokeStyle = COLORS.black; ctx.lineWidth=1; roundRect(px,py,pw,ph,8,false);
    ctx.fillStyle = COLORS.black; ctx.font = '16px Segoe UI, Arial';
    ctx.fillText(`Jour: ${day}   Argent: ${money.toFixed(2)}€   Loyer/j${rentEveryNDays}: ${rentBase + rentIncrease * rentsPaid}€`, px+12, py+24);
    ctx.fillText(`Salles: ${rooms.length}   Tables: ${tablesCount}`, px+12, py+44);
    ctx.fillText(`Groupes attendus: ${groupsNeeded} | Appar.: ${groupsSpawned} | Servis: ${groupsServed}`, px+12, py+64);
    ctx.fillText(`Contrôles: Flèches/WASD · E=prendre/poser · H=aider(QG) · M=boutique`, px+430, py+24);
    ctx.fillText(`1/2/3=Acheter salle · T=Acheter table · Échap=Ignorer`, px+430, py+44);
  }

  // Game Loop
  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now - last)/1000);
    last = now;

    // Mouvements joueur
    let dx=0, dy=0;
    if (keys['arrowleft']||keys['a']) dx -= PLAYER.speed;
    if (keys['arrowright']||keys['d']) dx += PLAYER.speed;
    if (keys['arrowup']||keys['w']) dy -= PLAYER.speed;
    if (keys['arrowdown']||keys['s']) dy += PLAYER.speed;
    if (!shopOpen) moveWithWalls(PLAYER, dx, dy);

    // Spawn groupes
    if (!shopOpen){
      spawnTimer += dt;
      if (spawnTimer >= GROUP_SPAWN_DELAY && groupsSpawned < groupsNeeded){
        spawnTimer = 0; spawnGroup();
      }
    }

    // Approche des groupes
    const arrived = [];
    for (const g of groupsMoving){
      if (g.state!=='moving') continue;
      if (g.y < g.targetY) g.y += g.speed * dt;
      if (g.y >= g.targetY){
        g.y = g.targetY; g.state='waiting'; arrived.push(g);
      }
    }
    for (const g of arrived){
      groupsMoving.splice(groupsMoving.indexOf(g),1);
      groupsWaiting.push(g);
    }

    // Suivi du groupe sélectionné
    if (selectedGroup){
      selectedGroup.x = PLAYER.x - selectedGroup.w - 6;
      selectedGroup.y = PLAYER.y + (PLAYER.h - selectedGroup.h)/2;
    }

    // Update salles
    if (!shopOpen) updateRooms(dt);

    // Fin de journée automatique
    if (!shopOpen && canEndDay()){
      openShop();
    }

    // Dessin
    ctx.clearRect(0,0,W,H);
    drawLayout();
    drawRooms();
    drawGroups();
    drawPlayer();
    hudPanel();

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
  }

  // Inputs continus
  function keyDown(e){ keys[e.key.toLowerCase()] = true; }
  function keyUp(e){ keys[e.key.toLowerCase()] = false; }
  document.addEventListener('keydown', keyDown);
  document.addEventListener('keyup', keyUp);

  // Touches déjà gérées pour boutique dans keydown de index
  document.addEventListener('keydown', (e)=>{
    if (shopOpen){
      if (e.key === 'Escape'){ closeShop(true); }
      if (e.key === '1'){ buyChoice(0); }
      if (e.key === '2'){ buyChoice(1); }
      if (e.key === '3'){ buyChoice(2); }
      if (e.key.toLowerCase() === 't'){ buyTableBtn.click(); }
    }
  });

  // Ouvrir la boutique : prépare choix et loyer
  function openShop(){
    shopChoices = [Utils.randRoom(), Utils.randRoom(), Utils.randRoom()];
    renderShop();
    overlay.classList.remove('hidden');
    shopOpen = true;
    // loyer si dû
    payRentIfDue();
  }

  requestAnimationFrame(loop);
})();
