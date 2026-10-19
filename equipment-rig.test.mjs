import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from './vendor/three.module.js';
import {ITEMS,newSave} from './core.mjs';
import {CharacterRig} from './equipment-rig.mjs';

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
  for(const time of [0,120,270,550]){model.pose({action:'slash',time,angle:.5});
   const expected=model.arms.right.grip.localToWorld(new Vector3(0,-.125,0)),actual=model.arms.left.grip.getWorldPosition(new Vector3());assert.ok(expected.distanceTo(actual)<1e-5,weapon+' support hand slips');
  }
 }}finally{model.destroy();}
});

test('continuous garment vertices deform at elbows rather than splitting into pictures',()=>{
 const model=new CharacterRig(),save=newSave();save.equipment.armor='leather-vest';model.equip(save);
 try{
  const sleeve=model.equipment.armor.children.find(m=>m.isSkinnedMesh&&m.geometry.getAttribute('skinIndex').array.includes(model.skeleton.bones.indexOf(model.bones.rightElbow)));
  assert.ok(sleeve);const p=sleeve.geometry.attributes.position,index=Math.floor(p.count*.8),before=new Vector3().fromBufferAttribute(p,index);model.pose({time:0,reducedMotion:true});const a=sleeve.applyBoneTransform(index,before.clone());model.pose({action:'slash',time:270});const b=sleeve.applyBoneTransform(index,before.clone());assert.ok(a.distanceTo(b)>.1);
 }finally{model.destroy();}
});
