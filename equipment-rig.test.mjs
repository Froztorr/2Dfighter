import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from './vendor/three.module.js';
import {ITEMS,newSave} from './core.mjs';
import {CharacterRig,STANCES,stanceFor,weaponTip,aimWeapon,blendPostures} from './equipment-rig.mjs';
import {cleanPose,readPoses,writePose,exportPoses} from './pose-settings.mjs';

test('export contains all saved A/B poses and excludes progression and unsaved or unknown data',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const stance={right:[-.2,1.2,.2],rightElbow:[.1,0,0],attack:{right:[.1,1.3,.3],rightWrist:[0,0,-.6]}};
 writePose(storage,'single',stance);writePose(storage,'staff',{neckRotation:[.1,0,0]});
 data.set('emberblade-v1','{"gold":999,"equipment":{"weapon":"rust-sword"}}');
 const output=JSON.parse(exportPoses(storage));
 assert.equal(output.format,'emberblade-poses');assert.equal(output.version,1);assert.equal(output.angleUnit,'radians');
 assert.deepEqual(output.poses,{staff:{neckRotation:[.1,0,0]},single:stance});
 assert.ok(!JSON.stringify(output).includes('gold'));assert.equal(output.poses.shield,undefined);
 assert.deepEqual(JSON.parse(exportPoses({getItem:()=>'{bad'})).poses,{});
 assert.deepEqual(JSON.parse(data.get('emberblade-v1')),{gold:999,equipment:{weapon:'rust-sword'}});
});

test('authored A/B attack reaches both poses, interpolates shortest rotation and persists without nesting',()=>{
 const a={right:[-.3,1.12,.24],rightWrist:[0,0,170*Math.PI/180],neckRotation:[.05,0,0]};
 const b={right:[-.1,1.3,.34],rightWrist:[0,0,-170*Math.PI/180],neckRotation:[.3,0,.1],torso:[.02,0,0]};
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 writePose(storage,'single',{...a,attack:{...b,attack:{right:[0,1,0]}}});
 const saved=readPoses(storage).single;assert.deepEqual(saved.attack,b);assert.equal(saved.attack.attack,undefined);
 const halfway=blendPostures(a,b,.5);
 assert.ok(Math.abs(Math.abs(halfway.rightWrist[2])-Math.PI)<1e-6,'rotation must take the short path through 180 degrees');
 assert.ok(Math.abs(halfway.right[0]+.2)<1e-6);
 const model=new CharacterRig(),save=newSave();save.equipment.weapon='iron-sword';save.equipment.offhand=null;model.equip(save);
 const snapshot=()=>Object.values(model.bones).map(b=>({p:b.getWorldPosition(new Vector3()),q:b.getWorldQuaternion(new Quaternion())}));
 try{
  for(const [time,expected]of [[0,a],[275,{...a,...b}],[550,a]]){
   model.pose({angle:0,reducedMotion:true,posture:expected});const reference=snapshot();
   model.pose({angle:0,action:'slash',time,reducedMotion:true,posture:saved});snapshot().forEach((bone,i)=>{
    assert.ok(bone.p.distanceTo(reference[i].p)<1e-5,'attack endpoint must match authored pose');
    assert.ok(bone.q.angleTo(reference[i].q)<1e-5);
   });
  }
 }finally{model.destroy();}
});

