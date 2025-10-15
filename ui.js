// UI: Menu, Management overlay (recap, upgrades, shops), Editor canvas

const UI = {
  elements: {},
  menu: {},
  mgmt: {},
  editor: { mode:'place', selectedRoomIndex:-1 }
};

function setSignForDay(day){
  const title = document.getElementById('menuSign');
  const stages = [
    {d:1, txt:'(vieux panneau)'},
    {d:5, txt:'Panneau réparé'},
    {d:10, txt:'Nouveau lettrage'},
    {d:20, txt:'Panneau vernis'},
    {d:35, txt:'Panneau deluxe'},
    {d:50, txt:'Panneau 5 étoiles'},
  ];
  let msg = stages[0].txt;
  for (const s of stages){ if (day>=s.d) msg = s.txt; }
  title.textContent = GameState.brand + ' – ' + msg;
}

function initMenu(){
  UI.menu.overlay = document.getElementById('overlayMenu');
  UI.menu.btnPlay = document.getElementById('btnPlay');
  UI.menu.playFlow = document.getElementById('playFlow');
  UI.menu.brandInput = document.getElementById('inputBrand');
  UI.menu.startRooms = document.getElementById('startRooms');
  UI.menu.btnStartGame = document.getElementById('btnStartGame');
  UI.menu.btnSettings = document.getElementById('btnSettings');
  UI.menu.btnHistory = document.getElementById('btnHistory');
  UI.menu.btnAchievements = document.getElementById('btnAchievements');
  UI.menu.settingsPanel = document.getElementById('settingsPanel');
  UI.menu.historyPanel = document.getElementById('historyPanel');
  UI.menu.achPanel = document.getElementById('achPanel');
  UI.menu.historyList = document.getElementById('historyList');
  UI.menu.achList = document.getElementById('achList');

  UI.menu.btnPlay.onclick = ()=>{
    UI.menu.playFlow.classList.remove('hidden');
    // propose 3 salles C
    const opts = [Utils.randRoom(), Utils.randRoom(), Utils.randRoom()].map(r=>({...r, class:'C'}));
    UI.menu.startRooms.innerHTML = opts.map((c,i)=>`
      <div class="choice"><div class="badge clsC">C</div>
        <div style="flex:1"><b>${c.name}</b></div>
        <label><input type="radio" name="startRoom" value="${i}" ${i===0?'checked':''}/> Choisir</label>
      </div>`).join('');
    UI.menu.opts = opts;
  };
  UI.menu.btnSettings.onclick = ()=>{
    UI.menu.settingsPanel.classList.remove('hidden');
  };
  UI.menu.btnHistory.onclick = ()=>{
    UI.menu.historyPanel.classList.remove('hidden');
    const hist = Persistence.getHistory();
    UI.menu.historyList.innerHTML = hist.length? hist.map(h=>`<div class="choice">
      <div><b>${h.brand}</b> — Jours: ${h.days} — Score: ${h.score} — Tokens: ${h.tokens}</div>
    </div>`).join('') : '<em>Aucune partie enregistrée.</em>';
  };
  UI.menu.btnAchievements.onclick = ()=>{
    UI.menu.achPanel.classList.remove('hidden');
    UI.menu.achList.innerHTML = Ach.ACHIEVEMENTS.map(a=>{
      const ok = GameState.unlocked[a.id];
      return `<div class="choice"><div style="width:10px;height:10px;border-radius:50%;background:${ok?'#78e678':'#ddd'};margin-right:10px;"></div><div><b>${a.name}</b><div class="small">${a.desc}</div></div></div>`;
    }).join('');
  };
  document.getElementById('btnBackSettings').onclick = ()=> UI.menu.settingsPanel.classList.add('hidden');
  document.getElementById('btnBackHistory').onclick = ()=> UI.menu.historyPanel.classList.add('hidden');
  document.getElementById('btnBackAch').onclick = ()=> UI.menu.achPanel.classList.add('hidden');

  UI.menu.btnStartGame.onclick = ()=>{
    const idx = parseInt((document.querySelector('input[name="startRoom"]:checked')||{value:0}).value);
    GameState.brand = UI.menu.brandInput.value.trim() || 'Mon Escape';
    GameState.rooms.length = 0;
    Rooms.addRoomAtNextSlot(UI.menu.opts[idx]);
    startRun();
  };

  setSignForDay(GameState.day);
}

function startRun(){
  UI.menu.overlay.classList.add('hidden');
  document.getElementById('statsPanel').classList.remove('hidden');
  GameState.runActive = true;
  GameState.paused = false;
  // reset day params
  GameState.groupsNeeded = GameState.groupsNeededBase + (GameState.day-1)*2;
  GameState.dayTimeLeft = GameState.dayDurationBase + (GameState.day-1)*5;
  GameState.dayOver = false;
  GameState.groupsSpawned = 0;
  GameState.groupsServed = 0;
  GameState.meta.totalServed = GameState.meta.totalServed||0;
  GameState.meta.totalClients = GameState.meta.totalClients||0;
  GameState.dayNoHelpFailed = false;
  Persistence.saveGame();
}

