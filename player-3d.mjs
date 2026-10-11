import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { sculptedHand, organicLimb, curvedHandPlate } from './player-sculpt.mjs';
import { surfaceMaterial, changeSurface } from './player-materials.mjs';
import { ITEMS } from './core.mjs';
import { ARM_LENGTHS, RIGHT_WRIST, LEFT_WRIST, samplePlayerRig } from './player-rig.mjs';

let sharedRenderer,studioEnvironment;
export function combatWebGLRenderer(){
 if(!sharedRenderer){
  sharedRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  sharedRenderer.setSize(480,800);sharedRenderer.setPixelRatio(1);sharedRenderer.setClearColor(0x000000,0);
  sharedRenderer.outputColorSpace=THREE.SRGBColorSpace;sharedRenderer.toneMapping=THREE.ACESFilmicToneMapping;sharedRenderer.toneMappingExposure=1.1;
  const room=new RoomEnvironment(),generator=new THREE.PMREMGenerator(sharedRenderer);studioEnvironment=generator.fromScene(room,.04).texture;generator.dispose();room.dispose();
 }
 return sharedRenderer;
}
export const WEAPON_STYLES={
 'rust-sword':{kind:'sword',length:.49,color:0xa98465},'iron-sword':{kind:'sword',length:.54,color:0xb9cad8},
 mace:{kind:'mace',length:.42,color:0x9aa8b4},axe:{kind:'axe',length:.46,color:0xb4c2ca},
 greatsword:{kind:'sword',length:.72,color:0xd6d2b5,wide:true},'ember-staff':{kind:'staff',length:.74,color:0xff993d},
 'parry-dagger':{kind:'dagger',length:.25,color:0xc3d2de},'venom-dagger':{kind:'dagger',length:.29,color:0x87ad6b},
 'fire-wand':{kind:'staff',length:.44,color:0xff6540},'ice-staff':{kind:'staff',length:.72,color:0x75ccf0},
 'frost-sword':{kind:'sword',length:.6,color:0x83c9df},'spider-fang':{kind:'dagger',length:.34,color:0x9bb975,hook:true},
 'spider-claw':{kind:'dagger',length:.3,color:0x8daa67,hook:true},'assassin-dagger':{kind:'dagger',length:.31,color:0x9898b8,hook:true},
 'inferno-axe':{kind:'axe',length:.66,color:0xc9673d,wide:true},'demon-staff':{kind:'staff',length:.78,color:0xee645d}
};
const material=(color,metalness=0,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
function mesh(parent,geometry,mat,position=[0,0,0]){const m=new THREE.Mesh(geometry,mat);m.position.set(...position);parent.add(m);return m;}
function box(parent,w,h,d,mat,pos){
 const r=Math.min(w,h,d)*.23,shape=new THREE.Shape();shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
 const g=new THREE.ExtrudeGeometry(shape,{depth:d-r*2,bevelEnabled:true,bevelSize:r*.55,bevelThickness:r,bevelSegments:4,curveSegments:12});g.translate(0,0,-d/2+r);return mesh(parent,g,mat,pos);
}
function cylinder(parent,top,bottom,length,mat,pos,segments=10){return mesh(parent,new THREE.CylinderGeometry(top,bottom,length,Math.max(40,segments),4),mat,pos);}
function sphere(parent,r,mat,pos){return mesh(parent,new THREE.SphereGeometry(r,40,24),mat,pos);}
function segment(parent,a,b,r,mat){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const m=cylinder(parent,r,r,delta.length(),mat,start.clone().add(end).multiplyScalar(.5).toArray(),8);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
function disposeGroup(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material])materials.add(mat);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.removeFromParent();}
function prism(parent,points,depth,mat){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:5,curveSegments:32,steps:2,bevelSize:.004,bevelThickness:.004});g.translate(0,0,-depth/2);return mesh(parent,g,mat);}