test('joint rotations persist and move connected limbs, neck and fitted equipment',()=>{
 const model=new CharacterRig(),save=newSave(),custom={torso:[.02,.03,0],hipRotation:[.12,0,.08],neckRotation:[.2,0,.1],rightShoulder:[.3,0,.2],leftShoulder:[-.2,0,.1],rightElbow:[.25,0,.1],leftElbow:[.2,0,-.1],rightKnee:[.3,0,.08],leftKnee:[.2,0,-.08],rightWrist:[.2,0,.3],leftWrist:[-.2,0,.1]};
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 writePose(storage,'swords',custom);assert.deepEqual(readPoses(storage).swords,custom);
 save.equipment.weapon='iron-sword';save.equipment.offhand='rust-sword';model.equip(save);
 try{
  model.pose({angle:0,reducedMotion:true});const before={};
  for(const name of ['rightShoulder','leftShoulder','rightElbow','leftElbow','rightKnee','leftKnee','rightWrist','leftWrist','neck'])before[name]=model.bones[name].quaternion.clone();
  model.pose({angle:0,reducedMotion:true,posture:custom});
  for(const name of Object.keys(before))assert.ok(before[name].angleTo(model.bones[name].quaternion)>.02,name+' must rotate');
  assert.ok(Math.abs(model.bones.spine.position.x-.02)<1e-6);
  assert.ok(Math.abs(model.bones.hips.rotation.z-.08)<1e-6);
  assert.equal(model.equipment.weapon.parent,model.arms.right.grip);
  assert.equal(model.equipment.offhand.parent,model.arms.left.grip);
  for(const side of ['left','right']){
   const a=model.arms[side],l=model.legs[side],p=b=>b.getWorldPosition(new Vector3());
   assert.ok(Math.abs(p(a.shoulder).distanceTo(p(a.elbow))-.29)<1e-6);
   assert.ok(Math.abs(p(a.elbow).distanceTo(p(a.wrist))-.255)<1e-6);
   assert.ok(Math.abs(p(l.knee).distanceTo(p(l.ankle))-.39)<1e-6);
  }
 }finally{model.destroy();}
});

test('tip aiming rotates the actual weapon with the wrist, including staff and mirrored mixed hands',()=>{
 const model=new CharacterRig(),save=newSave();
 try{
  for(const [weapon,offhand,side]of [['iron-sword','mace','right'],['mace','iron-sword','left'],['ember-staff',null,'left']]){
   save.equipment.weapon=weapon;save.equipment.offhand=offhand;model.equip(save);
   let posture={rightShoulder:[.1,0,.1],leftElbow:[.12,0,0]};
   model.pose({angle:.45,reducedMotion:true,posture});
   const origin=model.arms[side].wrist.getWorldPosition(new Vector3()),target=origin.clone().add(new Vector3(.3,.45,.2));
   posture={...posture,...aimWeapon(model,side,target,posture)};
   model.pose({angle:.45,reducedMotion:true,posture});
   const direction=weaponTip(model,side).sub(origin).normalize();
   assert.ok(direction.dot(target.sub(origin).normalize())>.999,'tip must follow target direction');
  }
  assert.deepEqual(aimWeapon(model,'right',new Vector3(),{}),{},'free casting hand has no tip');
 }finally{model.destroy();}
});

test('custom joints still join the greatsword support grip during contact and return smoothly',()=>{
 const model=new CharacterRig(),save=newSave();save.equipment.weapon='greatsword';save.equipment.offhand=null;model.equip(save);
 const posture={rightWrist:[.15,.1,.2],rightShoulder:[.08,0,.05],leftElbow:[.1,0,0]};
 try{
  model.pose({angle:0,action:'slash',time:275,reducedMotion:true,posture});
  const target=model.arms.right.grip.localToWorld(new Vector3(0,-.15,0)),support=model.arms.left.grip.getWorldPosition(new Vector3());
  assert.ok(target.distanceTo(support)<.002,'support palm must remain on the rotated hilt');
  let previous;
  for(let time=0;time<=550;time+=10){
   model.pose({angle:0,action:'slash',time,reducedMotion:true,posture});
   const p=model.arms.left.grip.getWorldPosition(new Vector3());if(previous)assert.ok(p.distanceTo(previous)<.07);previous=p;
  }
 }finally{model.destroy();}
});

test('inventory face is modeled on the head and uses the same material language as the body',()=>{
 const model=new CharacterRig();
 try{
  const face=model.bones.head.children.find(o=>o.name==='face-features');
  assert.ok(face,'face must have physical features, not a portrait crop stretched over a sphere');
  assert.ok(face.children.length>=6);
  assert.ok(!model.faceTexture);
  const cloth=model.material('rogue-pants',0x60452f,'leather');assert.ok(cloth.map.isDataTexture,'garments use a tailored weave, not an illustration crop');assert.equal(cloth.map.image.width,32);cloth.dispose();
 }finally{model.destroy();}
});