function openMgmtOverlay(roomsChoicesHtml, empChoicesHtml, upgrades){
  const ov = document.getElementById('overlayMgmt');
  GameState.paused = true; GameState.mgmtOpen = true;
  ov.classList.remove('hidden');

  // recap will be filled by game.js (we expose binders here)
}

function closeMgmtOverlay(){
  const ov = document.getElementById('overlayMgmt');
  ov.classList.add('hidden');
  GameState.mgmtOpen = false; GameState.paused = false;
}

function initMgmtUI(){
  UI.mgmt.overlay = document.getElementById('overlayMgmt');
  UI.mgmt.shopChoices = document.getElementById('shopChoices');
  UI.mgmt.empChoices = document.getElementById('empChoices');
  UI.mgmt.upgradeRow = document.getElementById('upgradeRow');
  UI.mgmt.upgradeSection = document.getElementById('upgradeSection');
  UI.mgmt.editorCanvas = document.getElementById('editorCanvas');
  UI.mgmt.btnPlace = document.getElementById('btnPlaceMode');
  UI.mgmt.btnMove = document.getElementById('btnMoveMode');
  UI.mgmt.btnDelete = document.getElementById('btnDeleteMode');
  UI.mgmt.recapServed = document.getElementById('recap-served');
  UI.mgmt.recapGross = document.getElementById('recap-gross');
  UI.mgmt.recapRoomCost = document.getElementById('recap-roomcost');
  UI.mgmt.recapEmpCost = document.getElementById('recap-empcost');
  UI.mgmt.recapTotal = document.getElementById('recap-total');
  UI.mgmt.recapCounter = document.getElementById('recap-counter');
  UI.mgmt.recapContinue = document.getElementById('recap-continue');
  UI.mgmt.upgradeContinue = document.getElementById('upgrade-continue');
  UI.mgmt.finish = document.getElementById('mgmt-finish');

  // Editor mode buttons
  UI.mgmt.btnPlace.onclick = ()=> UI.editor.mode='place';
  UI.mgmt.btnMove.onclick = ()=> UI.editor.mode='move';
  UI.mgmt.btnDelete.onclick = ()=> UI.editor.mode='delete';

  // Editor interactions
  const cvs = UI.mgmt.editorCanvas;
  cvs.addEventListener('click', (e)=>{
    const rect = cvs.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    // map to grid (editor draws a scaled version 600x300; we store its transform in ui)
    const cell = UI.editorHitTest(x,y);
    if (cell == null) return;
    if (UI.editor.mode==='place'){
      // place the first shop room if exists
      const btn = UI.mgmt.shopChoices.querySelector('button[data-room]');
      if (!btn) return;
      const idx = parseInt(btn.getAttribute('data-room'));
      const room = UI.editorRooms[idx];
      if (Rooms.addRoomAtCell(room, cell)){
        // remove from list & redraw
        UI.editorRooms.splice(idx,1);
        renderRoomsShopUI();
        UI.editorDraw();
      }
    } else if (UI.editor.mode==='move'){
      if (UI.editor.selectedRoomIndex === -1){
        // select a room on that cell if any
        const rIdx = Rooms.roomIndexAt(UI.editorMap[cell].x, UI.editorMap[cell].y);
        if (rIdx>=0){ UI.editor.selectedRoomIndex = rIdx; }
      } else {
        // move selected to this cell
        if (Rooms.moveRoomToCell(UI.editor.selectedRoomIndex, cell)){
          UI.editor.selectedRoomIndex = -1; UI.editorDraw();
        }
      }
    } else if (UI.editor.mode==='delete'){
      const rIdx = Rooms.roomIndexAt(UI.editorMap[cell].x, UI.editorMap[cell].y);
      if (rIdx>=0){ if (Rooms.deleteRoom(rIdx)) UI.editorDraw(); }
    }
  });
}

function renderRoomsShopUI(){
  // list left: remaining room offers (if any)
  const box = UI.mgmt.shopChoices;
  box.innerHTML = '';
  UI.editorRooms.forEach((c,i)=>{
    const price = PRICE[c.class];
    const cls = c.class==='S'?'clsS':c.class==='A'?'clsA':c.class==='B'?'clsB':'clsC';
    const div = document.createElement('div');
    div.className='choice';
    div.innerHTML = `<div class="badge ${cls}">${c.class}</div><div style="flex:1"><b>${c.name}</b><div class="small">Prix : ${price}€</div></div>`;
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Placer'; btn.setAttribute('data-room', String(i));
    btn.onclick = ()=>{
      if (GameState.money >= price){
        // set place mode and wait for canvas click
        UI.editor.mode='place';
        // actually purchase on placement success (in editor click)
      }
    };
    div.appendChild(btn); box.appendChild(div);
  });
}

