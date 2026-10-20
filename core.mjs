import {cleanAppearance} from './appearance.mjs';
export const ITEMS = {
  'rust-sword': { name: 'Rust Sword', slot: 'weapon', cost: 0, attack: 3, icon:0 },
  'iron-sword': { name: 'Iron Sword', slot: 'weapon', cost: 180, attack: 8, icon:1 },
  'mace': { name: 'Ironbreaker Mace', slot: 'weapon', cost: 230, attack: 10, icon:2 },
  'axe': { name: 'Reaver Axe', slot: 'weapon', cost: 260, attack: 11, icon:3 },
  'greatsword': { name: 'Dawn Greatsword', slot: 'weapon', cost: 380, attack: 19, hands:2, icon:4 },
  'ember-staff': { name: 'Ember Staff', slot: 'weapon', cost: 260, attack: 5, magic: true, hands:2, icon:5 },
  'wood-shield': { name: 'Oak Shield', slot: 'offhand', cost: 0, shield:true, icon:6 },
  'steel-shield': { name: 'Sentinel Shield', slot: 'offhand', cost: 210, armor:3, shield:true, icon:7 },
  'parry-dagger': { name: 'Mercenary Dagger', slot: 'offhand', cost: 160, attack:5, icon:8 },
  'venom-dagger': { name: 'Venom Fang', slot: 'weapon', cost: 200, attack:7, icon:9 },
  'fire-wand': { name: 'Cinder Wand', slot: 'weapon', cost: 340, attack:9, magic:true, hands:2, icon:10 },
  'ice-staff': { name: 'Winter Staff', slot: 'weapon', cost: 480, attack:13, magic:true, hands:2, icon:11 },
  'wolf-helm': { name: 'Wolf Helm', slot: 'helm', cost: 100, armor: 3, look:1, icon:12 },
  'rogue-hood': { name: 'Forest Hood', slot:'helm', cost:100, armor:1, attack:2, look:2, icon:13 },
  'mage-hat': { name: 'Astral Hat', slot:'helm', cost:120, attack:3, look:3, icon:14 },
  'scale-mail': { name: 'Scale Mail', slot: 'armor', cost: 220, armor: 7, look:1, icon:15 },
  'leather-vest': { name: 'Ranger Leather', slot:'armor', cost:180, armor:3, attack:3, look:2, icon:16 },
  'mage-robe': { name: 'Astral Robe', slot:'armor', cost:200, armor:2, health:25, look:3, icon:17 },
  'iron-greaves': { name: 'Iron Greaves', slot: 'pants', cost: 90, armor: 3, look:1, icon:18 },
  'rogue-pants': { name: 'Shadow Trousers', slot:'pants', cost:90, armor:1, attack:2, look:2, icon:19 },
  'mage-pants': { name: 'Astral Leggings', slot:'pants', cost:90, health:15, look:3, icon:20 },
  'plate-boots': { name: 'Sentinel Boots', slot:'boots', cost:120, armor:3, look:1, icon:21 },
  'trail-boots': { name: 'Trail Boots', slot: 'boots', cost: 120, armor: 2, look:2, icon:22 },
  'mage-boots': { name: 'Astral Slippers', slot:'boots', cost:120, attack:2, health:10, look:3, icon:23 },
  'ruby-ring': { name: 'Ruby Band', slot:'ring', cost:150, attack:3, icon:24 },
  'emerald-ring': { name: 'Emerald Band', slot:'ring', cost:150, health:20, icon:25 },
  'sapphire-ring': { name: 'Sapphire Band', slot:'ring', cost:150, armor:3, icon:26 },
  'moon-ring': { name: 'Moon Ring', slot: 'ring', cost: 150, attack: 2, armor: 1, icon:27 },
  'sun-necklace': { name: 'Sun Amulet', slot:'neck', cost:180, health:25, icon:28 },
  'arcane-pendant': { name: 'Arcane Pendant', slot:'neck', cost:220, attack:4, icon:29 },
  'red-cape': { name: 'Crimson Mantle', slot:'cloak', cost:160, armor:2, look:1, icon:30 },
  'forest-cloak': { name: 'Forest Cloak', slot:'cloak', cost:160, attack:2, look:2, icon:31 },
  'astral-cloak': { name: 'Astral Cloak', slot:'cloak', cost:160, health:20, look:3, icon:32 },
  'guardian-shield': { name: 'Solar Aegis', slot:'offhand', cost:450, armor:6, shield:true, icon:33 },
  'assassin-dagger': { name: 'Night Talon', slot:'offhand', cost:280, attack:9, icon:34 },
  'frost-sword': {name:'Rimeblade',slot:'weapon',cost:580,attack:21,icon:0,atlas:'relics'},
  'frost-shield': {name:'Glacier Aegis',slot:'offhand',cost:500,armor:9,shield:true,icon:1,atlas:'relics'},
  'frost-helm': {name:'Crown of Winter',slot:'helm',cost:420,armor:6,health:15,look:1,hue:165,icon:2,atlas:'relics'},
  'frost-plate': {name:'Glacier Plate',slot:'armor',cost:620,armor:11,health:25,look:1,hue:165,icon:3,atlas:'relics'},
  'spider-fang': {name:'Widow Fang',slot:'weapon',cost:560,attack:18,icon:4,atlas:'relics'},
  'spider-claw': {name:'Venom Hook',slot:'offhand',cost:520,attack:13,icon:5,atlas:'relics'},
  'silk-cloak': {name:'Widow Silk',slot:'cloak',cost:420,attack:5,armor:3,icon:6,atlas:'relics'},
  'spider-pendant': {name:'Venom Heart',slot:'neck',cost:450,health:40,attack:3,icon:7,atlas:'relics'},
  'inferno-axe': {name:'Inferno Cleaver',slot:'weapon',cost:850,attack:34,hands:2,icon:8,atlas:'relics'},
  'demon-staff': {name:'Hellfire Scepter',slot:'weapon',cost:800,attack:22,magic:true,hands:2,icon:9,atlas:'relics'},
  'demon-ring': {name:'Emberlord Seal',slot:'ring',cost:500,attack:6,health:20,icon:10,atlas:'relics'},
  'inferno-robe': {name:'Hellfire Vestments',slot:'armor',cost:650,armor:6,health:45,look:3,hue:105,icon:11,atlas:'relics'}
};
export const FLOORS=[
  {name:'THE ASHEN HALLS',theme:'ash',enemies:['brute','lizard','knight'],drops:['rogue-hood','trail-boots','wolf-helm'],colors:['#272537','#3c3544','#544453']},
  {name:'MOSSBOUND CRYPT',theme:'moss',enemies:['lizard','wraith','brute'],drops:['mage-hat','mage-pants','iron-greaves'],colors:['#1c3030','#334340','#50614b']},
  {name:'THE EMBER THRONE',theme:'ember',enemies:['wraith','knight','knight'],drops:['astral-cloak','arcane-pendant','moon-ring'],colors:['#37252e','#503038','#70433e']},
  {name:'FROSTBOUND KEEP',theme:'frost',enemies:['frost','knight','frost'],drops:['frost-helm','frost-shield','frost-sword'],colors:['#182e45','#29435d','#729da8']},
  {name:'THE SILKEN ABYSS',theme:'silk',enemies:['spider','wraith','spider'],drops:['silk-cloak','spider-claw','spider-fang'],colors:['#231e36','#3b2c48','#6e527b']},
  {name:'OBSIDIAN INFERNO',theme:'inferno',enemies:['demon','frost','demon'],drops:['demon-ring','inferno-robe','inferno-axe'],colors:['#281824','#432532','#a94e3d']}
];
export const QUESTS=[
  {id:'hunt',event:'kills',goal:6,name:'Monster Hunter',description:'กำจัดศัตรู 6 ตัว',reward:{gold:150,xp:80}},
  {id:'defense',event:'defenses',goal:8,name:'Unbroken Guard',description:'Parry / dodge / block สำเร็จ 8 ครั้ง',reward:{gold:120,xp:60}},
  {id:'clear',event:'clears',goal:1,name:'Dungeon Delver',description:'เคลียร์ด่านใดก็ได้ 1 ด่าน',reward:{gold:180,xp:100,potions:1}},
  {id:'leisure',event:'minis',goal:2,name:'Camp Artisan',description:'เล่น minigame จบ 2 รอบ',reward:{gold:80,xp:40,potions:1}}
];
export const dayKey=(now=Date.now())=>new Date(now+7*3600000).toISOString().slice(0,10);
export function daily(save,now=Date.now()){
  const day=dayKey(now);
  // ponytail: offline daily clock; server time is required only if cloud competition is introduced.
  if(save.daily?.day!==day)save.daily={day,counts:{kills:0,defenses:0,clears:0,minis:0},claimed:[],plays:{forge:0,runes:0}};
  return save.daily;
}
export function progress(save,event,amount=1,now=Date.now()){
  const d=daily(save,now);if(Object.hasOwn(d.counts,event)&&Number.isInteger(amount)&&amount>0)d.counts[event]=Math.min(999,d.counts[event]+amount);
}
export function grant(save,reward){
  save.gold=Math.min(99999,save.gold+(reward.gold||0));save.xp+=reward.xp||0;save.potions=Math.min(99,save.potions+(reward.potions||0));
  while(save.xp>=save.level*100&&save.level<20){save.xp-=save.level*100;save.level++;}
  if(save.level===20)save.xp=Math.min(save.xp,1999);
  return reward;
}
export function claimQuest(save,id,now=Date.now()){
  const q=QUESTS.find(q=>q.id===id),d=daily(save,now);
  if(!q||d.claimed.includes(id)||d.counts[q.event]<q.goal)return null;
  d.claimed.push(id);return grant(save,q.reward);
}
export function forgeScore(position){const distance=Math.abs(position-.5);return distance<=.06?3:distance<=.16?2:distance<=.26?1:0;}
export function finishMini(save,kind,score,now=Date.now()){
  const max=kind==='forge'?15:kind==='runes'?6:0;
  if(!max||!Number.isInteger(score)||score<0||score>max)return null;
  const d=daily(save,now);progress(save,'minis',1,now);
  if(d.plays[kind]>=3)return {gold:0,xp:0};
  d.plays[kind]++;return grant(save,{gold:20+score*(kind==='forge'?5:10),xp:10+score*2,potions:score===max?1:0});
}
export const SLOTS={helm:'หมวก',armor:'เกราะ',pants:'กางเกง',boots:'รองเท้า',weapon:'อาวุธหลัก',offhand:'อาวุธรอง',ring1:'แหวน I',ring2:'แหวน II',neck:'สร้อย',cloak:'ผ้าคลุม'};
export function fitsSlot(item,slot){
  if(!item||!Object.hasOwn(SLOTS,slot))return false;
  if((slot==='weapon'||slot==='offhand')&&(item.slot==='weapon'||item.slot==='offhand')){
    return item.shield?slot==='offhand':item.hands===2?slot==='weapon':true;
  }
  return item.slot===(slot.startsWith('ring')?'ring':slot);
}
export function guardReduction(level){return Math.min(1,.8+Math.max(1,level)*.04);}
export function stars(run){return run.damage===0&&run.potions===0?3:run.damage<=run.maxHp*.5&&run.potions<=1?2:1;}
export function equip(save,slot,id){
  if(!Object.hasOwn(SLOTS,slot))return false;
  if(slot==='offhand'&&ITEMS[save.equipment.weapon]?.hands===2)return false;
  if(id!==null&&(!save.owned.includes(id)||!fitsSlot(ITEMS[id],slot)))return false;
  if(id&&slot.startsWith('ring')&&Object.entries(save.equipment).some(([key,value])=>key!==slot&&value===id))return false;
  save.equipment[slot]=id;
  if(slot==='weapon'&&ITEMS[id]?.hands===2)save.equipment.offhand=null;
  return true;
}
export const DIR = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const HERO_ACTIONS={
  idle:{duration:Infinity},slash:{duration:300},guard:{duration:Infinity},block:{duration:360},
  parry:{duration:360},dodge:{duration:320},stun:{duration:Infinity},death:{duration:900},
  hurt:{duration:360},cast:{duration:520},ward:{duration:400},heal:{duration:700},victory:{duration:1100},walk:{duration:Infinity}
};
export function impactParticles(dir,count,random=Math.random){
  const angle={up:-Math.PI/2,down:Math.PI/2,left:Math.PI,right:0}[dir]??0;
  return Array.from({length:count},()=>{const a=angle+(random()-.5)*1.1,speed=35+random()*95;return {vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:260+random()*330,size:1+random()*2};});
}
export const ATTACKS = {
  normal: { label: 'PARRY · BLOCK · DODGE', cost: 24, color: '#ff535a' },
  heavy: { label: 'BLOCK ONLY', cost: 42, color: '#ff4057' },
  sweep: { label: 'DODGE ONLY', cost: 0, color: '#df2647' }
};
export function blockHit(stamina, kind = 'normal') {
  if (kind === 'sweep') return { stamina, broken: false, blocked: false };
  const left = Math.max(0, stamina - (ATTACKS[kind] || ATTACKS.normal).cost);
  return { stamina: left, broken: left === 0, blocked: left > 0 };
}
export function regenStamina(stamina, seconds, blocking) {
  return Math.min(100, stamina + Math.max(0, seconds) * (blocking ? 4 : 16));
}
export function defend(incoming, action, type, age, kind = 'normal') {
  if (!Number.isFinite(age) || age < 0 || age > 450) return null;
  if (kind === 'heavy' || (kind === 'sweep' && type !== 'dodge')) return null;
  const correct = type === 'slash' ? DIR[incoming] === action : type === 'dodge' && incoming === action;
  if (!correct) return null;
  return age <= 170 ? 'perfect' : 'normal';
}
export const MELEE_CONTACTS={main:110,offhand:165};
export const STAFF_RUNES={
 circle:{glyph:'○',name:'FIRE',cooldown:1800,multiplier:2.5},
 chevron:{glyph:'V',name:'WARD',cooldown:6500},
 bolt:{glyph:'Z',name:'NOVA',cooldown:4500,multiplier:4}
};
export function strikeContacts(save){
 const off=ITEMS[save.equipment.offhand],twoHanded=ITEMS[save.equipment.weapon]?.hands===2,total=stats(save).attack;
 return !twoHanded&&off&&!off.shield?[{hand:'right',at:MELEE_CONTACTS.main,damage:total-off.attack},{hand:'left',at:MELEE_CONTACTS.offhand,damage:off.attack}]:[{hand:'right',at:MELEE_CONTACTS.main,damage:total}];
}
function simplifyRune(points,tolerance){
 if(points.length<3)return points;
 const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;let far=0,index=0;
 for(let i=1;i<points.length-1;i++){
  const t=length?Math.max(0,Math.min(1,((points[i][0]-a[0])*dx+(points[i][1]-a[1])*dy)/length)):0;
  const distance=Math.hypot(points[i][0]-a[0]-t*dx,points[i][1]-a[1]-t*dy);if(distance>far){far=distance;index=i;}
 }
 if(far<=tolerance)return [a,b];
 return [...simplifyRune(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyRune(points.slice(index),tolerance)];
}
export function recognize(points){
 if(!Array.isArray(points))return null;
 const clean=[];for(const p of points)if(Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&(!clean.length||Math.hypot(p[0]-clean.at(-1)[0],p[1]-clean.at(-1)[1])>.5))clean.push(p);
 if(clean.length<3)return null;
 const xs=clean.map(p=>p[0]),ys=clean.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys),diagonal=Math.hypot(w,h);
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),cumulative=[0];
 for(let i=1;i<clean.length;i++)cumulative.push(cumulative.at(-1)+distance(clean[i-1],clean[i]));
 const length=cumulative.at(-1);if(diagonal<26||length<48)return null;
 // Equal arc-length samples remove pointer-speed differences and tolerate finger jitter.
 const samples=[];let segment=1;
 for(let i=0;i<40;i++){const at=length*i/39;while(segment<clean.length-1&&cumulative[segment]<at)segment++;const t=(at-cumulative[segment-1])/(cumulative[segment]-cumulative[segment-1]);samples.push(clean[segment-1].map((v,j)=>v+(clean[segment][j]-v)*t));}
 const turn=(a,b,c)=>{const u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];return Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]);};
 const gap=distance(clean[0],clean.at(-1)),closed=gap<diagonal*.32;
 if(closed&&w>diagonal*.25&&h>diagonal*.25){
  const rounded=simplifyRune(samples,diagonal*.045);let turns=0,signed=0,corners=0;
  for(let i=1;i<rounded.length-1;i++){const t=turn(rounded[i-1],rounded[i],rounded[i+1]);turns+=Math.abs(t);signed+=t;if(Math.abs(t)>1.12)corners++;}
  // One forgiving rounded loop; repeated loops and angular polygons do not alias to Fire.
  if(Math.abs(signed)>4.3&&Math.abs(signed)<7.8&&turns<9&&corners<3&&length<diagonal*3.4)return 'circle';
  return null;
 }
 const nodes=simplifyRune(samples,diagonal*.085),legs=nodes.slice(1).map((p,i)=>distance(nodes[i],p)),path=legs.reduce((a,b)=>a+b,0);
 if(nodes.length===3&&legs.every(l=>l>path*.23)){
  const bend=Math.abs(turn(...nodes));if(bend>1.05&&bend<2.85&&nodes[1][1]>Math.max(nodes[0][1],nodes[2][1])+h*.30)return 'chevron';
 }
 if(nodes.length===4&&legs.every(l=>l>path*.14)){
  const a=turn(...nodes.slice(0,3)),b=turn(...nodes.slice(1,4)),first=[nodes[1][0]-nodes[0][0],nodes[1][1]-nodes[0][1]],last=[nodes[3][0]-nodes[2][0],nodes[3][1]-nodes[2][1]];
  const parallel=(first[0]*last[0]+first[1]*last[1])/(legs[0]*legs[2]);
  if(a*b<0&&Math.abs(a)>.85&&Math.abs(b)>.85&&parallel>.35&&gap>diagonal*.55)return 'bolt';
 }
 return null;
}
export function newSave() { return { appearance:cleanAppearance(), gold: 80, level: 1, xp:0, potions:3, unlocked: 1, bestStars:{}, owned: ['rust-sword', 'ember-staff','wood-shield','venom-dagger','parry-dagger'], equipment: { helm: null, armor: null, pants: null, boots: null, ring1: null, ring2:null,neck:null,cloak:null, weapon: 'rust-sword',offhand:'wood-shield' }, upgrades: { vigor: 0, edge: 0 } }; }
export function stats(save) {
  const s = { attack: 7 + save.upgrades.edge * 2, armor: save.upgrades.vigor, maxHp: 100 + save.upgrades.vigor * 12, magic: false };
  Object.entries(save.equipment).forEach(([slot,id]) => { const i = ITEMS[id]; if (i && !(slot==='offhand'&&ITEMS[save.equipment.weapon]?.hands===2)) { s.attack += i.attack || 0; s.armor += i.armor || 0; s.maxHp+=i.health||0; s.magic ||= !!i.magic; } });
  s.canBlock=ITEMS[save.equipment.weapon]?.hands!==2&&!!ITEMS[save.equipment.offhand]?.shield;
  return s;
}
export function buy(save, id) { const item = ITEMS[id]; if (!item || save.owned.includes(id) || save.gold < item.cost) return false; save.gold -= item.cost; save.owned.push(id); return true; }
export function loadSave(text) {
  let raw; try { raw = JSON.parse(text); } catch { return newSave(); }
  const base = newSave(); if (!raw || typeof raw !== 'object') return base;
  base.appearance=cleanAppearance(raw.appearance);
  base.gold = Math.max(0, Math.min(99999, Math.floor(Number(raw.gold)) || 0)); base.level = Math.max(1, Math.min(20, Math.floor(Number(raw.level)) || 1)); base.unlocked = Math.max(1, Math.min(FLOORS.length, Math.floor(Number(raw.unlocked)) || 1));
  for(const key of ['xp','potions'])if(Number.isFinite(raw[key]))base[key]=Math.max(0,Math.min(key==='xp'?1999:99,Math.floor(raw[key])));
  if (Array.isArray(raw.owned)) base.owned = [...new Set([...base.owned, ...raw.owned.filter(id => ITEMS[id])])];
  for (const slot of Object.keys(base.equipment)) { const id = raw.equipment && Object.hasOwn(raw.equipment,slot) ? raw.equipment[slot] : slot==='ring1'?raw.equipment?.ring:undefined; if(id!==undefined)equip(base,slot,id); }
  if(ITEMS[base.equipment.weapon]?.hands===2)base.equipment.offhand=null;
  for(let f=1;f<=FLOORS.length;f++)if(Number.isInteger(raw.bestStars?.[f]))base.bestStars[f]=Math.max(0,Math.min(3,raw.bestStars[f]));
  if(typeof raw.daily?.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.daily.day)){
    base.daily={day:raw.daily.day,counts:{},claimed:QUESTS.filter(q=>Array.isArray(raw.daily.claimed)&&raw.daily.claimed.includes(q.id)).map(q=>q.id),plays:{}};
    for(const event of ['kills','defenses','clears','minis'])base.daily.counts[event]=Math.max(0,Math.min(999,Math.floor(Number(raw.daily.counts?.[event]))||0));
    for(const game of ['forge','runes'])base.daily.plays[game]=Math.max(0,Math.min(3,Math.floor(Number(raw.daily.plays?.[game]))||0));
  }
  if (raw.upgrades && typeof raw.upgrades === 'object') for (const k of Object.keys(base.upgrades)) base.upgrades[k] = Math.max(0, Math.min(10, Number(raw.upgrades[k]) || 0));
  return base;
}
