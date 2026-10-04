import { solveArm } from './core.mjs';
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const point=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
export const ARM_LENGTHS={upper:.145,lower:.145};
export function characterRig({action='idle',dir='right',elapsed=0,twoHanded=false,width=112,height=149,from=null,blend=1}){
  const w=width,h=height,upper=h*ARM_LENGTHS.upper,lower=h*ARM_LENGTHS.lower;
  const shoulders={main:{x:w*.185,y:-h*.20},off:{x:-w*.185,y:-h*.20}};
  const rest=twoHanded?{x:w*.12,y:-h*.005}:{x:w*.29,y:h*.055};
  const offRest={x:-w*.29,y:h*.055};
  const restAngle=twoHanded?-.28:-.65;
  let hand={...rest},offHand={...offRest},weaponAngle=restAngle;
  if(action==='slash'&&elapsed>=0&&elapsed<300){
    const contacts={right:{x:w*.40,y:-h*.23},left:{x:-w*.24,y:-h*.03},up:{x:w*.13,y:-h*.45},down:{x:w*.20,y:h*.09}};
    const winds={right:{x:-w*.07,y:-h*.12},left:{x:w*.37,y:-h*.22},up:{x:w*.18,y:h*.06},down:{x:w*.18,y:-h*.43}};
    const end=contacts[dir]||contacts.right,start=winds[dir]||winds.right;
    const angles={right:.9,left:-2.25,up:-.65,down:2.5},windAngles={right:-1.7,left:.8,up:1.7,down:-.65};
    if(elapsed<60){const t=ease(elapsed/60);hand=point(rest,start,t);weaponAngle=lerp(restAngle,windAngles[dir],t);}
    else if(elapsed<110){const t=ease((elapsed-60)/50);hand=point(start,end,t);weaponAngle=lerp(windAngles[dir],angles[dir],t);}
    else if(elapsed<155){hand=end;weaponAngle=angles[dir];}
    else {const t=ease((elapsed-155)/145);hand=point(end,rest,t);weaponAngle=lerp(angles[dir],restAngle,t);}
  }else if(['guard','block','ward'].includes(action)){
    const recoil=action==='block'?Math.sin(Math.PI*Math.min(1,elapsed/360)):0;
    hand={x:w*(.24-recoil*.045),y:-h*(.12+recoil*.035)};
    offHand={x:-w*.19,y:-h*(.16+recoil*.045)};weaponAngle=-.95-recoil*.12;
  }else if(action==='parry'&&elapsed<360){
    const weight=Math.sin(Math.PI*ease(elapsed/360));hand=point(rest,{x:w*.28,y:-h*.28},weight);offHand=point(offRest,{x:-w*.21,y:-h*.12},weight);weaponAngle=lerp(restAngle,-1.45,weight);
  }else if(action==='cast'&&elapsed<520){
    const weight=Math.sin(Math.PI*ease(elapsed/520));hand=point(rest,{x:w*.22,y:-h*.38},weight);offHand=point(offRest,{x:-w*.26,y:-h*.32},weight);weaponAngle=lerp(restAngle,-.75,weight);
  }else if(action==='dodge'&&elapsed<320){
    const weight=Math.sin(Math.PI*ease(elapsed/320));hand=point(rest,{x:w*.22,y:-h*.14},weight);offHand=point(offRest,{x:-w*.21,y:-h*.15},weight);weaponAngle=lerp(restAngle,-1.25,weight);
  }else if(action==='hurt'&&elapsed<360){
    const weight=Math.sin(Math.PI*ease(elapsed/360));hand=point(rest,{x:w*.37,y:-h*.08},weight);offHand=point(offRest,{x:-w*.36,y:-h*.03},weight);weaponAngle=lerp(restAngle,.22,weight);
  }else if(action==='stun'){
    hand={x:w*.25,y:h*.10};offHand={x:-w*.25,y:h*.10};weaponAngle=.65+Math.sin(elapsed/190)*.04;
  }else if(action==='death'){
    const weight=ease(elapsed/300);hand=point(rest,{x:w*.25,y:h*.07},weight);offHand=point(offRest,{x:-w*.30,y:h*.07},weight);weaponAngle=lerp(restAngle,-.45,weight);
  }else if(action==='heal'&&elapsed<700){
    const weight=Math.sin(Math.PI*ease(elapsed/700));hand=point(rest,{x:w*.14,y:-h*.04},weight);offHand=point(offRest,{x:-w*.07,y:-h*.13},weight);weaponAngle=lerp(restAngle,-.4,weight);
  }else if(action==='victory'&&elapsed<1100){
    const weight=ease(elapsed/240)*(1-ease((elapsed-850)/250));hand=point(rest,{x:w*.20,y:-h*.44},weight);offHand=point(offRest,{x:-w*.28,y:-h*.26},weight);weaponAngle=lerp(restAngle,-.65,weight);
  }
  if(from&&blend<1){
    hand=point(from.main.hand,hand,blend);offHand=point(from.off.hand,offHand,blend);
    const delta=Math.atan2(Math.sin(weaponAngle-from.weaponAngle),Math.cos(weaponAngle-from.weaponAngle));
    weaponAngle=from.weaponAngle+delta*blend;
  }
  if(twoHanded){
    const shaftAngle=weaponAngle+.65,separation=h*.075;
    const offset={x:Math.sin(shaftAngle)*separation,y:-Math.cos(shaftAngle)*separation};
    const reach=upper+lower-h*.008,minReach=h*.105;
    // The second hand is ABOVE the dominant hand, with a full fist's separation.
    // Project the shared handle into both reachable disks; no stretched limbs.
    for(let i=0;i<24;i++)for(const [shoulder,shift] of [[shoulders.off,offset],[shoulders.main,{x:0,y:0}]]){
      const dx=hand.x+shift.x-shoulder.x,dy=hand.y+shift.y-shoulder.y,d=Math.hypot(dx,dy);
      if(d>reach||d<minReach){const bound=d>reach?reach:minReach,safe=d||1;hand={x:shoulder.x+dx*bound/safe-shift.x,y:shoulder.y+(dy||(!d?1:0))*bound/safe-shift.y};}
    }
    offHand={x:hand.x+offset.x,y:hand.y+offset.y};
  }
  if(!twoHanded){
    const clamp=(target,shoulder)=>{const dx=target.x-shoulder.x,dy=target.y-shoulder.y,d=Math.hypot(dx,dy),reach=Math.max(h*.105,Math.min(upper+lower-h*.008,d));return {x:shoulder.x+dx*reach/(d||1),y:shoulder.y+(dy||(!d?1:0))*reach/(d||1)};};
    hand=clamp(hand,shoulders.main);offHand=clamp(offHand,shoulders.off);
  }
  const main=solveArm(shoulders.main,hand,upper,lower,1),off=solveArm(shoulders.off,offHand,upper,lower,-1);
  return {main,off,shoulders,upper,lower,weaponAngle,twoHanded};
}
