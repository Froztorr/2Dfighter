import * as THREE from './vendor/three.module.js';
import {ITEMS} from './core.mjs';
import {organicLimb,sculptedHand} from './player-sculpt.mjs';
import {solveArm} from './player-rig.mjs';
import {makeWeapon,makeShield,combatWebGLRenderer,WEAPON_STYLES} from './player-3d.mjs';
import {cleanPose,POSE_LIMITS} from './pose-settings.mjs';

const clamp=THREE.MathUtils.clamp;
// Palm targets are in body space; every garment follows the same solved skeleton.
export const STANCES={
 staff:{right:[-.48,1.29,.16],rotation:[.2,0,-2.5],left:[.33,1.03,.12],leftRotation:[.05,.10,-.10],feet:[.16,.08],hips:[.05,0,0],body:[.04,0,-.07],twist:-.12,lower:.02},
 greatsword:{right:[-.24,1.33,.22],rotation:[.25,-.2,.70],left:[.28,.97,.18],leftRotation:[0,0,-.20],feet:[.21,.10],hips:[-.04,0,0],body:[-.08,0,.08],twist:-.23,lower:.03},
 greataxe:{right:[-.12,1.12,.29],rotation:[.16,0,-.55],spread:-.125,feet:[.20,-.04],twist:.18,lower:.05},
 mixed:{right:[-.19,1.48,.13],rotation:[.08,-.18,1.65],left:[.25,1.00,.25],leftRotation:[.15,.1,1.7],feet:[.23,.17],hips:[.04,0,.02],body:[.10,0,-.07],twist:.34,lower:.09},
 swords:{right:[-.32,1.05,.22],rotation:[.5,0,.8],left:[.30,.92,.30],leftRotation:[.2,.1,2.25],feet:[.22,.13],hips:[-.04,0,0],body:[.08,0,.09],twist:-.22,lower:.05},
 dual:{right:[-.12,1.24,.38],rotation:[.05,-.1,-.9],left:[.35,1.18,.25],leftRotation:[.05,.1,-.12],feet:[.23,.17],hips:[.04,0,.03],body:[.14,0,-.06],twist:.35,lower:.09},
 shield:{right:[-.32,1.12,.20],rotation:[.25,0,.40],left:[.20,1.19,.35],leftRotation:[.08,-.25,-.12],feet:[.20,-.13],hips:[-.04,0,0],body:[.08,0,.06],twist:-.20,lower:.04},
 single:{right:[-.29,.98,.17],rotation:[.12,0,.45],left:[.28,.88,.08],leftRotation:[0,0,-.12],feet:[.12,-.03],twist:-.10,lower:.01}
};
export function stanceFor(equipment){
 const weapon=ITEMS[equipment.weapon],offhand=ITEMS[equipment.offhand],a=WEAPON_STYLES[equipment.weapon]?.kind==='sword',b=WEAPON_STYLES[equipment.offhand]?.kind==='sword';
 return weapon?.magic?'staff':weapon?.hands===2?(equipment.weapon==='inferno-axe'?'greataxe':'greatsword'):offhand?.shield?'shield':offhand&&weapon?(a&&b?'swords':a||b?'mixed':'dual'):'single';
}
export function blendPostures(a,b,weight){
 const result={...a},t=clamp(weight,0,1);
 for(const key of Object.keys(POSE_LIMITS)){
  if(b[key]===undefined)continue;
  const end=b[key],start=a[key]??(Array.isArray(end)?[0,0,0]:0);
  if(Array.isArray(end)){
   if(/rotation|Rotation|body|Shoulder|Elbow|Knee|Wrist/.test(key)){
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...start)).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(...end)),t),e=new THREE.Euler().setFromQuaternion(q);
    result[key]=[e.x,e.y,e.z];
   }else result[key]=end.map((v,i)=>start[i]+(v-start[i])*t);
  }else result[key]=start+(end-start)*t;
 }
 return result;
}
function mesh(parent,geometry,material,position=[0,0,0],scale=[1,1,1]){const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.scale.set(...scale);parent.add(object);return object;}
function oval(parent,radius,material,position,scale){return mesh(parent,new THREE.SphereGeometry(radius,32,20),material,position,scale);}
function band(parent,radius,material,position,scale=[1,1,1]){const object=mesh(parent,new THREE.TorusGeometry(radius,.004,8,40),material,position,scale);object.rotation.x=Math.PI/2;return object;}
function release(root,shared=new Set()){const geometry=new Set(),material=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])material.add(m);});for(const g of geometry)g.dispose();for(const m of material)if(!shared.has(m))m.dispose();root.removeFromParent();}
function tube(profile,flatten=.72){return organicLimb(1,profile,flatten);}
function planarUV(geometry){geometry.computeBoundingBox();const p=geometry.attributes.position,b=geometry.boundingBox,uv=[];for(let i=0;i<p.count;i++)uv.push((p.getX(i)-b.min.x)/(b.max.x-b.min.x),1-(p.getY(i)-b.min.y)/(b.max.y-b.min.y));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;}
function ribbon(points,radius,material,parent){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(parent,new THREE.TubeGeometry(curve,32,radius,6,false),material);}
function placeArm(root,arm,palm,worldQ,pole){
 const wrist=palm.clone().add(new THREE.Vector3(0,.055,-.014).applyQuaternion(worldQ)),shoulder=arm.shoulder.getWorldPosition(new THREE.Vector3());
 const solved=solveArm(shoulder,wrist,pole,{upper:.29,forearm:.255}),down=new THREE.Vector3(0,-1,0),upperQ=new THREE.Quaternion().setFromUnitVectors(down,solved.elbow.clone().sub(shoulder).normalize()),foreQ=new THREE.Quaternion().setFromUnitVectors(down,solved.wrist.clone().sub(solved.elbow).normalize());
 arm.shoulder.quaternion.copy(arm.shoulder.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(upperQ));arm.elbow.quaternion.copy(upperQ.clone().invert().multiply(foreQ));arm.wrist.quaternion.copy(foreQ.clone().invert().multiply(worldQ));arm.grip.rotation.set(0,0,0);root.updateMatrixWorld(true);
}

