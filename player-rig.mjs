import { Vector3, Quaternion, Euler } from './vendor/three.module.js';
import { HERO_ACTIONS } from './core.mjs';
import { equipmentArt } from './fps-player.mjs';

export const ARM_LENGTHS={upper:.34,forearm:.33};
export const RIGHT_WRIST=new Vector3(.031,-.063,.025);
export const LEFT_WRIST=new Vector3(-.031,-.063,.025);
export const SUPPORT_GRIP=new Vector3(0,-.125,0);
const yAxis=new Vector3(0,1,0);
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const v=a=>new Vector3(...a);
const q=a=>new Quaternion().setFromEuler(new Euler(...a,'YXZ'));
const key=(position,rotation,torso=[0,0,0])=>({position,rotation,torso});
const ready=key([.145,-.255,-.62],[-.35,-.12,.18]);
const twoReady=key([.095,-.255,-.64],[-.25,-.08,.1]);
// Positions describe a complete cut through space: chamber, acceleration,
// contact (110 ms), follow-through and recovery. The shoulder girdle turns too.
export const STRIKE_KEYS={
 right:[ready,key([-.115,-.24,-.52],[-.45,-.25,1.05],[0,-.16,.055]),key([.07,-.16,-.65],[-.55,.15,-.3],[0,.05,-.015]),key([.26,-.28,-.52],[-.6,.35,-1.15],[0,.17,-.055]),ready],
 left:[ready,key([.29,-.22,-.49],[-.35,.35,-1.05],[0,.14,-.05]),key([.03,-.16,-.66],[-.55,-.1,.35],[0,-.03,.01]),key([-.12,-.27,-.53],[-.55,-.3,1.2],[0,-.17,.055]),ready],
 up:[ready,key([.105,-.405,-.57],[-1.9,.05,-.1],[.05,0,.03]),key([.08,-.22,-.68],[-.7,.05,.05],[-.025,0,0]),key([.14,-.075,-.59],[-.1,.03,.05],[-.075,0,-.025]),ready],
 down:[ready,key([.09,-.07,-.52],[.2,-.08,.1],[-.065,-.07,.025]),key([.085,-.23,-.66],[-.95,.03,-.07],[.015,.03,-.01]),key([.18,-.39,-.56],[-1.95,.12,-.17],[.065,.075,-.02]),ready]
};
const times=[0,48,110,185,300];
function interpolate(a,b,t){t=ease(t);return {position:v(a.position).lerp(v(b.position),t),quaternion:q(a.rotation).slerp(q(b.rotation),t),torso:q(a.torso).slerp(q(b.torso),t)};}
function track(keys,elapsed){
 const i=Math.max(0,times.findLastIndex(t=>elapsed>=t));if(i===keys.length-1)return interpolate(keys[i],keys[i],0);
 const t=(elapsed-times[i])/(times[i+1]-times[i]),dt=times[i+1]-times[i],t2=t*t,t3=t2*t;
 const curve=values=>{
  const tangent=k=>k===0||k===values.length-1?0:(values[k+1]-values[k-1])/(times[k+1]-times[k-1]);
  return (2*t3-3*t2+1)*values[i]+(t3-2*t2+t)*dt*tangent(i)+(-2*t3+3*t2)*values[i+1]+(t3-t2)*dt*tangent(i+1);
 };
 const rotation=field=>{
  const rotations=keys.map(k=>q(k[field]));
  for(let k=1;k<rotations.length;k++)if(rotations[k-1].dot(rotations[k])<0)rotations[k].set(...rotations[k].toArray().map(v=>-v));
  return new Quaternion(...['x','y','z','w'].map(component=>curve(rotations.map(r=>r[component])))).normalize();
 };
 // Non-uniform cubic tangents keep velocity through contact; only the chamber
 // and final recovery settle. Gameplay's hitstop still freezes the actual hit.
 return {position:new Vector3(...[0,1,2].map(component=>curve(keys.map(k=>k.position[component])))),quaternion:rotation('rotation'),torso:rotation('torso')};
}
export function gripPoint(transform,offset=new Vector3()){return offset.clone().applyQuaternion(transform.quaternion).add(transform.position);}

