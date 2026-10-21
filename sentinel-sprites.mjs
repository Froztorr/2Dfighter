import * as T from './vendor/three.module.js';
import {CLIPS} from './expedition-core.mjs';

// A single articulated source is baked into 96 isolated billboard frames.
export function makeSentinelAtlas(renderer){
 const size=192,canvas=document.createElement('canvas');canvas.width=size*8;canvas.height=size*CLIPS.length;
 const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1.9,1.9,1.9,-1.9,.1,30);camera.position.set(0,1.65,8);camera.lookAt(0,1.65,0);
 scene.add(new T.HemisphereLight(0xc6e1ff,0x33332c,2));const light=new T.DirectionalLight(0xffd5a0,3);light.position.set(-3,5,5);scene.add(light);
 const root=new T.Group();scene.add(root);
 function material(color,metal=false){
  const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),base=new T.Color(color);
  for(let y=0;y<32;y++)for(let i=0;i<32;i++){const shade=((i*17+y*13+i*y)%11)/35+.78;x.fillStyle='#'+base.clone().multiplyScalar(shade).getHexString();x.fillRect(i,y,1,1);}
  const map=new T.CanvasTexture(c);map.magFilter=map.minFilter=T.NearestFilter;map.colorSpace=T.SRGBColorSpace;
  return new T.MeshStandardMaterial({color:0xffffff,map,roughness:metal?.7:1,metalness:metal?.35:0,flatShading:true});
 }
 const steel=material('#647780',true),edge=material('#b89c68',true),skin=material('#658052'),dark=material('#293239'),cloth=material('#863c3b'),bone=material('#ead5a6'),black=material('#161c20');
 function mesh(parent,g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;}
 const box=(p,m,w,h,d,x=0,y=0,z=0)=>mesh(p,new T.BoxGeometry(w,h,d),m,x,y,z);
 const sphere=(p,m,r,x,y,z,sx=1,sy=1,sz=1)=>{const o=mesh(p,new T.SphereGeometry(r,8,6),m,x,y,z);o.scale.set(sx,sy,sz);return o;};
 const joint=(p,x,y,z=0)=>{const o=new T.Group();o.position.set(x,y,z);p.add(o);return o;};
 const hips=joint(root,0,.95),body=joint(hips,0,.17),head=joint(body,0,.92);
 box(hips,cloth,.48,.3,.3);box(body,steel,.68,.66,.4,0,.31);box(body,edge,.73,.08,.43,0,.04);box(body,dark,.09,.66,.03,0,.31,.22);
 for(const sign of[-1,1])for(let i=0;i<3;i++)box(body,edge,.22,.025,.035,sign*.2,.2+i*.17,.215);
 sphere(head,skin,.26,0,.05,0,1.15,1.1,.95);box(head,steel,.52,.12,.43,0,.24);box(head,steel,.16,.17,.5,0,.27);
 sphere(head,skin,.2,0,-.08,.16,1.2,.58,.65);box(head,black,.27,.075,.03,0,-.13,.3);
 for(const sign of[-1,1]){
  const brow=box(head,dark,.2,.07,.07,sign*.15,.1,.23);brow.rotation.z=-sign*.2;
  box(head,new T.MeshBasicMaterial({color:0xffbd59}),.085,.035,.035,sign*.14,.055,.265);
  mesh(head,new T.ConeGeometry(.04,.18,5),bone,sign*.13,-.08,.32);
  const horn=mesh(head,new T.ConeGeometry(.09,.38,6),bone,sign*.32,.36);horn.rotation.z=-sign*.65;
  const ear=mesh(head,new T.ConeGeometry(.1,.28,4),skin,sign*.32,.07);ear.rotation.z=-sign*Math.PI/2;
 }
 box(body,cloth,.64,.13,.46,0,.68);const tail=box(body,cloth,.24,.7,.035,.15,.2,-.25);tail.rotation.z=.2;
 const arms=[],legs=[];
 for(const sign of[-1,1]){
  const shoulder=joint(body,sign*.45,.62),elbow=joint(shoulder,0,-.4),hand=joint(elbow,0,-.37);
  sphere(shoulder,steel,.25,0,-.03,0,1.15,.7,1.1);box(shoulder,edge,.38,.055,.4,0,-.16);
  mesh(shoulder,new T.ConeGeometry(.06,.23,4),bone,sign*.1,.16);
  sphere(shoulder,skin,.13,0,-.26,0,.95,1.55,1);sphere(elbow,dark,.145,0,0,0);box(elbow,steel,.22,.27,.25,0,-.18);box(elbow,edge,.23,.05,.27,0,-.29);sphere(hand,skin,.14,0,-.02,0);
  arms.push({shoulder,elbow,hand});
  const hip=joint(hips,sign*.23,-.08),knee=joint(hip,0,-.39),foot=joint(knee,0,-.38);
  sphere(hip,dark,.15,0,-.18,0,1,1.6,1);box(hip,steel,.26,.28,.3,0,-.13,.04);sphere(knee,edge,.15,0,0,.05);
  box(knee,steel,.23,.32,.25,0,-.18);box(foot,dark,.26,.14,.4,0,-.02,.08);box(foot,edge,.27,.05,.4,0,-.07,.08);legs.push({hip,knee,foot});
 }
 const axe=joint(arms[0].hand,0,-.02);box(axe,dark,.075,1.05,.075,0,.35);box(axe,edge,.1,.12,.1,0,-.14);
 const blade=box(axe,steel,.48,.4,.09,-.19,.78);blade.rotation.z=.15;box(axe,bone,.055,.4,.1,-.44,.8);box(axe,edge,.1,.22,.12,0,.78);
 const orb=mesh(arms[1].hand,new T.IcosahedronGeometry(.2,1),new T.MeshBasicMaterial({color:0x81dbea}),0,.12,.2);
 function pose(name,f){
  const t=f/8*Math.PI*2,walk=name.startsWith('walk'),attack=['up','down','left','right','thrust','kick','cast'].includes(name),p=f/7;
  root.rotation.set(0,name==='walk-quarter'?.8:name==='walk-rear'?2.3:name==='walk-back'?Math.PI:0,0);
  hips.position.y=.95+(walk?Math.abs(Math.sin(t))*.035:Math.sin(t)*.025);hips.rotation.set(0,walk?Math.cos(t)*.06:0,0);body.rotation.set(0,Math.cos(t)*.035,Math.sin(t)*.018);head.rotation.set(Math.cos(t)*.035,Math.sin(t)*.025,0);orb.visible=false;tail.rotation.x=Math.sin(t)*.12;
  arms.forEach(({shoulder,elbow,hand},i)=>{shoulder.rotation.set(walk?Math.sin(t+i*Math.PI)*.55:-.25,0,i===0?.17:-.17);elbow.rotation.set(-.3,0,0);hand.rotation.set(0,0,0);});
  legs.forEach(({hip,knee,foot},i)=>{const swing=Math.sin(t+i*Math.PI);hip.rotation.set(walk?swing*.55:0,0,i===0?.07:-.07);knee.rotation.set(walk?Math.max(0,-swing)*.65:.08,0,0);foot.rotation.set(walk?-Math.max(0,-swing)*.25:0,0,0);});
  axe.rotation.set(0,0,-.12);
  if(attack){
   const joints=[body,head,axe,...arms.flatMap(a=>[a.shoulder,a.elbow,a.hand]),...legs.flatMap(a=>[a.hip,a.knee,a.foot])],ready=joints.map(o=>o.rotation.clone());
   // Frames 0-2 load the weapon, 3-5 contact, 6-7 return to the shared ready pose.
   const wind=Math.sin(Math.min(1,p/.4)*Math.PI/2),release=p<.4?0:Math.sin(Math.min(1,(p-.4)/.6)*Math.PI),a=arms[0],b=arms[1];
   body.rotation.y=wind*.28-release*.65;body.rotation.x=-release*.1;
   if(name==='down'){a.shoulder.rotation.x=-wind*2.5+release*2.2;a.elbow.rotation.x=-wind*.7;}
   if(name==='up'){a.shoulder.rotation.x=wind*.5-release*2.2;a.elbow.rotation.x=-.5;body.rotation.z=-wind*.12;}
   if(name==='left'||name==='right'){const s=name==='left'?1:-1;a.shoulder.rotation.x=-.9;a.shoulder.rotation.z=s*(wind*1.2-release*2.2);a.elbow.rotation.x=-.6;axe.rotation.z=s*.7;}
   if(name==='thrust'){a.shoulder.rotation.x=-1.2-release*.4;a.elbow.rotation.x=-1.2+release;axe.rotation.x=Math.PI/2;body.position.z=release*.2;}
   else body.position.z=0;
   if(name==='kick'){legs[1].hip.rotation.x=-wind*.6-release*1.1;legs[1].knee.rotation.x=wind*1.1-release;body.rotation.x=.18;arms[0].shoulder.rotation.z=.7;}
   if(name==='cast'){b.shoulder.rotation.x=-1.3;b.elbow.rotation.x=-.5;orb.visible=true;orb.scale.setScalar(.6+wind*.8);orb.position.z=.2+release*.6;head.rotation.x=-.08;}
   const blend=Math.min(1,p/.2,(1-p)/.2);
   joints.forEach((o,i)=>{for(const axis of['x','y','z'])o.rotation[axis]=ready[i][axis]+(o.rotation[axis]-ready[i][axis])*blend;});body.position.z*=blend;if(blend<.1)orb.visible=false;
  }else body.position.z=0;
 }
 const oldSize=renderer.getSize(new T.Vector2()),oldRatio=renderer.getPixelRatio(),oldColor=renderer.getClearColor(new T.Color()),oldAlpha=renderer.getClearAlpha();
 renderer.setPixelRatio(1);renderer.setSize(size,size,false);renderer.setClearColor(0x000000,0);
 const checks=[];
 CLIPS.forEach(({name},row)=>{for(let f=0;f<8;f++){
  pose(name,f);renderer.render(scene,camera);ctx.drawImage(renderer.domElement,f*size,row*size);
  const pixels=ctx.getImageData(f*size,row*size,size,size).data;let count=0,minX=size,minY=size,maxX=0,maxY=0,hash=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;if(pixels[i+3]>32){count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);hash=(Math.imul(hash,31)+pixels[i]+pixels[i+1]*3+pixels[i+2]*7+i)|0;}}
  checks.push({clip:name,frame:f,count,minX,minY,maxX,maxY,hash});
 }});
 canvas.spriteChecks=checks;
 if(checks.some(c=>c.count<100||c.minX===0||c.minY===0||c.maxX===size-1||c.maxY===size-1))console.warn('Sentinel atlas has an empty or edge-clipped frame',checks.filter(c=>c.count<100||c.minX===0||c.minY===0||c.maxX===size-1||c.maxY===size-1));
 renderer.setPixelRatio(oldRatio);renderer.setSize(oldSize.x,oldSize.y,false);renderer.setClearColor(oldColor,oldAlpha);
 const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose();}
 return canvas;
}
export function sentinelFrame(texture,clip,frame,flip=false){
 const row=Math.max(0,CLIPS.findIndex(c=>c.name===clip));texture.repeat.set((flip?-1:1)/8,1/CLIPS.length);texture.offset.set((frame+(flip?1:0))/8,1-(row+1)/CLIPS.length);
}