export class CharacterRig {
 constructor(sprites={}){
  this.root=new THREE.Group();this.bones={};this.equipment={};this.sprites=sprites;this.textures=new Map();
  const bone=(name,parent,x=0,y=0,z=0)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);this.bones[name]=b;return b;};
  const hips=bone('hips',this.root,0,.9),spine=bone('spine',hips,0,.14),chest=bone('chest',spine,0,.21),neck=bone('neck',chest,0,.20),head=bone('head',neck,0,.16);
  this.arms={};this.legs={};
  for(const [side,sign]of [['right',-1],['left',1]]){
   const shoulder=bone(side+'Shoulder',chest,sign*.205,.14),elbow=bone(side+'Elbow',shoulder,0,-.29),wrist=bone(side+'Wrist',elbow,0,-.255),grip=bone(side+'Grip',wrist,0,-.055,.014);
   this.arms[side]={shoulder,elbow,wrist,grip,sign};
   const hip=bone(side+'Hip',hips,sign*.097,-.02),knee=bone(side+'Knee',hip,0,-.41),ankle=bone(side+'Ankle',knee,0,-.39);this.legs[side]={hip,knee,ankle,sign};
  }
  const cape=bone('cape',chest,0,.10,-.13),capeMid=bone('capeMid',cape,0,-.5,-.025);bone('capeHem',capeMid,0,-.5,-.035);
  this.root.updateMatrixWorld(true);this.skeleton=new THREE.Skeleton(Object.values(this.bones));this.skeleton.calculateInverses();
  this.bindPositions=new Map(this.skeleton.bones.map(b=>[b,b.position.clone()]));
  this.base={};const baseMat=this.material('base',0x3e4854,'cloth'),bootMat=this.material(null,0x302923,'leather');
  this.mats={skin:this.material(null,0xb98c6c,'skin'),glove:this.material(null,0x493020,'leather'),hair:this.material(null,0x39291f,'hair'),gold:this.material(null,0x9d7b43,'gold'),dark:this.material(null,0x242327,'cloth')};
  this.base.torso=this.group('base-torso');this.torso(this.base.torso,baseMat);
  this.base.arms=this.group('base-arms');this.sleeves(this.base.arms,baseMat);
  this.base.pants=this.group('base-pants');this.trousers(this.base.pants,baseMat);
  this.base.boots=this.group('base-boots');this.boots(this.base.boots,bootMat,false);
  mesh(neck,new THREE.CylinderGeometry(.052,.064,.12,32),this.mats.skin,[0,.035,0]);
  this.hair=[oval(head,.11,this.mats.hair,[0,.005,-.009],[.92,1.27,.86])];
  oval(head,.105,this.mats.skin,[0,-.015,.025],[.89,1.18,.86]);
  const face=this.group('face-features',head);
  const eye=new THREE.MeshLambertMaterial({color:0x28252b}),lips=new THREE.MeshLambertMaterial({color:0x935b4c});
  for(const sign of [-1,1]){
   oval(head,.022,this.mats.skin,[sign*.102,-.005,0],[.55,1,.55]);
   oval(face,.012,eye,[sign*.037,.012,.115],[.72,.55,.35]);
   const brow=mesh(face,new THREE.BoxGeometry(.035,.007,.007),this.mats.hair,[sign*.036,.039,.111]);brow.rotation.z=sign*-.13;
   this.hair.push(oval(head,.042,this.mats.hair,[sign*.075,.075,.027],[.9,.8,1.2]));
  }
  oval(face,.016,this.mats.skin,[0,-.018,.123],[.55,1.2,.8]);
  mesh(face,new THREE.BoxGeometry(.034,.006,.005),lips,[0,-.060,.111]);
  for(let i=-2;i<=2;i++){const lock=oval(head,.04,this.mats.hair,[i*.035,.096,.055],[.75,.8,1]);lock.rotation.z=i*.18;this.hair.push(lock);}
  for(const [side,arm]of Object.entries(this.arms)){
   const hand=mesh(arm.grip,sculptedHand(side),this.mats.glove);hand.scale.setScalar(1.03);arm.hand=hand;
   const gesture=this.group('casting-hand',arm.grip);arm.gesture=gesture;gesture.visible=false;
   oval(gesture,.026,this.mats.glove,[0,-.004,.012],[1,1.35,.60]);
   for(let i=0;i<4;i++){const x=(i-1.5)*.014,extended=i===1||i===2;ribbon([[x,-.022,.013],[x,-.045,.012],[x+(i-1.5)*.004,extended?-.088:-.048,extended?.012:.035]],.006,this.mats.glove,gesture);}
   ribbon([[-.018,.01,.014],[-.037,-.005,.016],[-.042,-.023,.026]],.007,this.mats.glove,gesture);
   band(arm.wrist,.029,this.mats.gold,[0,-.005,0],[1,1,.85]);
  }
  this.pose({time:0,reducedMotion:true});
 }
 group(name,parent=this.root){const group=new THREE.Group();group.name=name;parent.add(group);return group;}
 material(id,color,kind){
  // Hue-shifted pixel clusters live on the surface, so they stay attached while posing.
  let gradient=this.textures.get('light-ramp');
  if(!gradient){gradient=new THREE.DataTexture(new Uint8Array([65,105,155,205,255]),5,1,THREE.RedFormat);gradient.magFilter=gradient.minFilter=THREE.NearestFilter;gradient.needsUpdate=true;this.textures.set('light-ramp',gradient);}
  const mat=new THREE.MeshToonMaterial({color,gradientMap:gradient,side:THREE.DoubleSide});
  if(!['skin','hair','cloth','leather','steel','gold'].includes(kind))return mat;
  const key=kind+':'+color;let map=this.textures.get(key);
  if(!map){
   const data=new Uint8Array(32*48*4),base=new THREE.Color(color),shadow=new THREE.Color(0x242139),light=new THREE.Color(0xffe5ae);
   const palette=Array.from({length:7},(_,i)=>{const c=base.clone();if(i<3)c.lerp(shadow,(3-i)*.19);else c.lerp(light,(i-3)*.075);return c.convertLinearToSRGB().toArray().map(v=>Math.round(v*255));});
   for(let y=0;y<48;y++)for(let x=0;x<32;x++){
    const u=x/31,v=y/47,fold=Math.cos(x*.43+Math.sin(y*.18)*1.5),edge=x===2||x===29;
    let shade=3;
    if(kind==='skin')shade=Math.round(2.5+1.8*Math.cos((u-.40)*Math.PI*2)+.6*Math.cos(v*9));
    else if(kind==='hair')shade=Math.round(2.5+1.7*Math.cos(x*.8+Math.floor(y/12))+.4*Math.cos(y*.3));
    else if(kind==='cloth')shade=Math.round(3+.85*fold+.7*Math.cos(y*.32+u*5)+(edge&&y%4<2?.7:0)+((x+y)%4===0?.25:0));
    else if(kind==='leather')shade=Math.round(3+.65*fold+(edge?(y%4<2?1.4:-.8):0)+(y%12===3&&x%7<3?.55:0));
    else shade=Math.round(2.8+2*Math.cos((u-.33)*Math.PI*2)+(y%8===0?.9:0)+(x%8===3&&y%8===3?1.2:0));
    if(kind==='leather'&&edge)shade=y%12===2?6:y%4===3?1:shade;
    data.set([...palette[clamp(shade,0,6)],255],(y*32+x)*4);
   }
   map=new THREE.DataTexture(data,32,48);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=map.minFilter=THREE.NearestFilter;map.needsUpdate=true;this.textures.set(key,map);
  }
  mat.color.setHex(0xffffff);mat.map=map;mat.userData.tint=color;return mat;
 }
 skin(group,geometry,material,weights){
  const p=geometry.attributes.position,indices=[],values=[];
  for(let i=0;i<p.count;i++){
   const influence=weights(p.getX(i),p.getY(i),p.getZ(i));
   for(let j=0;j<4;j++){indices.push(influence[j]?this.skeleton.bones.indexOf(this.bones[influence[j][0]]):0);values.push(influence[j]?.[1]||0);}
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(values,4));
  const object=new THREE.SkinnedMesh(geometry,material);group.add(object);object.bind(this.skeleton,new THREE.Matrix4());object.frustumCulled=false;return object;
 }
 torso(group,mat,bulk=0){
  const geometry=tube([[.84,.145+bulk],[.91,.151+bulk],[1.02,.126+bulk],[1.16,.176+bulk],[1.32,.205+bulk],[1.4,.194+bulk],[1.445,.074+bulk]],.63);planarUV(geometry);for(let i=0;i<geometry.attributes.uv.count;i++)geometry.attributes.uv.setY(i,1-geometry.attributes.uv.getY(i));
  return this.skin(group,geometry,mat,(x,y)=>y<1.04?[['hips',clamp((1.1-y)/.2,0,1)],['spine',1-clamp((1.1-y)/.2,0,1)]]:[['spine',clamp((1.26-y)/.22,0,1)],['chest',1-clamp((1.26-y)/.22,0,1)]]);
 }
 sleeves(group,mat,plate=false,id=null){
  const sleeve=id?this.material(id,mat.userData.tint??mat.color.getHex(),plate?'steel':id==='leather-vest'?'leather':'cloth'):mat;
  for(const [side,arm]of Object.entries(this.arms)){
   const upper=this.group('shoulder-cap',arm.shoulder);group.userData.attached??=[];group.userData.attached.push(upper);
   oval(upper,.066,sleeve,[0,-.005,0],[1,1,.82]);
   const g=planarUV(organicLimb(.545,[[0,.066],[.12,.076],[.4,.055],[.53,.046],[.68,.055],[.85,.04],[1,.027]],.82));g.rotateZ(Math.PI);g.translate(arm.sign*.205,1.39,0);
   this.skin(group,g,sleeve,(x,y)=>{const blend=clamp((1.14-y)/.08,0,1);return [[side+'Shoulder',1-blend],[side+'Elbow',blend]];});
   if(plate)oval(upper,.085,mat,[arm.sign*.012,-.025,.009],[1,.65,.95]);
  }
 }
 trousers(group,mat,plate=false,id=null){
  const geometry=new THREE.SphereGeometry(.153,40,24);geometry.scale(1,.60,.74);geometry.translate(0,.883,0);planarUV(geometry);for(let i=0;i<geometry.attributes.uv.count;i++)geometry.attributes.uv.setY(i,1-geometry.attributes.uv.getY(i));this.skin(group,geometry,mat,()=>[['hips',1]]);
  for(const [side,leg]of Object.entries(this.legs)){
   const legMat=id?this.material(id,mat.userData.tint??mat.color.getHex(),plate?'steel':id==='mage-pants'?'cloth':'leather'):mat;
   const g=planarUV(organicLimb(.8,[[0,.087],[.12,.09],[.36,.067],[.51,.049],[.65,.061],[.83,.041],[1,.031]],.82));g.rotateZ(Math.PI);g.translate(leg.sign*.097,.88,0);
   this.skin(group,g,legMat,(x,y)=>{const blend=clamp((.51-y)/.08,0,1);return [[side+'Hip',1-blend],[side+'Knee',blend]];});
   const trim=this.group('trouser-trim',leg.hip);group.userData.attached??=[];group.userData.attached.push(trim);
   if(plate){const knee=this.group('knee-plate',leg.knee);group.userData.attached.push(knee);oval(knee,.062,mat,[0,-.015,.029],[1,.85,.65]);}
   ribbon([[0,-.035,.076],[0,-.18,.073],[0,-.36,.047]],.0015,this.mats.gold,trim);
  }
 }
 boots(group,mat,tall,id=null){
  for(const [side,leg]of Object.entries(this.legs)){
   const foot=this.group('boot',leg.ankle);group.userData.attached??=[];group.userData.attached.push(foot);
   oval(foot,.065,mat,[0,-.03,.036],[.76,.65,1.55]);oval(foot,.061,this.mats.dark,[0,-.062,.04],[.8,.14,1.62]);
   const shaft=this.group('boot-shaft',leg.knee);shaft.position.y=-.39;group.userData.attached.push(shaft);
   const shell=tube(tall?[[.065,.035],[.11,.038],[.18,.047],[.28,.061],[.355,.064]]:[[.065,.035],[.11,.037],[.16,.039]],.86);shell.translate(leg.sign*.097,0,0);
   const upper=this.skin(group,shell,mat,(x,y)=>{const blend=clamp((y-.08)/.08,0,1);return [[side+'Ankle',1-blend],[side+'Knee',blend]];});upper.name='boot-upper-'+side;
   band(shaft,tall?.064:.039,this.mats.gold,[0,tall?.275:.08,0],[1,1,.86]);
   for(const y of [0,.035])band(foot,.038,this.mats.glove,[0,y,0],[1,1,.88]);
   if(tall){
    const front=id?this.material(id,mat.userData.tint??mat.color.getHex(),id==='plate-boots'?'steel':'leather'):mat,g=planarUV(new THREE.SphereGeometry(.055,32,20));
    for(let i=0;i<g.attributes.uv.count;i++)g.attributes.uv.setY(i,1-g.attributes.uv.getY(i));mesh(shaft,g,front,[0,.145,.034],[.90,2.55,.40]);
    for(const [y,r]of [[.10,.047],[.215,.058]]){band(shaft,r,this.mats.glove,[0,y,0],[1,1,.86]);oval(shaft,.006,this.mats.gold,[.019,y,r*.9],[1,1,.5]);}
   }
  }
 }
 belt(group,mat){
  const geometry=new THREE.CylinderGeometry(.149,.153,.052,48,1,true);geometry.scale(1,1,.65);geometry.translate(0,.93,0);this.skin(group,geometry,mat,()=>[['hips',1]]);
  const buckle=this.group('buckle',this.bones.hips);group.userData.attached??=[];group.userData.attached.push(buckle);
  const ring=mesh(buckle,new THREE.TorusGeometry(.027,.005,6,4),this.mats.gold,[0,.03,.106]);ring.rotation.z=Math.PI/4;
 }
 tailoring(group,id,mat,metal){
  const chest=this.group('tailored-front',this.bones.chest);group.userData.attached??=[];group.userData.attached.push(chest);
  if(metal){
   oval(chest,.174,mat,[0,.015,.087],[1,.85,.52]);
   ribbon([[0,.15,.135],[0,.025,.18],[0,-.12,.145]],.004,this.mats.gold,chest);
   for(const y of [-.14,-.19,-.24]){const g=new THREE.CylinderGeometry(.15,.145,.045,32,1,true,-1.4,2.8);mesh(chest,g,mat,[0,y,.003],[1,1,.84]);band(chest,.15,this.mats.gold,[0,y+.02,.003],[1,1,.84]);}
   for(const arm of Object.values(this.arms)){const plate=this.group('fitted-bracer',arm.elbow);group.userData.attached.push(plate);mesh(plate,new THREE.CylinderGeometry(.052,.033,.17,16),mat,[0,-.13,0],[1,1,.95]);band(plate,.052,this.mats.gold,[0,-.045,0]);}
  }else{
   for(const x of [-.105,.105])ribbon([[x,.17,.085],[x*.7,.03,.135],[x*.6,-.27,.11]],id==='leather-vest'?.012:.005,id==='leather-vest'?this.mats.glove:this.mats.gold,chest);
   if(id==='leather-vest')for(const y of[-.03,-.08,-.13])ribbon([[-.03,y,.134],[.03,y-.025,.137]],.003,this.mats.gold,chest);
   else for(const sign of[-1,1])oval(chest,.028,this.mats.gold,[sign*.11,.15,.09],[1,.5,.45]);
  }
 }
 cape(group,mat){
  const positions=[],uv=[],indices=[],rows=24,columns=20;
  for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
   const t=y/rows,u=x/columns*2-1,width=.19+t*.13;
   positions.push(u*width,1.40-t*1.19+Math.abs(u)**1.5*.045*t,-.14-.04*t-.035*(1-u*u)+Math.cos(u*20)*.012*t);uv.push(x/columns,1-t);
  }
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+columns+1;indices.push(a,a+1,b,a+1,b+1,b);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  this.skin(group,geometry,mat,(x,y)=>{const t=clamp((1.40-y)/.5,0,2),low=Math.min(1,Math.floor(t)),names=['cape','capeMid','capeHem'];return [[names[low],1-(t-low)],[names[low+1],t-low]];});
  const collar=this.group('cape-clasp',this.bones.chest);group.userData.attached=[collar];
  for(const sign of[-1,1])oval(collar,.068,mat,[sign*.135,.15,.095],[1.15,.28,1.5]);
  ribbon([[-.13,.16,.165],[-.06,.115,.20],[.06,.115,.20],[.13,.16,.165]],.005,this.mats.gold,collar);
 }
 robe(group,mat){
  const geometry=tube([[.11,.28],[.2,.275],[.55,.22],[.8,.17],[.95,.15]],.74);planarUV(geometry);for(let i=0;i<geometry.attributes.uv.count;i++)geometry.attributes.uv.setY(i,1-geometry.attributes.uv.getY(i));
  this.skin(group,geometry,mat,(x,y)=>{const blend=clamp((.9-y)/.75,0,.42),side=x<0?'rightHip':'leftHip';return [['hips',1-blend],[side,blend]];});
  for(const sign of [-1,1]){const panel=this.group('robe-trim',this.bones.hips);group.userData.attached??=[];group.userData.attached.push(panel);ribbon([[sign*.04,.02,.118],[sign*.08,-.34,.153],[sign*.18,-.77,.177]],.004,this.mats.gold,panel);}
 }
 headgear(group,id,mat){
  const mount=this.group('headgear',this.bones.head);group.userData.attached=[mount];
  if(id==='mage-hat'){
   mesh(mount,new THREE.CylinderGeometry(.17,.19,.018,48),mat,[0,.075,0],[1,1,.85]);
   const g=new THREE.ConeGeometry(.115,.29,40,12),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+Math.max(0,p.getY(i))**2*3);g.computeVertexNormals();mesh(mount,g,mat,[0,.22,0]);band(mount,.113,this.mats.gold,[0,.095,0]);
  }else if(id==='rogue-hood'){
   const g=new THREE.SphereGeometry(.135,40,26,.72,Math.PI*2-1.44),p=g.attributes.position;
   // SphereGeometry's front is +Z. Remove a face window rather than covering the face with a picture.
   for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setX(i,z);p.setZ(i,-x);}
   g.computeVertexNormals();mesh(mount,g,mat,[0,.015,-.01],[1,1.27,1.02]);
   mesh(mount,new THREE.SphereGeometry(.135,40,16,0,Math.PI*2,0,.8),mat,[0,.015,-.01],[1,1.27,1.02]);
   const collar=mesh(mount,new THREE.TorusGeometry(.13,.027,12,48),mat,[0,-.155,0],[1.12,1,.72]);collar.rotation.x=Math.PI/2;
   const cloth=collar.geometry.attributes.position;for(let i=0;i<cloth.count;i++)cloth.setZ(i,cloth.getZ(i)+Math.max(0,cloth.getY(i))*.4);collar.geometry.computeVertexNormals();
   mesh(mount,new THREE.CylinderGeometry(.12,.17,.065,40,4,true),mat,[0,-.19,0],[1,1,.7]);
   const scarf=new THREE.Shape();scarf.moveTo(-.14,-.15);scarf.quadraticCurveTo(-.05,-.20,-.06,-.26);scarf.quadraticCurveTo(.09,-.25,.14,-.15);scarf.quadraticCurveTo(0,-.20,-.14,-.15);
   const clothFront=planarUV(new THREE.ExtrudeGeometry(scarf,{depth:.009,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:3,curveSegments:20}));for(let i=0;i<clothFront.attributes.uv.count;i++)clothFront.attributes.uv.setY(i,1-clothFront.attributes.uv.getY(i));mesh(mount,clothFront,mat,[0,0,.115]);
  }else{
   mesh(mount,new THREE.SphereGeometry(.136,40,24,0,Math.PI*2,0,1.42),mat,[0,.01,0],[.96,1.22,.92]);
   for(const sign of [-1,1])oval(mount,.045,mat,[sign*.10,-.04,.068],[.55,1.5,1]);
   mesh(mount,new THREE.CylinderGeometry(.13,.105,.09,40,4,true,-1.30,2.6),mat,[0,-.067,.025],[1,1,1]);
   for(const sign of[-1,1])for(const y of[-.052,-.073,-.094])oval(mount,.0035,this.mats.dark,[sign*.038,y,.107],[1,1,.45]);
   band(mount,.115,this.mats.gold,[0,.028,0],[.96,1,.92]);
   if(id==='frost-helm')for(let i=-2;i<=2;i++)mesh(mount,new THREE.ConeGeometry(.019,.095,5),mat,[i*.039,.135+(.025*(2-Math.abs(i))),.04]);
  }
 }
 equip(save){
  const equipment={...save.equipment};if(ITEMS[equipment.weapon]?.hands===2)equipment.offhand=null;
  const signature=Object.values(equipment).join(':');if(signature===this.signature)return;this.signature=signature;
  for(const hair of this.hair)hair.visible=!['wolf-helm','frost-helm'].includes(equipment.helm);
  // A slot replaces its old mesh. Nothing is stacked over a permanently dressed body.
  const shared=new Set(Object.values(this.mats));for(const group of Object.values(this.equipment)){for(const attached of group.userData.attached||[])release(attached,shared);release(group,shared);}this.equipment={};
  for(const [part,visible]of Object.entries({torso:!equipment.armor,arms:!equipment.armor,pants:!equipment.pants,boots:!equipment.boots})){
   this.base[part].visible=visible;for(const attached of this.base[part].userData.attached||[])attached.visible=visible;
  }
  const palettes={helm:{'rogue-hood':0x314c31,'mage-hat':0x493261,'wolf-helm':0x9ca8b0,'frost-helm':0x74b9d7},armor:{'scale-mail':0x82909d,'frost-plate':0x70b8d5,'leather-vest':0x614632,'mage-robe':0x48315f,'inferno-robe':0x782b31},pants:{'iron-greaves':0x87949f,'rogue-pants':0x60452f,'mage-pants':0x443154},boots:{'plate-boots':0x9aa6af,'trail-boots':0x543b29,'mage-boots':0x41314f},cloak:{'red-cape':0x832c35,'forest-cloak':0x294b36,'astral-cloak':0x443363,'silk-cloak':0x282534}};
  this.root.rotation.set(0,0,0);for(const [bone,position]of this.bindPositions){bone.rotation.set(0,0,0);bone.position.copy(position);}this.root.updateMatrixWorld(true);
  for(const [slot,id]of Object.entries(equipment)){
   if(!id)continue;const item=ITEMS[id];if(!item)continue;
   if(slot==='weapon'||slot==='offhand'){
    const object=item.shield?makeShield(id):makeWeapon(id),arm=this.arms[slot==='weapon'&&!item.magic?'right':'left'];arm.grip.add(object);object.userData.item=id;const materials=new Map();object.traverse(o=>{if(!o.isMesh)return;const source=o.material;if(!materials.has(source)){materials.set(source,new THREE.MeshLambertMaterial({color:source.color,emissive:source.emissive,emissiveIntensity:source.emissiveIntensity}));source.dispose();}o.material=materials.get(source);});
    if(id==='greatsword')object.scale.set(1.3,1.2,1.1);
    if(item.magic){object.scale.y=1.25;object.position.y=-.25;}
    if(item.shield){
     object.rotation.y=Math.PI;object.position.z=.065;
     if(id!=='wood-shield')object.children[0].material.color.setHex({'steel-shield':0x8393a1,'guardian-shield':0xbf9b55,'frost-shield':0x78bccf}[id]);
     oval(object,.047,this.mats.gold,[0,-.005,-.022],[.65,1.4,.28]);
    }
    this.equipment[slot]=object;continue;
   }
   const group=this.group(slot);group.userData.item=id;this.equipment[slot]=group;
   const metal=id.includes('plate')||id.includes('greaves')||id.includes('helm')||id==='scale-mail',mat=this.material(id,palettes[slot]?.[id]||0xb99a52,metal?'steel':slot==='pants'||slot==='boots'||id==='leather-vest'?'leather':'cloth');
   if(slot==='armor'){this.torso(group,mat,.008);this.sleeves(group,mat,metal,id);this.belt(group,this.mats.glove);this.tailoring(group,id,mat,metal);if(item.look===3)this.robe(group,this.material(id,palettes.armor[id],'cloth',[0,.4,1,1]));}
   else if(slot==='pants'){this.trousers(group,mat,metal,id);this.belt(group,this.mats.glove);}
   else if(slot==='boots'){mat.dispose();this.boots(group,this.material(null,palettes.boots[id],metal?'steel':'leather'),id!=='mage-boots',id);}
   else if(slot==='helm'){
    if(id==='rogue-hood'||metal)mat.dispose();
    this.headgear(group,id,id==='rogue-hood'?this.material(id,palettes.helm[id],'cloth',[.03,.68,.97,.98]):metal?this.material(null,palettes.helm[id],'steel',{side:THREE.DoubleSide}):mat);
   }
   else if(slot==='cloak')this.cape(group,mat);
   else if(slot==='neck'){
    const front=['scale-mail','frost-plate'].includes(equipment.armor)?.19:.14,mount=this.group('necklace',this.bones.chest);group.userData.attached=[mount];ribbon([[-.066,.19,.10],[-.045,.04,front],[0,-.025,front],[.045,.04,front],[.066,.19,.10]],.0028,this.mats.gold,mount);mat.color.setHex(id==='arcane-pendant'?0x9082d4:id==='spider-pendant'?0x77a44e:0xe9bc61);oval(mount,.019,mat,[0,-.023,front+.01],[.7,1.3,.4]);
   }else if(slot.startsWith('ring')){
    const arm=this.arms[slot==='ring1'?'right':'left'],mount=this.group('ring',arm.grip);group.userData.attached=[mount];const ring=mesh(mount,new THREE.TorusGeometry(.012,.0025,6,20),mat,[arm.sign*.034,-.006,.024]);ring.rotation.x=Math.PI/2;const gem=this.material(null,{'ruby-ring':0xc74e58,'emerald-ring':0x6fbd79,'sapphire-ring':0x609bdb,'moon-ring':0xc6bde4,'demon-ring':0xf08b4f}[id]);oval(mount,.006,gem,[arm.sign*.034,-.006,.038],[1,1,.65]);
   }
  }
  for(const [side,arm]of Object.entries(this.arms)){
   const item=ITEMS[equipment[side==='right'?'weapon':ITEMS[equipment.weapon]?.hands===2?'weapon':'offhand']],large=equipment.weapon==='greatsword',profile={radiusX:item?.shield?.011:large?.019:item?.magic?.018:.014,radiusZ:item?.shield?.011:large?.014:item?.magic?.018:.012,round:!!item?.shield};
   if(JSON.stringify(profile)!==arm.profile){arm.hand.geometry.dispose();arm.hand.geometry=sculptedHand(side,profile);arm.profile=JSON.stringify(profile);}
  }
 }
 pose({time=0,action='idle',angle=.55,reducedMotion=false,posture}={}){
  const t=reducedMotion?0:time/1000,breathe=Math.sin(t*2)*.006;
  const family=stanceFor({weapon:this.equipment.weapon?.userData.item,offhand:this.equipment.offhand?.userData.item}),ready={...STANCES[family],...cleanPose(posture)},mirrored=family==='mixed'&&WEAPON_STYLES[this.equipment.offhand?.userData.item]?.kind==='sword';
  for(const [bone,position]of this.bindPositions){bone.rotation.set(0,0,0);bone.position.copy(position);}
  const progress=clamp(time/550,0,1),cycle=Math.sin(progress*progress*(3-2*progress)*Math.PI),custom=action==='slash'&&ready.attack;
  const stance=custom?blendPostures(ready,ready.attack,cycle):ready,cut=action==='slash'&&!custom?cycle:0,cast=action==='cast'?cycle:0;
  this.root.rotation.y=angle;this.bones.hips.position.add(new THREE.Vector3(...(stance.hips||[0,0,0])));this.bones.hips.position.y-=stance.lower;
  this.bones.hips.rotation.set(...(stance.hipRotation||[0,0,0]));this.bones.spine.position.add(new THREE.Vector3(...(stance.torso||[0,0,0])));
  this.bones.neck.rotation.set(...(stance.neckRotation||[0,0,0]));
  this.bones.spine.rotation.set(...(stance.body||[0,0,0]));this.bones.spine.rotation.x+=breathe+cut*.07;this.bones.chest.rotation.y=stance.twist*(mirrored?-1:1)+Math.sin(t*.9)*.012-cut*.28;
  this.bones.head.rotation.y=-stance.twist*.65+.10-Math.sin(t*.9)*.015;
  let right=new THREE.Vector3(...stance.right);const rotation=new THREE.Euler(...stance.rotation);
  right.x+=cut*(family==='staff'?.22:stance.spread?.02:.28);right.y+=cut*.17+cast*.09+breathe;right.z+=cut*(stance.spread?.035:.10)+cast*.02;
  rotation.x+=cut*(family==='staff'?.65:1.15)-cast*.25;rotation.z+=cut*(family==='staff'?.35:family==='greataxe'?.5:-.65);
  let left=new THREE.Vector3(...(stance.left||[0,1,.2])),leftRotation=new THREE.Euler(...(stance.leftRotation||[0,0,0]));
  if(family==='dual'){left.x-=cut*.24;left.y+=cut*.21;left.z+=cut*.1;leftRotation.x-=cut*.8;leftRotation.z+=cut*.8;}
  if(action==='guard'){left.set(.08,1.32,.34);leftRotation.set(-.12,-.15,0);}
  if(cast&&!stance.spread&&family!=='staff'){left.set(.25,1.13+cast*.1,.25);leftRotation.set(-.5,0,-.2);}
  if(action==='walk'&&!stance.spread){right.y+=Math.sin(t*5)*.025;left.y-=Math.sin(t*5)*.025;}
  let rightQ=new THREE.Quaternion().setFromEuler(rotation),leftQ=new THREE.Quaternion().setFromEuler(leftRotation);
  if(family==='greatsword'||family==='mixed'){
   right.set(...stance.right).lerp(new THREE.Vector3(-.03,family==='greatsword'?1.30:1.10,.25),cut);right.y+=breathe;
   rightQ.setFromEuler(new THREE.Euler(...stance.rotation)).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.9,0,Math.PI-.05)),cut);
   if(family==='greatsword'){
    const join=cut;
    left.lerp(right.clone().add(new THREE.Vector3(0,-.15,0).applyQuaternion(rightQ)),join);leftQ.slerp(rightQ,join);
   }
  }
  if(family==='staff'){
   right.set(...stance.right);right.y+=breathe+(cast||cut)*.1;right.z+=(cast||cut)*.09;
   rightQ.setFromEuler(new THREE.Euler(stance.rotation[0]-(cast||cut)*.35,stance.rotation[1],stance.rotation[2]));
  }
  if(stance.spread){left=right.clone().add(new THREE.Vector3(0,stance.spread,0).applyQuaternion(rightQ));leftQ.copy(rightQ);}
  if(mirrored){
   [right,left]=[left,right];right.x*=-1;left.x*=-1;[rightQ,leftQ]=[leftQ,rightQ];
   for(const q of [rightQ,leftQ]){q.y*=-1;q.z*=-1;}
  }
  // Solve both elbows to the authored palms, never rotate an independent prop over a hand.
  this.root.updateMatrixWorld(true);
  for(const [side,arm]of Object.entries(this.arms)){
   arm.gesture.visible=family==='staff'&&side==='right';arm.hand.visible=!arm.gesture.visible;
   const local=side==='right'?right:left,q=side==='right'?rightQ:leftQ;
   const worldQ=this.root.getWorldQuaternion(new THREE.Quaternion()).multiply(q),palm=this.root.localToWorld(local.clone());
   placeArm(this.root,arm,palm,worldQ,this.root.localToWorld(new THREE.Vector3(...(stance[side+'Pole']||[arm.sign*.48,1.08,-.08]))));
  }
  // Plant the feet while the pelvis lowers into each weapon's stance.
  for(const [side,leg]of Object.entries(this.legs)){
   const step=action==='walk'?Math.sin(t*5)*leg.sign:0,target=new THREE.Vector3(...(stance[side+'Foot']||[leg.sign*stance.feet[0],.08,leg.sign*stance.feet[1]]));target.y+=Math.max(0,step)*.06;target.z+=step*.10;const foot=this.root.localToWorld(target);
   const hip=leg.hip.getWorldPosition(new THREE.Vector3()),pole=this.root.localToWorld(new THREE.Vector3(leg.sign*.25,.45,.5)),solved=solveArm(hip,foot,pole,{upper:.41,forearm:.39}),down=new THREE.Vector3(0,-1,0),upperQ=new THREE.Quaternion().setFromUnitVectors(down,solved.elbow.clone().sub(hip).normalize()),lowerQ=new THREE.Quaternion().setFromUnitVectors(down,solved.wrist.clone().sub(solved.elbow).normalize());
   leg.hip.quaternion.copy(leg.hip.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(upperQ));leg.knee.quaternion.copy(upperQ.clone().invert().multiply(lowerQ));
   const footQ=this.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,leg.sign*.12,0)));leg.ankle.quaternion.copy(lowerQ.clone().invert().multiply(footQ));this.root.updateMatrixWorld(true);
  }
  // Manual joint offsets follow IK; connected garments and props inherit them without stretching bones.
  for(const side of ['right','left'])for(const joint of ['Shoulder','Elbow','Knee','Wrist']){
   const value=stance[side+joint];if(value)this.bones[side+joint].quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...value)));
  }
  if(cut>0&&['greatsword','greataxe'].includes(family)&&Object.keys(stance).some(k=>/Shoulder|Elbow|Wrist/.test(k)&&stance[k].some(v=>v!==0))){
   this.root.updateMatrixWorld(true);const a=this.arms.left,b=this.arms.right;
   const palm=a.grip.getWorldPosition(new THREE.Vector3()).lerp(b.grip.localToWorld(new THREE.Vector3(0,family==='greatsword'?-.15:stance.spread,0)),cut);
   const q=a.grip.getWorldQuaternion(new THREE.Quaternion()).slerp(b.grip.getWorldQuaternion(new THREE.Quaternion()),cut);
   placeArm(this.root,a,palm,q,this.root.localToWorld(new THREE.Vector3(...(stance.leftPole||[.48,1.08,-.08]))));
  }
  this.bones.capeMid.rotation.x=Math.sin(t*1.8)*.045;this.bones.capeHem.rotation.x=Math.sin(t*1.8-.7)*.065;
  this.root.updateMatrixWorld(true);this.skeleton.update();
 }
 destroy(){this.skeleton.dispose();this.faceTexture?.dispose();for(const texture of this.textures.values())texture.dispose();release(this.root);}
}
export function weaponTip(model,side){
 const grip=model.arms[side].grip,object=['weapon','offhand'].map(slot=>model.equipment[slot]).find(o=>o?.parent===grip&&!ITEMS[o.userData.item]?.shield);
 if(!object)return null;
 // Measure in grip space so the control follows the real scaled staff or blade, at any pose.
 const box=new THREE.Box3(),inverse=grip.matrixWorld.clone().invert();
 object.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)));});
 return grip.localToWorld(new THREE.Vector3(0,box.max.y,0));
}
export function aimWeapon(model,side,target,posture={}){
 const tip=weaponTip(model,side);if(!tip)return {};
 const wrist=model.arms[side].wrist,origin=wrist.getWorldPosition(new THREE.Vector3()),to=target.clone().sub(origin);
 if(to.lengthSq()<1e-8)return {};
 const delta=new THREE.Quaternion().setFromUnitVectors(tip.sub(origin).normalize(),to.normalize());
 const desired=wrist.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(delta.multiply(wrist.getWorldQuaternion(new THREE.Quaternion())));
 const key=side+'Wrist',offset=new THREE.Quaternion().setFromEuler(new THREE.Euler(...(posture[key]||[0,0,0]))),base=wrist.quaternion.clone().multiply(offset.invert());
 const angles=new THREE.Euler().setFromQuaternion(base.invert().multiply(desired));
 return {[key]:[angles.x,angles.y,angles.z]};
}