function makeWeapon(id){
 const root=new THREE.Group(),style=WEAPON_STYLES[id];if(!style)return root;
 const {kind,length:l,color,wide,hook}=style,steel=surfaceMaterial(color,'steel'),gold=surfaceMaterial(0x8e7445,'gold'),leather=surfaceMaterial(0x433127,'leather');
 const handle=ITEMS[id]?.hands===2?.235:.125;
 cylinder(root,.014,.015,handle,leather,[0,-handle*.35,0]);
 for(let y=-handle*.8;y<.03;y+=.018){const wrap=mesh(root,new THREE.TorusGeometry(.0155,.0022,12,48),surfaceMaterial(0x806346,'leather'),[0,y,0]);wrap.rotation.x=Math.PI/2;}
 cylinder(root,.02,.024,.025,gold,[0,-handle*.85,0]);
 if(kind==='sword'||kind==='dagger'){
  const start=.07,w=wide?.042:kind==='dagger'?.023:.032;
  // Diamond cross-section gives a real bevel catching the directional light.
  const vertices=new Float32Array([-w,start,0,0,start,.011,w,start,0,0,start,-.011,-w,l-.065,0,0,l-.055,.009,w,l-.065,0,0,l-.055,-.009,hook?.04:0,l,0]);
  const indices=[0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,4,5,8,5,6,8,6,7,8,7,4,8,0,3,2,0,2,1];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setIndex(indices);const uv=[];for(let i=0;i<vertices.length;i+=3)uv.push((vertices[i]+w)/(2*w),(vertices[i+1]-start)/(l-start));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();mesh(root,geometry,steel);
  const guardCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(wide?-.095:-.075,.071,-.003),new THREE.Vector3(-.04,.057,0),new THREE.Vector3(0,.053,0),new THREE.Vector3(.04,.057,0),new THREE.Vector3(wide?.095:.075,.071,-.003)]);
  mesh(root,new THREE.TubeGeometry(guardCurve,48,.01,16,false),gold);
  for(const sign of[-1,1])sphere(root,.012,gold,[sign*(wide?.089:.065),.055,0]);
  if(id==='rust-sword'){steel.color.setHex(0x898278);steel.roughness=.9;steel.metalness=.58;}
  if(id==='frost-sword'){const rune=material(0x92dcff,.25,.2);rune.emissive.setHex(0x17657a);for(let y=.12;y<l-.08;y+=.07)box(root,.008,.024,.002,rune,[0,y,.012]);}
 }else if(kind==='axe'){
  cylinder(root,.011,.016,l+.1,leather,[0,l*.4,0]);
  prism(root,[[.01,l-.04],[.08,l+.015],[.17,l-.005],[.17,l-.105],[.08,l-.13],[.015,l-.11]],.034,steel);
  if(wide)prism(root,[[-.015,l-.04],[-.09,l+.01],[-.16,l-.025],[-.14,l-.12],[-.025,l-.11]],.034,steel);
  cylinder(root,.024,.024,.13,gold,[0,l-.06,0]);
 }else if(kind==='mace'){
  cylinder(root,.013,.017,l,leather,[0,l*.35,0]);sphere(root,.062,steel,[0,l-.04,0]);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;const fin=box(root,.025,.09,.055,steel,[Math.cos(a)*.042,l-.04,Math.sin(a)*.042]);fin.rotation.y=-a;}
 }else{
  cylinder(root,.012,.018,l+.15,surfaceMaterial(0x624c33,'wood'),[0,l*.37,0]);
  for(let y=.14;y<l-.08;y+=.15)cylinder(root,.021,.021,.025,gold,[0,y,0]);
  const gem=material(color,.2,.19);gem.emissive.setHex(color);gem.emissiveIntensity=.5;
  const crystal=mesh(root,new THREE.IcosahedronGeometry(.05,3),gem,[0,l,0]);crystal.scale.y=1.55;
  for(const sign of[-1,1]){const prong=cylinder(root,.008,.012,.1,gold,[sign*.041,l-.012,0]);prong.rotation.z=sign*-.28;}
  const glow=new THREE.PointLight(color,.3,.55);glow.position.set(0,l,0);root.add(glow);
 }
 root.userData.item=id;return root;
}
function makeShield(id){
 const root=new THREE.Group(),color={'wood-shield':0x8b704e,'steel-shield':0x8b9cad,'guardian-shield':0xb99856,'frost-shield':0x87c6df}[id];
 const wood=surfaceMaterial(0x7a5941,'wood'),strap=surfaceMaterial(0x3d2b21,'leather'),rim=surfaceMaterial(color,id==='wood-shield'?'gold':'steel');
 const shape=new THREE.Shape();shape.moveTo(-.13,.14);shape.quadraticCurveTo(0,.205,.13,.14);shape.bezierCurveTo(.14,-.065,.09,-.17,0,-.21);shape.bezierCurveTo(-.09,-.17,-.14,-.065,-.13,.14);shape.closePath();
 const base=new THREE.ExtrudeGeometry(shape,{depth:.021,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:5,curveSegments:40});base.translate(0,0,-.0105);
 const pos=base.attributes.position,norm=base.attributes.normal,uv=base.attributes.uv;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),slope=.048*x/(.13*.13);
  pos.setZ(i,z+.024*(x/.13)**2);
  const n=new THREE.Vector3(norm.getX(i)-slope*norm.getZ(i),norm.getY(i),norm.getZ(i)).normalize();norm.setXYZ(i,n.x,n.y,n.z);
  uv.setXY(i,(x+.145)/.29,(y+.22)/.43);
 }
 mesh(root,base,wood);
 const edge=shape.getPoints(120).map(p=>new THREE.Vector3(p.x,p.y,.017+.024*(p.x/.13)**2));const path=new THREE.CatmullRomCurve3(edge,true);
 mesh(root,new THREE.TubeGeometry(path,160,.0065,16,true),rim);
 for(const y of[-.09,.105]){
  const band=box(root,.224,.012,.012,rim,[0,y,.033]);
  for(const x of[-.092,.092]){const ring=mesh(root,new THREE.TorusGeometry(.0052,.0013,8,24),rim,[x,y,.045+.012]);sphere(root,.0038,rim,[x,y,.059]);}
 }
 for(const x of[-.043,.043]){
  box(root,.013,.075,.013,strap,[x,-.005,.047]);
  for(let j=0;j<8;j++)sphere(root,.0009,material(0xb39d79),[x+.004,j*.008-.032,.056]);
 }
 const gripMat=surfaceMaterial(0x50382b,'leather');cylinder(root,.011,.011,.105,gripMat,[0,0,.066],48);
 for(const y of[-.053,.053]){const post=cylinder(root,.007,.007,.046,rim,[0,y,.043],40);post.rotation.x=Math.PI/2;}
 root.userData.item=id;return root;
}
function makeHand(side,mats){
 const root=new THREE.Group(),s=side==='right'?1:-1,offset=side==='right'?RIGHT_WRIST:LEFT_WRIST;
 const palm=new THREE.Group();palm.position.copy(offset).multiplyScalar(-1);root.add(palm);
 mesh(palm,sculptedHand(side),mats.glove);
 const back=mesh(palm,curvedHandPlate(),mats.plate,[s*.033,.001,.043]);back.userData.armorDetail=true;
 for(let i=0;i<4;i++){
  const knuckle=mesh(palm,new THREE.CapsuleGeometry(.0085,.008,8,24),mats.plate,[s*.043,.025-i*.016,-.006]);knuckle.rotation.z=Math.PI/2;knuckle.userData.armorDetail=true;
  // A subtle stitched line along each leather finger, with rounded thread.
  for(let j=0;j<4;j++)sphere(palm,.00065,mats.stitch,[s*(.052-j*.006),.029-i*.016,.028-j*.008]);
 }
 return root;
}
function makeArm(side,mats){
 const upper=new THREE.Bone(),elbow=new THREE.Bone(),wrist=new THREE.Bone();upper.name=side+'-shoulder';elbow.name=side+'-elbow';wrist.name=side+'-wrist';upper.add(elbow);elbow.add(wrist);elbow.position.y=ARM_LENGTHS.upper;wrist.position.y=ARM_LENGTHS.forearm;
 mesh(upper,organicLimb(ARM_LENGTHS.upper,[[0,.061],[.16,.074],[.45,.069],[.76,.056],[1,.048]],.8),mats.sleeve);
 sphere(elbow,.049,mats.sleeve,[0,0,0]).scale.z=.82;
 mesh(elbow,organicLimb(ARM_LENGTHS.forearm,[[0,.048],[.22,.056],[.5,.047],[.77,.038],[1,.027]],.85),mats.sleeve);
 const plates=[mesh(elbow,organicLimb(ARM_LENGTHS.forearm,[[.04,.052],[.22,.058],[.51,.05],[.81,.039],[.96,.032]],.88),mats.plate)];
 for(const y of [.065,.26]){const radius=y<.1?.055:.038;const lip=mesh(elbow,new THREE.TorusGeometry(radius,.0018,10,48),mats.trim,[0,y,0]);lip.rotation.x=Math.PI/2;lip.scale.y=.87;plates.push(lip);}
 cylinder(elbow,.031,.032,.018,mats.trim,[0,ARM_LENGTHS.forearm-.006,0],48).scale.z=.88;
 wrist.add(makeHand(side,mats));return {upper,elbow,wrist,plates};
}
export class Player3D {
 constructor(renderer=combatWebGLRenderer()){
  this.renderer=renderer;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(75,480/800,.025,8);
  this.scene.environment=studioEnvironment;this.scene.environmentIntensity=.55;this.scene.add(new THREE.HemisphereLight(0xd6e8ff,0x312537,.7));
  const keyLight=new THREE.DirectionalLight(0xffe9c2,2);keyLight.position.set(-1.5,2,1.3);this.scene.add(keyLight);
  const rim=new THREE.DirectionalLight(0x83b9ff,.7);rim.position.set(1,.4,-1);this.scene.add(rim);
  this.torso=new THREE.Bone();this.torso.name='chest';this.scene.add(this.torso);
  this.mats={sleeve:surfaceMaterial(0x343b43,'cloth'),glove:surfaceMaterial(0x34271f,'leather'),plate:surfaceMaterial(0xa3afb9,'steel'),trim:surfaceMaterial(0x8c744a,'gold'),stitch:material(0x8c7b64)};
  this.right=makeArm('right',this.mats);this.left=makeArm('left',this.mats);this.torso.add(this.right.upper,this.left.upper);
  this.magic=mesh(this.scene,new THREE.TorusGeometry(.07,.003,5,32),new THREE.MeshBasicMaterial({color:0xbaa1ff,transparent:true,opacity:.75}));this.magic.visible=false;
 }
 equipment(art){
  const signature=[art.weapon,art.offhand,art.look,art.armorHue].join(':');if(signature===this.signature)return;this.signature=signature;
  for(const object of[this.weapon,this.offhand])if(object)disposeGroup(object);
  this.weapon=makeWeapon(art.weapon);this.weapon.position.copy(RIGHT_WRIST).multiplyScalar(-1);this.right.wrist.add(this.weapon);
  this.offhand=art.offhand?(ITEMS[art.offhand]?.shield?makeShield(art.offhand):makeWeapon(art.offhand)):new THREE.Group();this.offhand.position.copy(LEFT_WRIST).multiplyScalar(-1);
  if(ITEMS[art.offhand]?.shield)this.offhand.position.z-=.065;this.left.wrist.add(this.offhand);
  const palette=[[0x7b7164,0x60432d,0x967c61],[0x333a42,0x493b30,0xa4afba],[0x3e4537,0x493526,0x8c7655],[0x3a304c,0x413349,0xa594c3]][art.look];
  ['sleeve','glove','plate'].forEach((name,i)=>{this.mats[name].color.setHex(palette[i]);if(art.armorHue)this.mats[name].color.offsetHSL(art.armorHue/360,0,0);changeSurface(this.mats[name],name==='plate'?'steel':name==='glove'?'leather':art.look===2?'leather':'cloth');this.mats[name].metalness=art.look===1&&name==='plate'?.82:0;});
  this.scene.traverse(o=>{if(o.userData.armorDetail)o.visible=art.look===1;});
  for(const arm of[this.right,this.left])for(const plate of arm.plates)plate.visible=art.look===1;
 }
 sync(state){
  const displayAspect=Number.isFinite(state.aspect)&&state.aspect>0?.6*state.aspect:.6;
  if(this.camera.aspect!==displayAspect){this.camera.aspect=displayAspect;this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(75/2))*.6/displayAspect));this.camera.updateProjectionMatrix();}
  const pose=samplePlayerRig(state);this.pose=pose;this.equipment(pose.art);
  this.torso.position.copy(pose.torso.position);this.torso.quaternion.copy(pose.torso.quaternion);
  for(const side of['right','left']){
   const rig=this[side],arm=pose[side],handQuaternion=side==='right'?pose.grip.quaternion:pose.leftGrip.quaternion;
   rig.upper.position.copy(arm.shoulder).sub(pose.torso.position).applyQuaternion(pose.torso.quaternion.clone().invert());
   rig.upper.quaternion.copy(pose.torso.quaternion).invert().multiply(arm.upperQuaternion);
   rig.elbow.quaternion.copy(arm.upperQuaternion).invert().multiply(arm.forearmQuaternion);
   rig.wrist.quaternion.copy(arm.forearmQuaternion).invert().multiply(handQuaternion);
  }
  this.magic.visible=pose.magic>.02;this.magic.position.copy(pose.grip.position).add(new THREE.Vector3(0,.1,-.08));this.magic.scale.setScalar(.6+pose.magic*.7);this.magic.material.color.setHex(pose.action==='heal'?0x8bffc7:0xbfa4ff);
  this.torso.visible=pose.alpha>.001;
  this.scene.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);return pose;
 }
 inspect(){this.scene.updateMatrixWorld(true);return {renderer:this.renderer,camera:this.camera,torso:this.torso,right:this.right,left:this.left,weapon:this.weapon,offhand:this.offhand};}
 destroy(){disposeGroup(this.scene);this.renderer.renderLists.dispose();}
}