function renderEmpShopUI(cands, WAIT){
  const box = UI.mgmt.empChoices; box.innerHTML='';
  cands.forEach((c,i)=>{
    const div = document.createElement('div'); div.className='emp-card';
    div.innerHTML = `
      <div class="row"><b>${c.name}</b><span class="emp-tag" style="background:${c.color}">Candidat</span></div>
      <div class="row"><span>Capacité</span><b>${c.capacity}</b></div>
      <div class="row"><span>Vitesse</span><b>${c.speed}px/s</b></div>
      <div class="row"><span>Pause</span><b>${c.breakTime}s</b></div>
      <div class="actions"><button class="btn" data-emp="${i}">Embaucher (${Emps.EMP_COST}€)</button></div>
    `;
    const btn = div.querySelector('button');
    btn.onclick = ()=>{
      if (Emps.hireEmployee(c, WAIT)){
        btn.disabled = true; btn.textContent = 'Embauché';
      }
    };
    box.appendChild(div);
  });
}

function renderUpgradesUI(upgrades){
  const row = UI.mgmt.upgradeRow; row.innerHTML='';
  upgrades.forEach((u,i)=>{
    const label = u.stat==='capacity' ? 'Capacité +'
                 : u.stat==='speed'   ? 'Vitesse +'
                 : u.stat==='break'   ? 'Pause -' : u.stat;
    const vtxt = u.stat==='speed' ? `${u.value*5}px/s` : `${u.value}`;
    const card = document.createElement('div');
    card.className='upg'; card.innerHTML = `<b>${label}</b> <span>(${vtxt})</span>`;
    card.onclick = ()=>{
      // choose player boost or global: for now buff player carry, or store max employees later
      if (u.stat==='capacity') GameState.player.carryCapacity += u.value;
      else if (u.stat==='speed') GameState.player.speed += u.value*0.2;
      else if (u.stat==='break'){ GameState.employees.forEach(e=> e.breakTime = Math.max(0, e.breakTime - Math.floor(u.value/3))); }
      Array.from(row.children).forEach(c=>c.classList.add('disabled'));
    };
    row.appendChild(card);
  });
}

function initEditorDraw(MISSION){
  // map real grid to editor canvas size
  const cvs = UI.mgmt.editorCanvas, ctx = cvs.getContext('2d');
  const w = cvs.width, h = cvs.height;
  const range = GameState.roomGrid;
  UI.editorMap = range.map(p=>({x:p.x, y:p.y})); // store real coords
  // also precompute scaled positions for editor
  const minx = Math.min(...range.map(p=>p.x)), maxx = Math.max(...range.map(p=>p.x));
  const miny = Math.min(...range.map(p=>p.y)), maxy = Math.max(...range.map(p=>p.y));
  const scaleX = (w-40) / (maxx - minx + Rooms.ROOM_W);
  const scaleY = (h-40) / (maxy - miny + Rooms.ROOM_H);
  UI.editorSx = 20 - minx*scaleX; UI.editorSy = 20 - miny*scaleY; UI.editorScaleX=scaleX; UI.editorScaleY=scaleY;

  UI.editorDraw = function(){
    ctx.clearRect(0,0,w,h);
    // draw cells
    ctx.strokeStyle='#bbc'; ctx.fillStyle='#eef';
    GameState.roomGrid.forEach(p=>{
      const rx = p.x*scaleX + UI.editorSx, ry = p.y*scaleY + UI.editorSy;
      ctx.strokeRect(rx, ry, Rooms.ROOM_W*scaleX, Rooms.ROOM_H*scaleY);
    });
    // draw rooms
    GameState.rooms.forEach((r,idx)=>{
      const rx = r.x*scaleX + UI.editorSx, ry = r.y*scaleY + UI.editorSy;
      ctx.fillStyle='#bfe9ff'; ctx.fillRect(rx,ry,Rooms.ROOM_W*scaleX, Rooms.ROOM_H*scaleY);
      ctx.strokeStyle='#333'; ctx.strokeRect(rx,ry,Rooms.ROOM_W*scaleX, Rooms.ROOM_H*scaleY);
      ctx.fillStyle='#000'; ctx.font='12px sans-serif'; ctx.fillText(r.class, rx+4, ry+14);
      if (UI.editor.selectedRoomIndex===idx){
        ctx.strokeStyle='#f66'; ctx.lineWidth=3; ctx.strokeRect(rx-2,ry-2,Rooms.ROOM_W*scaleX+4, Rooms.ROOM_H*scaleY+4); ctx.lineWidth=1;
      }
    });
  };

  UI.editorHitTest = function(x,y){
    // return cell index
    for (let i=0;i<GameState.roomGrid.length;i++){
      const p = GameState.roomGrid[i];
      const rx = p.x*scaleX + UI.editorSx, ry = p.y*scaleY + UI.editorSy;
      if (x>=rx && x<=rx+Rooms.ROOM_W*scaleX && y>=ry && y<=ry+Rooms.ROOM_H*scaleY) return i;
    }
    return null;
  }
  UI.editorDraw();
}

window.AppUI = {
  UI, initMenu, startRun, openMgmtOverlay, closeMgmtOverlay, initMgmtUI, renderRoomsShopUI, renderEmpShopUI, renderUpgradesUI, initEditorDraw, setSignForDay
};