test('all equipment uses one skeleton and replaces covered body segments',()=>{
 const model=new CharacterRig(),save=newSave();
 try{
  assert.ok(model.skeleton.bones.length>=20);
  for(const [id,item]of Object.entries(ITEMS)){
   save.equipment={...newSave().equipment,[item.slot==='ring'?'ring1':item.slot]:id};model.equip(save);
   const slot=item.slot==='ring'?'ring1':item.slot,group=model.equipment[slot];assert.equal(group.userData.item,id);
   assert.ok(group.children.length>0||group.userData.attached?.some(g=>g.children.length),id+' has no geometry');
   group.traverse(object=>{if(object.isSkinnedMesh){assert.equal(object.skeleton,model.skeleton);const w=object.geometry.getAttribute('skinWeight');for(let i=0;i<w.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5);}});
   if(item.slot==='pants')assert.equal(model.base.pants.visible,false);
   if(item.slot==='boots')assert.equal(model.base.boots.visible,false);
  }
  save.equipment.weapon='greatsword';save.equipment.offhand='steel-shield';model.equip(save);assert.ok(!model.equipment.offhand);
 }finally{model.destroy();}
});

test('animated equipment stays in the physical grip and limbs retain their length',()=>{
 const model=new CharacterRig(),save=newSave();save.equipment.weapon='venom-dagger';save.equipment.offhand='parry-dagger';save.equipment.cloak='forest-cloak';model.equip(save);
 try{
  let start;
  for(const action of ['idle','walk','slash','guard','cast'])for(const time of [0,120,270,600,1400]){
   model.pose({action,time,angle:.35});model.root.updateMatrixWorld(true);
   for(const side of ['right','left']){
    const arm=model.arms[side],hand=arm.grip.getWorldPosition(new Vector3()),weapon=model.equipment[side==='right'?'weapon':'offhand'];
    assert.ok(hand.distanceTo(weapon.getWorldPosition(new Vector3()))<1e-6,'weapon detached from palm');
    assert.ok(Math.abs(arm.shoulder.getWorldPosition(new Vector3()).distanceTo(arm.elbow.getWorldPosition(new Vector3()))-.29)<1e-6);
    assert.ok(Math.abs(arm.elbow.getWorldPosition(new Vector3()).distanceTo(arm.wrist.getWorldPosition(new Vector3()))-.255)<1e-6);
   }
   if(action==='slash'&&time===0)start=model.arms.right.grip.getWorldPosition(new Vector3());
   if(action==='slash'&&time===120)assert.ok(start.distanceTo(model.arms.right.grip.getWorldPosition(new Vector3()))>.1,'attack must articulate the arm');
  }
  model.pose({time:0,reducedMotion:true});const initial=model.arms.right.grip.getWorldPosition(new Vector3());model.pose({time:1200,reducedMotion:true});assert.ok(initial.distanceTo(model.arms.right.grip.getWorldPosition(new Vector3()))<1e-6);
 }finally{model.destroy();}
});

