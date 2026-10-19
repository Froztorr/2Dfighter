import { ITEMS } from './core.mjs';
import { itemArt, artCanvas } from './equipment-art.mjs';

const wornRects={
 'wolf-helm':[102,6,52,70],'frost-helm':[104,-2,48,77],'rogue-hood':[82,2,92,93],'mage-hat':[80,-20,104,54],
 'scale-mail':[55,72,146,126],'frost-plate':[55,72,146,126],'leather-vest':[55,73,146,126],
 'mage-robe':[48,72,160,296],'inferno-robe':[48,72,160,296],
 'iron-greaves':[81,158,94,185],'rogue-pants':[81,158,94,185],'mage-pants':[81,158,94,185],
 'plate-boots':[69,273,117,95],'trail-boots':[69,274,117,94],'mage-boots':[69,313,117,55]
};
// Openings are authored in the garment's local coordinates, not cut from a person.
const capeOpening=[[.35,.13],[.47,.20],[.50,.24],[.53,.20],[.65,.13],[.83,1],[.17,1]];
const hoodOpening=[[.50,.12],[.68,.30],[.74,.72],[.28,.72],[.32,.30]];
const fitted=new WeakMap();
function fittedImage(image,width,height){
 if(!fitted.has(image))fitted.set(image,new Map());const cache=fitted.get(image),key=`${width}:${height}`;if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=false;context.drawImage(image,0,0,width,height);cache.set(key,canvas);return canvas;
}
export function portraitLayers(save){
 const equipment=save.equipment,layers=[],add=(part,id,rect,extra={})=>{if(id)layers.push({part,id,rect,...extra});};
 const cloak=equipment.cloak,hood=equipment.helm==='rogue-hood',base=itemArt('base');
 add('cloak-back',cloak,[48,78,160,275]);
 if(hood)add('hood-back',equipment.helm,wornRects[equipment.helm]);
 const body=base.crop.map(value=>Math.round(value/4));add('body','base',body,equipment.armor?{hide:[[0,68,109,109],[149,68,107,109],[109,90,40,87]]}:{});
 for(const slot of ['pants','boots','armor'])add(slot,equipment[slot],wornRects[equipment[slot]]);
 add('cloak-front',cloak,[48,78,160,275],{hole:capeOpening});
 add('helm',equipment.helm,wornRects[equipment.helm],hood?{hole:hoodOpening}:{});
 add('neck',equipment.neck,[118,91,20,24]);
 const weapon=ITEMS[equipment.weapon],offhand=weapon?.hands===2?null:equipment.offhand;
 for(const [part,id,x,angle]of [['weapon',equipment.weapon,66,-.18],['offhand',offhand,190,.18]]){
  if(!id)continue;const item=ITEMS[id],art=itemArt(id),height=item.shield?83:item.magic?155:item.hands===2?147:item.slot==='offhand'||id.includes('fang')||id==='venom-dagger'?62:110;
  const width=height*art.crop[2]/art.crop[3];add(part,id,[-art.grip[0]*width,-art.grip[1]*height,width,height],{translate:[x,193],rotation:item.shield?0:angle,shield:!!item.shield});
 }
 // Base gloves cover shafts; shield faces stay in front of the hand.
 for(const [x,width]of [[55,25],[177,25]])add('glove','base',body,{clip:[x,176,width,36]});
 const shield=layers.find(layer=>layer.part==='offhand'&&layer.shield);if(shield){layers.splice(layers.indexOf(shield),1);layers.push(shield);}
 add('ring1',equipment.ring1,[63,193,5,5]);add('ring2',equipment.ring2,[188,193,5,5]);
 return layers;
}
export function paintPortrait(context,sprites,layers){
 context.save();context.imageSmoothingEnabled=false;context.translate(0,28);
 for(const layer of layers){
  const image=artCanvas(sprites,layer.id);if(!image)continue;context.save();
  if(layer.clip){context.beginPath();context.rect(...layer.clip);context.clip();}
  if(layer.hide){context.beginPath();context.rect(0,-28,256,426);for(const rect of layer.hide)context.rect(...rect);context.clip('evenodd');}
  if(layer.translate){context.translate(...layer.translate);context.rotate(layer.rotation);}
  if(layer.hole){const [x,y,w,h]=layer.rect;context.beginPath();context.rect(x,y,w,h);layer.hole.forEach(([px,py],index)=>index?context.lineTo(x+px*w,y+py*h):context.moveTo(x+px*w,y+py*h));context.closePath();context.clip('evenodd');}
  // Rasterize fitted clothing once on the logical pixel grid; repeated equips sample identically.
  context.drawImage(layer.translate?image:fittedImage(image,layer.rect[2],layer.rect[3]),...layer.rect);context.restore();
 }
 context.restore();
}
export class EquipmentFigure {
 constructor(sprites={}){this.sprites=sprites;this.canvas=document.createElement('canvas');this.canvas.width=256;this.canvas.height=426;this.context=this.canvas.getContext('2d',{willReadFrequently:true});}
 sync(save){
  const signature=Object.values(save.equipment).join(':');if(signature===this.signature)return;this.signature=signature;
  this.context.clearRect(0,0,256,426);paintPortrait(this.context,this.sprites,portraitLayers(save));
 }
 destroy(){this.canvas.width=this.canvas.height=0;}
}
