(function(){
  // helpers
  const $ = id => document.getElementById(id);
  const show = el => el.classList.remove('hidden');
  const hide = el => el.classList.add('hidden');

  // DOM
  const canvas = $('c');
  const menu = $('menu');
  const hud = $('hud');
  const btnNew = $('btnNew');
  const btnContinue = $('btnContinue');
  const btnHow = $('btnHow');
  const btnSettings = $('btnSettings');
  const modalHow = $('how');
  const modalSettings = $('settings');
  const invertY = $('invertY');
  const sensi = $('sensi');
  const btnReset = $('btnReset');
  const invPanel = $('inventory');
  const invList = $('invList');
  const craftingDiv = $('crafting');
  const messagesDiv = $('messages');
  const hint = $('hint');

  // basic modal
  btnHow.onclick = ()=> show(modalHow);
  btnSettings.onclick = ()=> show(modalSettings);
  document.querySelectorAll('[data-close]').forEach(b=> b.addEventListener('click', e=> hide(document.querySelector(b.dataset.close))));

  btnReset.onclick = ()=>{
    localStorage.removeItem('coldhorizon-save');
    pushMsg('Save cleared.');
  };

  // THREE global
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x20242a);
  const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.05, 500);

  const hemi = new THREE.HemisphereLight(0xaaccff, 0x334455, 0.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(10,30,10);
  sun.castShadow = true;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 200;
  scene.add(sun);

  const groundGeo = new THREE.PlaneGeometry(500, 500);
  const groundMat = new THREE.MeshPhongMaterial({color:0x24303f});
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Controls (global version)
  const controls = new THREE.PointerLockControls(camera, renderer.domElement);
  scene.add(controls.getObject());
  camera.position.set(0, 1.7, 0);

  // settings
  const settings = { invertY:false, sensi:1.8 };
  try{ Object.assign(settings, JSON.parse(localStorage.getItem('coldhorizon-settings')||'{}')); }catch{}
  invertY.checked = settings.invertY; sensi.value = settings.sensi;
  invertY.onchange = ()=> saveSettings(invertY.checked, +sensi.value);
  sensi.oninput = ()=> saveSettings(invertY.checked, +sensi.value);
  function saveSettings(inv, s){ localStorage.setItem('coldhorizon-settings', JSON.stringify({invertY:inv, sensi:s})); settings.invertY=inv; settings.sensi=s; }

  // gameplay state
  const key = {};
  let velocity = new THREE.Vector3();
  let speed = 6.0, sprint = 1.7, gravity = 22.0, jumpImpulse = 8.5;
  let inventoryOpen = false, saveTimer = 0;
  const player = { inv: new Map([['berry',2],['water',1]]) };

  // nodes
  const NODE_KIND = {TREE:'Tree', ROCK:'Rock', ORE:'Ore'};
  const nodes = [];
  const nodeGeo = new THREE.CapsuleGeometry(0.4, 0.6, 4, 8);
  const nodeMats = {
    [NODE_KIND.TREE]: new THREE.MeshStandardMaterial({color:0x3a8540}),
    [NODE_KIND.ROCK]: new THREE.MeshStandardMaterial({color:0x71767a}),
    [NODE_KIND.ORE]:  new THREE.MeshStandardMaterial({color:0x8b6f3e})
  };
  function spawnNodes(count=80){
    for (let i=0;i<count;i++){
      const kind = [NODE_KIND.TREE, NODE_KIND.ROCK, NODE_KIND.ORE][(Math.random()*3)|0];
      const mesh = new THREE.Mesh(nodeGeo, nodeMats[kind]);
      mesh.position.set( (Math.random()-0.5)*220, 0.9, (Math.random()-0.5)*220 );
      mesh.castShadow = true;
      mesh.userData.kind = kind;
      mesh.userData.hp = (kind===NODE_KIND.TREE?30:kind===NODE_KIND.ROCK?40:50);
      scene.add(mesh);
      nodes.push(mesh);
    }
  }

  // inv/crafting
  function add(item, qty=1){ player.inv.set(item, (player.inv.get(item)||0)+qty); pushMsg(`+${qty} ${item}`); if (inventoryOpen) renderInventory(); }
  function has(item, qty=1){ return (player.inv.get(item)||0) >= qty; }
  function remove(item, qty=1){ if (!has(item,qty)) return false; player.inv.set(item, player.inv.get(item)-qty); if (player.inv.get(item)<=0) player.inv.delete(item); return true; }
  function giveResource(kind){ if (kind===NODE_KIND.TREE) add('wood',3); else if (kind===NODE_KIND.ROCK) add('stone',3); else add('ore',2); }
  const RECIPES = { hatchet:{cost:{wood:2,stone:1},gives:{hatchet:1}}, pickaxe:{cost:{wood:2,stone:2},gives:{pickaxe:1}}, spear:{cost:{wood:3},gives:{spear:1}}, tea:{cost:{berry:2,water:1},gives:{tea:1}} };
  function craft(name, qty=1){
    const r = RECIPES[name]; if (!r) return false;
    for (const [k,v] of Object.entries(r.cost)){ if (!has(k, v*qty)) { pushMsg('Missing '+k); return false; } }
    for (const [k,v] of Object.entries(r.cost)) remove(k, v*qty);
    for (const [k,v] of Object.entries(r.gives)) add(k, v*qty);
    pushMsg(`Crafted ${name} x${qty}`); renderInventory(); return true;
  }
  function renderInventory(){
    invList.innerHTML='';
    [...player.inv.entries()].sort().forEach(([k,v])=>{ const li=document.createElement('li'); li.textContent=`${k} x${v}`; invList.appendChild(li); });
    craftingDiv.innerHTML='';
    Object.keys(RECIPES).forEach(name=>{ const b=document.createElement('button'); b.textContent=name; b.onclick=()=>craft(name,1); craftingDiv.appendChild(b); });
  }

  // pointer lock
  function requestLock(){ controls.lock(); }
  controls.addEventListener('lock', ()=>{ menu.classList.add('hidden'); hud.classList.remove('hidden'); hint.textContent='Press Esc to unlock'; });
  controls.addEventListener('unlock', ()=>{ hint.textContent='Click to lock mouse'; });
  canvas.addEventListener('click', ()=>{ if (!controls.isLocked) requestLock(); });

  // input
  window.addEventListener('keydown', e=>{ if (e.code==='Tab'){ e.preventDefault(); inventoryOpen=!inventoryOpen; invPanel.classList.toggle('hidden', !inventoryOpen); renderInventory(); return; } key[e.code]=true; });
  window.addEventListener('keyup', e=> key[e.code]=false);
  window.addEventListener('resize', ()=>{ camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  // interact
  const raycaster = new THREE.Raycaster();
  function tryInteract(){
    raycaster.set(camera.getWorldPosition(new THREE.Vector3()), camera.getWorldDirection(new THREE.Vector3()));
    const hits = raycaster.intersectObjects(nodes, false);
    if (hits.length && hits[0].distance < 3){
      const m = hits[0].object; m.userData.hp -= 10; pushMsg('-10');
      if (m.userData.hp <= 0){ giveResource(m.userData.kind); scene.remove(m); const idx=nodes.indexOf(m); if (idx>=0) nodes.splice(idx,1); }
    } else pushMsg('Nothing to harvest.');
  }
  window.addEventListener('keydown', e=>{ if (e.code==='KeyE') tryInteract(); });

  // messages
  function pushMsg(t){ const el=document.createElement('div'); el.className='msg'; el.textContent=t; messagesDiv.appendChild(el); setTimeout(()=>el.remove(),1800); }

  // save/load
  function saveGame(){ const data={ pos: controls.getObject().position.toArray(), inv: Array.from(player.inv.entries()) }; localStorage.setItem('coldhorizon-save', JSON.stringify(data)); }
  function loadGame(){ try{ const d=JSON.parse(localStorage.getItem('coldhorizon-save')||'null'); if(!d) return false; controls.getObject().position.fromArray(d.pos); player.inv=new Map(d.inv); pushMsg('Save loaded.'); return true; }catch{ return false; } }

  // loop
  let last = performance.now();
  function step(now){
    const dt = Math.min(0.05, (now - last)/1000); last = now;
    sun.position.applyAxisAngle(new THREE.Vector3(1,0,0), dt * (Math.PI*2/360));
    const dot = Math.max(0, sun.position.normalize().y); hemi.intensity = 0.15 + 0.35 * dot; sun.intensity = 0.2 + 1.0 * dot;

    const obj = controls.getObject();
    const grounded = obj.position.y <= 1.7;
    if (grounded){ obj.position.y = 1.7; velocity.y = 0; } else { velocity.y -= gravity * dt; }

    const fwd = new THREE.Vector3(); controls.getDirection(fwd); fwd.y=0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), fwd).negate();
    const dx = (Number(key['KeyD'])-Number(key['KeyA']));
    const dz = (Number(key['KeyS'])-Number(key['KeyW']));
    const dlen = Math.hypot(dx, dz) || 1;
    const move = new THREE.Vector3().addScaledVector(fwd, -dz/dlen).addScaledVector(right, dx/dlen);
    const mult = (key['ShiftLeft']||key['ShiftRight']) ? 1.7 : 1.0;

    if (controls.isLocked){
      controls.moveRight(move.x * 6.0 * mult * dt);
      controls.moveForward(move.z * 6.0 * mult * dt);
      if (grounded && key['Space']) velocity.y = jumpImpulse;
      obj.position.y += velocity.y * dt;
    }

    saveTimer += dt; if (saveTimer > 5){ saveGame(); saveTimer = 0; }
    renderer.render(scene, camera);
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // buttons
  btnNew.onclick = ()=>{
    // spawn world
    for (const n of [...nodes]) scene.remove(n); nodes.length = 0; spawnNodes();
    controls.getObject().position.set(0,1.7,0); player.inv = new Map([['berry',2],['water',1]]);
    renderInventory(); controls.lock();
  };
  btnContinue.onclick = ()=>{ if (!loadGame()){ pushMsg('No save found; starting new game.'); btnNew.click(); } else { if (nodes.length===0) spawnNodes(); controls.lock(); } };

  // init
  invPanel.classList.add('hidden');
  // attach close events already set above
})();