// Two-bone analytic IK: fixed bone lengths with a moving elbow pole. No arm
// scaling, straight-line elbow approximation or detached weapon overlays.
export function solveArm(shoulder,target,pole){
 const {upper:a,forearm:b}=ARM_LENGTHS;
 const delta=target.clone().sub(shoulder),requested=delta.length();
 const distance=Math.max(.04,Math.min(a+b-.00001,requested)),axis=delta.clone().normalize();
 const bend=pole.clone().sub(shoulder);bend.addScaledVector(axis,-bend.dot(axis));
 if(bend.lengthSq()<1e-8)bend.set(1,0,0).addScaledVector(axis,-axis.x);bend.normalize();
 const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
 const elbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height);
 const wrist=shoulder.clone().addScaledVector(axis,distance);
 const upperQuaternion=new Quaternion().setFromUnitVectors(yAxis,elbow.clone().sub(shoulder).normalize());
 const forearmQuaternion=new Quaternion().setFromUnitVectors(yAxis,wrist.clone().sub(elbow).normalize());
 return {shoulder,elbow,wrist,upperQuaternion,forearmQuaternion,reachable:requested<a+b,reachError:wrist.distanceTo(target)};
}
export function samplePlayerRig({save,action='idle',dir='right',elapsed=0,reducedMotion=false}){
 elapsed=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
 const art=equipmentArt(save),base=art.twoHanded?twoReady:ready;
 let grip=interpolate(base,base,0),off=interpolate(key([-.145,-.26,-.64],[-.12,-.12,.12]),key([-.145,-.26,-.64],[-.12,-.12,.12]),0),alpha=1,magic=0;
 const duration=HERO_ACTIONS[action]?.duration||360,pulse=Math.sin(clamp(elapsed/duration)*Math.PI);
 if(action==='slash'&&elapsed<300){const keys=(STRIKE_KEYS[dir]||STRIKE_KEYS.right).map((k,i)=>i===0||i===4?base:k);grip=track(keys,elapsed);off.position.x+=Math.sin(elapsed/300*Math.PI)*.035;off.position.z-=Math.sin(elapsed/300*Math.PI)*.025;}
 else if(action==='guard'||action==='block'){
  grip=interpolate(base,key([.2,-.245,-.56],[-.15,.15,-.5]),1);
  off=interpolate(key([-.16,-.14,-.58],[.08,-.2,.1]),key([-.16,-.14,-.58],[.08,-.2,.1]),0);
  if(action==='block'&&elapsed<360){off.position.z+=pulse*.075;off.position.y-=pulse*.035;off.quaternion.multiply(q([pulse*.14,0,pulse*.08]));grip.torso=q([pulse*.045,0,0]);}
 }else if(action==='parry'&&elapsed<360){grip=interpolate(base,key([.025,-.13,-.6],[-.25,.22,-.95],[0,.08,-.04]),pulse);off.position.z-=pulse*.04;}
 else if(['cast','heal','ward'].includes(action)&&elapsed<duration){grip=interpolate(base,key([.11,-.22,-.64],[-.13,.15,.04],[-.025,0,0]),pulse);off.position.lerp(v([-.12,-.21,-.61]),pulse);magic=pulse;}
 else if(action==='hurt'&&elapsed<360){grip.position.y-=pulse*.075;grip.position.z+=pulse*.04;grip.torso=q([pulse*.08,pulse*.04,0]);off.position.y-=pulse*.05;}
 else if(action==='stun'){grip.position.y-=.055;off.position.y-=.05;if(!reducedMotion)grip.quaternion.multiply(q([0,Math.sin(elapsed/70)*.025,0]));}
 else if(action==='dodge'&&elapsed<320){const sign=dir==='left'?-1:1;grip.position.x+=sign*pulse*.055;off.position.x+=sign*pulse*.055;grip.position.y-=pulse*.035;grip.torso=q([0,-sign*pulse*.07,-sign*pulse*.12]);}
 else if(action==='victory'&&elapsed<1100)grip=interpolate(base,key([.14,-.11,-.56],[.05,.1,-.12],[-.035,0,0]),pulse);
 else if(action==='death'){const fall=ease(elapsed/1000);grip.position.y-=fall*.22;off.position.y-=fall*.22;grip.torso=q([fall*.2,0,fall*.12]);alpha=1-fall;}
 if(!reducedMotion&&['idle','walk'].includes(action)){const bob=Math.sin(elapsed/(action==='walk'?120:650))*(action==='walk'?.007:.002);grip.position.y+=bob;off.position.y+=bob;}
 const torso={position:new Vector3(0,-.43,.045),quaternion:grip.torso};
 const shoulder=side=>v([side==='right'?.275:-.275,.1,-.225]).applyQuaternion(torso.quaternion).add(torso.position);
 const rightTarget=gripPoint(grip,RIGHT_WRIST);
 const leftGrip=art.twoHanded?{position:gripPoint(grip,SUPPORT_GRIP),quaternion:grip.quaternion}:off;
 const leftTarget=gripPoint(leftGrip,LEFT_WRIST);
 const right=solveArm(shoulder('right'),rightTarget,gripPoint(torso,v([.49,-.21,-.12])));
 const left=solveArm(shoulder('left'),leftTarget,gripPoint(torso,v([-.49,-.2,-.12])));
 // The authored paths stay reachable. IK also safely constrains terminal falls.
 // Equipment follows the actual wrist, so there is never a separated grip.
 grip.position.copy(right.wrist).sub(RIGHT_WRIST.clone().applyQuaternion(grip.quaternion));
 if(art.twoHanded){leftGrip.position.copy(gripPoint(grip,SUPPORT_GRIP));}
 else off.position.copy(left.wrist).sub(LEFT_WRIST.clone().applyQuaternion(off.quaternion));
 return {art,action,grip,off,torso,right,left,leftGrip,alpha,magic,contact:action==='slash'&&elapsed===110};
}
