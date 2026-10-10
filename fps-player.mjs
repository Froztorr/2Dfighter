import { ITEMS, HERO_ACTIONS } from './core.mjs';

export const FPS_GRID={columns:8,rows:8};
const attackRows={right:1,left:2,up:3,down:4};
// Contact is painted in column 4 and remains aligned with damage at 110 ms.
const strikeTimes=[0,28,55,82,110,155,205,255];
const pick=(elapsed,times)=>Math.max(0,times.findLastIndex(at=>elapsed>=at));
export function playerFrame(action='idle',dir='right',elapsed=0){
  elapsed=Math.max(0,elapsed);
  let row=0,column=0;
  if(action==='slash'){if(elapsed<300){row=attackRows[dir]??1;column=pick(elapsed,strikeTimes);}}
  else if(action==='parry'&&elapsed<360){row=6;column=Math.min(7,Math.floor(elapsed/45));}
  else if(action==='guard'){row=5;column=2;}
  else if(action==='block'){row=5;column=elapsed<360?[0,1,2,3,4,3,2,2][Math.min(7,Math.floor(elapsed/45))]:2;}
  else if(action==='death'){row=7;column=Math.min(7,Math.floor(elapsed/112.5));}
  else if(action==='stun'){row=7;column=3+Math.floor(elapsed/220)%2;}
  else if(action==='hurt'&&elapsed<360){row=7;column=[0,1,2,3,2,1,0,0][Math.min(7,Math.floor(elapsed/45))];}
  else if(action==='dodge'&&elapsed<320){row=7;column=[0,4,5,6,5,4,0,0][Math.min(7,Math.floor(elapsed/40))];}
  else if(['cast','ward','heal'].includes(action)&&elapsed<HERO_ACTIONS[action].duration){row=6;column=Math.min(7,Math.floor(elapsed/HERO_ACTIONS[action].duration*8));}
  else if(action==='victory'&&elapsed<1100){row=3;column=[0,1,2,3,4,5,6,7][Math.min(7,Math.floor(elapsed/137.5))];}
  else if(['idle','walk'].includes(action)){column=Math.floor(elapsed/(action==='walk'?95:180))%8;}
  return {row,column,index:row*8+column};
}
export function equipmentArt(save){
  const weapon=ITEMS[save.equipment.weapon],armor=ITEMS[save.equipment.armor];
  return {look:armor?.look||0,twoHanded:weapon?.hands===2,weapon:save.equipment.weapon,offhand:weapon?.hands===2?null:save.equipment.offhand,armorHue:armor?.hue||0};
}
export const ITEM_GRIPS={
  'rust-sword':[.28,.76],'iron-sword':[.30,.77],mace:[.27,.79],axe:[.30,.77],greatsword:[.25,.78],
  'ember-staff':[.24,.79],'parry-dagger':[.30,.77],'venom-dagger':[.31,.77],'fire-wand':[.27,.78],
  'ice-staff':[.25,.78],'frost-sword':[.24,.80],'spider-fang':[.26,.80],'spider-claw':[.70,.76],
  'assassin-dagger':[.66,.35],'inferno-axe':[.25,.81],'demon-staff':[.20,.82]
};

export const PLAYER_LOOKS=['plain','plate','rogue','mage'];
export const PLAYER_WEAPONS=Object.keys(ITEMS).filter(id=>ITEMS[id].slot==='weapon');
export const MATERIAL_PROFILES={blade:'iron-sword',staff:'ember-staff',heavy:'greatsword'};
export function materialProfile(save){const item=ITEMS[save.equipment.weapon];return item?.hands===2?(item.magic?'staff':'heavy'):'blade';}
export const PLAYER_SHEETS=[...PLAYER_WEAPONS.map(id=>`fps-${id}-plate`),...PLAYER_LOOKS.map(look=>`fps-offhand-${look}`),...Object.keys(MATERIAL_PROFILES).flatMap(profile=>PLAYER_LOOKS.filter(look=>look!=='plate').map(look=>`fps-material-${profile}-${look}`))];
// Combat uses a procedural rig; historical sheets remain available as source art.
export function playerAssets(){return [];}
export const OFFHAND_ROWS={'wood-shield':0,'steel-shield':1,'guardian-shield':2,'frost-shield':3,'parry-dagger':4,'assassin-dagger':5,'spider-claw':6};
export function offhandFrame(action,elapsed){
 if(action==='guard')return 2;
 if(action==='block')return [0,1,2,3,4,3,2,2][Math.min(7,Math.floor(Math.max(0,elapsed)/45))];
 if(action==='parry')return [0,1,2,3,4,5,6,0][Math.min(7,Math.floor(Math.max(0,elapsed)/45))];
 if(action==='death')return elapsed>650?7:Math.floor(Math.max(0,elapsed)/110)%7;
 if(action==='hurt'||action==='stun')return 3;
 return 0;
}