export class RiggedEquipmentFigure {
 constructor(sprites={},renderer=combatWebGLRenderer()){
  this.renderer=renderer;this.model=new CharacterRig(sprites);this.scene=new THREE.Scene();this.scene.add(this.model.root);
  this.scene.add(new THREE.HemisphereLight(0xc9dae1,0x30303e,.95));const key=new THREE.DirectionalLight(0xffdfaf,1.5);key.position.set(-2,3,4);this.scene.add(key);const rim=new THREE.DirectionalLight(0x91b9da,.65);rim.position.set(2,2,-2);this.scene.add(rim);
  this.camera=new THREE.OrthographicCamera(-.66,.66,1.1,-1.1,.1,10);this.camera.position.set(0,.98,4);this.camera.lookAt(0,.98,0);
  this.canvas=document.createElement('canvas');this.canvas.width=480;this.canvas.height=800;this.context=this.canvas.getContext('2d');this.pixels=document.createElement('canvas');this.pixels.width=240;this.pixels.height=400;this.pixelContext=this.pixels.getContext('2d',{willReadFrequently:true});
  const floor=mesh(this.scene,new THREE.CircleGeometry(.36,48),new THREE.MeshBasicMaterial({color:0x0d1413,transparent:true,opacity:.5}),[0,.007,0]);floor.rotation.x=-Math.PI/2;
 }
 sync(save,state={}){this.model.equip(save);this.model.pose({...state,posture:state.posture??state.poses?.[stanceFor(save.equipment)]});this.renderer.render(this.scene,this.camera);this.context.clearRect(0,0,480,800);this.pixelContext.imageSmoothingEnabled=false;this.pixelContext.clearRect(0,0,240,400);this.pixelContext.drawImage(this.renderer.domElement,0,0,240,400);
  const frame=this.pixelContext.getImageData(0,0,240,400),data=frame.data;for(let i=0;i<data.length;i+=4){if(data[i+3]<120){data[i+3]=0;continue;}data[i+3]=255;for(let c=0;c<3;c++)data[i+c]=Math.min(255,Math.round(data[i+c]/8)*8);}this.pixelContext.putImageData(frame,0,0);this.context.imageSmoothingEnabled=false;this.context.drawImage(this.pixels,0,0,480,800);}
 destroy(){this.model.destroy();release(this.scene);this.canvas.width=this.canvas.height=0;this.renderer.renderLists.dispose();}
}

