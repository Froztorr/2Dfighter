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
  'assassin-dagger': { name: 'Night Talon', slot:'offhand', cost:280, attack:9, icon:34 }
};
export const SLOTS={helm:'หมวก',armor:'เกราะ',pants:'กางเกง',boots:'รองเท้า',weapon:'อาวุธหลัก',offhand:'อาวุธรอง',ring1:'แหวน I',ring2:'แหวน II',neck:'สร้อย',cloak:'ผ้าคลุม'};
export function guardReduction(level){return Math.min(1,.8+Math.max(1,level)*.04);}
export function stars(run){return run.damage===0&&run.potions===0?3:run.damage<=run.maxHp*.5&&run.potions<=1?2:1;}
export function equip(save,slot,id){
  if(!Object.hasOwn(SLOTS,slot))return false;
  if(slot==='offhand'&&ITEMS[save.equipment.weapon]?.hands===2)return false;
  if(id!==null&&(!save.owned.includes(id)||ITEMS[id]?.slot!==(slot.startsWith('ring')?'ring':slot)))return false;
  if(id&&slot.startsWith('ring')&&Object.entries(save.equipment).some(([key,value])=>key!==slot&&value===id))return false;
  save.equipment[slot]=id;
  if(slot==='weapon'&&ITEMS[id]?.hands===2)save.equipment.offhand=null;
  return true;
}
export const DIR = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const ATTACKS = {
  normal: { label: 'PARRY · BLOCK · DODGE', cost: 24, color: '#ff535a' },
  heavy: { label: 'BLOCK · DODGE', cost: 42, color: '#75d8ff' },
  sweep: { label: 'BLOCK ONLY', cost: 34, color: '#df2647' }
};
export function blockHit(stamina, kind = 'normal') {
  const left = Math.max(0, stamina - (ATTACKS[kind] || ATTACKS.normal).cost);
  return { stamina: left, broken: left === 0 };
}
export function regenStamina(stamina, seconds, blocking) {
  return Math.min(100, stamina + Math.max(0, seconds) * (blocking ? 4 : 16));
}
export function defend(incoming, action, type, age, kind = 'normal') {
  if (!Number.isFinite(age) || age < 0 || age > 450) return null;
  if (type === 'slash' && kind !== 'normal' || type === 'dodge' && kind === 'sweep') return null;
  const correct = type === 'slash' ? DIR[incoming] === action : type === 'dodge' && incoming === action;
  if (!correct) return null;
  return age <= 170 ? 'perfect' : 'normal';
}
export function recognize(points) {
  if (!Array.isArray(points) || points.length < 3) return null;
  const clean = points.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (clean.length < 3) return null;
  let length = 0, turns = 0, signed = 0, corners = 0;
  for (let i = 1; i < clean.length; i++) length += Math.hypot(clean[i][0]-clean[i-1][0], clean[i][1]-clean[i-1][1]);
  for (let i = 1; i < clean.length-1; i++) {
    const a = Math.atan2(clean[i][1]-clean[i-1][1], clean[i][0]-clean[i-1][0]);
    const b = Math.atan2(clean[i+1][1]-clean[i][1], clean[i+1][0]-clean[i][0]);
    let d = b-a; if (d > Math.PI) d -= Math.PI*2; if (d < -Math.PI) d += Math.PI*2;
    turns += Math.abs(d); signed += d; if (Math.abs(d) > .65) corners++;
  }
  const close = Math.hypot(clean[0][0]-clean.at(-1)[0], clean[0][1]-clean.at(-1)[1]) < Math.max(25, length*.18);
  if (length < 70) return null;
  // ponytail: geometric heuristic for three runes; template matching if more runes are added.
  if (Math.abs(signed) > 8 && turns < Math.abs(signed)*1.5) return 'spiral';
  if (close && corners >= 3 && corners <= 5 && turns >= 3.5 && turns < 8) return 'square';
  if (close && turns > 5 && turns < 9) return 'circle';
  return null;
}
export function newSave() { return { gold: 80, level: 1, xp:0, potions:3, unlocked: 1, owned: ['rust-sword', 'ember-staff','wood-shield','venom-dagger','parry-dagger'], equipment: { helm: null, armor: null, pants: null, boots: null, ring1: null, ring2:null,neck:null,cloak:null, weapon: 'rust-sword',offhand:'wood-shield' }, upgrades: { vigor: 0, edge: 0 } }; }
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
  base.gold = Math.max(0, Math.min(99999, Number(raw.gold) || 0)); base.level = Math.max(1, Math.min(20, Number(raw.level) || 1)); base.unlocked = Math.max(1, Math.min(3, Number(raw.unlocked) || 1));
  for(const key of ['xp','potions'])if(Number.isFinite(raw[key]))base[key]=Math.max(0,Math.min(key==='xp'?1999:99,Math.floor(raw[key])));
  if (Array.isArray(raw.owned)) base.owned = [...new Set([...base.owned, ...raw.owned.filter(id => ITEMS[id])])];
  for (const slot of Object.keys(base.equipment)) { const id = raw.equipment && Object.hasOwn(raw.equipment,slot) ? raw.equipment[slot] : slot==='ring1'?raw.equipment?.ring:undefined; if(id!==undefined)equip(base,slot,id); }
  if(ITEMS[base.equipment.weapon]?.hands===2)base.equipment.offhand=null;
  if (raw.upgrades && typeof raw.upgrades === 'object') for (const k of Object.keys(base.upgrades)) base.upgrades[k] = Math.max(0, Math.min(10, Number(raw.upgrades[k]) || 0));
  return base;
}