test('reference stances select the correct hand, blade direction and relaxed/ready silhouette',()=>{
 const model=new CharacterRig(),save=newSave();
 const point=(side)=>model.arms[side].grip.getWorldPosition(new Vector3());
 const direction=(slot)=>{const prop=model.equipment[slot];return prop.localToWorld(new Vector3(0,1,0)).sub(prop.getWorldPosition(new Vector3())).normalize();};
 try{
  for(const [weapon,offhand]of [['greatsword',null],['iron-sword','mace'],['ember-staff',null],['iron-sword','rust-sword'],['iron-sword','steel-shield'],['venom-dagger','mace']]){
   save.equipment.weapon=weapon;save.equipment.offhand=offhand;model.equip(save);model.pose({angle:0,reducedMotion:true});
   const ready=[point('right'),point('left')];
   if(weapon==='greatsword'){assert.ok(direction('weapon').y>.5,'greatsword silhouette points up above the shoulder');assert.ok(ready[0].y>1.2);}
   else if(weapon==='ember-staff'){assert.equal(model.equipment.weapon.parent,model.arms.left.grip);assert.ok(model.arms.right.gesture.visible,'mage has a free casting hand');assert.ok(direction('weapon').y>.8,'staff head points up');}
   else if(offhand==='mace'&&weapon==='iron-sword'){assert.ok(ready[0].y>1.4&&ready[1].y<1.1);assert.ok(Math.abs(direction('weapon').y)<.25,'sword rests horizontally over the shoulder');}
   else if(offhand==='rust-sword'){assert.ok(direction('weapon').y>.4&&direction('offhand').y<-.3,'twin swords use opposing high/low lines');}
   else if(offhand==='steel-shield')assert.ok(ready[1].y>1.1&&ready[1].z>.2,'shield protects the torso');
   else assert.ok(ready[0].y>1.15&&ready[1].y>1.10,'short weapons use the raised asymmetric guard');
   model.pose({action:'slash',time:275,angle:0});
   if(weapon==='greatsword'){const grip=model.arms.right.grip.localToWorld(new Vector3(0,-.15,0));assert.ok(grip.distanceTo(point('left'))<1e-5,'support hand joins the greatsword hilt for the cut');}
   model.pose({action:'slash',time:550,angle:0,reducedMotion:true});['right','left'].forEach((side,i)=>assert.ok(point(side).distanceTo(ready[i])<1e-5,'cut returns to reference stance'));
   let previous;
   for(let time=0;time<=550;time+=10){
    model.pose({action:'slash',time,angle:0,reducedMotion:true});
    const hands=[point('right'),point('left')];
    if(previous)hands.forEach((p,i)=>assert.ok(p.distanceTo(previous[i])<.07,weapon+' has a discontinuous hand path'));
    previous=hands;
   }
  }
  save.equipment.weapon='mace';save.equipment.offhand='iron-sword';model.equip(save);model.pose({angle:0,reducedMotion:true});assert.ok(point('left').y>1.4&&point('right').y<1.1,'the sword shoulder pose follows the hand actually holding the sword');
 }finally{model.destroy();}
});

test('skin and garments have repeatable colored pixel clusters with discrete shade ramps',()=>{
 const model=new CharacterRig();
 try{
  for(const kind of ['skin','cloth','leather','steel']){
   const a=model.material(null,0xb98c6c,kind),b=model.material(null,0xb98c6c,kind);
   assert.ok(a.map?.isDataTexture,kind+' is missing its surface texture');
   assert.equal(a.map,b.map,'repeated materials should reuse their texture');
   const data=a.map.image.data,colors=new Set();
   for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);}
   assert.ok(colors.size>=5&&colors.size<=10,kind+' needs a controlled multi-shade palette');
   assert.ok([...colors].some(c=>new Set(c.split(',')).size>1),'shadows must carry hue, not just grey noise');
   a.dispose();b.dispose();
  }
 }finally{model.destroy();}
});

test('continuous garment vertices deform at elbows rather than splitting into pictures',()=>{
 const model=new CharacterRig(),save=newSave();save.equipment.armor='leather-vest';model.equip(save);
 try{
  const sleeve=model.equipment.armor.children.find(m=>m.isSkinnedMesh&&m.geometry.getAttribute('skinIndex').array.includes(model.skeleton.bones.indexOf(model.bones.rightElbow)));
  assert.ok(sleeve);const p=sleeve.geometry.attributes.position,index=Math.floor(p.count*.8),before=new Vector3().fromBufferAttribute(p,index);model.pose({time:0,reducedMotion:true});const a=sleeve.applyBoneTransform(index,before.clone());model.pose({action:'slash',time:270});const b=sleeve.applyBoneTransform(index,before.clone());assert.ok(a.distanceTo(b)>.1);
 }finally{model.destroy();}
});