const iconCache=new Map();
export function rigItemIcon(id){
 if(iconCache.has(id))return iconCache.get(id);
 const figure=new RiggedEquipmentFigure(),slot=ITEMS[id]?.slot==='ring'?'ring1':ITEMS[id]?.slot;
 if(!slot){figure.destroy();return '';}
 try{
  figure.model.equip({equipment:{[slot]:id}});figure.model.pose({angle:.40,reducedMotion:true});
  const group=figure.model.equipment[slot],parts=[group,...group.userData.attached||[]],visible=new Set();
  for(const part of parts)part.traverse(o=>visible.add(o));
  figure.model.root.traverse(o=>{if(o.isMesh)o.visible=visible.has(o);});
  for(const child of figure.scene.children)if(child.isMesh)child.visible=false;
  const bounds=new THREE.Box3();for(const part of parts)bounds.expandByObject(part,true);
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y)*.62;
  figure.camera.left=-extent;figure.camera.right=extent;figure.camera.top=extent;figure.camera.bottom=-extent;figure.camera.position.set(center.x,center.y,center.z+4);figure.camera.lookAt(center);figure.camera.updateProjectionMatrix();
  // Icons use the actual fitted garment/prop, never independently generated artwork.
  figure.renderer.render(figure.scene,figure.camera);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const c=canvas.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=false;c.drawImage(figure.renderer.domElement,0,0,48,48);
  const image=c.getImageData(0,0,48,48),data=image.data;for(let i=0;i<data.length;i+=4){data[i+3]=data[i+3]>120?255:0;for(let k=0;k<3;k++)data[i+k]=Math.min(255,Math.round(data[i+k]/16)*16);}c.putImageData(image,0,0);
  const url=canvas.toDataURL();iconCache.set(id,url);return url;
 }finally{figure.destroy();}
}
