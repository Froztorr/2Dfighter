import * as THREE from './vendor/three.module.js';
import { ITEMS } from './core.mjs';
import { combatWebGLRenderer, makeWeapon, makeShield, WEAPON_STYLES } from './player-3d.mjs';
import { makePixelEquipment } from './pixel-equipment.mjs';

// Authored landmarks register every outfit to one silhouette at neck, belt,
// knees and ankles. Source figures have different proportions and cannot be sliced as-is.
export const PORTRAIT_ANCHORS=[
 {y:[0,175,420,555,750,1000],left:[112,103,129,112,112,0],right:[278,281,259,272,272,384]},
 {y:[0,178,410,552,745,994],left:[106,80,132,104,110,0],right:[280,305,261,282,280,384]},
 {y:[0,183,410,556,748,994],left:[108,91,133,118,116,0],right:[285,303,263,283,280,384]},
 {y:[0,181,413,557,748,994],left:[104,85,130,115,111,0],right:[289,313,264,288,285,384]}
];
const target=PORTRAIT_ANCHORS[0],cache=new Map();
function dispose(root){root.traverse(object=>{object.geometry?.dispose();if(object.material)for(const material of [].concat(object.material))material.dispose();});root.removeFromParent();}
function registeredFigure(sheet,look,hue=0){
 const key=`${look}:${hue}`;if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=1024;
 const context=canvas.getContext('2d'),source=PORTRAIT_ANCHORS[look],cell=sheet.naturalWidth/4;context.imageSmoothingEnabled=false;
 if(hue)context.filter=`hue-rotate(${hue}deg)`;
 for(let y=0;y<1000;y++){
  const section=Math.min(4,target.y.findLastIndex(value=>y>=value)),progress=(y-target.y[section])/(target.y[section+1]-target.y[section]);
  const mix=values=>values[section]+(values[section+1]-values[section])*progress;
  const sy=mix(source.y),left=mix(source.left),right=mix(source.right),destLeft=mix(target.left),destRight=mix(target.right);
  const scale=(destRight-destLeft)/(right-left),offset=destLeft-left*scale;
  context.drawImage(sheet,look*cell,sy*sheet.naturalHeight/1024,cell,sheet.naturalHeight/1024,offset,y,384*scale,1.1);
 }
 cache.set(key,canvas);return canvas;
}
export class Portrait3D {
 constructor(renderer=combatWebGLRenderer(),sprites={}){
  this.renderer=renderer;this.sprites=sprites;this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-.64,.64,2.05,-.083,.05,10);this.camera.position.set(0,0,4);this.camera.lookAt(0,0,0);
  this.scene.add(new THREE.HemisphereLight(0xdbe9e9,0x302824,2));const key=new THREE.DirectionalLight(0xffe4bc,2);key.position.set(-2,3,4);this.scene.add(key);
  this.model=new THREE.Group();this.scene.add(this.model);this.textures=[];
 }
 sync(save){
  const signature=Object.values(save.equipment).join(':');if(signature===this.signature){this.renderer.render(this.scene,this.camera);return;}this.signature=signature;
  for(const child of [...this.model.children])dispose(child);for(const texture of this.textures)texture.dispose();this.textures=[];this.offhand=null;
  const equipment=save.equipment,armorLook=ITEMS[equipment.armor]?.look||0;
  const canvas=typeof document==='undefined'?null:document.createElement('canvas');
  if(canvas&&this.sprites.portrait?.naturalWidth){
   canvas.width=384;canvas.height=1024;const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
   // Robes keep their continuous outer silhouette; fitted garments expose trousers.
   const sections=[['boots',750,1024],['pants',555,750],['armor',175,555],['helm',0,175]];
   if(armorLook===3){sections[1][1]=750;sections[1][2]=750;sections[2][2]=955;}
   if(equipment.cloak){
    context.save();
    context.beginPath();context.moveTo(110,205);context.bezierCurveTo(80,360,64,680,55,940);context.lineTo(192,900);context.lineTo(330,940);context.bezierCurveTo(315,650,300,340,275,205);context.closePath();context.fill();
    context.clip();context.filter=`grayscale(1) sepia(1) hue-rotate(${equipment.cloak==='red-cape'?-45:equipment.cloak==='forest-cloak'?60:210}deg) saturate(2) brightness(.65)`;context.drawImage(registeredFigure(this.sprites.portrait,3),0,0);context.restore();
   }
   for(const [slot,start,end]of sections){
    if(end<=start)continue;const item=ITEMS[equipment[slot]],look=slot==='armor'?armorLook:item?.look||0;
    const lower=slot==='pants'||slot==='boots',sourceLook=lower&&look===3?0:look;
    const image=registeredFigure(this.sprites.portrait,sourceLook,(item?.hue||0)+(lower&&look===3?245:0));
    if(lower){
     const layer=document.createElement('canvas');layer.width=384;layer.height=end-start;const paint=layer.getContext('2d'),base=registeredFigure(this.sprites.portrait,0,look===3?245:0);
     paint.drawImage(base,0,start,384,end-start,0,0,384,end-start);paint.drawImage(image,0,start,384,end-start,0,0,384,end-start);paint.globalCompositeOperation='destination-in';paint.drawImage(base,0,start,384,end-start,0,0,384,end-start);context.drawImage(layer,0,start);
    }else context.drawImage(image,0,start,384,end-start,0,start,384,end-start);
   }
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearFilter;this.textures.push(texture);
   const body=new THREE.Mesh(new THREE.PlaneGeometry(.74,1.8),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.1,toneMapped:false}));body.position.set(0,.94,0);this.model.add(body);
   // Hand occlusion is registered with the same pixels as the body, over the shaft.
   for(const [x,width]of [[0,70],[309,75]]){
    const glove=document.createElement('canvas');glove.width=width;glove.height=130;glove.getContext('2d').drawImage(canvas,x,405,width,130,0,0,width,130);
    const map=new THREE.CanvasTexture(glove);map.colorSpace=THREE.SRGBColorSpace;this.textures.push(map);
    const hand=new THREE.Mesh(new THREE.PlaneGeometry(width/384*.74,130/1024*1.8),new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.1,toneMapped:false}));hand.position.set((x+width/2)/384*.74-.37,.94+.9-(405+65)/1024*1.8,.075);this.model.add(hand);
   }
  }
  this.rightGrip=new THREE.Group();this.leftGrip=new THREE.Group();this.rightGrip.position.set(-.295,.965,.025);this.leftGrip.position.set(.297,.965,.027);this.model.add(this.rightGrip,this.leftGrip);
  this.rightGrip.rotation.z=.6;this.leftGrip.rotation.z=-.55;
  const make=id=>!id?new THREE.Group():makePixelEquipment(id,this.sprites,WEAPON_STYLES[id]?.length)||(ITEMS[id]?.shield?makeShield(id):makeWeapon(id));
  this.weapon=make(equipment.weapon);this.rightGrip.add(this.weapon);
  if(ITEMS[equipment.weapon]?.hands===2){
   this.rightGrip.rotation.z=.35;
   if(WEAPON_STYLES[equipment.weapon]?.kind==='axe')this.weapon.scale.setScalar(.68);
   if(WEAPON_STYLES[equipment.weapon]?.kind==='staff')this.weapon.scale.setScalar(.8);
  }
  else if(equipment.offhand){this.offhand=make(equipment.offhand);this.leftGrip.add(this.offhand);if(ITEMS[equipment.offhand].shield)this.offhand.rotation.y=Math.PI;}
  for(const [slot,position]of [['neck',[0,1.43,.08]],['ring1',[-.296,.975,.09]],['ring2',[.30,.975,.09]]]){
   if(!equipment[slot])continue;const root=new THREE.Group();this.model.add(root);const radius=slot==='neck'?.018:.007;
   const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,radius*.2,8,24),new THREE.MeshBasicMaterial({color:0xd0b477}));ring.position.set(...position);root.add(ring);
   if(slot==='neck'){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.012),new THREE.MeshBasicMaterial({color:equipment.neck==='spider-pendant'?0x78bc72:0x9dccda}));gem.position.set(position[0],position[1]-.02,position[2]);root.add(gem);}
  }
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.28,.32,.035,48),new THREE.MeshLambertMaterial({color:0x43554e}));pedestal.position.set(0,.035,0);this.model.add(pedestal);
  this.scene.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);
 }
 destroy(){dispose(this.model);for(const texture of this.textures)texture.dispose();this.renderer.renderLists.dispose();}
}
