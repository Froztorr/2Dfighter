import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from './vendor/three.module.js';
import {ITEMS,newSave} from './core.mjs';
import {CharacterRig} from './equipment-rig.mjs';

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

test('two handed weapons keep both closed hands on the same shaft through a cut',()=>{
 const model=new CharacterRig(),save=newSave();
 try{for(const weapon of ['greatsword','ember-staff','ice-staff','demon-staff','inferno-axe']){
  save.equipment.weapon=weapon;model.equip(save);
  for(const action of ['idle','slash','cast','guard'])for(let time=0;time<=550;time+=25){model.pose({action,time,angle:.5});
   const expected=model.arms.right.grip.localToWorld(new Vector3(0,ITEMS[weapon].magic?.25:-.125,0)),actual=model.arms.left.grip.getWorldPosition(new Vector3());assert.ok(expected.distanceTo(actual)<1e-5,weapon+' support hand slips');
  }
 }}finally{model.destroy();}
});

test('changing weapon families changes the whole ready stance and restores it after a cut',()=>{
 const model=new CharacterRig(),save=newSave(),poses=[];
 try{
  for(const [weapon,offhand]of [['ember-staff',null],['greatsword',null],['venom-dagger','parry-dagger'],['iron-sword','steel-shield']]){
   save.equipment.weapon=weapon;save.equipment.offhand=offhand;model.equip(save);model.pose({time:0,angle:0,reducedMotion:true});
   const snapshot=()=>['rightGrip','leftGrip','rightAnkle','leftAnkle'].map(name=>model.bones[name].getWorldPosition(new Vector3()));
   const ready=snapshot();poses.push(ready);
   if(weapon==='ember-staff')assert.ok(ready[1].y-ready[0].y>.18,'staff hands must spread along the shaft, not both crowd the pommel');
   if(offhand==='steel-shield')assert.ok(ready[1].y>1.1&&ready[1].z>.2,'shield must cover the chest');
   model.pose({action:'slash',time:270,angle:0});assert.ok(ready[0].distanceTo(snapshot()[0])>.08,'cut needs an actual arm movement');
   model.pose({action:'slash',time:550,angle:0,reducedMotion:true});snapshot().forEach((p,i)=>assert.ok(p.distanceTo(ready[i])<1e-5,'recovery must settle into the equipped stance'));
  }
  for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++){
   assert.ok(poses[i][0].distanceTo(poses[j][0])+poses[i][1].distanceTo(poses[j][1])>.15,'weapon families share the same arm pose');
   assert.ok(poses[i][2].distanceTo(poses[j][2])+poses[i][3].distanceTo(poses[j][3])>.06,'weapon families share the same footing');
  }
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
