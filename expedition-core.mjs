export const MAP=[
 '#############',
 '#...........#',
 '#...........#',
 '#..#.....#..#',
 '#...........#',
 '#...........#',
 '#...........#',
 '#..#.....#..#',
 '#...........#',
 '#...........#',
 '#..#.....#..#',
 '#...........#',
 '#...........#',
 '#############'
];
export const CLIPS=['walk-front','walk-quarter','walk-rear','walk-back','idle','up','down','left','right','thrust','kick','cast'].map(name=>({name,frames:8}));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function spriteView(angle){
 const a=Math.abs(angleDelta(angle,0));return {clip:a<.4?'walk-front':a<1.57?'walk-quarter':a<2.65?'walk-rear':'walk-back',flip:angle<0};
}
export class Expedition{
 constructor(random=Math.random,floor=1){
  this.random=random;this.time=0;this.mode='explore';this.player={x:6.5,z:12,yaw:0,pitch:0};this.anchor=0;this.stamina=100;this.playerStun=0;
  this.enemies=[[5.6,6],[7.5,6.5],[6.5,2]].map(([x,z],i)=>({id:i,x,z,homeX:x,homeZ:z,yaw:Math.PI,hp:70+floor*12+(i===2?65:0),max:70+floor*12+(i===2?65:0),hits:0,allowance:2+Math.floor(random()*2),normals:0,nextSpecial:3+Math.floor(random()*2),stunUntil:0,hitUntil:0,nextAttack:0,attack:null,active:false,boss:i===2}));
 }
 clear(x,z){const r=.23;return [[-r,-r],[r,-r],[-r,r],[r,r]].every(([a,b])=>MAP[Math.floor(z+b)]?.[Math.floor(x+a)]==='.');}
 move(strafe,forward,dt){
  if(this.mode!=='explore')return;const scale=2.2*Math.min(dt,.1)/Math.max(1,Math.hypot(strafe,forward)),p=this.player;
  const x=p.x+(Math.cos(p.yaw)*strafe+Math.sin(p.yaw)*forward)*scale,z=p.z+(Math.sin(p.yaw)*strafe-Math.cos(p.yaw)*forward)*scale;
  if(this.clear(x,p.z))p.x=x;if(this.clear(p.x,z))p.z=z;
 }
 look(yaw,pitch){const p=this.player;p.yaw+=yaw;p.pitch=clamp(p.pitch+pitch,-.3,.35);if(this.mode==='combat')p.yaw=this.anchor+clamp(angleDelta(p.yaw,this.anchor),-1.05,1.05);}
 visible(e){const p=this.player,dx=e.x-p.x,dz=e.z-p.z,n=Math.ceil(Math.hypot(dx,dz)*8);for(let i=1;i<n;i++)if(MAP[Math.floor(p.z+dz*i/n)]?.[Math.floor(p.x+dx*i/n)]!=='.')return false;return true;}
 target(){const p=this.player;return this.enemies.filter(e=>e.active&&e.hp>0).map(e=>({e,a:Math.abs(angleDelta(Math.atan2(e.x-p.x,p.z-e.z),p.yaw))})).filter(v=>v.a<.62).sort((a,b)=>a.a-b.a)[0]?.e;}
 update(dt){
  this.time+=dt;const p=this.player;
  if(this.mode==='explore'){
   const near=this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<4.8&&this.visible(e));
   if(near.length){
    const group=this.enemies.filter(e=>e.hp>0&&this.visible(e)&&near.some(n=>Math.hypot(e.x-n.x,e.z-n.z)<3));
    this.mode='combat';const x=group.reduce((s,e)=>s+e.x,0)/group.length,z=group.reduce((s,e)=>s+e.z,0)/group.length;this.anchor=Math.atan2(x-p.x,p.z-z);p.yaw=this.anchor;p.pitch=0;group.forEach((e,i)=>{e.active=true;e.slot=(i-(group.length-1)/2)*1.8;e.nextAttack=this.time+2+i*1.4;});
   }
  }
  for(const e of this.enemies){
   if(e.hp<=0)continue;
   if(e.active){
    e.yaw=Math.atan2(p.x-e.x,p.z-e.z);
    const tx=p.x+Math.sin(this.anchor)*2.8+Math.cos(this.anchor)*(e.slot||0),tz=p.z-Math.cos(this.anchor)*2.8+Math.sin(this.anchor)*(e.slot||0),d=Math.hypot(tx-e.x,tz-e.z);e.walking=d>.05;
    if(e.walking){const step=Math.min(d,dt*.85),x=e.x+(tx-e.x)/d*step,z=e.z+(tz-e.z)/d*step;if(this.clear(x,z)){e.x=x;e.z=z;}else e.walking=false;}
   }else{const x=e.homeX+Math.sin(this.time*.6+e.id)*.45,z=e.homeZ+Math.cos(this.time*.6+e.id)*.35;e.yaw=Math.atan2(x-e.x,z-e.z);e.walking=true;if(this.clear(x,z)){e.x=x;e.z=z;}}
  }
  if(this.mode==='combat'&&!this.enemies.some(e=>e.active&&e.hp>0)){this.mode='explore';for(const e of this.enemies)e.active=false;}
 }
 chooseAttack(e){
  if(e.normals>=e.nextSpecial){e.normals=0;e.nextSpecial=3+Math.floor(this.random()*2);const clip=['thrust','kick','cast'][Math.floor(this.random()*3)];return {kind:'special',clip,power:clip==='kick'?60:48};}
  e.normals++;const dir=['up','down','left','right'][Math.floor(this.random()*4)];return {kind:'normal',clip:dir,dir,power:24};
 }
 strike(e,damage){if(!e||e.hp<=0)return 0;if(e.hits>=e.allowance)return 0;e.hits++;e.hp=Math.max(0,e.hp-damage);e.hitUntil=this.time+.2;return damage;}
 stun(e){e.stunUntil=this.time+2.4;e.hits=0;e.allowance=2+Math.floor(this.random()*2);e.attack=null;e.nextAttack=e.stunUntil+1;}
 receive(attack,shield,armor){
  if(shield&&this.time>=this.playerStun){this.stamina=Math.max(0,this.stamina-attack.power);if(this.stamina>0)return 0;this.playerStun=this.time+1.2;}
  return Math.max(3,Math.round(attack.power*.52-armor*.55));
 }
}
