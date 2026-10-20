export const POSE_KEY='emberblade-poses-v1';
const families=['staff','greatsword','greataxe','mixed','swords','dual','shield','single'];
export const POSE_LIMITS={
 right:[[-.65,.65],[.65,1.7],[-.35,.6]],left:[[-.65,.65],[.65,1.7],[-.35,.6]],
 rightFoot:[[-.38,.38],[.08,.25],[-.32,.32]],leftFoot:[[-.38,.38],[.08,.25],[-.32,.32]],
 rightPole:[[-.7,.7],[.8,1.65],[-.4,.5]],leftPole:[[-.7,.7],[.8,1.65],[-.4,.5]],
 rotation:[[-Math.PI,Math.PI],[-Math.PI,Math.PI],[-Math.PI,Math.PI]],leftRotation:[[-Math.PI,Math.PI],[-Math.PI,Math.PI],[-Math.PI,Math.PI]],
 hips:[[-.12,.12],[-.1,.06],[-.1,.1]],torso:[[-.08,.08],[-.06,.06],[-.08,.08]],
 body:[[-.6,.6],[-.6,.6],[-.5,.5]],hipRotation:[[-.5,.5],[-.6,.6],[-.4,.4]],neckRotation:[[-.6,.6],[-1,1],[-.5,.5]],
 ...Object.fromEntries(['right','left'].flatMap(side=>[
  [side+'Shoulder',[[-1.3,1.3],[-1,1],[-1.3,1.3]]],
  [side+'Elbow',[[-1.2,1.2],[-.5,.5],[-.4,.4]]],
  [side+'Knee',[[-1.2,1.2],[-.15,.15],[-.2,.2]]],
  [side+'Wrist',[[-Math.PI,Math.PI],[-Math.PI,Math.PI],[-Math.PI,Math.PI]]]
 ])),twist:[-.6,.6],lower:[0,.15]
};
export function cleanPose(value,includeAttack=true){
 const result={};if(!value||typeof value!=='object')return result;
 for(const [key,bounds]of Object.entries(POSE_LIMITS)){
  const v=value[key],vector=Array.isArray(bounds[0]);
  if(vector?(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)):!Number.isFinite(v))continue;
  const clamp=(n,b)=>Math.max(b[0],Math.min(b[1],n));
  result[key]=vector?v.map((n,i)=>clamp(n,bounds[i])):clamp(v,bounds);
 }
 if(includeAttack&&value.attack){const attack=cleanPose(value.attack,false);if(Object.keys(attack).length)result.attack=attack;}
 return result;
}
export function readPoses(storage){
 try{const raw=JSON.parse(storage.getItem(POSE_KEY)),result={};for(const family of families)if(raw?.[family])result[family]=cleanPose(raw[family]);return result;}catch{return {};}
}
export function writePose(storage,family,value){
 if(!families.includes(family))throw Error('Unknown posture');
 const poses=readPoses(storage);if(value===null)delete poses[family];else poses[family]=cleanPose(value);
 storage.setItem(POSE_KEY,JSON.stringify(poses));
}
export function exportPoses(storage){
 return JSON.stringify({format:'emberblade-poses',version:1,angleUnit:'radians',poses:readPoses(storage)},null,2);
}