test('boot shafts follow the shin while soles stay planted in spread and bent-knee stances',()=>{
 const model=new CharacterRig(),save=newSave();save.equipment.boots='trail-boots';save.equipment.weapon='venom-dagger';save.equipment.offhand='mace';model.equip(save);
 try{
  for(const action of ['idle','slash','walk'])for(const time of [0,120,275]){
   model.pose({action,time});
   for(const [side,leg]of Object.entries(model.legs)){
    const upper=model.equipment.boots.getObjectByName('boot-upper-'+side);
    assert.ok(upper?.isSkinnedMesh,'boot upper must deform with shin and ankle');
    const p=upper.geometry.attributes.position,top=[];let highest=-Infinity;
    for(let i=0;i<p.count;i++)highest=Math.max(highest,p.getY(i));
    for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-highest)<1e-5)top.push(upper.applyBoneTransform(i,new Vector3().fromBufferAttribute(p,i)));
    const center=top.reduce((a,v)=>a.add(v),new Vector3()).divideScalar(top.length);upper.localToWorld(center);
    const expected=leg.knee.localToWorld(new Vector3(0,highest-.47,0));
    assert.ok(center.distanceTo(expected)<.003,'boot cuff is offset from shin');
    const up=new Vector3(0,1,0).applyQuaternion(leg.ankle.getWorldQuaternion(new Quaternion()));
    assert.ok(up.y>.999,'sole should remain planted');
   }
  }
 }finally{model.destroy();}
});

test('mixed outfit accessories sit over the worn chest and capes wrap in front and behind',()=>{
 const model=new CharacterRig(),save=newSave();save.equipment.neck='sun-necklace';save.equipment.cloak='forest-cloak';
 try{
  save.equipment.armor='leather-vest';model.equip(save);const cloth=model.equipment.neck.userData.attached[0].children.at(-1).position.z;
  save.equipment.armor='scale-mail';model.equip(save);const plate=model.equipment.neck.userData.attached[0].children.at(-1).position.z;
  assert.ok(plate>cloth+.04,'pendant must clear the breastplate instead of being buried in it');
  const cape=model.equipment.cloak,back=cape.children.find(m=>m.isSkinnedMesh);back.geometry.computeBoundingBox();assert.ok(back.geometry.boundingBox.max.z<0);
  const front=cape.userData.attached[0];assert.ok(front.children.some(m=>m.position.z>.09),'front shoulder cloth must wrap over the body');
  assert.equal(model.base.torso.visible,false);assert.equal(model.base.arms.visible,false);
 }finally{model.destroy();}
});

 test('pose edits survive storage, reject invalid values and affect the same rig without changing gear',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const custom={right:[-.42,1.20,.24],left:[.25,1.14,.2],rightFoot:[-.23,.08,.12],hips:[-.06,0,.02],body:[.12,0,-.10],rotation:[.2,.1,.3],twist:.22};
 writePose(storage,'shield',custom);writePose(storage,'staff',{twist:-.2});assert.deepEqual(readPoses(storage).shield,custom);
 assert.deepEqual(cleanPose({twist:Infinity,right:[1,2,'3'],body:[0,0,0],unknown:4}),{body:[0,0,0]});
 assert.deepEqual(cleanPose({right:[99,-99,99]}).right,[.65,.65,.6]);
 const model=new CharacterRig(),save=newSave();save.equipment.weapon='iron-sword';save.equipment.offhand='steel-shield';model.equip(save);
 try{model.pose({angle:0,reducedMotion:true,posture:readPoses(storage).shield});const p=model.arms.right.grip.getWorldPosition(new Vector3());assert.ok(p.distanceTo(new Vector3(...custom.right))<1e-4);assert.equal(model.equipment.weapon.userData.item,'iron-sword');assert.equal(stanceFor(save.equipment),'shield');assert.ok(Math.abs(model.bones.spine.rotation.z-custom.body[2])<1e-6);}
 finally{model.destroy();}
 writePose(storage,'shield',null);assert.equal(readPoses(storage).shield,undefined);assert.equal(readPoses(storage).staff.twist,-.2);
 assert.deepEqual(readPoses({getItem:()=>'{broken'}),{});assert.throws(()=>writePose({getItem:()=>null,setItem:()=>{throw Error('full')}},'staff',custom),/full/);
 assert.ok(STANCES.staff.leftRotation[2]>-1);
 });
