export const ITEMS = {
  'rust-sword': { name: 'Rust Sword', slot: 'weapon', cost: 0, attack: 3 },
  'iron-sword': { name: 'Iron Sword', slot: 'weapon', cost: 180, attack: 8 },
  'ember-staff': { name: 'Ember Staff', slot: 'weapon', cost: 260, attack: 5, magic: true },
  'wolf-helm': { name: 'Wolf Helm', slot: 'helm', cost: 100, armor: 3 },
  'scale-mail': { name: 'Scale Mail', slot: 'armor', cost: 220, armor: 7 },
  'iron-greaves': { name: 'Iron Greaves', slot: 'pants', cost: 90, armor: 3 },
  'trail-boots': { name: 'Trail Boots', slot: 'boots', cost: 120, armor: 2 },
  'moon-ring': { name: 'Moon Ring', slot: 'ring', cost: 150, attack: 2, armor: 1 }
};
export const DIR = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const ATTACKS = {
  normal: { label: 'PARRY / DODGE', cost: 24, color: '#ff716c' },
  heavy: { label: 'DODGE / BLOCK', cost: 42, color: '#ffbe56' },
  sweep: { label: 'BLOCK ONLY', cost: 34, color: '#75d8ff' }
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
export function newSave() { return { gold: 80, level: 1, unlocked: 1, owned: ['rust-sword', 'ember-staff'], equipment: { helm: null, armor: null, pants: null, boots: null, ring: null, weapon: 'rust-sword' }, upgrades: { vigor: 0, edge: 0 } }; }
export function stats(save) {
  const s = { attack: 7 + save.upgrades.edge * 2, armor: save.upgrades.vigor, maxHp: 100 + save.upgrades.vigor * 12, magic: false };
  Object.values(save.equipment).forEach(id => { const i = ITEMS[id]; if (i) { s.attack += i.attack || 0; s.armor += i.armor || 0; s.magic ||= !!i.magic; } });
  return s;
}
export function buy(save, id) { const item = ITEMS[id]; if (!item || save.owned.includes(id) || save.gold < item.cost) return false; save.gold -= item.cost; save.owned.push(id); return true; }
export function loadSave(text) {
  let raw; try { raw = JSON.parse(text); } catch { return newSave(); }
  const base = newSave(); if (!raw || typeof raw !== 'object') return base;
  base.gold = Math.max(0, Math.min(99999, Number(raw.gold) || 0)); base.level = Math.max(1, Math.min(20, Number(raw.level) || 1)); base.unlocked = Math.max(1, Math.min(3, Number(raw.unlocked) || 1));
  if (Array.isArray(raw.owned)) base.owned = [...new Set(['rust-sword', ...raw.owned.filter(id => ITEMS[id])])];
  for (const slot of Object.keys(base.equipment)) { const id = raw.equipment?.[slot]; if (ITEMS[id]?.slot === slot && base.owned.includes(id)) base.equipment[slot] = id; }
  if (raw.upgrades && typeof raw.upgrades === 'object') for (const k of Object.keys(base.upgrades)) base.upgrades[k] = Math.max(0, Math.min(10, Number(raw.upgrades[k]) || 0));
  return base;
}
