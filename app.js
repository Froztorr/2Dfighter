import { playerAssets } from './fps-player.mjs';
import { createPhaserRenderer } from './phaser-renderer.mjs';
import { HERO_ACTIONS, impactParticles, ITEMS, FLOORS, QUESTS, dayKey, daily, progress, grant, claimQuest, forgeScore, finishMini, SLOTS, equip, stars, guardReduction, DIR, ATTACKS, blockHit, regenStamina, defend, recognize, newSave, loadSave, stats, buy } from './core.mjs';
const $ = id => document.getElementById(id);
const canvas = $('scene'), background=document.createElement('canvas'), ctx = background.getContext('2d');
background.width=480;background.height=800;
canvas.width = 480; canvas.height = 800;
const BASE_SPRITES=['brute','lizard','wraith','knight','gear','guards','frost','spider','demon','relics','portrait'];
const sprites={};let spritesLoaded=0;
function loadSprite(name){
  if(sprites[name])return sprites[name];const image=new Image();sprites[name]=image;
  image.onload=()=>{spritesLoaded++;if(spritesLoaded===Object.keys(sprites).length){$('start').disabled=false;$('assetStatus').textContent='';if(phase==='home')renderHome();}};
  image.onerror=()=>{$('assetStatus').textContent='โหลดภาพไม่สำเร็จ กรุณารีเฟรช';};image.src=`./assets/${name}.png`;return image;
}
function ensurePlayerArt(){for(const name of playerAssets(save))loadSprite(name);}
for(const name of BASE_SPRITES)loadSprite(name);
let save = newSave();
try { const stored = localStorage.getItem('emberblade-v1'); if (stored) save = loadSave(stored); } catch {}
let floor = 1, room = 0, hp = stats(save).maxHp, enemy, phase = 'home', paused = false, tab = 'gear';
let time = 0, last = performance.now(), attack = null, nextAttack = 1800, stunned = 0, nextSlash = 0, nextDodge = 0;
let trail = [], pointer = null, pointerSlashed=false, effects = [], flash = 0, dodge = null, shield = 0, cooldown = {}, transition = 0;
let stamina=100, blocking=false, guardPointer=null, guardKey=false, playerStunned=0, stunStarted=0, deathPanelAt=0, victoryAt=0, regenAt=0, attackCount=0;
let selectedSlot='weapon', rewardUntil=0, run={gold:0,xp:0,items:[],damage:0,potions:0,maxHp:100};
let mini=null, campNotice='', dailyCheck=0;
let heroAction={type:'idle',dir:'right',at:0},pendingSlash=null,particles=[],cuts=[],shakeUntil=0,shakePower=0,hitStop=0,homeView='hall',selectedFloor=1;
const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const runes=['☀','☾','✦','◇'];
const cueIcons={normal:'<path d="M23 3l-3 13-9 9-4-4 9-9Z M5 19l8 8 M8 24l-5 5"/>',heavy:'<path d="M4 5L16 2l12 3v12q0 9-12 14Q4 26 4 17Z M16 8v16M10 15h12"/>',sweep:'<path d="M6 23C-3 7 7 2 16 2s19 5 10 21l-5 1v6H11v-6Z"/><path class="skullEyes" d="M8 12l6 3-6 3ZM24 12l-6 3 6 3ZM16 19l-2 4h4Z"/>'};
const arrows = { up: '↑', down: '↓', left: '←', right: '→' };
const floors = FLOORS.map(f=>f.name);
const enemyTypes = { brute:'Grotto Brute', lizard:'Scale Reaver', wraith:'Cinder Wraith', knight:'Crimson Warden', frost:'Rime Revenant',spider:'Widow Matriarch',demon:'Obsidian Behemoth' };
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
function animateHero(type,dir='right'){heroAction={type,dir,at:time};}
function currentHero(){let type=heroAction.type,at=heroAction.at;if(phase==='dead'){type='death';}else if(time<playerStunned){type='stun';at=stunStarted;}else if(blocking&&!(type==='block'&&time-at<HERO_ACTIONS.block.duration)){type='guard';}else if(time-at>=(HERO_ACTIONS[type]?.duration??0)){type=phase==='walking'?(time<victoryAt?'idle':time-victoryAt<1100?'victory':'walk'):'idle';at=type==='victory'?victoryAt:at;}return {action:type,dir:heroAction.dir,elapsed:time-at};}
function impact(x,y,dir,kind='blood',power=1){
  const colors=kind==='blood'?['#8c1232','#cd2940','#f26760']:kind==='magic'?['#eee5ff','#b89afa','#785dca']:['#fff7c0','#e6b36c','#9ae5ec'];
  for(const p of impactParticles(dir,Math.round(15*power)))particles.push({...p,x,y,at:time,color:colors[Math.floor(Math.random()*colors.length)]});
  shakeUntil=time+180;shakePower=power*(kind==='blood'?2.6:1.5);hitStop=kind==='blood'?45:25;
}
function spawn() {
  const max = 65 + floor * 15 + room * 12 + (room === 2 ? 65 : 0);
  const type=encounters[floor-1][room];
  enemy = { hp: max, max, type, level:(floor-1)*3+room+1, openUntil:0, guardHit:0, name: enemyTypes[type]+(room===2?' • BOSS':''), hit: 0, strikeUntil:0, recoverUntil:0, dir:'down' };
  attack = null; pendingSlash=null; stunned = 0; nextAttack = time + 1700; phase = 'combat';
  say(room === 0 ? 'ลากนิ้วฟัน • ปัดสวนลูกศรเพื่อ parry' : 'Room cleared. Moving deeper…'); hud();
}
function hud() {
  $('game').dataset.mode=phase==='home'?'home':'combat';
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
  const directional=!!attack&&kind==='normal';$('attackArrow').hidden=!directional;$('attackArrow').textContent=directional?arrows[attack.dir]:'';cue.dataset.directional=String(directional);cue.setAttribute('aria-label',attack?`${ATTACKS[kind].label}${directional?' '+attack.dir:''}`:'');
  $('attackRule').textContent=attack ? ATTACKS[kind].label : '';
  cue.style.setProperty('--cue-color',ATTACKS[kind].color);
  cue.dataset.kind=kind;
  if($('attackIcon').dataset.kind!==kind){$('attackIcon').innerHTML=cueIcons[kind];$('attackIcon').dataset.kind=kind;}
  cue.style.left='50%'; cue.style.top=`${(enemyPosition().y+(directional&&attack.dir==='up'?16:0))/4}%`;
  cue.classList.toggle('show', !!attack); cue.classList.toggle('danger', !!attack && attack.at-time <= 450);
  if (s.magic) $('spellHint').textContent = ['circle','square','spiral'].map((k,i) => `${['○ FIRE','□ WARD','◎ NOVA'][i]} ${cooldown[k]>time ? ((cooldown[k]-time)/1000).toFixed(1)+'s' : 'READY'}`).join(' · ');
}
function hit(damage, color = '#fff0ae',dir=heroAction.dir) {
  if (phase !== 'combat') return;
  if(time>=enemy.openUntil&&time>=stunned){
    damage=Math.floor(damage*(1-guardReduction(enemy.level)));enemy.guardHit=time+280;
    say('GUARDED · parry / หลบ แล้วสวนตอน OPEN');
    impact(120,207,dir,'spark',.6);
  }
  if(!damage){effects.push({x:118,y:190,text:'BLOCK',color:'#91cce1',until:time+450});return;}
  enemy.hp = Math.max(0,enemy.hp-damage); enemy.hit = time+260;enemy.hitDir=dir;
  impact(120,212,dir,color==='#bdabff'?'magic':'blood');
  cuts.push({dir,at:time,x:120,y:212});
  effects.push({ x:120, y:190, text:String(damage), color, until:time+700 });
  if (!enemy.hp) {
    attack = null; phase = 'walking'; transition = time+1500;victoryAt=time+200;releaseGuard(); say('ENEMY DEFEATED');
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
  if(type==='slash')animateHero('parry',dir);
  attack = null; stunned = result==='perfect' ? time+2100 : 0; nextAttack = time+(result==='perfect'?2900:1300);
  enemy.openUntil=result==='perfect'?stunned:time+Math.max(600,1150-enemy.level*55);
  progress(save,'defenses');persist();
  impact(125,232,dir,'spark',result==='perfect'?1.5:.8);
  say(`${result==='perfect'?'PERFECT ':''}${type==='dodge'?'DODGE':'PARRY'}${result==='perfect'?' · STUNNED!':''}`);
  effects.push({x:140,y:175,text:'✦',color:'#c6ffff',until:time+550});
  return true;
}
function slash(dir) {
  if (phase!=='combat' || paused || blocking || time<playerStunned || time<nextSlash) return;
  nextSlash = time+300;animateHero('slash',dir);
  if (!defensive(dir,'slash'))pendingSlash={at:time+110,dir,damage:stats(save).attack};
}
function evade(dir) {
  if (phase!=='combat' || paused || time<playerStunned || time<nextDodge) return;
  setBlocking(false);
  nextDodge = time+650; dodge = {dir,until:time+260};
  animateHero('dodge',dir);pendingSlash=null;
  if (!defensive(dir,'dodge')) say(attack&&attack.kind!=='normal'?'ท่านี้ต้อง BLOCK • กดโล่':'Dodge: ตามทิศลูกศร เมื่อใกล้โดน');
}
function cast(points) {
  if (phase!=='combat' || paused || blocking || time<playerStunned) return;
  const spell = recognize(points);
  if (!spell) { say('วาด ○ วงกลม · □ สี่เหลี่ยม · ◎ ก้นหอย'); return; }
  if (cooldown[spell]>time) { say('Spell cooling down'); return; }
  cooldown[spell] = time + ({circle:1800,square:6500,spiral:4500}[spell]);
  animateHero('cast','up');
  if (spell==='square') { shield = 2; say('WARD · blocks the next 2 hits'); }
  else { say(spell==='spiral'?'ARCANE NOVA':'EMBER ORB');hit(Math.round(stats(save).attack*(spell==='spiral'?4:2.5)), '#bdabff'); }
  effects.push({x:140,y:210,text:spell==='square'?'◇':'✺',color:'#bb9aff',until:time+850});
}
function setBlocking(value) {
  const previous=blocking;blocking = !!value && stats(save).canBlock && phase==='combat' && !paused && time>=playerStunned;
  if(blocking&&!previous)animateHero('guard');else if(!blocking&&previous&&['guard','block'].includes(heroAction.type))animateHero('idle');
  if (blocking) { pointer=null;trail=[];pendingSlash=null; }
}
function releaseGuard() { guardPointer=null;guardKey=false;setBlocking(false); }
function openPanel() { if(phase==='dead'&&time<deathPanelAt)return;paused = true; releaseGuard(); pointer=null; trail=[]; $('panel').hidden=false; renderPanel(); }
function itemIcon(id){const i=ITEMS[id],cols=i?.atlas?4:6,rows=i?.atlas?3:6;return i?`<span class="gearIcon ${i.atlas?'relicIcon':''}" style="background-position:${i.icon%cols*100/(cols-1)}% ${Math.floor(i.icon/cols)*100/(rows-1)}%"></span>`:'<span class="emptySlot">＋</span>';}
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
  $('panel').querySelector('h1').textContent = phase==='won'?'FLOOR CLEARED':phase==='dead'?'YOU FELL':({gear:'CHARACTER',shop:'THE ARMORY',quests:'CONTRACTS',camp:'WAYFARER CAMP'}[tab]);
  $('nextFloor').hidden = !['won','dead'].includes(phase);
  $('nextFloor').textContent = phase==='dead'?'RETRY FLOOR':floor===floors.length?'กลับแผนที่':'เลือกด่านถัดไป';
  const slotButton=slot=>{const id=save.equipment[slot],locked=slot==='offhand'&&ITEMS[save.equipment.weapon]?.hands===2;return `<button class="gearSlot ${selectedSlot===slot?'selected':''}" data-slot="${slot}" aria-label="${SLOTS[slot]}: ${locked?'Locked':ITEMS[id]?.name||'Empty'}" ${locked?'disabled':''}><small>${SLOTS[slot]}</small>${locked?'<span class="emptySlot">🔒</span>':itemIcon(id)}<span>${locked?'TWO HANDED':ITEMS[id]?.name||'Empty'}</span></button>`;};
  const gear=`<div class="paperDoll"><div>${['helm','armor','pants','boots'].map(slotButton).join('')}</div><div class="heroDisplay"><canvas id="heroPreview" width="240" height="400" aria-label="Equipped character preview"></canvas><b>${s.magic?'ARCANIST':s.canBlock?'VANGUARD':'DUELIST'}</b><small>${s.canBlock?'SHIELD READY':'NO SHIELD · DODGE / WARD'}</small></div><div>${['weapon','offhand','neck','cloak'].map(slotButton).join('')}</div></div><div class="ringSlots">${['ring1','ring2'].map(slotButton).join('')}</div><div class="inventoryTitle">${SLOTS[selectedSlot]} <span>เลือกเพื่อสวมใส่</span></div><div class="inventory">${save.owned.filter(id=>ITEMS[id].slot===(selectedSlot.startsWith('ring')?'ring':selectedSlot)).map(id=>`<button class="inventoryItem ${save.equipment[selectedSlot]===id?'selected':''}" data-item="${id}">${itemIcon(id)}<b>${ITEMS[id].name}</b><small>${itemStats(ITEMS[id])}</small></button>`).join('')}<button class="inventoryItem" data-unequip="${selectedSlot}">ถอดอุปกรณ์</button></div><p class="gearHelp">สองมือจะล็อกช่องรอง • ต้องถือโล่จึงบล็อกได้<br>Staff: วาด □ เพื่อสร้าง WARD รับได้ 2 ครั้ง</p>`;
  const upgrades = ['vigor','edge'].map(k=>`<div class="upgrade">${k.toUpperCase()} ${save.upgrades[k]}/10<button data-upgrade="${k}" ${save.upgrades[k]>=10?'disabled':''}>◈ ${80+save.upgrades[k]*50}</button></div>`).join('');
  const summary=phase==='won'?`<section class="clearSummary"><div class="stars" aria-label="${stars(run)} of 3 stars">${'★'.repeat(stars(run))}<span>${'★'.repeat(3-stars(run))}</span></div><h2>${floors[floor-1]}</h2><b>+${run.xp} EXP · +${run.gold} GOLD</b><p>Damage ${run.damage} · Potions ${run.potions}</p><small>★★★ ไม่เสีย HP / ไม่ใช้ยา<br>★★ เสีย HP ≤ ${Math.round(run.maxHp*.5)} / ใช้ยา ≤ 1</small><div class="lootList">${run.items.map(id=>`<div>${itemIcon(id)}${ITEMS[id].name} ×1</div>`).join('')}</div></section>`:'';
  $('panelBody').innerHTML = summary+(tab==='gear' ? gear + `<p>EXP ${save.xp} / ${save.level*100}</p><div class="upgrade">Vigor +12 HP / Edge +2 ATK</div>` + upgrades + '<button class="returnHall" data-home="map">แผนที่การเดินทาง →</button>' : `<div class="inventory">${Object.entries(ITEMS).map(([id,item])=>`<button class="inventoryItem" data-buy="${id}" ${save.owned.includes(id)||save.gold<item.cost?'disabled':''}>${itemIcon(id)}<b>${item.name}</b><small>${itemStats(item)}</small><span>${save.owned.includes(id)?'OWNED':'◈ '+item.cost}</span></button>`).join('')}</div><button class="primary" data-potion-buy ${save.gold<40||save.potions>=99?'disabled':''}>HEALING POTION · 40 GOLD</button>`);
  if(tab==='quests')$('panelBody').innerHTML=questPanel();
  if(tab==='camp')$('panelBody').innerHTML=campPanel();
  if(tab==='gear')renderer.preview($('heroPreview'),save);else renderer.closePreview();
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); hud();
}
function renderHome(){
  const cleared=Object.values(save.bestStars).filter(Boolean).length,total=Object.values(save.bestStars).reduce((a,b)=>a+b,0);
  $('homeProgress').innerHTML=`<b>LV ${save.level} · ${save.gold} GOLD</b><span>${cleared} / 6 ด่าน · ★ ${total} / 18</span><progress value="${save.xp}" max="${save.level*100}" aria-label="Experience"></progress>`;
  $('start').hidden=homeView!=='hall';
  $('homeBody').innerHTML=homeView==='hall'?`<div class="hallTitle"><small>A CHRONICLE OF ASH & STEEL</small><h1>EMBER<br>BLADE</h1><p>THE SIX FORSAKEN HALLS</p></div><div class="hallStory"><span>บทที่ ${save.unlocked} / VI</span><h2>${floors[save.unlocked-1]}</h2><p>อ่านท่าศัตรู ตั้งรับ แล้วชิงจังหวะสวนกลับ</p></div>`:
    `<div class="mapHeading"><button data-home="hall">← โถงหลัก</button><h1>THE EXPEDITION</h1><p>เลือกด่าน · ชนะบอสเพื่อเปิดเส้นทางถัดไป</p></div><div class="stageMap">${FLOORS.map((f,i)=>`<button class="stageNode ${selectedFloor===i+1?'selected':''}" data-select-floor="${i+1}" ${i>=save.unlocked?'disabled':''}><span class="stageNumber">${i>=save.unlocked?'◇':String(i+1).padStart(2,'0')}</span><span><b>${f.name}</b><small>${i>=save.unlocked?'LOCKED · ผ่านด่านก่อนหน้า':save.bestStars[i+1]?'CLEARED':'UNEXPLORED'}</small></span><span class="mapStars">${'★'.repeat(save.bestStars[i+1]||0)}${'☆'.repeat(3-(save.bestStars[i+1]||0))}</span></button>`).join('')}</div><div class="expeditionDetail"><small>THREE ENCOUNTERS · ONE BOSS</small><h2>${floors[selectedFloor-1]}</h2><p>${FLOORS[selectedFloor-1].enemies.map(t=>enemyTypes[t]).join(' → ')}</p><div class="mapLoot">${FLOORS[selectedFloor-1].drops.map(id=>`<span>${itemIcon(id)}<small>${ITEMS[id].name}</small></span>`).join('')}</div><button class="primary" data-embark="${selectedFloor}" ${spritesLoaded<Object.keys(sprites).length?'disabled':''}>ออกเดินทาง · FLOOR ${selectedFloor}</button></div>`;
}
function goHome(view='hall'){
  phase='home';homeView=view;selectedFloor=Math.min(save.unlocked,Math.max(1,selectedFloor));paused=false;attack=null;pendingSlash=null;enemy=null;mini=null;releaseGuard();pointer=null;trail=[];particles=[];cuts=[];hitStop=0;heroAction={type:'idle',dir:'right',at:time};$('panel').hidden=true;$('intro').hidden=false;ensurePlayerArt();renderHome();hud();
}
function enter(n) { if(!Number.isInteger(n)||n<1||n>floors.length)return;floor=n;room=0;hp=stats(save).maxHp;mini=null;run={gold:0,xp:0,items:[],damage:0,potions:0,maxHp:hp};rewardUntil=0;hitStop=0;particles=[];cuts=[];flash=0;heroAction={type:'idle',dir:'right',at:time};shield=0;cooldown={};nextSlash=nextDodge=0;stamina=100;playerStunned=stunStarted=deathPanelAt=victoryAt=regenAt=attackCount=0;releaseGuard();paused=false;$('panel').hidden=true;spawn(); }
function drinkPotion(){if(phase!=='combat'||paused||playerStunned>time||hp>=stats(save).maxHp||!save.potions)return;save.potions--;run.potions++;hp=Math.min(stats(save).maxHp,hp+50);animateHero('heal');say('+50 HP · HEALING POTION');persist();hud();}
document.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return;
  if(b.id==='start'){homeView='map';selectedFloor=save.unlocked;renderHome();}
  if(b.dataset.home)goHome(b.dataset.home);
  if(b.dataset.selectFloor&&Number(b.dataset.selectFloor)<=save.unlocked){selectedFloor=Number(b.dataset.selectFloor);renderHome();}
  if(b.dataset.embark&&Number(b.dataset.embark)<=save.unlocked&&spritesLoaded===Object.keys(sprites).length){$('intro').hidden=true;enter(Number(b.dataset.embark));}
  if(b.dataset.hub){tab=b.dataset.hub;openPanel();}
  if(b.id==='heroBtn'||b.id==='menuBtn')openPanel();
  if(b.hasAttribute('data-close')){ mini=null;$('panel').hidden=true;paused=false;if(phase==='home')renderHome(); }
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
  if(b.id==='nextFloor'){selectedFloor=phase==='dead'?floor:Math.min(save.unlocked,floor+1);goHome('map');}
});
document.querySelectorAll('[data-dodge]').forEach(b=>{b.setAttribute('aria-label','Dodge '+b.dataset.dodge);b.addEventListener('pointerdown',e=>{e.preventDefault();evade(b.dataset.dodge);});});
$('blockBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(guardPointer!==null)return;guardPointer=e.pointerId;$('blockBtn').setPointerCapture(e.pointerId);setBlocking(true);});
for(const name of ['pointerup','pointercancel','lostpointercapture']) $('blockBtn').addEventListener(name,e=>{if(e.pointerId===guardPointer){guardPointer=null;setBlocking(guardKey);}});
const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*240/r.width,(e.clientY-r.top)*400/r.height];};
function swipe(points){const dx=points.at(-1)[0]-points[0][0],dy=points.at(-1)[1]-points[0][1];if(Math.hypot(dx,dy)<18)return false;slash(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');return true;}
canvas.addEventListener('pointerdown',e=>{if(phase!=='combat'||paused||blocking||time<playerStunned||pointer!==null)return;pointer=e.pointerId;pointerSlashed=false;trail=[point(e)];canvas.setPointerCapture(pointer);});
canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer){const p=point(e);if(Math.hypot(p[0]-trail.at(-1)[0],p[1]-trail.at(-1)[1])>2)trail.push(p);if(!pointerSlashed&&!stats(save).magic)pointerSlashed=swipe(trail);}});
canvas.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;trail.push(point(e));const points=trail;pointer=null;
  if(stats(save).magic)cast(points);else if(!pointerSlashed)swipe(points);
  trail=[];
});
for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{pointer=null;trail=[];});
window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();guardKey=true;setBlocking(true);return;}const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];if(d){e.preventDefault();e.shiftKey?evade(d):!stats(save).magic&&slash(d);}});
window.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();guardKey=false;setBlocking(guardPointer!==null);}});
window.addEventListener('blur',releaseGuard);
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){if(mini){mini=null;campNotice='พักเกมแล้ว · รอบที่ยังไม่จบไม่หักสิทธิ์รางวัล';renderPanel();}if(phase==='combat')openPanel();}});
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function poly(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function enemyPosition() {
  const impact = enemy?.strikeUntil>time ? Math.sin((enemy.strikeUntil-time)/180*Math.PI)*8 : 0;
  const recoil=enemy?.hit>time?Math.sin((enemy.hit-time)/260*Math.PI)*9:0;
  const anticipation=attack?Math.min(1,(time-(attack.started??time))/400)*-3:0,lean=impact+anticipation,dir=attack?.dir||enemy?.dir;
  return {x:120+({left:-1,right:1}[enemy?.hitDir]||0)*recoil+({left:-1,right:1}[dir]||0)*lean,y:212+impact+({up:-1,down:1}[enemy?.hitDir]||0)*recoil+({up:-1,down:1}[dir]||0)*anticipation};
}
function drawEnemy() {
  const sheet=sprites[enemy?.type || 'brute'];
  if(!sheet.complete || !sheet.naturalWidth)return;
  const expanded=['frost','spider','demon'].includes(enemy?.type);
  // Guard and movement now share the character's own atlas and ground anchor.
  // Separately generated guards had different anatomy and cannot be blended safely.
  let row=0,column=0;
  if(phase==='walking')column=3;
  else if(stunned>time||enemy?.hit>time)column=2;
  else if(attack){row=['up','down','left','right'].indexOf(attack.dir)+1;column=attack.at-time>400?0:1;}
  else if(enemy?.recoverUntil>time){row=['up','down','left','right'].indexOf(enemy.dir)+1;column=enemy.strikeUntil>time?2:3;}
  // Match the actual directional poses rather than rotating a generic strike.
  if(row>=3 && enemy.type==='wraith')row=row===3?4:3;
  if(row>=3 && enemy.type==='knight')column=(row===3?[2,2,1,0]:[3,0,1,2])[column];
  const cellW=sheet.naturalWidth/4,cellH=sheet.naturalHeight/(expanded?6:5);
  const {x,y}=enemyPosition(), size=room===2?174:156;
  const bounds=canvas.getBoundingClientRect(), aspect=(bounds.width/240)/(bounds.height/400);
  const cuts=atlasCuts[enemy?.type || 'brute']||{x:[0,cellW,cellW*2,cellW*3,cellW*4],y:Array(4).fill(Array.from({length:7},(_,i)=>cellH*i))};
  const sx=cuts.x[column],sy=cuts.y[column][row],sw=cuts.x[column+1]-sx,sh=cuts.y[column][row+1]-sy;
  const scale=size/cellW;
  renderer.syncEnemy({sheet,type:enemy?.type||'brute',key:`${row}:${column}`,sx,sy,sw,sh,column,row,cellH,x,y,size,aspect,mirror:enemy?.type==='demon'&&row===3,danger:attack&&attack.kind!=='normal'?{remaining:attack.at-time,clock:time,reducedMotion}:null,alpha:phase==='walking'?Math.max(0,Math.min(1,(transition-time)/500)):1});

}
function resolveAttack() {
  const kind=attack.kind || 'normal';
  let damage=Math.max(3,14+floor*3+room*2+(kind==='heavy'?8:0)-stats(save).armor);
  enemy.dir=attack.dir;enemy.strikeUntil=time+180;enemy.recoverUntil=time+480;
  if(blocking){
    const result=blockHit(stamina,kind);stamina=result.stamina;regenAt=time+800;
    if(result.broken){playerStunned=time+1400;stunStarted=time;releaseGuard();animateHero('stun');say('GUARD BREAK · สตั้น!');}
    else{animateHero('block',attack.dir);damage=0;enemy.openUntil=time+550;progress(save,'defenses');persist();say(`BLOCK · COUNTER! −${ATTACKS[kind].cost} STAMINA`);effects.push({x:88,y:295,text:'✦',color:'#94e5ff',until:time+400});}
  }else if(shield){animateHero('ward',attack.dir);shield--;damage=0;enemy.openUntil=time+900;progress(save,'defenses');persist();say('WARD BLOCK · COUNTER!');}
  else say(kind!=='normal'?'ท่ากวาดต้อง BLOCK!':'HIT! ปัดสวน หรือหลบตามลูกศร');
  if(damage){run.damage+=Math.min(hp,damage);hp=Math.max(0,hp-damage);flash=time+420;if(time>=playerStunned)animateHero('hurt',attack.dir);pendingSlash=null;impact(120,295,attack.dir,'blood',2);}
  else impact(85,282,attack.dir,'spark',1.3);
  attack=null;nextAttack=time+1100;
  if(!hp){phase='dead';releaseGuard();animateHero('death');deathPanelAt=time+1100;}
}
function draw(){
  if(phase==='home')return;
  ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=false;
  ctx.save();if(!reducedMotion&&shakeUntil>time){const strength=shakePower*(shakeUntil-time)/180;ctx.translate(Math.sin(time*1.7)*strength,Math.cos(time*1.3)*strength);}
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
  drawEnemy();

  if(playerStunned>time){ctx.fillStyle='#ffd293';ctx.font='bold 10px monospace';ctx.fillText('GUARD BROKEN',12,252);}
  cuts=cuts.filter(c=>time-c.at<190);for(const cut of cuts){ctx.save();ctx.translate(cut.x,cut.y);ctx.rotate({up:-Math.PI/2,down:Math.PI/2,left:Math.PI,right:0}[cut.dir]);ctx.globalAlpha=1-(time-cut.at)/190;poly([[-48,8],[-15,-7],[43,0],[4,3]],'#fff3c2');ctx.restore();}
  particles=particles.filter(p=>time-p.at<p.life);for(const p of particles){const age=(time-p.at)/1000;ctx.globalAlpha=1-(time-p.at)/p.life;rect(p.x+p.vx*age,p.y+p.vy*age+75*age*age,p.size,p.size,p.color);}ctx.globalAlpha=1;
  if(shield){ctx.strokeStyle='#ad97ff';ctx.lineWidth=2;ctx.strokeRect(12,250,216,110);}
  if(stunned>time){ctx.fillStyle='#f5e9a4';ctx.font='10px monospace';ctx.fillText('✦  STUN  ✦',115,155);}
  if(trail.length>1){ctx.strokeStyle=stats(save).magic?'#c8a8ff':'#fff1c2';ctx.lineWidth=3;ctx.beginPath();trail.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  effects=effects.filter(e=>e.until>time);for(const e of effects){ctx.fillStyle=e.color;ctx.font='bold 18px monospace';ctx.fillText(e.text,e.x,e.y-(700-(e.until-time))/30);}
  ctx.restore();
  if(flash>time){const glow=ctx.createRadialGradient(120,200,40,120,200,240);glow.addColorStop(0,'#8d001000');glow.addColorStop(1,`rgba(220,24,43,${(flash-time)/420*.8})`);ctx.fillStyle=glow;ctx.fillRect(0,0,240,400);}
  if(phase==='walking')rect(0,0,240,400,`rgba(12,10,20,${Math.sin((transition-time)/1000*Math.PI)*.65})`);
}
function resolvePlayerStrike(){if(pendingSlash&&time>=pendingSlash.at){const strike=pendingSlash;pendingSlash=null;hit(strike.damage,'#fff0ae',strike.dir);}}
function loop(now){let dt=Math.min(50,now-last);last=now;updateMini(now);if(now>=dailyCheck){dailyCheck=now+1000;if(paused&&['quests','camp'].includes(tab)&&save.daily?.day!==dayKey()){daily(save);persist();if(!mini)renderPanel();}}if(!paused && phase!=='home'&&!document.hidden){const stopped=Math.min(hitStop,dt);hitStop-=stopped;dt-=stopped;time+=dt;
  if(phase==='dead'&&time>=deathPanelAt)openPanel();
  if(phase==='walking'&&time>=transition)finishRoom();
  if(phase==='combat'){
    resolvePlayerStrike();
    if(time>=regenAt)stamina=regenStamina(stamina,dt/1000,blocking);
    if(attack&&time>=attack.at)resolveAttack();
    if(phase==='combat'&&!attack&&time>=nextAttack&&time>=stunned){const pattern=enemy.type==='frost'?['normal','heavy','normal','sweep']:enemy.type==='spider'?['normal','normal','heavy','normal']:enemy.type==='demon'?['heavy','normal','sweep','normal']:['normal','normal','heavy','normal','sweep'];const kind=pattern[attackCount++%pattern.length],duration=kind==='normal'?Math.max(650,1050-floor*70):1300;attack={dir:Object.keys(DIR)[Math.floor(Math.random()*4)],kind,started:time,at:time+duration};enemy.dir=attack.dir;}
  }
}hud();draw();}
const renderer=createPhaserRenderer({canvas,background,sprites,tick:loop,getState:()=>{
  ensurePlayerArt();
  const bounds=canvas.getBoundingClientRect(),aspect=(bounds.width/240)/(bounds.height/400);
  return {phase,paused,loaded:spritesLoaded===Object.keys(sprites).length,hero:{save,...currentHero(),clock:time,aspect}};
}});
ensurePlayerArt();renderHome();hud();
