import { ITEMS, HERO_ACTIONS } from './core.mjs';
import { equipmentArt } from './fps-player.mjs';

const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const blend=(a,b,t)=>a.map((v,i)=>mix(v,b[i],smooth(t)));
const rest=[181,321,.28];
// Wrist x/y and grip angle. The contact key is shared with gameplay's 110 ms hit.
export const STRIKE_KEYS={
 right:[[195,337,.85],[218,312,1.35],[126,270,-.85],[73,304,-1.35],rest],
 left:[[151,334,-.7],[99,302,-1.35],[149,270,.85],[211,307,1.4],rest],
 up:[[179,346,.1],[157,366,-.15],[137,255,.05],[146,249,.15],rest],
 down:[[186,314,.35],[152,244,.12],[143,309,-.12],[147,357,-.28],rest]
};
const strikeTimes=[0,55,110,175,300];
function keyed(keys,times,elapsed){
 const i=Math.max(0,times.findLastIndex(t=>elapsed>=t));
 return i>=keys.length-1?keys.at(-1):blend(keys[i],keys[i+1],(elapsed-times[i])/(times[i+1]-times[i]));
}
export function gripPoint(grip,x=0,y=0){
 return {x:grip[0]+Math.cos(grip[2])*x-Math.sin(grip[2])*y,y:grip[1]+Math.sin(grip[2])*x+Math.cos(grip[2])*y};
}
function arm(side,wrist,angle){
 const shoulder={x:side==='right'?259:-19,y:442};
 const elbow={x:mix(shoulder.x,wrist.x,.48)+(side==='right'?9:-9),y:mix(shoulder.y,wrist.y,.48)+10};
 return {shoulder,elbow,wrist,angle};
}
export function samplePlayerRig({save,action='idle',dir='right',elapsed=0,reducedMotion=false}){
 elapsed=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
 const art=equipmentArt(save),duration=HERO_ACTIONS[action]?.duration||360;
 const bob=reducedMotion?0:Math.sin(elapsed/(action==='walk'?90:430))*(action==='walk'?3:1.1);
 let grip=[rest[0],rest[1]+bob,rest[2]],off=[54,328+ bob,-.12],alpha=1,magic=0;
 const pulse=Math.sin(Math.min(1,elapsed/duration)*Math.PI);
 if(action==='slash'&&elapsed<300)grip=keyed(STRIKE_KEYS[dir]||STRIKE_KEYS.right,strikeTimes,elapsed);
 else if(action==='guard'||action==='block'){
  grip=[176,308,.38];off=[84,278,-.2];
  if(action==='block'&&elapsed<360){const recoil=Math.sin(Math.min(1,elapsed/360)*Math.PI);off[1]+=recoil*17;off[2]+=recoil*.2;grip[1]+=recoil*8;}
 }else if(action==='parry'&&elapsed<360){grip=blend(rest,[124,274,1.15],pulse);off=blend(off,[89,296,-.5],pulse);}
 else if(['cast','heal','ward'].includes(action)&&elapsed<duration){grip=blend(rest,[158,287,-.15],pulse);off=blend(off,[80,298,.2],pulse);magic=pulse;}
 else if(action==='hurt'&&elapsed<360){grip[0]+=pulse*14;grip[1]+=pulse*22;grip[2]+=pulse*.22;off[1]+=pulse*17;}
 else if(action==='stun'){grip[1]+=23;off[1]+=25;if(!reducedMotion)grip[2]+=Math.sin(elapsed/60)*.06;}
 else if(action==='dodge'&&elapsed<320){const sign=dir==='left'?-1:1;grip[0]+=sign*pulse*32;off[0]+=sign*pulse*32;grip[1]+=pulse*28;off[1]+=pulse*28;}
 else if(action==='victory'&&elapsed<1100){grip=blend(rest,[169,261,-.13],pulse);}
 else if(action==='death'){const fall=smooth(elapsed/1000);grip[1]+=fall*190;grip[2]+=fall*.8;off[1]+=fall*190;alpha=1-fall;}
 const right=arm('right',gripPoint(grip),grip[2]);
 // Support hand is a child of the SAME weapon grip, never an independent pose.
 const left=art.twoHanded?arm('left',gripPoint(grip,0,25),grip[2]):arm('left',gripPoint(off),off[2]);
 return {art,action,grip,off,right,left,alpha,magic,contact:action==='slash'&&elapsed===110};
}
const outline='#14141d';
function polygon(c,points,color,edge=true){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();c.strokeStyle=outline;c.lineWidth=1.5;if(edge)c.stroke();}
function line(c,a,b,width,color){c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
function local(c,wrist,angle,draw){c.save();c.translate(wrist.x,wrist.y);c.rotate(angle);draw();c.restore();}
function palette(art){
 const base=[['#997862','#d2ad87'],['#515e73','#adbccc'],['#354c40','#718569'],['#494273','#9d8ac5']][art.look];
 const colors={look:art.look,base:base[0],light:base[1],glove:art.look===1?'#74859b':art.look===0?'#c99572':'#5b4140'};
 if(art.armorHue){
  const a=art.armorHue*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
  const m=[[.213+.787*cs-.213*sn,.715-.715*cs-.715*sn,.072-.072*cs+.928*sn],[.213-.213*cs+.143*sn,.715+.285*cs+.140*sn,.072-.072*cs-.283*sn],[.213-.213*cs-.787*sn,.715-.715*cs+.715*sn,.072+.928*cs+.072*sn]];
  for(const key of ['base','light','glove']){const n=parseInt(colors[key].slice(1),16),rgb=[n>>16,(n>>8)&255,n&255];colors[key]='#'+m.map(row=>Math.max(0,Math.min(255,Math.round(row.reduce((sum,v,i)=>sum+v*rgb[i],0)))).toString(16).padStart(2,'0')).join('');}
 }
 return colors;
}
function tone(hex,factor){const n=parseInt(hex.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.min(255,Math.round(v*factor)).toString(16).padStart(2,'0')).join('');}
function limb(c,a,b,wa,wb,colors){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
 const at=(p,w,t)=>[p.x+nx*w*t,p.y+ny*w*t];
 polygon(c,[at(a,wa,-1),at(b,wb,-1),at(b,wb,1),at(a,wa,1)],tone(colors.base,.55));
 const bands=[[-1,-.63,colors.base],[-.63,-.25,colors.light],[-.25,.25,colors.base],[.25,.68,tone(colors.base,.78)]];
 for(const [lo,hi,color]of bands)polygon(c,[at(a,wa,lo),at(b,wb,lo),at(b,wb,hi),at(a,wa,hi)],color,false);
 // Segmented vambrace plates / stitched cloth folds track the forearm axis.
 for(let i=1;i<5;i++){
  const t=i/5,p={x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)},w=mix(wa,wb,t);
  line(c,{x:p.x+nx*w*.85,y:p.y+ny*w*.85},{x:p.x-nx*w*.85,y:p.y-ny*w*.85},colors.look===1?2:1,tone(colors.base,.55));
  if(colors.look===1)line(c,{x:p.x-nx*w*.7,y:p.y-ny*w*.7+2},{x:p.x+nx*w*.4,y:p.y+ny*w*.4+2},1,colors.light);
 }
}
function drawArm(c,bone,colors){
 limb(c,bone.shoulder,bone.elbow,21,15,colors);limb(c,bone.elbow,bone.wrist,15,11,colors);
 local(c,bone.wrist,bone.angle,()=>{
  polygon(c,[[-15,13],[13,13],[15,29],[-14,29]],colors.base);
  polygon(c,[[-14,14],[-3,14],[-3,28],[-13,28]],colors.light,false);
  polygon(c,[[9,14],[13,14],[14,28],[9,28]],tone(colors.base,.6),false);
  polygon(c,[[-12,-7],[10,-10],[14,7],[8,17],[-9,14],[-15,4]],tone(colors.glove,.7));
  polygon(c,[[-11,-6],[-2,-9],[7,-7],[9,2],[4,9],[-8,7]],colors.glove,false);
  if(colors.look===1){
   polygon(c,[[-11,-5],[-2,-8],[8,-6],[10,3],[5,9],[-8,7]],colors.light);
   polygon(c,[[-10,-4],[-2,-7],[1,-5],[-1,4],[-8,5]],tone(colors.light,1.3),false);
   for(const y of [17,22])line(c,{x:-11,y},{x:11,y},1.3,colors.base);
  }else if(colors.look===2){
   line(c,{x:-9,y:19},{x:10,y:19},3,'#b89560');c.fillStyle='#d5b578';c.fillRect(3,17,4,4);
  }else if(colors.look===3){polygon(c,[[-4,18],[0,14],[4,18],[0,24]],'#c8b4ef');}
 });
}
function fingers(c,bone,colors){
 local(c,bone.wrist,bone.angle,()=>{
  // Draw fingers after the handle: the grip is visibly wrapped around equipment.
  for(let i=0;i<3;i++){
   const color=colors.look===1?colors.light:colors.glove;
   polygon(c,[[-9,-5+i*5],[5,-5+i*5],[7,-2+i*5],[4,1+i*5],[-10,1+i*5]],tone(color,.85));
   line(c,{x:-7,y:-4+i*5},{x:3,y:-4+i*5},1.5,tone(color,1.25));
  }
  polygon(c,[[5,-11],[12,-7],[10,3],[5,5],[3,0]],colors.glove);
 });
}
export const WEAPON_STYLES={
 'rust-sword':{kind:'sword',length:104,color:'#bd9475'},'iron-sword':{kind:'sword',length:113,color:'#c8d8e0'},
 mace:{kind:'mace',length:87,color:'#a9aeba'},axe:{kind:'axe',length:94,color:'#b8c7ce'},
 greatsword:{kind:'sword',length:148,color:'#efcf88',wide:true},'ember-staff':{kind:'staff',length:147,color:'#ffae55'},
 'parry-dagger':{kind:'dagger',length:61,color:'#b8cad7'},'venom-dagger':{kind:'dagger',length:68,color:'#98c77c'},
 'fire-wand':{kind:'staff',length:98,color:'#ff7955'},'ice-staff':{kind:'staff',length:145,color:'#90e4f4'},
 'frost-sword':{kind:'sword',length:125,color:'#96dfed'},'spider-fang':{kind:'dagger',length:82,color:'#acd777',hook:true},
 'spider-claw':{kind:'dagger',length:74,color:'#a6c982',hook:true},'assassin-dagger':{kind:'dagger',length:70,color:'#a3a4d1',hook:true},
 'inferno-axe':{kind:'axe',length:134,color:'#f39456',wide:true},'demon-staff':{kind:'staff',length:155,color:'#ed6d79'}
};
function weapon(c,id,grip){
 const style=WEAPON_STYLES[id];if(!style)return;
 local(c,gripPoint(grip),grip[2],()=>{
  const {kind,length:l,color,wide,hook}=style;
  polygon(c,[[-4,37],[4,37],[4,-l],[-4,-l]],kind==='staff'?'#725344':'#675046');
  for(let y=-12;y<35;y+=6){c.fillStyle='#b38c60';c.fillRect(-3,y,6,2);}
  if(kind==='sword'||kind==='dagger'){
   const w=wide?13:kind==='dagger'?7:9,tip=hook?13:0;
   polygon(c,[[-w,-22],[-w,-l+20],[tip,-l],[w,-l+22],[w,-22]],color);
   polygon(c,[[-w+1,-24],[-w+1,-l+21],[tip,-l+3],[-2,-l+19],[-2,-24]],tone(color,1.22),false);
   polygon(c,[[1,-24],[tip,-l+3],[w-1,-l+23],[w-1,-24]],tone(color,.62),false);
   line(c,{x:-1,y:-28},{x:tip,y:-l+8},1,tone(color,1.35));
   if(id==='rust-sword')for(let i=0;i<8;i++){c.fillStyle=i%2?'#714d3f':'#8e6349';c.fillRect(-w+2+(i*3)%8,-35-i*8,2+i%3,3);}
   if(['frost-sword','spider-fang','venom-dagger'].includes(id))for(let i=0;i<4;i++){c.fillStyle=tone(color,1.35);c.fillRect(-3,-36-i*14,3,3);}
   polygon(c,[[-21,-24],[21,-24],[19,-18],[-19,-18]],'#b99658');
   line(c,{x:-18,y:-23},{x:18,y:-23},2,'#ecd5a0');
   polygon(c,[[-19,-20],[19,-20],[18,-18],[-18,-18]],'#705536',false);
  }else if(kind==='axe'){
   polygon(c,[[-5,-l+10],[25,-l-4],[39,-l+6],[34,-l+36],[8,-l+28],[-5,-l+28]],color);
   polygon(c,[[4,-l+11],[24,-l+2],[29,-l+9],[24,-l+27],[8,-l+24]],tone(color,.65),false);
   polygon(c,[[30,-l+2],[39,-l+6],[34,-l+36],[27,-l+28]],'#fff0bd');
   if(wide)polygon(c,[[-5,-l+9],[-23,-l],[-34,-l+11],[-29,-l+34],[-5,-l+28]],color);
  }else if(kind==='mace'){
   polygon(c,[[-8,-l-6],[8,-l-6],[17,-l+6],[12,-l+27],[-12,-l+27],[-17,-l+6]],color);
   for(const x of [-8,0,8])line(c,{x,y:-l},{x,y:-l+20},3,'#e8ebec');
  }else{
   polygon(c,[[-5,-l+14],[-15,-l],[-10,-l-21],[0,-l-31],[10,-l-21],[15,-l],[5,-l+14]],'#ae9764');
   polygon(c,[[0,-l-25],[9,-l-11],[0,-l+3],[-9,-l-11]],color);
   polygon(c,[[0,-l-25],[1,-l-11],[0,-l+3],[-9,-l-11]],tone(color,.65),false);
   polygon(c,[[0,-l-25],[9,-l-11],[1,-l-12]],tone(color,1.4),false);
   line(c,{x:-2,y:25},{x:-2,y:-l+13},1,'#b28b61');
   for(let y=-l+18;y<-20;y+=22)polygon(c,[[-6,y],[6,y],[6,y+5],[-6,y+5]],'#baa374');
   c.fillStyle='#fff1d0';c.beginPath();c.arc(-2,-l-13,3,0,Math.PI*2);c.fill();
  }
  polygon(c,[[-6,32],[6,32],[7,40],[-7,40]],'#b99658');
 });
}
function shield(c,id,grip){
 const color={'wood-shield':'#8d6845','steel-shield':'#8694a4','guardian-shield':'#c6a468','frost-shield':'#8ac8dc'}[id];
 local(c,gripPoint(grip),grip[2],()=>{
  polygon(c,[[-35,-43],[0,-54],[35,-43],[33,18],[22,42],[0,55],[-22,42],[-33,18]],color);
  polygon(c,[[-28,-37],[0,-45],[28,-37],[26,15],[17,35],[0,46],[-17,35],[-26,15]],'#3a3031');
  for(let i=0;i<5;i++){
   const x=-24+i*10;
   polygon(c,[[x,-35],[x+8,-38],[x+8,29],[x,33]],['#594434','#6e5139','#503d30','#76583d','#48392e'][i],false);
   for(let j=0;j<4;j++)line(c,{x:x+2+(j%2),y:-27+j*13},{x:x+3,y:-18+j*13},1,'#9b7951');
  }
  polygon(c,[[-35,-43],[0,-54],[35,-43],[30,-40],[0,-49],[-30,-39]],tone(color,1.35),false);
  polygon(c,[[30,-40],[35,-43],[33,18],[22,42],[0,55],[0,49],[18,37],[27,15]],tone(color,.58),false);
  for(const [x,y]of [[-30,-36],[30,-36],[-26,17],[26,17],[0,49]]){c.fillStyle='#d5c5a1';c.fillRect(x-1,y-1,2,2);}
  for(const x of [-18,0,18])line(c,{x,y:-34},{x,y:31},2,'#65514b');
  for(const y of [-24,21]){
   polygon(c,[[-29,y-4],[29,y-4],[29,y+4],[-29,y+4]],'#937b61');
   line(c,{x:-27,y:y-3},{x:27,y:y-3},1,'#d0b68a');
   line(c,{x:-27,y:y+3},{x:27,y:y+3},2,'#514030');
  }
  polygon(c,[[-15,-12],[-7,-12],[-7,15],[-15,15]],'#c5a27b');
  polygon(c,[[11,-16],[21,-13],[21,18],[11,20]],'#65514b');
 });
}
export function drawPlayerRig(c,pose){
 c.clearRect(0,0,240,400);c.save();c.globalAlpha=pose.alpha;
 const colors=palette(pose.art);
 // Apply material hue only to the sleeves, never to steel, gems or skin.
 drawArm(c,pose.left,colors);drawArm(c,pose.right,colors);
 if(pose.art.offhand&&ITEMS[pose.art.offhand]?.shield)shield(c,pose.art.offhand,pose.off);
 else if(pose.art.offhand)weapon(c,pose.art.offhand,pose.off);
 weapon(c,pose.art.weapon,pose.grip);
 fingers(c,pose.left,colors);fingers(c,pose.right,colors);
 if(pose.magic){const p=pose.right.wrist;c.save();c.globalAlpha*=pose.magic;c.strokeStyle=pose.action==='heal'?'#9fffc3':'#d5b6ff';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y-30,22+pose.magic*8,0,Math.PI*2);c.stroke();c.restore();}
 c.restore();
}
