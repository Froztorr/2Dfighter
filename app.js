import { ITEMS, DIR, ATTACKS, blockHit, regenStamina, defend, recognize, newSave, loadSave, stats, buy } from './core.mjs';
const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
canvas.width = 480; canvas.height = 800;
const sprites = Object.fromEntries(['brute','lizard','wraith','knight'].map(name => [name, new Image()]));
let spritesLoaded = 0;
for (const [name, image] of Object.entries(sprites)) {
  image.onload = () => { spritesLoaded++; if (spritesLoaded===4) { $('start').disabled=false; $('assetStatus').textContent=''; } };
  image.onerror = () => { $('assetStatus').textContent='โหลดภาพไม่สำเร็จ กรุณารีเฟรช'; };
  image.src = `./assets/${name}.png`;
}
let save = newSave();
try { const stored = localStorage.getItem('emberblade-v1'); if (stored) save = loadSave(stored); } catch {}
let floor = 1, room = 0, hp = stats(save).maxHp, enemy, phase = 'intro', paused = false, tab = 'gear';
let time = 0, last = performance.now(), attack = null, nextAttack = 1800, stunned = 0, nextSlash = 0, nextDodge = 0;
let trail = [], pointer = null, effects = [], flash = 0, swing = 0, dodge = null, shield = 0, cooldown = {}, transition = 0;
let stamina=100, blocking=false, guardPointer=null, guardKey=false, playerStunned=0, regenAt=0, attackCount=0;
const arrows = { up: '↑', down: '↓', left: '←', right: '→' };
const floors = ['THE ASHEN HALLS', 'MOSSBOUND CRYPT', 'THE EMBER THRONE'];
const enemyTypes = { brute:'Grotto Brute', lizard:'Scale Reaver', wraith:'Cinder Wraith', knight:'Crimson Warden' };
const encounters = [['brute','lizard','knight'],['lizard','wraith','brute'],['wraith','knight','knight']];
// Measured transparent gutters: generated sheets are not perfectly uniform grids.
const atlasCuts = {
  brute:{x:[0,284,561,836,1122],y:[[0,280,555,841,1122,1402],[0,280,561,832,1089,1402],[0,277,561,841,1114,1402],[0,280,561,841,1122,1402]]},
  lizard:{x:[0,280,561,841,1122],y:Array(4).fill([0,280,561,841,1122,1402])},
  wraith:{x:[0,280,554,838,1122],y:[[0,280,561,841,1112,1402],[0,280,556,841,1114,1402],[0,275,561,841,1118,1402],[0,280,561,841,1122,1402]]},
  knight:{x:[0,280,561,841,1122],y:[[0,280,551,841,1122,1402],[0,280,540,841,1113,1402],[0,278,561,841,1122,1402],[0,278,561,841,1122,1402]]}
};
function persist() { try { localStorage.setItem('emberblade-v1', JSON.stringify(save)); } catch { say('Storage unavailable — progress lasts this session'); } }
function say(text) { $('message').textContent = text; }
function spawn() {
  const max = 65 + floor * 15 + room * 12 + (room === 2 ? 65 : 0);
  const type=encounters[floor-1][room];
  enemy = { hp: max, max, type, name: enemyTypes[type]+(room===2?' • BOSS':''), hit: 0, strikeUntil:0, recoverUntil:0, dir:'down' };
  attack = null; stunned = 0; nextAttack = time + 1700; phase = 'combat';
  say(room === 0 ? 'ลากนิ้วฟัน • ปัดสวนลูกศรเพื่อ parry' : 'Room cleared. Moving deeper…'); hud();
}
function hud() {
  const s = stats(save);
  $('playerHp').style.width = `${Math.max(0,hp/s.maxHp*100)}%`;
  $('staminaFill').style.width = `${stamina}%`;
  $('staminaValue').textContent = `${Math.ceil(stamina)} / 100`;
  $('staminaBar').setAttribute('aria-valuenow',String(Math.round(stamina)));
  $('blockBtn').classList.toggle('held',blocking);
  $('blockBtn').classList.toggle('broken',playerStunned>time);
  $('blockBtn').setAttribute('aria-pressed',String(blocking));
  $('blockLabel').textContent=playerStunned>time?'STUNNED':blocking?'GUARDING':'HOLD BLOCK';
  $('enemyHp').style.width = `${Math.max(0,(enemy?.hp || 0)/(enemy?.max || 1)*100)}%`;
  $('enemyName').textContent = enemy?.name || 'THE ASHEN HALLS';
  $('gold').textContent = save.gold; $('floor').textContent = `${floor} / 3 · ROOM ${room+1}`;
  $('spellHint').hidden = !s.magic;
  const cue = $('telegraph'), kind=attack?.kind || 'normal';
  $('attackArrow').textContent=attack ? arrows[attack.dir] : '';
  $('attackRule').textContent=attack ? ATTACKS[kind].label : '';
  cue.style.setProperty('--cue-color',ATTACKS[kind].color);
  cue.dataset.kind=kind;
  cue.style.left='60%'; cue.style.top=`${(enemyPosition().y+(attack?.dir==='up'?16:0))/4}%`;
  cue.classList.toggle('show', !!attack); cue.classList.toggle('danger', !!attack && attack.at-time <= 450);
  if (s.magic) $('spellHint').textContent = ['circle','square','spiral'].map((k,i) => `${['○ FIRE','□ WARD','◎ NOVA'][i]} ${cooldown[k]>time ? ((cooldown[k]-time)/1000).toFixed(1)+'s' : 'READY'}`).join(' · ');
}
function hit(damage, color = '#fff0ae') {
  if (phase !== 'combat') return;
  enemy.hp = Math.max(0,enemy.hp-damage); enemy.hit = time+130;
  effects.push({ x:145, y:190, text:String(damage), color, until:time+700 });
  if (!enemy.hp) {
    attack = null; phase = 'walking'; transition = time+1000; say('ENEMY DEFEATED');
  }
  hud();
}
function finishRoom() {
  if (room < 2) { room++; spawn(); return; }
  const reward = 150 + floor*70;
  save.gold += reward; save.level = Math.min(20,save.level+1); save.unlocked = Math.min(3,Math.max(save.unlocked,floor+1));
  const loot = ['wolf-helm','iron-greaves','moon-ring'][floor-1];
  const duplicate = save.owned.includes(loot); if (!duplicate) save.owned.push(loot); else save.gold += 50;
  phase = 'won'; hp = stats(save).maxHp; persist();
  say(`CLEAR +${reward}${duplicate?' +50':''} GOLD · ${ITEMS[loot].name}`); openPanel();
}
function defensive(dir,type) {
  if (!attack) return false;
  const result = defend(attack.dir,dir,type,attack.at-time,attack.kind);
  if (!result) return false;
  attack = null; stunned = result==='perfect' ? time+2100 : 0; nextAttack = time+(result==='perfect'?2900:1300);
  say(`${result==='perfect'?'PERFECT ':''}${type==='dodge'?'DODGE':'PARRY'}${result==='perfect'?' · STUNNED!':''}`);
  effects.push({x:140,y:175,text:'✦',color:'#c6ffff',until:time+550});
  return true;
}
function slash(dir) {
  if (phase!=='combat' || paused || blocking || time<playerStunned || time<nextSlash) return;
  nextSlash = time+220; swing = time+160;
  if (!defensive(dir,'slash')) hit(stats(save).attack);
}
function evade(dir) {
  if (phase!=='combat' || paused || time<playerStunned || time<nextDodge) return;
  setBlocking(false);
  nextDodge = time+650; dodge = {dir,until:time+260};
  if (!defensive(dir,'dodge')) say(attack?.kind==='sweep'?'ท่ากวาด • กดโล่เพื่อ BLOCK':'Dodge: ตามทิศลูกศร เมื่อใกล้โดน');
}
function cast(points) {
  if (phase!=='combat' || paused || blocking || time<playerStunned) return;
  const spell = recognize(points);
  if (!spell) { say('วาด ○ วงกลม · □ สี่เหลี่ยม · ◎ ก้นหอย'); return; }
  if (cooldown[spell]>time) { say('Spell cooling down'); return; }
  cooldown[spell] = time + ({circle:1800,square:6500,spiral:4500}[spell]);
  if (spell==='square') { shield = 2; say('WARD · blocks the next 2 hits'); }
  else { hit(Math.round(stats(save).attack*(spell==='spiral'?4:2.5)), '#bdabff'); say(spell==='spiral'?'ARCANE NOVA':'EMBER ORB'); }
  effects.push({x:140,y:210,text:spell==='square'?'◇':'✺',color:'#bb9aff',until:time+850});
}
function setBlocking(value) {
  blocking = !!value && phase==='combat' && !paused && time>=playerStunned;
  if (blocking) { pointer=null;trail=[]; }
}
function releaseGuard() { guardPointer=null;guardKey=false;setBlocking(false); }
function openPanel() { paused = true; releaseGuard(); pointer=null; trail=[]; $('panel').hidden=false; renderPanel(); }
function renderPanel() {
  const s=stats(save);
  $('statline').textContent=`LV ${save.level} · ATK ${s.attack} · DEF ${s.armor} · HP ${Math.ceil(hp)}/${s.maxHp} · ◈ ${save.gold}`;
  $('panel').querySelector('h1').textContent = phase==='won'?'FLOOR CLEARED':phase==='dead'?'YOU FELL':'VANGUARD';
  $('nextFloor').hidden = !['won','dead'].includes(phase);
  $('nextFloor').textContent = phase==='dead'?'RETRY FLOOR':floor===3?'RETURN TO FLOOR 1':'ENTER NEXT FLOOR';
  const gear = Object.entries(save.equipment).map(([slot,id])=>`<div class="slot"><b>${slot.toUpperCase()}</b><span>${ITEMS[id]?.name || 'Empty'}</span><button data-equip="${slot}">CHANGE</button></div>`).join('');
  const upgrades = ['vigor','edge'].map(k=>`<div class="upgrade">${k.toUpperCase()} ${save.upgrades[k]}/10<button data-upgrade="${k}" ${save.upgrades[k]>=10?'disabled':''}>◈ ${80+save.upgrades[k]*50}</button></div>`).join('');
  const choices = Array.from({length:save.unlocked},(_,i)=>`<button class="floorChoice" data-floor="${i+1}">${i+1} · ${floors[i]}</button>`).join('');
  $('panelBody').innerHTML = tab==='gear' ? gear + '<p>Staff starts unlocked: change WEAPON to try magic.</p><div class="upgrade">Vigor +12 HP / Edge +2 ATK</div>' + upgrades + '<p>Unlocked floors</p>' + choices : Object.entries(ITEMS).map(([id,item])=>`<div class="item"><h3>${item.name}</h3><p>${item.slot} · ${item.attack?'ATK +'+item.attack:'DEF +'+item.armor}</p><button data-buy="${id}" ${save.owned.includes(id)||save.gold<item.cost?'disabled':''}>${save.owned.includes(id)?'OWNED':'◈ '+item.cost}</button></div>`).join('');
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); hud();
}
function enter(n) { floor=n;room=0;hp=stats(save).maxHp;shield=0;cooldown={};nextSlash=nextDodge=0;stamina=100;playerStunned=regenAt=attackCount=0;releaseGuard();paused=false;$('panel').hidden=true;spawn(); }
document.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return;
  if(b.id==='start'){$('intro').hidden=true;enter(1);}
  if(b.id==='heroBtn'||b.id==='menuBtn')openPanel();
  if(b.hasAttribute('data-close')){ $('panel').hidden=true;paused=false; }
  if(b.dataset.tab){tab=b.dataset.tab;renderPanel();}
  if(b.dataset.equip){const slot=b.dataset.equip, owned=save.owned.filter(id=>ITEMS[id]?.slot===slot);if(owned.length){save.equipment[slot]=owned[(owned.indexOf(save.equipment[slot])+1)%owned.length];hp=Math.min(hp,stats(save).maxHp);persist();renderPanel();}}
  if(b.dataset.buy && buy(save,b.dataset.buy)){persist();renderPanel();}
  if(b.dataset.upgrade){const k=b.dataset.upgrade,cost=80+save.upgrades[k]*50;if(save.upgrades[k]<10 && save.gold>=cost){save.gold-=cost;save.upgrades[k]++;if(k==='vigor')hp+=12;persist();renderPanel();}}
  if(b.dataset.floor)enter(Number(b.dataset.floor));
  if(b.id==='nextFloor')enter(phase==='dead'?floor:floor%3+1);
});
document.querySelectorAll('[data-dodge]').forEach(b=>{b.setAttribute('aria-label','Dodge '+b.dataset.dodge);b.addEventListener('pointerdown',e=>{e.preventDefault();evade(b.dataset.dodge);});});
$('blockBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(guardPointer!==null)return;guardPointer=e.pointerId;$('blockBtn').setPointerCapture(e.pointerId);setBlocking(true);});
for(const name of ['pointerup','pointercancel','lostpointercapture']) $('blockBtn').addEventListener(name,e=>{if(e.pointerId===guardPointer){guardPointer=null;setBlocking(guardKey);}});
const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*240/r.width,(e.clientY-r.top)*400/r.height];};
canvas.addEventListener('pointerdown',e=>{if(phase!=='combat'||paused||blocking||time<playerStunned||pointer!==null)return;pointer=e.pointerId;trail=[point(e)];canvas.setPointerCapture(pointer);});
canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer){const p=point(e);if(Math.hypot(p[0]-trail.at(-1)[0],p[1]-trail.at(-1)[1])>2)trail.push(p);}});
canvas.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;trail.push(point(e));const points=trail;pointer=null;
  if(stats(save).magic)cast(points);else{const dx=points.at(-1)[0]-points[0][0],dy=points.at(-1)[1]-points[0][1];if(Math.hypot(dx,dy)>14)slash(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');}
  trail=[];
});
canvas.addEventListener('pointercancel',()=>{pointer=null;trail=[];});
window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();guardKey=true;setBlocking(true);return;}const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];if(d){e.preventDefault();e.shiftKey?evade(d):!stats(save).magic&&slash(d);}});
window.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();guardKey=false;setBlocking(guardPointer!==null);}});
window.addEventListener('blur',releaseGuard);
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden&&phase==='combat')openPanel();});
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function poly(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function character(x,y,scale,back=false,boss=false){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
  const color=back?(save.equipment.armor?'#78919b':'#547581'):room===0?'#7c7972':floor===2?'#5c7961':'#77567d',light=back?'#99b9af':'#be9b9a';
  ctx.fillStyle='#100e1d88';ctx.beginPath();ctx.ellipse(0,38,21,6,0,0,7);ctx.fill();
  rect(-12,21,9,15,'#252836');rect(4,21,9,15,'#252836');rect(-14,34,12,5,'#131a29');rect(3,34,13,5,'#131a29');
  poly([[-17,-2],[14,-2],[18,23],[9,27],[-14,25]],'#242139');
  rect(-13,-4,27,25,color);rect(-13,-4,5,20,light);rect(-8,-4,17,4,'#bdd0b7');rect(8,0,7,19,'#344455');
  rect(-20,-2,10,9,light);rect(12,-2,10,9,color);rect(-20,7,6,15,color);rect(16,7,6,15,'#333346');rect(-19,20,7,6,'#b99a80');rect(16,20,7,6,'#b99a80');
  rect(-10,-22,21,18,'#34384c');rect(-8,-25,16,4,light);rect(-10,-21,6,14,light);rect(-4,-20,13,9,color);rect(9,-20,3,13,'#272335');
  if(back){poly([[-10,-8],[11,-8],[17,27],[0,31],[-15,26]],'#752e48');poly([[-9,-7],[-2,-6],[-3,26],[-14,25]],'#be5361');rect(-4,-17,8,11,'#456575');}
  else{rect(-6,-13,14,6,'#191623');rect(-5,-12,4,2,'#ffbe65');rect(4,-12,4,2,'#ffbe65');rect(-3,-6,8,2,'#dfbd98');}
  rect(-13,20,27,4,'#332237');rect(-2,20,5,4,'#e4b268');
  if(back){
    if(save.equipment.helm){rect(-8,-26,18,3,'#dbc49e');rect(-2,-31,5,7,'#c35765');}
    if(save.equipment.pants){rect(-11,26,7,7,'#83979c');rect(5,26,7,7,'#697c86');}
    if(save.equipment.boots){rect(-13,35,10,2,'#d2ad7c');rect(4,35,10,2,'#d2ad7c');}
    if(save.equipment.ring)rect(20,22,3,3,'#e5d178');
    rect(-9,-2,3,17,'#d27678');rect(-5,22,9,2,'#8f3a53');
  }else{
    rect(-10,5,18,2,'#4a3d4e');rect(-8,10,16,2,'#4a3d4e');rect(-6,15,12,2,'#4a3d4e');
    rect(-17,0,3,2,'#e1c4a1');rect(16,0,3,2,'#ad8d80');
    if(room===0){rect(-6,-14,14,7,'#b7ae95');rect(-5,-13,4,3,'#252130');rect(4,-13,3,3,'#252130');rect(-2,-7,2,2,'#161526');}
    if(room===1){poly([[-13,-16],[-6,-29],[7,-29],[15,-16],[8,-21],[-6,-21]],'#7a364e');}
  }
  if(boss){poly([[-10,-21],[-20,-31],[-17,-15]],'#dfb57e');poly([[10,-21],[20,-31],[17,-15]],'#9c775e');}
  if(back&&stats(save).magic){rect(24,-22,3,49,'#ac794c');rect(21,-28,9,9,'#aa80ed');rect(23,-26,4,4,'#eff3ff');}
  else{rect(25,-24,4,44,'#b7c9c7');rect(25,-24,2,40,'#edf3d4');poly([[25,-24],[29,-24],[27,-31]],'#eef4d4');rect(20,17,14,3,'#d8b060');rect(26,20,3,9,'#66504b');}
  ctx.restore();
}
function enemyPosition() {
  const impact = enemy?.strikeUntil>time ? Math.sin((enemy.strikeUntil-time)/180*Math.PI)*8 : 0;
  return {x:144,y:212+impact};
}
function drawEnemy() {
  const sheet=sprites[enemy?.type || 'brute'];
  if(!sheet.complete || !sheet.naturalWidth)return;
  let row=0, column=Math.floor(time/360)%2;
  if(phase==='walking')column=3;
  else if(stunned>time)column=2;
  else if(attack){row=['up','down','left','right'].indexOf(attack.dir)+1;column=attack.at-time>400?0:1;}
  else if(enemy?.recoverUntil>time){row=['up','down','left','right'].indexOf(enemy.dir)+1;column=enemy.strikeUntil>time?2:3;}
  else if(enemy?.hit>time)column=2;
  // Match the actual directional poses rather than rotating a generic strike.
  if(row>=3 && enemy.type==='wraith')row=row===3?4:3;
  if(row>=3 && enemy.type==='knight')column=(row===3?[2,2,1,0]:[3,0,1,2])[column];
  const cellW=sheet.naturalWidth/4,cellH=sheet.naturalHeight/5;
  const {x,y}=enemyPosition(), size=room===2?174:156;
  const bounds=canvas.getBoundingClientRect(), aspect=(bounds.width/240)/(bounds.height/400);
  const cuts=atlasCuts[enemy?.type || 'brute'];
  const sx=cuts.x[column],sy=cuts.y[column][row],sw=cuts.x[column+1]-sx,sh=cuts.y[column][row+1]-sy;
  const scale=size/cellW;
  ctx.save();
  if(phase==='walking')ctx.globalAlpha=Math.min(1,(transition-time)/500);
  else if(enemy?.hit>time)ctx.globalAlpha=.78;
  ctx.drawImage(sheet,sx,sy,sw,sh,Math.round(x-size/2+(sx-column*cellW)*scale),Math.round(y-size*aspect/2+(sy-row*cellH)*scale*aspect),sw*scale,sh*scale*aspect);
  ctx.restore();
}
function resolveAttack() {
  const kind=attack.kind || 'normal';
  let damage=Math.max(3,14+floor*3+room*2+(kind==='heavy'?8:0)-stats(save).armor);
  enemy.dir=attack.dir;enemy.strikeUntil=time+180;enemy.recoverUntil=time+480;
  if(blocking){
    const result=blockHit(stamina,kind);stamina=result.stamina;regenAt=time+800;
    if(result.broken){playerStunned=time+1400;releaseGuard();say('GUARD BREAK · สตั้น!');}
    else{damage=0;say(`BLOCK · −${ATTACKS[kind].cost} STAMINA`);effects.push({x:88,y:295,text:'✦',color:'#94e5ff',until:time+400});}
  }else if(shield){shield--;damage=0;say('WARD BLOCK');}
  else say(kind==='sweep'?'ท่ากวาดต้อง BLOCK!':'HIT! ปัดสวน หรือหลบตามลูกศร');
  if(damage){hp=Math.max(0,hp-damage);flash=time+170;}
  attack=null;nextAttack=time+1100;
  if(!hp){phase='dead';openPanel();}
}
function draw(){
  ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=false;
  const palettes=[['#272537','#3c3544','#544453'],['#1c3030','#334340','#50614b'],['#37252e','#503038','#70433e']][floor-1];
  rect(0,0,240,400,'#171522');rect(0,45,240,155,palettes[0]);
  for(let row=0;row<8;row++)for(let col=-1;col<7;col++){const x=col*44+(row%2)*22,y=48+row*20;rect(x+1,y+1,42,18,palettes[1]);rect(x+2,y+2,40,2,palettes[2]);rect(x+4,y+15,36,2,palettes[0]);}
  poly([[92,91],[104,76],[143,76],[158,91],[158,209],[92,209]],'#100f1a');
  for(let i=0;i<5;i++){rect(87,91+i*23,9,21,palettes[2]);rect(155,91+i*23,9,21,palettes[2]);}rect(100,74,48,9,palettes[2]);
  poly([[0,200],[240,200],[240,400],[0,400]],'#302a35');
  for(let i=0;i<9;i++){const y=200+i*i*3;rect(0,y,240,2,'#181825');}
  for(let i=-5;i<7;i++){ctx.strokeStyle='#181825';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(120+i*8,200);ctx.lineTo(120+i*74,400);ctx.stroke();}
  for(const x of [32,204]){rect(x-5,139,11,4,'#171321');rect(x-2,120,5,22,'#8f654c');const flick=Math.floor(Math.sin(time/100+x)*2);rect(x-5,109+flick,11,14,'#a64b42');rect(x-3,104-flick,7,14,'#ed9451');rect(x-1,111,4,8,'#ffe3a0');}
  for(let i=0;i<14;i++){const x=(i*43+time/90)%240,y=90+(i*59+time/150)%230;rect(x,y,1,2,'#bc86645c');}
  drawEnemy();
  let dx=0,dy=0;if(dodge&&dodge.until>time){const v=Math.sin((dodge.until-time)/260*Math.PI)*19;dx=dodge.dir==='left'?-v:dodge.dir==='right'?v:0;dy=dodge.dir==='up'?-v:dodge.dir==='down'?v:0;}
  character(55+dx,316+dy,1.9,true);
  if(blocking){poly([[76,302],[94,296],[113,303],[110,329],[94,342],[79,330]],'#394960');poly([[81,305],[94,301],[108,306],[106,326],[94,336],[83,326]],'#87bac7');rect(92,308,4,20,'#f1e0a9');rect(85,316,18,4,'#f1e0a9');}
  if(playerStunned>time){ctx.fillStyle='#ffd293';ctx.font='bold 10px monospace';ctx.fillText('GUARD BROKEN',12,252);}
  if(swing>time){ctx.strokeStyle='#fff4b1';ctx.lineWidth=4;ctx.beginPath();ctx.arc(140,224,52,-2,.7);ctx.stroke();ctx.strokeStyle='#e7a165';ctx.lineWidth=2;ctx.beginPath();ctx.arc(140,224,58,-2,.4);ctx.stroke();}
  if(shield){ctx.strokeStyle='#ad97ff';ctx.lineWidth=2;ctx.strokeRect(21+dx,257+dy,79,126);}
  if(stunned>time){ctx.fillStyle='#f5e9a4';ctx.font='10px monospace';ctx.fillText('✦  STUN  ✦',115,155);}
  if(trail.length>1){ctx.strokeStyle=stats(save).magic?'#c8a8ff':'#fff1c2';ctx.lineWidth=3;ctx.beginPath();trail.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  effects=effects.filter(e=>e.until>time);for(const e of effects){ctx.fillStyle=e.color;ctx.font='bold 18px monospace';ctx.fillText(e.text,e.x,e.y-(700-(e.until-time))/30);}
  if(flash>time)rect(0,0,240,400,'#e8494933');
  if(phase==='walking')rect(0,0,240,400,`rgba(12,10,20,${Math.sin((transition-time)/1000*Math.PI)*.65})`);
}
function loop(now){const dt=Math.min(50,now-last);last=now;if(!paused && phase!=='intro'&&!document.hidden){time+=dt;
  if(phase==='walking'&&time>=transition)finishRoom();
  if(phase==='combat'){
    if(time>=regenAt)stamina=regenStamina(stamina,dt/1000,blocking);
    if(attack&&time>=attack.at)resolveAttack();
    if(phase==='combat'&&!attack&&time>=nextAttack&&time>=stunned){const kind=['normal','normal','heavy','normal','sweep'][attackCount++%5],duration=kind==='normal'?1050-floor*90:1300;attack={dir:Object.keys(DIR)[Math.floor(Math.random()*4)],kind,started:time,at:time+duration};enemy.dir=attack.dir;}
  }
}hud();draw();requestAnimationFrame(loop);}
hud();requestAnimationFrame(loop);
