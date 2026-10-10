import * as THREE from './vendor/three.module.js';
import { MarchingCubes } from './vendor/MarchingCubes.js';

const hands=new Map();
const smoothMin=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
function capsuleDistance(x,y,z,a,b,r){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy+(z-a[2])*dz)/(dx*dx+dy*dy+dz*dz)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t,z-a[2]-dz*t)-r;}
function ellipsoid(x,y,z,c,r){return (Math.hypot((x-c[0])/r[0],(y-c[1])/r[1],(z-c[2])/r[2])-1)*Math.min(...r);}
export function sculptedHand(side){
 if(hands.has(side))return hands.get(side).clone();
 const sign=side==='right'?1:-1,segments=[];
 for(let i=0;i<4;i++){
  const y=.025-i*.016,length=i===0||i===3?.9:1;
  const a=[sign*.053,y,.023],b=[sign*.042,y,-.007],c=[sign*.018,y,-.025*length],d=[-sign*.018,y,-.005];
  segments.push([a,b,.008],[b,c,.0075],[c,d,.0065]);
 }
 segments.push([[sign*.042,.031,.031],[sign*.02,.043,.023],.0105],[[sign*.02,.043,.023],[-sign*.009,.018,.02],.009]);
 const size=64,half=.084,field=new MarchingCubes(size,new THREE.MeshBasicMaterial(),false,false,16000);field.isolation=0;
 for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=(x/size*2-1)*half,py=(y/size*2-1)*half,pz=(z/size*2-1)*half;
  let d=ellipsoid(px,py,pz,[sign*.032,.001,.025],[.025,.04,.019]);
  d=smoothMin(d,ellipsoid(px,py,pz,[sign*.031,-.045,.025],[.019,.031,.016]),.01);
  for(const[a,b,r]of segments)d=smoothMin(d,capsuleDistance(px,py,pz,a,b,r),.0035);
  field.field[z*size*size+y*size+x]=-d*10000;
 }
 field.update();
 const count=field.geometry.drawRange.count,positions=field.geometry.attributes.position.array.slice(0,count*3),normals=field.geometry.attributes.normal.array.slice(0,count*3),uv=new Float32Array(count*2);
 for(let i=0;i<count;i++){uv[i*2]=positions[i*3]*.5+.5;uv[i*2+1]=positions[i*3+1]*.5+.5;}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.scale(half,half,half);geometry.computeBoundingSphere();
 field.geometry.dispose();field.material.dispose();hands.set(side,geometry);return geometry.clone();
}
export function organicLimb(length,profile,flatten=.82){
 const curve=new THREE.SplineCurve(profile.map(([t,r])=>new THREE.Vector2(t,r))),radial=48,rings=36,positions=[],uv=[],indices=[];
 for(let j=0;j<=rings;j++){
  const t=j/rings,point=curve.getPoint(t),radius=point.y;
  for(let i=0;i<=radial;i++){const angle=i/radial*Math.PI*2;const fold=1+Math.sin(t*86+Math.cos(angle*3))*.012;positions.push(Math.cos(angle)*radius*fold,point.x*length,Math.sin(angle)*radius*flatten*fold);uv.push(i/radial,t*2);}
 }
 for(let j=0;j<rings;j++)for(let i=0;i<radial;i++){const a=j*(radial+1)+i,b=a+radial+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function curvedHandPlate(){
 const rings=16,radial=48,p=[],uv=[],indices=[];
 for(let j=0;j<=rings;j++)for(let i=0;i<=radial;i++){
  const t=j/rings,a=i/radial*Math.PI*2,r=.96*t,c=Math.cos(a),s=Math.sin(a),x=Math.sign(c)*Math.abs(c)**.65*.022*r,y=Math.sign(s)*Math.abs(s)**.65*.031*r;
  const z=.0038*Math.sqrt(Math.max(0,1-r*r))+.00065*Math.cos(x/.008*Math.PI)*r*(1-r);
  p.push(x,y,z);uv.push((x/.05+.5)*2,(y/.07+.5)*2);
 }
 for(let j=0;j<rings;j++)for(let i=0;i<radial;i++){const a=j*(radial+1)+i,b=a+radial+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
