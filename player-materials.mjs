import * as THREE from './vendor/three.module.js';

const cache=new Map();
const noise=(x,y)=>{let n=Math.imul(x+17,374761393)^Math.imul(y+31,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
function surface(kind){
 if(cache.has(kind))return cache.get(kind);
 const size=256,color=new Uint8Array(size*size*4),height=new Uint8Array(color.length),roughness=new Uint8Array(color.length);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const n=noise(x,y),low=noise(x>>3,y>>3),i=(y*size+x)*4;
  let value=232+n*16,h=n*.22,r=.75;
  if(kind==='leather'){value=221+low*13+n*15;h=low*.28+n*.27+Math.sin(x*.24+Math.sin(y*.03)*2)*.045;r=.72+n*.14;}
  if(kind==='cloth'){const weave=((x%4<2)=== (y%4<2))?1:0;value=216+weave*16+n*14;h=weave*.25+n*.12;r=.86;}
  if(kind==='wood'){
   const grain=Math.sin(x*.23+Math.sin(y*.028)*1.4+Math.sin(y*.08)*.3),seam=x%43<2;
   value=seam?100:195+grain*21+n*18;h=seam?.06:.4+grain*.2+n*.08;r=.67+n*.16;
  }
  if(kind==='steel'||kind==='gold'){const scratch=Math.sin(y*2.1+low)*.03;value=237+n*16;h=n*.12+scratch;r=kind==='steel'?.28+n*.15:.3+n*.1;}
  for(let k=0;k<3;k++){color[i+k]=value;height[i+k]=Math.max(0,Math.min(255,Math.round(h*255)));roughness[i+k]=Math.round(r*255);}
  color[i+3]=height[i+3]=roughness[i+3]=255;
 }
 const texture=data=>{const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
 const maps={map:texture(color),bumpMap:texture(height),roughnessMap:texture(roughness)};maps.map.colorSpace=THREE.SRGBColorSpace;cache.set(kind,maps);return maps;
}
export function surfaceMaterial(color,kind='leather',options={}){
 const metalness=kind==='steel'?.82:kind==='gold'?.78:0;
 return new THREE.MeshStandardMaterial({color,metalness,roughness:1,...surface(kind),bumpScale:kind==='wood'?.0014:kind==='cloth'?.00065:kind==='leather'?.00065:.00008,...options});
}
export function changeSurface(mat,kind){Object.assign(mat,surface(kind));mat.bumpScale=kind==='cloth'?.00065:kind==='leather'?.00065:.00008;mat.needsUpdate=true;}
