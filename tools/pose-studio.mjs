import * as THREE from '../vendor/three.module.js';
import {RiggedEquipmentFigure,STANCES} from '../equipment-rig.mjs';
import {ITEMS,SLOTS,newSave,loadSave} from '../core.mjs';
import {POSE_LIMITS,cleanPose,readPoses,writePose} from '../pose-settings.mjs';

const $=id=>document.getElementById(id),presets={
 greatsword:['Greatsword · ดาบใหญ่','greatsword',null],
 mixed:['Sword + weapon · ดาบผสม','iron-sword','mace'],
 staff:['Mage · คทา','ember-staff',null],
 swords:['Twin swords · ดาบคู่','iron-sword','rust-sword'],
 shield:['Sword & shield · ดาบและโล่','iron-sword','steel-shield'],
 dual:['Short weapons · อาวุธสั้นคู่','venom-dagger','mace'],
 single:['Single weapon · อาวุธมือเดียว','iron-sword',null]
};
let storage;try{storage=localStorage;}catch{}
const saved=readPoses(storage),drafts={},dirty=new Set(),figure=new RiggedEquipmentFigure(),save=newSave();
let original;try{original=loadSave(storage?.getItem('emberblade-v1'));}catch{original=newSave();}
save.equipment={...save.equipment,helm:null,armor:'leather-vest',pants:'rogue-pants',boots:'trail-boots'};
const canvas=$('figure'),context=canvas.getContext('2d');let family='greatsword',selected='right',drag=null,animation=0,animationStart=0;
const joints={right:['R','มือขวา'],left:['L','มือซ้าย'],rightFoot:['R','เท้าขวา'],leftFoot:['L','เท้าซ้าย'],hips:['＋','สะโพก']};
$('family').innerHTML=Object.entries(presets).map(([id,[label]])=>`<option value="${id}">${label}</option>`).join('');
for(const [id,[text,name]]of Object.entries(joints)){
 const button=document.createElement('button');button.className='joint';button.dataset.joint=id;button.textContent=text;button.setAttribute('aria-label','ลาก'+name);button.title=name;
 button.onpointerdown=e=>{
  if(e.button!==0)return;e.preventDefault();stopAnimation();select(id);
  const start=jointPoint(id),normal=new THREE.Vector3(0,0,1).applyQuaternion(figure.model.root.quaternion);
  drag={id,pointer:e.pointerId,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,start),start,values:[...drafts[family][id]]};
  button.setPointerCapture(e.pointerId);
 };
 button.onpointermove=e=>{
  if(!drag||drag.pointer!==e.pointerId)return;
  const r=canvas.getBoundingClientRect(),ndc=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,figure.camera);const hit=ray.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!hit)return;
  const local=figure.model.root.worldToLocal(hit),start=figure.model.root.worldToLocal(drag.start.clone()),delta=local.sub(start);
  drafts[family][id]=cleanPose({[id]:drag.values.map((n,i)=>n+delta.getComponent(i))})[id];changed();fields();
 };
 const end=e=>{if(drag?.pointer===e.pointerId)drag=null;};button.onpointerup=end;button.onpointercancel=end;button.onlostpointercapture=end;
 button.onkeydown=e=>{const offset={ArrowLeft:[0,-.01],ArrowRight:[0,.01],ArrowUp:[1,.01],ArrowDown:[1,-.01]}[e.key];if(!offset)return;e.preventDefault();select(id);drafts[family][id][offset[0]]+=offset[1];drafts[family][id]=cleanPose({[id]:drafts[family][id]})[id];changed();fields();};
 $('joints').append(button);
}
function defaultPose(id){
 const p=STANCES[id];
 return structuredClone({...cleanPose(p),left:p.left||[.1,1,.2],leftRotation:p.leftRotation||[0,0,0],rightFoot:[-p.feet[0],.08,-p.feet[1]],leftFoot:[p.feet[0],.08,p.feet[1]],hips:p.hips||[0,0,0],body:p.body||[0,0,0],rightPole:[-.48,1.08,-.08],leftPole:[.48,1.08,-.08]});
}
function jointPoint(id){
 const m=figure.model;
 if(id==='hips')return m.bones.hips.getWorldPosition(new THREE.Vector3());
 return (id.endsWith('Foot')?m.legs[id.replace('Foot','')].ankle:m.arms[id].grip).getWorldPosition(new THREE.Vector3());
}
function render(time=0,action='idle'){
 figure.sync(save,{posture:drafts[family],angle:Number($('view').value),time,action,reducedMotion:true});
 context.clearRect(0,0,480,800);context.drawImage(figure.canvas,0,0);context.imageSmoothingEnabled=false;
 // The displayed canvas always fills this exact aspect; hit tests use the same rectangle.
 const r=$('stage').getBoundingClientRect(),ratio=3/5,drawWidth=Math.min(r.width,r.height*ratio),drawHeight=drawWidth/ratio;
 canvas.style.width=drawWidth+'px';canvas.style.height=drawHeight+'px';canvas.style.left=(r.width-drawWidth)/2+'px';canvas.style.top=(r.height-drawHeight)/2+'px';
 let unreachable=false;
 for(const button of $('joints').children){
  const id=button.dataset.joint,world=jointPoint(id),p=world.clone().project(figure.camera);
  button.style.left=((r.width-drawWidth)/2+(p.x+1)*drawWidth/2)+'px';button.style.top=((r.height-drawHeight)/2+(1-p.y)*drawHeight/2)+'px';button.hidden=!$('handles').checked||!!animation;button.setAttribute('aria-pressed',String(id===selected));
  if(id==='right'||id==='left'){const target=figure.model.root.localToWorld(new THREE.Vector3(...drafts[family][id]));unreachable ||= action==='idle'&&target.distanceTo(world)>.025;}
 }
 $('warning').textContent=unreachable?'จุดมือเกินระยะแขน — หุ่นจำกัดระยะไว้เพื่อไม่ให้แขนยืดผิดสัดส่วน':'ลากจุดบนหุ่น · ใช้แถบลึกเพื่อขยับเข้า–ออกจากตัว';
}
function changed(){stopAnimation();dirty.add(family);$('status').textContent='แก้ไขแล้ว · ยังไม่ได้บันทึก';render();}
function stopAnimation(){cancelAnimationFrame(animation);animation=0;}
function field(container,label,key,index){
 const bounds=index===null?POSE_LIMITS[key]:POSE_LIMITS[key][index],value=index===null?drafts[family][key]:drafts[family][key][index],angular=['rotation','leftRotation','body','twist'].includes(key),factor=angular?180/Math.PI:1,step=angular?1:.01;
 const row=document.createElement('label');row.className='field';row.innerHTML=`<span>${label}${angular?' (°)':''}</span><input type="range" min="${bounds[0]*factor}" max="${bounds[1]*factor}" step="${step}" value="${value*factor}" aria-label="${label}"><input type="number" min="${bounds[0]*factor}" max="${bounds[1]*factor}" step="${step}" value="${(value*factor).toFixed(angular?0:2)}" aria-label="${label} ตัวเลข">`;
 const inputs=row.querySelectorAll('input');for(const input of inputs)input.oninput=()=>{
  if(input.value===''||!Number.isFinite(Number(input.value)))return;
  const n=Math.max(bounds[0],Math.min(bounds[1],Number(input.value)/factor));if(index===null)drafts[family][key]=n;else drafts[family][key][index]=n;
  for(const other of inputs)if(other!==input)other.value=(n*factor).toFixed(angular?0:2);changed();
 };container.append(row);
}
function fields(){
 $('positionFields').replaceChildren();['ซ้าย–ขวา','สูง–ต่ำ','ลึกเข้า–ออก'].forEach((name,i)=>field($('positionFields'),name,selected,i));
 $('weaponFields').hidden=!['right','left'].includes(selected);$('rotationFields').replaceChildren();
 if(!$('weaponFields').hidden)['ก้ม / เงย','บิดข้อมือ','เอียงอาวุธ'].forEach((name,i)=>field($('rotationFields'),name,selected==='right'?'rotation':'leftRotation',i));
 $('bodyFields').replaceChildren();field($('bodyFields'),'โน้มลำตัว','body',0);field($('bodyFields'),'เอียงไหล่','body',2);field($('bodyFields'),'บิดอก','twist',null);field($('bodyFields'),'ย่อตัว','lower',null);
}
function select(id){selected=id;$('joint').value=id;fields();render();}
function choose(){
 stopAnimation();family=$('family').value;drafts[family]??={...defaultPose(family),...saved[family]};save.equipment.weapon=presets[family][1];save.equipment.offhand=presets[family][2];
 $('stanceName').textContent=presets[family][0];$('status').textContent=dirty.has(family)?'แก้ไขแล้ว · ยังไม่ได้บันทึก':saved[family]?'ใช้ท่าที่บันทึกไว้':'ท่าตั้งต้น';fields();render();
}
$('equipment').innerHTML=['helm','armor','pants','boots','cloak'].map(slot=>`<label>${SLOTS[slot]}<select data-slot="${slot}"><option value="">None</option>${Object.entries(ITEMS).filter(([,i])=>i.slot===slot).map(([id,i])=>`<option value="${id}">${i.name}</option>`).join('')}</select></label>`).join('');
function outfitFields(){for(const el of $('equipment').querySelectorAll('select'))el.value=save.equipment[el.dataset.slot]||'';}
$('equipment').onchange=e=>{save.equipment[e.target.dataset.slot]=e.target.value||null;render();};
$('currentOutfit').onclick=()=>{for(const slot of ['helm','armor','pants','boots','cloak'])save.equipment[slot]=original.equipment[slot];outfitFields();render();};
$('family').onchange=choose;$('joint').onchange=()=>select($('joint').value);$('view').oninput=()=>render();$('handles').onchange=()=>render();
$('reset').onclick=()=>{drafts[family]=defaultPose(family);fields();changed();try{writePose(storage,family,null);delete saved[family];dirty.delete(family);$('status').textContent='คืนท่าตั้งต้นแล้ว — ลบเฉพาะท่าที่บันทึกของประเภทนี้';}catch{$('status').textContent='คืนท่าบนหุ่นแล้ว แต่ลบท่าที่บันทึกไม่สำเร็จ';}};
$('apply').onclick=()=>{try{writePose(storage,family,drafts[family]);saved[family]=cleanPose(drafts[family]);dirty.delete(family);$('status').textContent='บันทึกแล้ว — กลับเกมแล้วเปิดหน้าอุปกรณ์เพื่อใช้ท่านี้';}catch{$('status').textContent='บันทึกไม่สำเร็จ: เบราว์เซอร์ไม่อนุญาตหรือพื้นที่เต็ม ท่าที่แก้ยังอยู่ในหน้านี้';}};
$('cut').onclick=()=>{stopAnimation();animationStart=performance.now();const tick=now=>{const elapsed=now-animationStart;if(elapsed>=550){animation=0;render();return;}animation=requestAnimationFrame(tick);render(elapsed,'slash');};animation=requestAnimationFrame(tick);};
new ResizeObserver(()=>render()).observe($('stage'));
window.addEventListener('pagehide',e=>{stopAnimation();if(!e.persisted)figure.destroy();});
window.addEventListener('pageshow',e=>{if(e.persisted)render();});
outfitFields();choose();
