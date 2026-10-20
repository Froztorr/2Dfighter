export const POSE_KEY='emberblade-poses-v1';
const families=['staff','greatsword','greataxe','mixed','swords','dual','shield','single'];
export const POSE_LIMITS={
 right:[[-.65,.65],[.65,1.7],[-.35,.6]],left:[[-.65,.65],[.65,1.7],[-.35,.6]],
 rightFoot:[[-.38,.38],[.08,.25],[-.32,.32]],leftFoot:[[-.38,.38],[.08,.25],[-.32,.32]],
 rightPole:[[-.7,.7],[.8,1.65],[-.4,.5]],leftPole:[[-.7,.7],[.8,1.65],[-.4,.5]],
 rotation:[[-Math.PI,Math.PI],[-Math.PI,Math.PI],[-Math.PI,Math.PI]],leftRotation:[[-Math.PI,Math.PI],[-Math.PI,Math.PI],[-Math.PI,Math.PI]],
 hips:[[-.12,.12],[-.1,.06],[-.1,.1]],body:[[-.3,.3],[-.35,.35],[-.25,.25]],twist:[-.6,.6],lower:[0,.15]
};
export function cleanPose(value){
 const result={};if(!value||typeof value!=='object')return result;
 for(const [key,bounds]of Object.entries(POSE_LIMITS)){
  const v=value[key],vector=Array.isArray(bounds[0]);
  if(vector?(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)):!Number.isFinite(v))continue;
  const clamp=(n,b)=>Math.max(b[0],Math.min(b[1],n));
  result[key]=vector?v.map((n,i)=>clamp(n,bounds[i])):clamp(v,bounds);
 }
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
