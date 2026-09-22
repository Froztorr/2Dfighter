import { ENEMY_VARIANTS, ITEMS, FLOORS, QUESTS, dayKey, daily, progress, grant, claimQuest, forgeScore, finishMini, SLOTS, equip, stars, guardReduction, DIR, ATTACKS, blockHit, regenStamina, defend, recognize, newSave, loadSave, stats, buy } from './core.mjs';
const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
canvas.width = 480; canvas.height = 800;
const sprites = Object.fromEntries(['brute','lizard','wraith','knight','gear','hero','guards','frost','spider','demon','relics'].map(name => [name, new Image()]));
let spritesLoaded = 0;
for (const [name, image] of Object.entries(sprites)) {
  image.onload = () => { spritesLoaded++; if (spritesLoaded===Object.keys(sprites).length) { $('start').disabled=false; $('assetStatus').textContent=''; } };
  image.onerror = () => { $('assetStatus').textContent='โหลดภาพไม่สำเร็จ กรุณารีเฟรช'; };
  image.src = `./assets/${name}.png`;
}
let save = newSave();
try { const stored = localStorage.getItem('emberblade-v1'); if (stored) save = loadSave(stored); } catch {}
let floor = 1, room = 0, hp = stats(save).maxHp, enemy, phase = 'intro', paused = false, tab = 'gear';
let time = 0, last = performance.now(), attack = null, nextAttack = 1800, stunned = 0, nextSlash = 0, nextDodge = 0;
let trail = [], pointer = null, effects = [], flash = 0, swing = 0, dodge = null, shield = 0, cooldown = {}, transition = 0;
let stamina=100, blocking=false, guardPointer=null, guardKey=false, playerStunned=0, regenAt=0, attackCount=0;
let selectedSlot='weapon', rewardUntil=0, run={gold:0,xp:0,items:[],damage:0,potions:0,maxHp:100};
let mini=null, campNotice='', dailyCheck=0;
const runes=['☀','☾','✦','◇'];
const cueIcons={normal:'<path d="M23 3l-3 13-9 9-4-4 9-9Z M5 19l8 8 M8 24l-5 5"/>',heavy:'<path d="M4 5L16 2l12 3v12q0 9-12 14Q4 26 4 17Z M16 8v16M10 15h12"/>',sweep:'<path d="M6 23C-3 7 7 2 16 2s19 5 10 21l-5 1v6H11v-6Z"/><path class="skullEyes" d="M8 12l6 3-6 3ZM24 12l-6 3 6 3ZM16 19l-2 4h4Z"/>'};
const arrows = { up: '↑', down: '↓', left: '←', right: '→' };
const floors = FLOORS.map(f=>f.name);
const enemyTypes = { brute:'Grotto Brute', lizard:'Scale Reaver', wraith:'Cinder Wraith', knight:'Crimson Warden', frost:'Rime Revenant',spider:'Widow Matriarch',demon:'Obsidian Behemoth' };
Object.assign(enemyTypes,Object.fromEntries(Object.entries(ENEMY_VARIANTS).map(([id,v])=>[id,v.name])));
const encounters = FLOORS.map(f=>f.enemies);
// Measured transparent gutters: generated sheets are not perfectly uniform grids.
const atlasCuts = {
  frost:{x:[0,263,521,789,1024],y:[[0,256,493,768,1024,1241,1536],[0,280,512,768,1024,1240,1536],[0,236,512,768,1024,1242,1536],[0,256,512,768,1024,1240,1536]]},
  spider:{x:[0,256,512,768,1024],y:[[0,256,504,768,1024,1261,1536],[0,256,512,768,1024,1260,1536],[0,252,512,768,1024,1262,1536],[0,256,512,768,1024,1263,1536]]},
  demon:{x:[0,252,512,761,1024],y:[[0,256,496,768,1024,1280,1536],[0,256,476,768,1024,1278,1536],[0,233,512,768,1024,1280,1536],[0,256,512,768,1024,1274,1536]]},
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
  enemy = { hp: max, max, type, level:(floor-1)*3+room+1, openUntil:0, guardHit:0, name: enemyTypes[type]+(room===2?' • BOSS':''), hit: 0, strikeUntil:0, recoverUntil:0, dir:'down' };
  attack = null; attackCount = 0; stunned = 0; nextAttack = time + 1700; phase = 'combat';
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
  $('blockBtn').disabled=!s.canBlock;
  $('blockLabel').textContent=!s.canBlock?'NO SHIELD':playerStunned>time?'STUNNED':blocking?'GUARDING':'HOLD BLOCK';
  $('potionBtn').textContent=`✚ ${save.potions}`;
  $('potionBtn').disabled=phase!=='combat'||paused||hp>=s.maxHp||!save.potions||playerStunned>time;
  $('rewardToast').hidden=time>=rewardUntil;
  $('enemyHp').style.width = `${Math.max(0,(enemy?.hp || 0)/(enemy?.max || 1)*100)}%`;
  $('enemyName').textContent = enemy ? `LV ${enemy.level} · ${enemy.name}` : 'THE ASHEN HALLS';
  $('guardState').textContent=phase==='combat'?(enemy.openUntil>time?'OPEN · STRIKE!':`GUARD ${Math.round(guardReduction(enemy.level)*100)}%`):'';
  $('gold').textContent = save.gold; $('floor').textContent = `${floor} / ${floors.length} · ROOM ${room+1}`;
  $('spellHint').hidden = !s.magic;
  const cue = $('telegraph'), kind=attack?.kind || 'normal';
  $('attackArrow').textContent=attack ? arrows[attack.dir] : '';
  $('attackRule').textContent=attack ? ATTACKS[kind].label : '';
  cue.style.setProperty('--cue-color',ATTACKS[kind].color);
  cue.dataset.kind=kind;
  if($('attackIcon').dataset.kind!==kind){$('attackIcon').innerHTML=cueIcons[kind];$('attackIcon').dataset.kind=kind;}
  cue.style.left='60%'; cue.style.top=`${(enemyPosition().y+(attack?.dir==='up'?16:0))/4}%`;
  cue.classList.toggle('show', !!attack); cue.classList.toggle('danger', !!attack && attack.at-time <= 450);
  if (s.magic) $('spellHint').textContent = ['circle','square','spiral'].map((k,i) => `${['○ FIRE','□ WARD','◎ NOVA'][i]} ${cooldown[k]>time ? ((cooldown[k]-time)/1000).toFixed(1)+'s' : 'READY'}`).join(' · ');
}
function hit(damage, color = '#fff0ae') {
  if (phase !== 'combat') return;
  if(time>=enemy.openUntil&&time>=stunned){
    damage=Math.floor(damage*(1-guardReduction(enemy.level)));enemy.guardHit=time+280;
    say('GUARDED · parry / หลบ แล้วสวนตอน OPEN');
  }
  if(!damage){effects.push({x:118,y:190,text:'BLOCK',color:'#91cce1',until:time+450});return;}
  enemy.hp = Math.max(0,enemy.hp-damage); enemy.hit = time+130;
  effects.push({ x:145, y:190, text:String(damage), color, until:time+700 });
  if (!enemy.hp) {
    attack = null; phase = 'walking'; transition = time+1500; say('ENEMY DEFEATED');
    const gold=20+enemy.level*5,xp=25+enemy.level*10;
    const loot=FLOORS[floor-1].drops[room],duplicate=save.owned.includes(loot),total=gold+(duplicate?30:0);
    grant(save,{gold:total,xp});run.gold+=total;run.xp+=xp;progress(save,'kills');
    if(!duplicate){save.owned.push(loot);run.items.push(loot);}
    $('rewardToast').innerHTML=`<b>VICTORY</b><span>+${xp} EXP · +${total} GOLD</span><span>${duplicate?'Duplicate → +30 gold':ITEMS[loot].name}</span>`;
    rewardUntil=time+2800;persist();
  }
  hud();
}
function finishRoom() {
  if(phase!=='walking')return;
  if (room < 2) { room++; spawn(); return; }
  const reward = 150 + floor*70;
  grant(save,{gold:reward});run.gold+=reward;save.unlocked = Math.min(floors.length,Math.max(save.unlocked,floor+1));
  save.bestStars[floor]=Math.max(save.bestStars[floor]||0,stars(run));progress(save,'clears');
  phase = 'won'; hp = stats(save).maxHp; persist();
  say(`CLEAR +${reward} GOLD`); openPanel();
}
function defensive(dir,type) {
  if (!attack) return false;
  const result = defend(attack.dir,dir,type,attack.at-time,attack.kind);
  if (!result) return false;
  attack = null; stunned = result==='perfect' ? time+2100 : 0; nextAttack = time+(result==='perfect'?2900:1300);
  enemy.openUntil=result==='perfect'?stunned:time+Math.max(600,1150-enemy.level*55);
  progress(save,'defenses');persist();
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
  else { say(spell==='spiral'?'ARCANE NOVA':'EMBER ORB');hit(Math.round(stats(save).attack*(spell==='spiral'?4:2.5)), '#bdabff'); }
  effects.push({x:140,y:210,text:spell==='square'?'◇':'✺',color:'#bb9aff',until:time+850});
}
function setBlocking(value) {
  blocking = !!value && stats(save).canBlock && phase==='combat' && !paused && time>=playerStunned;
  if (blocking) { pointer=null;trail=[]; }
}
function releaseGuard() { guardPointer=null;guardKey=false;setBlocking(false); }
function openPanel() { paused = true; releaseGuard(); pointer=null; trail=[]; $('panel').hidden=false; renderPanel(); }
function itemIcon(id){const i=ITEMS[id],cols=i?.atlas?4:6,rows=i?.atlas?3:6;return i?`<span class="gearIcon ${i.atlas?'relicIcon':''}" style="filter:hue-rotate(${i.hue||0}deg);background-position:${i.icon%cols*100/(cols-1)}% ${Math.floor(i.icon/cols)*100/(rows-1)}%"></span>`:'<span class="emptySlot">＋</span>';}
function itemStats(i){return [i.attack?`ATK +${i.attack}`:'',i.armor?`DEF +${i.armor}`:'',i.health?`HP +${i.health}`:'',i.hands===2?'2 HANDS':i.shield?'BLOCK':''].filter(Boolean).join(' · ');}
function rewardText(r){return `+${r.gold} GOLD · +${r.xp||0} EXP${r.potions?' · +'+r.potions+' POTION':''}`;}
function questPanel(){
  const d=daily(save);
  return `<div class="campHeading"><small>THE ADVENTURERS' GUILD</small><h2>DAILY CONTRACTS</h2><p>${d.day} · รีเซ็ตเที่ยงคืนเวลาไทย</p></div><p class="campNotice" role="status">${campNotice}</p>${QUESTS.map(q=>`<article class="questCard"><div><h3>${q.name}</h3><p>${q.description}</p><small>${rewardText(q.reward)}</small></div><progress aria-label="${q.name}" value="${Math.min(q.goal,d.counts[q.event])}" max="${q.goal}"></progress><span>${Math.min(q.goal,d.counts[q.event])} / ${q.goal}</span><button data-quest="${q.id}" ${d.claimed.includes(q.id)||d.counts[q.event]<q.goal?'disabled':''}>${d.claimed.includes(q.id)?'CLAIMED':'รับรางวัล'}</button></article>`).join('')}<p class="gearHelp">นับจากการเล่นทุกด่าน • รับรางวัลได้ครั้งเดียวต่อวัน</p>`;
}
function campPanel(){
  const d=daily(save);
  if(!mini)return `<div class="campHeading"><small>REST BETWEEN EXPEDITIONS</small><h2>THE WAYFARER CAMP</h2><p>พักจากดันเจี้ยน ฝึกฝีมือ เก็บรางวัล</p></div><p class="campNotice" role="status">${campNotice}</p><article class="campGame"><span>⚒</span><h3>EMBER FORGE</h3><p>หยุดเข็มให้ใกล้กึ่งกลางที่สุด 5 ครั้ง<br>เต็ม 15 คะแนน รับยาเพิ่ม 1 ขวด</p><small>รางวัลวันนี้ ${d.plays.forge}/3 รอบ</small><button class="primary" data-mini="forge">${d.plays.forge<3?'ตีเหล็ก':'ฝึกตีเหล็ก · ไม่มีรางวัล'}</button></article><article class="campGame"><span>☾</span><h3>RUNE MEMORY</h3><p>จำรูน 6 ตัว แล้วแตะเรียงตามลำดับ<br>ถูกครบรับยาเพิ่ม 1 ขวด</p><small>รางวัลวันนี้ ${d.plays.runes}/3 รอบ</small><button class="primary" data-mini="runes">${d.plays.runes<3?'จำรูน':'ฝึกจำรูน · ไม่มีรางวัล'}</button></article><p class="gearHelp">เล่นจบนับ daily quest • ออกก่อนจบไม่ได้รางวัล</p>`;
  if(mini.kind==='forge')return `<div class="campHeading"><h2>EMBER FORGE</h2><p>ครั้งที่ ${mini.round+1} / 5 · ${mini.score} คะแนน</p></div><div class="forgeAnvil">⚒</div><div class="forgeTrack"><span class="forgeZone"></span><span class="forgePerfect"></span><i id="forgeNeedle"></i></div><p class="gearHelp">ตรงกลาง = 3 · ใกล้ = 2 · ขอบ = 1 · พลาด = 0</p><button id="forgeStrike" class="primary" disabled>HAMMER · ตี!</button><p class="campNotice">${mini.message||'รอเข็มเข้าแถบสีทอง'}</p>`;
  return `<div class="campHeading"><h2>RUNE MEMORY</h2><p id="runeInstruction">จำลำดับรูน แล้วรอสัญญาณ YOUR TURN</p></div><div id="runeDisplay" class="runeDisplay" aria-live="polite">${runes[mini.sequence[0]]}</div><div class="runeChoices">${runes.map((r,i)=>`<button data-rune="${i}" aria-label="Rune ${i+1}" ${mini.phase==='show'?'disabled':''}>${r}</button>`).join('')}</div><p id="runeProgress" class="gearHelp">${mini.score} / 6</p>`;
}
function startMini(kind){
  if(!['forge','runes'].includes(kind)||!paused)return;
  mini={kind,round:0,score:0,started:performance.now(),offset:Math.random()*Math.PI*2,phase:'show',sequence:Array.from({length:6},()=>Math.floor(Math.random()*4))};campNotice='';renderPanel();
}
function endMini(){
  const reward=finishMini(save,mini.kind,mini.score);campNotice=`${mini.score} / ${mini.kind==='forge'?15:6} · ${reward.gold?rewardText(reward):'PRACTICE COMPLETE · วันนี้รับครบแล้ว'}`;mini=null;persist();renderPanel();
}
function forgePosition(now){return (Math.sin((now-mini.started)/(550-mini.round*45)+mini.offset)+1)/2;}
function strikeForge(){
  if(!mini||mini.kind!=='forge'||performance.now()-mini.started<250)return;
  const score=forgeScore(forgePosition(performance.now()));mini.score+=score;mini.round++;
  if(mini.round===5){endMini();return;}
  mini.message=`${score===3?'PERFECT':score===0?'MISS':'GOOD'} +${score}`;mini.started=performance.now();mini.offset=Math.random()*Math.PI*2;renderPanel();
}
function answerRune(value){
  if(!mini||mini.kind!=='runes'||mini.phase!=='input')return;
  if(value!==mini.sequence[mini.score]){endMini();return;}
  mini.score++;if(mini.score===6){endMini();return;}
  $('runeProgress').textContent=`${mini.score} / 6`;
}
function updateMini(now){
  if(!mini||tab!=='camp'||!paused)return;
  if(mini.kind==='forge'){$('forgeStrike').disabled=now-mini.started<250;$('forgeNeedle').style.left=`${forgePosition(now)*100}%`;return;}
  if(mini.phase==='show'){
    const index=Math.floor((now-mini.started)/750);
    if(index<6){$('runeDisplay').textContent=(now-mini.started)%750<570?runes[mini.sequence[index]]:'·';$('runeInstruction').textContent=`จำรูน ${index+1} / 6`;}
    else{mini.phase='input';$('runeDisplay').textContent='?';$('runeInstruction').textContent='YOUR TURN · แตะรูนให้ตรงลำดับ';document.querySelectorAll('[data-rune]').forEach(b=>b.disabled=false);}
  }
}
function renderPanel() {
  const s=stats(save);
  $('statline').textContent=`LV ${save.level} · ATK ${s.attack} · DEF ${s.armor} · HP ${Math.ceil(hp)}/${s.maxHp} · ◈ ${save.gold}`;
  $('panel').querySelector('h1').textContent = phase==='won'?'FLOOR CLEARED':phase==='dead'?'YOU FELL':'VANGUARD';
  $('nextFloor').hidden = !['won','dead'].includes(phase);
  $('nextFloor').textContent = phase==='dead'?'RETRY FLOOR':floor===floors.length?'RETURN TO FLOOR 1':'ENTER NEXT FLOOR';
  const slotButton=slot=>{const id=save.equipment[slot],locked=slot==='offhand'&&ITEMS[save.equipment.weapon]?.hands===2;return `<button class="gearSlot ${selectedSlot===slot?'selected':''}" data-slot="${slot}" aria-label="${SLOTS[slot]}: ${locked?'Locked':ITEMS[id]?.name||'Empty'}" ${locked?'disabled':''}><small>${SLOTS[slot]}</small>${locked?'<span class="emptySlot">🔒</span>':itemIcon(id)}<span>${locked?'TWO HANDED':ITEMS[id]?.name||'Empty'}</span></button>`;};
  const gear=`<div class="paperDoll"><div>${['helm','armor','pants','boots'].map(slotButton).join('')}</div><div class="heroDisplay"><canvas id="heroPreview" width="240" height="400" aria-label="Equipped character preview"></canvas><b>${s.magic?'ARCANIST':s.canBlock?'VANGUARD':'DUELIST'}</b><small>${s.canBlock?'SHIELD READY':'NO SHIELD · DODGE / WARD'}</small></div><div>${['weapon','offhand','neck','cloak'].map(slotButton).join('')}</div></div><div class="ringSlots">${['ring1','ring2'].map(slotButton).join('')}</div><div class="inventoryTitle">${SLOTS[selectedSlot]} <span>เลือกเพื่อสวมใส่</span></div><div class="inventory">${save.owned.filter(id=>ITEMS[id].slot===(selectedSlot.startsWith('ring')?'ring':selectedSlot)).map(id=>`<button class="inventoryItem ${save.equipment[selectedSlot]===id?'selected':''}" data-item="${id}">${itemIcon(id)}<b>${ITEMS[id].name}</b><small>${itemStats(ITEMS[id])}</small></button>`).join('')}<button class="inventoryItem" data-unequip="${selectedSlot}">ถอดอุปกรณ์</button></div><p class="gearHelp">สองมือจะล็อกช่องรอง • ต้องถือโล่จึงบล็อกได้<br>Staff: วาด □ เพื่อสร้าง WARD รับได้ 2 ครั้ง</p>`;
  const upgrades = ['vigor','edge'].map(k=>`<div class="upgrade">${k.toUpperCase()} ${save.upgrades[k]}/10<button data-upgrade="${k}" ${save.upgrades[k]>=10?'disabled':''}>◈ ${80+save.upgrades[k]*50}</button></div>`).join('');
  const choices = floors.map((name,i)=>`<button class="floorChoice" data-floor="${i+1}" ${i>=save.unlocked?'disabled':''}>${i>=save.unlocked?'🔒':i+1} · ${name}<span>${'★'.repeat(save.bestStars[i+1]||0)}</span></button>`).join('');
  const summary=phase==='won'?`<section class="clearSummary"><div class="stars" aria-label="${stars(run)} of 3 stars">${'★'.repeat(stars(run))}<span>${'★'.repeat(3-stars(run))}</span></div><h2>${floors[floor-1]}</h2><b>+${run.xp} EXP · +${run.gold} GOLD</b><p>Damage ${run.damage} · Potions ${run.potions}</p><small>★★★ ไม่เสีย HP / ไม่ใช้ยา<br>★★ เสีย HP ≤ ${Math.round(run.maxHp*.5)} / ใช้ยา ≤ 1</small><div class="lootList">${run.items.map(id=>`<div>${itemIcon(id)}${ITEMS[id].name} ×1</div>`).join('')}</div></section>`:'';
  $('panelBody').innerHTML = summary+(tab==='gear' ? gear + `<p>EXP ${save.xp} / ${save.level*100}</p><div class="upgrade">Vigor +12 HP / Edge +2 ATK</div>` + upgrades + '<p>Unlocked floors</p>' + choices : `<div class="inventory">${Object.entries(ITEMS).map(([id,item])=>`<button class="inventoryItem" data-buy="${id}" ${save.owned.includes(id)||save.gold<item.cost?'disabled':''}>${itemIcon(id)}<b>${item.name}</b><small>${itemStats(item)}</small><span>${save.owned.includes(id)?'OWNED':'◈ '+item.cost}</span></button>`).join('')}</div><button class="primary" data-potion-buy ${save.gold<40||save.potions>=99?'disabled':''}>HEALING POTION · 40 GOLD</button>`);
  if(tab==='quests')$('panelBody').innerHTML=questPanel();
  if(tab==='camp')$('panelBody').innerHTML=campPanel();
  if(tab==='gear'){const preview=$('heroPreview');drawHero(preview.getContext('2d'),120,200,240,false);}
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); hud();
}
function enter(n) { if(!Number.isInteger(n)||n<1||n>floors.length)return;floor=n;room=0;hp=stats(save).maxHp;mini=null;run={gold:0,xp:0,items:[],damage:0,potions:0,maxHp:hp};rewardUntil=0;shield=0;cooldown={};nextSlash=nextDodge=0;stamina=100;playerStunned=regenAt=attackCount=0;releaseGuard();paused=false;$('panel').hidden=true;spawn(); }
function drinkPotion(){if(phase!=='combat'||paused||playerStunned>time||hp>=stats(save).maxHp||!save.potions)return;save.potions--;run.potions++;hp=Math.min(stats(save).maxHp,hp+50);say('+50 HP · HEALING POTION');persist();hud();}
document.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return;
  if(b.id==='start'){$('intro').hidden=true;enter(1);}
  if(b.id==='heroBtn'||b.id==='menuBtn')openPanel();
  if(b.hasAttribute('data-close')){ mini=null;$('panel').hidden=true;paused=false; }
  if(b.dataset.tab){mini=null;tab=b.dataset.tab;renderPanel();}
  if(b.dataset.quest){const reward=claimQuest(save,b.dataset.quest);if(reward){campNotice=rewardText(reward);persist();renderPanel();}}
  if(b.dataset.mini)startMini(b.dataset.mini);
  if(b.id==='forgeStrike')strikeForge();
  if(b.dataset.rune!==undefined)answerRune(Number(b.dataset.rune));
  if(b.dataset.slot){selectedSlot=b.dataset.slot;renderPanel();}
  if(b.dataset.item||b.dataset.unequip){if(equip(save,b.dataset.unequip||selectedSlot,b.dataset.item||null)){hp=Math.min(hp,stats(save).maxHp);persist();renderPanel();$('panel').querySelector('.sheet').scrollTop=0;}}
  if(b.id==='potionBtn')drinkPotion();
  if(b.hasAttribute('data-potion-buy')&&save.gold>=40&&save.potions<99){save.gold-=40;save.potions++;persist();renderPanel();}
  if(b.dataset.buy && buy(save,b.dataset.buy)){persist();renderPanel();}
  if(b.dataset.upgrade){const k=b.dataset.upgrade,cost=80+save.upgrades[k]*50;if(save.upgrades[k]<10 && save.gold>=cost){save.gold-=cost;save.upgrades[k]++;if(k==='vigor')hp+=12;persist();renderPanel();}}
  if(b.dataset.floor&&Number(b.dataset.floor)<=save.unlocked)enter(Number(b.dataset.floor));
  if(b.id==='nextFloor')enter(phase==='dead'?floor:floor%floors.length+1);
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
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){if(mini){mini=null;campNotice='พักเกมแล้ว · รอบที่ยังไม่จบไม่หักสิทธิ์รางวัล';renderPanel();}if(phase==='combat')openPanel();}});
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function poly(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function gearSprite(context,id,x,y,w,h=w,angle=0){
  const item=ITEMS[id],sheet=sprites[item?.atlas||'gear'];if(!item||!sheet.complete||!sheet.naturalWidth)return;
  const cols=item.atlas?4:6,rows=item.atlas?3:6,cell=sheet.naturalWidth/cols;
  context.save();context.filter=`hue-rotate(${item.hue||0}deg)`;context.translate(x,y);context.rotate(angle);context.drawImage(sheet,item.icon%cols*cell,Math.floor(item.icon/cols)*sheet.naturalHeight/rows,cell,sheet.naturalHeight/rows,-w/2,-h/2,w,h);context.restore();
}
function drawHero(context,x,y,size,back){
  const sheet=sprites.hero;if(!sheet.complete||!sheet.naturalWidth)return;
  const cw=sheet.naturalWidth/4,ch=sheet.naturalHeight/2,height=size*ch/cw;
  context.save();context.imageSmoothingEnabled=false;
  const left=x-size/2,top=y-height/2;
  gearSprite(context,save.equipment.cloak,x,y+height*.07,size*.65,height*.65);
  // Aligned atlas strips allow each armor slot to change independently.
  for(const [slot,a,b] of [['boots',.77,1],['pants',.55,.77],['armor',.28,.55],['helm',0,.28]]){
    const look=ITEMS[save.equipment[slot]]?.look||0;
    context.filter=ITEMS[save.equipment[slot]]?.hue?`hue-rotate(${ITEMS[save.equipment[slot]].hue}deg)`:'none';
    context.drawImage(sheet,look*cw,(back?ch:0)+a*ch,cw,(b-a)*ch,left,top+a*height,size,(b-a)*height);
  }
  context.filter='none';
  // Cloaks are visible over the torso in rear combat view.
  if(back)gearSprite(context,save.equipment.cloak,x,y+height*.03,size*.51,height*.61);
  gearSprite(context,save.equipment.neck,x,y-height*.22,size*.14);
  gearSprite(context,save.equipment.ring1,x-size*.25,y+height*.03,size*.065);
  gearSprite(context,save.equipment.ring2,x+size*.25,y+height*.03,size*.065);
  const main=ITEMS[save.equipment.weapon];
  gearSprite(context,save.equipment.weapon,x+size*.3,y+(back&&swing>time?-height*.08:0),size*(main?.hands===2?.63:.46),height*(main?.hands===2?.7:.48),back&&swing>time?.8:0);
  if(main?.hands!==2)gearSprite(context,save.equipment.offhand,x-size*(back&&blocking?.18:.3),y+height*.05,size*.39,height*.36);
  context.restore();
}
function enemyPosition() {
  const impact = enemy?.strikeUntil>time ? Math.sin((enemy.strikeUntil-time)/180*Math.PI)*8 : 0;
  return {x:144,y:212+impact};
}
function drawEnemy() {
  const variant=ENEMY_VARIANTS[enemy?.type], spriteType=variant?.sprite||enemy?.type||'brute';
  const sheet=sprites[spriteType];
  if(!sheet.complete || !sheet.naturalWidth)return;
  const expanded=['frost','spider','demon'].includes(spriteType);
  const guarding=phase==='combat'&&stunned<=time&&enemy.openUntil<=time&&((!attack&&enemy.recoverUntil<=time)||enemy.guardHit>time);
  if(guarding&&!expanded){
    const guard=sprites.guards,{x,y}=enemyPosition(),column=Object.keys(enemyTypes).indexOf(enemy.type),row=enemy.guardHit>time?1:0;
    const bounds=canvas.getBoundingClientRect(),aspect=(bounds.width/240)/(bounds.height/400),size=room===2?158:143;
    if(guard.complete&&guard.naturalWidth){ctx.drawImage(guard,column*guard.naturalWidth/4,row*guard.naturalHeight/2,guard.naturalWidth/4,guard.naturalHeight/2,x-size/2,y-size*aspect/2,size,size*aspect);return;}
  }
  let row=0, column=Math.floor(time/360)%2;
  if(guarding&&expanded){row=5;column=enemy.guardHit>time?1:0;}
  else if(phase==='walking')column=3;
  else if(stunned>time)column=2;
  else if(attack){row=['up','down','left','right'].indexOf(attack.dir)+1;column=attack.at-time>400?0:1;}
  else if(enemy?.recoverUntil>time){row=['up','down','left','right'].indexOf(enemy.dir)+1;column=enemy.strikeUntil>time?2:3;}
  else if(enemy?.hit>time)column=2;
  // Match the actual directional poses rather than rotating a generic strike.
  if(row>=3 && enemy.type==='wraith')row=row===3?4:3;
  if(row>=3 && enemy.type==='knight')column=(row===3?[2,2,1,0]:[3,0,1,2])[column];
  const cellW=sheet.naturalWidth/4,cellH=sheet.naturalHeight/(expanded?6:5);
  const {x,y}=enemyPosition(), size=room===2?174:156;
  const bounds=canvas.getBoundingClientRect(), aspect=(bounds.width/240)/(bounds.height/400);
  const cuts=atlasCuts[spriteType]||{x:[0,cellW,cellW*2,cellW*3,cellW*4],y:Array(4).fill(Array.from({length:7},(_,i)=>cellH*i))};
  const sx=cuts.x[column],sy=cuts.y[column][row],sw=cuts.x[column+1]-sx,sh=cuts.y[column][row+1]-sy;
  const scale=size/cellW;
  ctx.save();
  if(variant)ctx.filter=`hue-rotate(${variant.hue}deg)`;
  // Both generated demon horizontal strikes face right; mirror the left attack only.
  if(spriteType==='demon'&&row===3){ctx.translate(x*2,0);ctx.scale(-1,1);}
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
    else{damage=0;enemy.openUntil=time+550;progress(save,'defenses');persist();say(`BLOCK · COUNTER! −${ATTACKS[kind].cost} STAMINA`);effects.push({x:88,y:295,text:'✦',color:'#94e5ff',until:time+400});}
  }else if(shield){shield--;damage=0;enemy.openUntil=time+900;progress(save,'defenses');persist();say('WARD BLOCK · COUNTER!');}
  else say(kind==='sweep'?'ท่ากวาดต้อง BLOCK!':'HIT! ปัดสวน หรือหลบตามลูกศร');
  if(damage){run.damage+=Math.min(hp,damage);hp=Math.max(0,hp-damage);flash=time+170;}
  attack=null;nextAttack=time+1100;
  if(!hp){phase='dead';openPanel();}
}
function draw(){
  ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=false;
  const palettes=FLOORS[floor-1].colors;
  rect(0,0,240,400,'#171522');rect(0,45,240,155,palettes[0]);
  for(let row=0;row<8;row++)for(let col=-1;col<7;col++){const x=col*44+(row%2)*22,y=48+row*20;rect(x+1,y+1,42,18,palettes[1]);rect(x+2,y+2,40,2,palettes[2]);rect(x+4,y+15,36,2,palettes[0]);}
  poly([[92,91],[104,76],[143,76],[158,91],[158,209],[92,209]],'#100f1a');
  for(let i=0;i<5;i++){rect(87,91+i*23,9,21,palettes[2]);rect(155,91+i*23,9,21,palettes[2]);}rect(100,74,48,9,palettes[2]);
  poly([[0,200],[240,200],[240,400],[0,400]],'#302a35');
  for(let i=0;i<9;i++){const y=200+i*i*3;rect(0,y,240,2,'#181825');}
  for(let i=-5;i<7;i++){ctx.strokeStyle='#181825';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(120+i*8,200);ctx.lineTo(120+i*74,400);ctx.stroke();}
  for(const x of [32,204]){rect(x-5,139,11,4,'#171321');rect(x-2,120,5,22,'#8f654c');const flick=Math.floor(Math.sin(time/100+x)*2);rect(x-5,109+flick,11,14,'#a64b42');rect(x-3,104-flick,7,14,'#ed9451');rect(x-1,111,4,8,'#ffe3a0');}
  for(let i=0;i<14;i++){const x=(i*43+time/90)%240,y=90+(i*59+time/150)%230;rect(x,y,1,2,'#bc86645c');}
  if(floor===4){for(let i=0;i<23;i++)rect((i*37+Math.sin(time/900+i)*8)%240,60+(i*19+time/65)%320,2,2,'#c9e9f7');for(const x of [0,25,196,222])poly([[x,48],[x+8,95],[x+16,48]],'#98ced0');}
  if(floor===5){ctx.strokeStyle='#adacbf55';ctx.lineWidth=1;for(const anchor of [0,240]){for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(anchor,50);ctx.lineTo(anchor+(anchor?-1:1)*90,60+i*24);ctx.stroke();}for(let i=1;i<4;i++){ctx.beginPath();ctx.arc(anchor,50,i*28,0,Math.PI);ctx.stroke();}}}
  if(floor===6){for(let i=0;i<10;i++){const y=215+i*19;rect((i*67)%210,y,25,2,'#ff7138');rect((i*67)%210+12,y+2,2,10,'#d84127');}}
  if(FLOORS[floor-1].theme==='storm'){
    for(let i=0;i<24;i++){const x=(i*31+time/24)%240,y=55+(i*47+time/9)%330;rect(x,y,1,9,'#9fcbe777');}
    if(Math.floor(time/180)%23===0)poly([[182,52],[170,86],[181,84],[159,127],[166,94],[155,96]],'#d9f5ff');
  }
  if(FLOORS[floor-1].theme==='tide'){
    rect(0,218,240,182,'#258a8e28');
    for(let i=0;i<13;i++)rect((i*41+Math.sin(time/650+i)*12)%240,225+i*13,22,1,'#75dbca66');
    for(const x of [8,220])for(let i=0;i<7;i++)rect(x+Math.sin(time/900+i)*3,187+i*5,3,6,'#497c70');
  }
  if(FLOORS[floor-1].theme==='eclipse'){
    ctx.strokeStyle='#d6a5ec';ctx.lineWidth=2;ctx.beginPath();ctx.arc(124,113,20,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<18;i++)rect((i*43)%240,65+(i*29+time/100)%130,1,2,'#c3a0e1');
  }
  drawEnemy();
  let dx=0,dy=0;if(dodge&&dodge.until>time){const v=Math.sin((dodge.until-time)/260*Math.PI)*19;dx=dodge.dir==='left'?-v:dodge.dir==='right'?v:0;dy=dodge.dir==='up'?-v:dodge.dir==='down'?v:0;}
  const bounds=canvas.getBoundingClientRect(),aspect=(bounds.width/240)/(bounds.height/400);
  ctx.save();ctx.translate(60+dx,308+dy);ctx.scale(1,aspect);drawHero(ctx,0,0,112,true);ctx.restore();
  if(playerStunned>time){ctx.fillStyle='#ffd293';ctx.font='bold 10px monospace';ctx.fillText('GUARD BROKEN',12,252);}
  if(swing>time){ctx.strokeStyle='#fff4b1';ctx.lineWidth=4;ctx.beginPath();ctx.arc(140,224,52,-2,.7);ctx.stroke();ctx.strokeStyle='#e7a165';ctx.lineWidth=2;ctx.beginPath();ctx.arc(140,224,58,-2,.4);ctx.stroke();}
  if(shield){ctx.strokeStyle='#ad97ff';ctx.lineWidth=2;ctx.strokeRect(21+dx,257+dy,79,126);}
  if(stunned>time){ctx.fillStyle='#f5e9a4';ctx.font='10px monospace';ctx.fillText('✦  STUN  ✦',115,155);}
  if(trail.length>1){ctx.strokeStyle=stats(save).magic?'#c8a8ff':'#fff1c2';ctx.lineWidth=3;ctx.beginPath();trail.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  effects=effects.filter(e=>e.until>time);for(const e of effects){ctx.fillStyle=e.color;ctx.font='bold 18px monospace';ctx.fillText(e.text,e.x,e.y-(700-(e.until-time))/30);}
  if(flash>time)rect(0,0,240,400,'#e8494933');
  if(phase==='walking')rect(0,0,240,400,`rgba(12,10,20,${Math.sin((transition-time)/1000*Math.PI)*.65})`);
}
function loop(now){const dt=Math.min(50,now-last);last=now;updateMini(now);if(now>=dailyCheck){dailyCheck=now+1000;if(paused&&['quests','camp'].includes(tab)&&save.daily?.day!==dayKey()){daily(save);persist();if(!mini)renderPanel();}}if(!paused && phase!=='intro'&&!document.hidden){time+=dt;
  if(phase==='walking'&&time>=transition)finishRoom();
  if(phase==='combat'){
    if(time>=regenAt)stamina=regenStamina(stamina,dt/1000,blocking);
    if(attack&&time>=attack.at)resolveAttack();
    if(phase==='combat'&&!attack&&time>=nextAttack&&time>=stunned){const variant=ENEMY_VARIANTS[enemy.type];const pattern=variant?.pattern||(enemy.type==='frost'?['normal','heavy','normal','sweep']:enemy.type==='spider'?['normal','normal','heavy','normal']:enemy.type==='demon'?['heavy','normal','sweep','normal']:['normal','normal','heavy','normal','sweep']);const kind=pattern[attackCount++%pattern.length],duration=kind==='normal'?Math.max(650,1050-floor*70):1300;attack={dir:variant?variant.directions[(attackCount-1)%variant.directions.length]:Object.keys(DIR)[Math.floor(Math.random()*4)],kind,started:time,at:time+duration};enemy.dir=attack.dir;}
  }
}hud();draw();requestAnimationFrame(loop);}
hud();requestAnimationFrame(loop);

