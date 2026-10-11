import * as THREE from './vendor/three.module.js';
import { ITEMS } from './core.mjs';
import { ITEM_GRIPS } from './fps-player.mjs';

// Tip landmarks align the original diagonal inventory drawings with the rig's +Y grip axis.
const TIPS={
 'rust-sword':[.83,.06],'iron-sword':[.85,.06],mace:[.59,.24],axe:[.58,.23],greatsword:[.91,.03],
 'ember-staff':[.65,.20],'parry-dagger':[.85,.08],'venom-dagger':[.77,.13],'fire-wand':[.67,.23],
 'ice-staff':[.66,.20],'frost-sword':[.91,.05],'spider-fang':[.82,.06],
 'spider-claw':[.19,.04],'assassin-dagger':[.25,.87],'inferno-axe':[.64,.24],'demon-staff':[.49,.20]
};
const cache=new Map();

// Solid front/back faces and boundary walls, rather than a transparent billboard.
// Each occupied scanline is merged into runs; only exposed pixel edges get walls.
export function extrudePixels(rgba,width,height,{grip=[.5,.5],tip=[.5,0],length=.5,depth=.025,shield=false}={}){
 const occupied=(x,y)=>x>=0&&x<width&&y>=0&&y<height&&rgba[(y*width+x)*4+3]>=100;
 const dx=tip[0]-grip[0],dy=grip[1]-tip[1],angle=shield?0:Math.atan2(dx,dy);
 const scale=shield?length:length/Math.hypot(dx,dy),cos=Math.cos(angle),sin=Math.sin(angle);
 const front=[],back=[],walls=[],uvFront=[],uvBack=[],colors=[];
 const point=(x,y,z)=>{const px=(x/width-grip[0])*scale,py=(grip[1]-y/height)*scale;return [px*cos-py*sin,px*sin+py*cos,z];};
 const quad=(dest,points)=>{for(const i of[0,1,2,0,2,3])dest.push(...points[i]);};
 const uvQuad=(dest,coords)=>{for(const i of[0,1,2,0,2,3])dest.push(...coords[i]);};
 for(let y=0;y<height;y++){
  for(let x=0;x<width;){if(!occupied(x,y)){x++;continue;}const start=x;while(occupied(x,y))x++;const end=x;
   const corners=[[start,y+1],[end,y+1],[end,y],[start,y]];
   quad(front,corners.map(([a,b])=>point(a,b,depth/2)));uvQuad(uvFront,corners.map(([a,b])=>[a/width,1-b/height]));
   const reverse=[...corners].reverse();quad(back,reverse.map(([a,b])=>point(a,b,-depth/2)));uvQuad(uvBack,reverse.map(([a,b])=>[a/width,1-b/height]));
  }
  for(let x=0;x<width;x++)if(occupied(x,y)){
   const index=(y*width+x)*4,color=new THREE.Color().setRGB(rgba[index]/255,rgba[index+1]/255,rgba[index+2]/255,THREE.SRGBColorSpace);
   for(const[nx,ny,a,b]of [[x-1,y,[x,y],[x,y+1]],[x+1,y,[x+1,y+1],[x+1,y]],[x,y-1,[x+1,y],[x,y]],[x,y+1,[x,y+1],[x+1,y+1]]]){
    if(occupied(nx,ny))continue;
    quad(walls,[point(...a,-depth/2),point(...b,-depth/2),point(...b,depth/2),point(...a,depth/2)]);
    for(let i=0;i<6;i++)colors.push(color.r*.72,color.g*.72,color.b*.72);
   }
  }
 }
 const geometry=(vertices,uv,vertexColors)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));if(vertexColors)g.setAttribute('color',new THREE.Float32BufferAttribute(vertexColors,3));g.computeVertexNormals();return g;};
 return {front:geometry(front,uvFront),back:geometry(back,uvBack),walls:geometry(walls,null,colors)};
}
// Ignore isolated atlas specks and detached glow particles in the physical silhouette.
export function solidPixelMask(rgba,width,height){
 const seen=new Uint8Array(width*height);let largest=[];
 for(let i=0;i<seen.length;i++){
  if(seen[i]||rgba[i*4+3]<100)continue;
  const component=[i];seen[i]=1;
  for(let j=0;j<component.length;j++){
   const current=component[j],x=current%width,y=Math.floor(current/width);
   for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    const nx=x+ox,ny=y+oy,index=ny*width+nx;
    if(nx<0||ny<0||nx>=width||ny>=height||seen[index]||rgba[index*4+3]<100)continue;
    seen[index]=1;component.push(index);
   }
  }
  if(component.length>largest.length)largest=component;
 }
 const result=new Uint8Array(rgba.length);for(const i of largest)result.set(rgba.subarray(i*4,i*4+4),i*4);return result;
}
function sourceAsset(id,sprites,length){
 const item=ITEMS[id],sheet=sprites?.[item?.atlas||'gear'];if(!sheet?.complete||!sheet.naturalWidth)return null;
 if(cache.has(id))return cache.get(id);
 const cols=item.atlas?4:6,rows=item.atlas?3:6,cw=sheet.naturalWidth/cols,ch=sheet.naturalHeight/rows;
 const canvas=document.createElement('canvas');canvas.width=Math.round(cw);canvas.height=Math.round(ch);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sheet,item.icon%cols*cw,Math.floor(item.icon/cols)*ch,cw,ch,0,0,canvas.width,canvas.height);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 // Native fine pixels remain in the texture. A 128-cell outline keeps the mesh light.
 const mask=document.createElement('canvas');mask.width=mask.height=128;const mc=mask.getContext('2d',{willReadFrequently:true});mc.imageSmoothingEnabled=false;mc.drawImage(canvas,0,0,128,128);
 const geometries=extrudePixels(solidPixelMask(mc.getImageData(0,0,128,128).data,128,128),128,128,{grip:item.shield?[.5,.5]:ITEM_GRIPS[id],tip:TIPS[id],length:item.shield?.36:length,depth:item.shield?.025:item.magic?.035:.024,shield:!!item.shield});
 // Keep the source hilt design while giving two-handed grips enough usable length.
 if(item.hands===2){
  let minimum=0;const positions=geometries.front.attributes.position;
  for(let i=0;i<positions.count;i++)minimum=Math.min(minimum,positions.getY(i));
  if(minimum<0&&minimum>-.19)for(const g of Object.values(geometries)){
   const p=g.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)<0)p.setY(i,p.getY(i)*(-.19/minimum));g.computeVertexNormals();
  }
 }
 const asset={texture,geometries,atlas:item.atlas||'gear',icon:item.icon};cache.set(id,asset);return asset;
}
export function makePixelEquipment(id,sprites,length){
 const asset=sourceAsset(id,sprites,length);if(!asset)return null;
 const root=new THREE.Group();
 // Painted highlights are already in the source art: preserve them without glossy PBR overlays.
 const face=()=>new THREE.MeshBasicMaterial({map:asset.texture,alphaTest:.38,toneMapped:false});
 root.add(new THREE.Mesh(asset.geometries.front.clone(),face()));
 root.add(new THREE.Mesh(asset.geometries.back.clone(),face()));
 root.add(new THREE.Mesh(asset.geometries.walls.clone(),new THREE.MeshLambertMaterial({vertexColors:true})));
 if(ITEMS[id].shield){
  // The existing wrist rig holds a rear handle 6.5 cm away from the shield face.
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.105,24),new THREE.MeshLambertMaterial({color:0x50382b}));grip.position.z=.065;root.add(grip);
  for(const y of[-.053,.053]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.065,16),new THREE.MeshLambertMaterial({color:0x88734d}));post.rotation.x=Math.PI/2;post.position.set(0,y,.033);root.add(post);}
 }
 root.userData={item:id,sourceAtlas:asset.atlas,sourceIcon:asset.icon,pixelEquipment:true};
 return root;
}
