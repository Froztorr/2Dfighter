import { ITEMS } from './core.mjs';
import { PAPERDOLL_ATLAS } from './paperdoll-atlas.mjs';

export const PORTRAIT_FILES=Object.fromEntries(['base','plate','parts','held','robe-top'].map(name=>['doll-'+name,`assets/paperdoll/${name}.png`]));
const parts={
 'wolf-helm':0,'rogue-hood':1,'mage-hat':2,'frost-helm':3,
 'iron-greaves':4,'rogue-pants':5,'mage-pants':6,'red-cape':7,
 'plate-boots':8,'trail-boots':9,'mage-boots':10,'forest-cloak':11,
 'astral-cloak':12,'silk-cloak':13,'leather-vest':14,'mage-robe':15,'inferno-robe':15,'mage-skirt':15,'inferno-skirt':15
};
const held=['rust-sword','iron-sword','mace','axe','greatsword','ember-staff','wood-shield','steel-shield','parry-dagger','venom-dagger','fire-wand','ice-staff','guardian-shield','assassin-dagger','frost-sword','frost-shield','spider-fang','spider-claw','inferno-axe','demon-staff'];
const grips=[[.5,.84],[.5,.83],[.5,.76],[.18,.74],[.5,.85],[.5,.76],[.5,.5],[.5,.5],[.5,.83],[.5,.83],[.5,.80],[.5,.80],[.5,.5],[.5,.80],[.5,.85],[.5,.5],[.5,.86],[.5,.86],[.5,.82],[.5,.83]];
export function itemArt(id){
 let sheet='doll-parts',frame=parts[id];
 if(id==='base'){sheet='doll-base';frame=0;}
 else if(['mage-top','inferno-top'].includes(id)){sheet='doll-robe-top';frame=0;}
 else if(['scale-mail','frost-plate'].includes(id)){sheet='doll-plate';frame=0;}
 else if(held.includes(id)){sheet='doll-held';frame=held.indexOf(id);}
 if(frame!==undefined){const measured=PAPERDOLL_ATLAS[sheet].frames[frame];return {sheet,frame,...measured,palette:id==='frost-plate'?'ice':id.startsWith('inferno-')&&id!=='inferno-axe'?'ember':null,grip:grips[held.indexOf(id)]||[.5,.5],tip:[.5,.02]};}
 const item=ITEMS[id];if(!item)return null;sheet=item.atlas||'gear';const cols=item.atlas?4:6,rows=item.atlas?3:6,size=item.atlas?[1448,1086]:[1254,1254];
 return {sheet,frame:item.icon,crop:[item.icon%cols*size[0]/cols,Math.floor(item.icon/cols)*size[1]/rows,size[0]/cols,size[1]/rows]};
}
const caches=new WeakMap();
export function artCanvas(sprites,id){
 const art=itemArt(id),sheet=sprites[art?.sheet];if(!sheet?.complete||!sheet.naturalWidth)return null;
 if(!caches.has(sprites))caches.set(sprites,new Map());const cache=caches.get(sprites);if(cache.has(id))return cache.get(id);
 if(id==='mage-robe'||id==='inferno-robe'){
  const kind=id==='mage-robe'?'mage':'inferno',top=artCanvas(sprites,kind+'-top'),skirt=artCanvas(sprites,kind+'-skirt');if(!top||!skirt)return null;
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=296;const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
  context.save();context.beginPath();context.rect(0,110,160,186);context.clip();context.drawImage(skirt,0,0,160,296);context.restore();context.drawImage(top,7,0,146,126);cache.set(id,canvas);return canvas;
 }
 const canvas=document.createElement('canvas'),[sx,sy,sw,sh]=art.crop;canvas.width=Math.ceil(sw);canvas.height=Math.ceil(sh);
 const context=canvas.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=false;context.drawImage(sheet,sx,sy,sw,sh,0,0,sw,sh);
 const pixels=context.getImageData(0,0,canvas.width,canvas.height),data=pixels.data,mask=art.runs?new Uint8Array(canvas.width*canvas.height):null;
 if(mask)for(const [x,y,width]of art.runs)mask.fill(1,y*canvas.width+x,y*canvas.width+x+width);
 for(let index=0;index<data.length;index+=4){
  if(data[index+3]<200||(mask&&!mask[index/4])){data[index+3]=0;continue;}data[index+3]=255;
  const r=data[index],g=data[index+1],b=data[index+2],light=.2126*r+.7152*g+.0722*b;
  if(art.palette==='ice'){data[index]=light*.68;data[index+1]=light*.88;data[index+2]=Math.min(255,light*1.08+12);}
  if(art.palette==='ember'&&b>g*1.13){data[index]=Math.min(255,light*1.25+28);data[index+1]=light*.32;data[index+2]=light*.23;}
 }
 context.putImageData(pixels,0,0);cache.set(id,canvas);return canvas;
}
export function itemIconData(sprites,id){
 const source=artCanvas(sprites,id);if(!source)return '';
 const cache=caches.get(sprites),key='icon:'+id;if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
 const scale=60/Math.max(source.width,source.height);context.drawImage(source,(64-source.width*scale)/2,(64-source.height*scale)/2,source.width*scale,source.height*scale);
 const url=canvas.toDataURL();cache.set(key,url);return url;
}
