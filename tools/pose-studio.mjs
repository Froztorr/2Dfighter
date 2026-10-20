import {AUTHORED_POSES} from '../authored-poses.mjs';
import * as THREE from '../vendor/three.module.js';
import {RiggedEquipmentFigure,STANCES,weaponTip,aimWeapon} from '../equipment-rig.mjs';
import {ITEMS,SLOTS,newSave,loadSave} from '../core.mjs';
import {POSE_LIMITS,cleanPose,readPoses,writePose,exportPoses} from '../pose-settings.mjs';

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
save.appearance={...original.appearance};
save.equipment={...save.equipment,helm:null,armor:'leather-vest',pants:'rogue-pants',boots:'trail-boots'};
const canvas=$('figure'),context=canvas.getContext('2d');let family='greatsword',selected='right',frame='A',drag=null,animation=0,animationStart=0;
const joints={right:['R','ข้อมือขวา'],left:['L','ข้อมือซ้าย'],rightFoot:['R','เท้าขวา'],leftFoot:['L','เท้าซ้าย'],hips:['H','สะโพก / Hip'],torso:['T','ลำตัว / Torso'],neckRotation:['N','คอ'],
 rightShoulder:['S','ไหล่ขวา'],leftShoulder:['S','ไหล่ซ้าย'],rightElbow:['E','ศอกขวา'],leftElbow:['E','ศอกซ้าย'],rightKnee:['K','เข่าขวา'],leftKnee:['K','เข่าซ้าย'],rightTip:['◆','ปลายอาวุธขวา'],leftTip:['◆','ปลายอาวุธซ้าย']};
const rotationKey=id=>({right:'rightWrist',left:'leftWrist',rightTip:'rightWrist',leftTip:'leftWrist',hips:'hipRotation',torso:'body',neckRotation:'neckRotation'}[id]||(/Shoulder|Elbow|Knee/.test(id)?id:null));
const movable=id=>['right','left','rightFoot','leftFoot','hips','torso','rightPole','leftPole'].includes(id);
$('joint').innerHTML=Object.entries({...joints,rightPole:['','แนวงอศอกขวา'],leftPole:['','แนวงอศอกซ้าย']}).map(([id,[,name]])=>`<option value="${id}">${name}</option>`).join('');
$('family').innerHTML=Object.entries(presets).map(([id,[label]])=>`<option value="${id}">${label}</option>`).join('');
for(const [id,[text,name]]of Object.entries(joints)){
 const button=document.createElement('button');button.className='joint'+(id.endsWith('Tip')?' tip':!movable(id)?' rotation':'');button.dataset.joint=id;button.textContent=text;button.setAttribute('aria-label',name);button.title=name;
 button.onclick=()=>select(id);
 button.onpointerdown=e=>{
  if(e.button!==0)return;e.preventDefault();stopAnimation();select(id);
  if(!movable(id)&&!id.endsWith('Tip'))return;
  const start=jointPoint(id),normal=new THREE.Vector3(0,0,1).applyQuaternion(figure.model.root.quaternion);
  if(!start)return;
  drag={id,pointer:e.pointerId,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,start),start,values:[...(editPose()[id]||[0,0,0])]};
  button.setPointerCapture(e.pointerId);
 };
 button.onpointermove=e=>{
  if(!drag||drag.pointer!==e.pointerId)return;
  const r=canvas.getBoundingClientRect(),ndc=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,figure.camera);const hit=ray.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!hit)return;
  if(id.endsWith('Tip')){Object.assign(editPose(),aimWeapon(figure.model,id.replace('Tip',''),hit,editPose()));changed();fields();return;}
  const local=figure.model.root.worldToLocal(hit),start=figure.model.root.worldToLocal(drag.start.clone()),delta=local.sub(start);
  editPose()[id]=cleanPose({[id]:drag.values.map((n,i)=>n+delta.getComponent(i))})[id];changed();fields();
 };
 const end=e=>{if(drag?.pointer===e.pointerId)drag=null;};button.onpointerup=end;button.onpointercancel=end;button.onlostpointercapture=end;
 button.onkeydown=e=>{const offset={ArrowLeft:[0,-.01],ArrowRight:[0,.01],ArrowUp:[1,.01],ArrowDown:[1,-.01]}[e.key];if(!offset)return;e.preventDefault();select(id);if(!movable(id))return;editPose()[id][offset[0]]+=offset[1];editPose()[id]=cleanPose({[id]:editPose()[id]})[id];changed();fields();};
 $('joints').append(button);
}
for(const ring of $('dials').querySelectorAll('.dial')){
 let turn=null;
 const pointerAngle=e=>{const r=$('dials').getBoundingClientRect();return Math.atan2(r.top+r.height/2-e.clientY,e.clientX-r.left-r.width/2);};
 const rotate=value=>{
  const key=rotationKey(selected),axis=Number(ring.dataset.axis);if(!key)return;
  editPose()[key][axis]=value;editPose()[key]=cleanPose({[key]:editPose()[key]})[key];changed();fields();
 };
 ring.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();stopAnimation();const key=rotationKey(selected);if(!key)return;turn={pointer:e.pointerId,angle:pointerAngle(e),value:editPose()[key][Number(ring.dataset.axis)]};ring.setPointerCapture(e.pointerId);};
 ring.onpointermove=e=>{if(turn?.pointer!==e.pointerId)return;const a=pointerAngle(e),delta=Math.atan2(Math.sin(a-turn.angle),Math.cos(a-turn.angle));turn.value+=delta;turn.angle=a;rotate(turn.value);turn.value=editPose()[rotationKey(selected)][Number(ring.dataset.axis)];};
 const end=()=>{turn=null;};ring.onpointerup=end;ring.onpointercancel=end;ring.onlostpointercapture=end;
 ring.onkeydown=e=>{const sign={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[e.key];if(!sign&&e.key!=='Home')return;e.preventDefault();const key=rotationKey(selected);if(key)rotate(e.key==='Home'?0:editPose()[key][Number(ring.dataset.axis)]+sign*(e.shiftKey?5:1)*Math.PI/180);};
}
function defaultPose(id){
 const p=STANCES[id];
 return structuredClone({...Object.fromEntries(Object.entries(POSE_LIMITS).filter(([,b])=>Array.isArray(b[0])).map(([key])=>[key,[0,0,0]])),...cleanPose(p),left:p.left||[.1,1,.2],leftRotation:p.leftRotation||[0,0,0],rightFoot:[-p.feet[0],.08,-p.feet[1]],leftFoot:[p.feet[0],.08,p.feet[1]],hips:p.hips||[0,0,0],body:p.body||[0,0,0],rightPole:[-.48,1.08,-.08],leftPole:[.48,1.08,-.08],...cleanPose(AUTHORED_POSES[id])});
}
function editPose(){return frame==='B'?drafts[family].attack:drafts[family];}
function selectFrame(value){
 stopAnimation();frame=value;
 if(frame==='B'&&!drafts[family].attack){drafts[family].attack=cleanPose(drafts[family],false);dirty.add(family);$('status').textContent='สร้าง B จากท่า A แล้ว — จัดท่าสุดโจมตีและบันทึก';}
 fields();render();
}
function jointPoint(id){
 const m=figure.model;
 if(id.endsWith('Tip'))return weaponTip(m,id.replace('Tip',''));
 if(id.endsWith('Pole'))return m.root.localToWorld(new THREE.Vector3(...editPose()[id]));
 if(id==='torso')return m.bones.chest.getWorldPosition(new THREE.Vector3());
 if(id==='neckRotation')return m.bones.neck.getWorldPosition(new THREE.Vector3());
 if(/Shoulder|Elbow|Knee/.test(id))return m.bones[id].getWorldPosition(new THREE.Vector3());
 if(id==='hips')return m.bones.hips.getWorldPosition(new THREE.Vector3());
 return (id.endsWith('Foot')?m.legs[id.replace('Foot','')].ankle:m.arms[id].grip).getWorldPosition(new THREE.Vector3());
}
function render(time=0,action='idle'){
 figure.sync(save,{posture:action==='slash'?drafts[family]:editPose(),angle:Number($('view').value),time,action,reducedMotion:true});
 context.clearRect(0,0,480,800);context.drawImage(figure.canvas,0,0);context.imageSmoothingEnabled=false;
 const custom=!!drafts[family].attack;
 $('poseA').setAttribute('aria-pressed',String(frame==='A'));$('poseB').setAttribute('aria-pressed',String(frame==='B'));
 $('stanceName').textContent=presets[family][0]+' · '+(animation?'A → B → A':frame);
 $('frameHint').textContent=frame==='B'?'กำลังจัด B — ท่าสุดจังหวะโจมตี ใช้จุดลากและวงหมุนเดิมได้ทุกข้อ':custom?'กำลังจัด A — ปุ่มลองจะเคลื่อนจาก A ไป B แล้วคืนกลับ A':'กำลังจัด A — กด B เพื่อสร้างท่าโจมตีของคุณจากท่านี้';
 $('cut').textContent=custom?'ลอง A → B → A':'ลองออกท่าเดิม';$('clearAttack').hidden=!custom;
 // The displayed canvas always fills this exact aspect; hit tests use the same rectangle.
 const r=$('stage').getBoundingClientRect(),ratio=3/5,drawWidth=Math.min(r.width,r.height*ratio),drawHeight=drawWidth/ratio;
 canvas.style.width=drawWidth+'px';canvas.style.height=drawHeight+'px';canvas.style.left=(r.width-drawWidth)/2+'px';canvas.style.top=(r.height-drawHeight)/2+'px';
 let unreachable=false;
 for(const button of $('joints').children){
  const id=button.dataset.joint,world=jointPoint(id);if(!world){button.hidden=true;continue;}const p=world.clone().project(figure.camera);
  button.style.left=((r.width-drawWidth)/2+(p.x+1)*drawWidth/2)+'px';button.style.top=((r.height-drawHeight)/2+(1-p.y)*drawHeight/2)+'px';button.hidden=!$('handles').checked||!!animation;button.setAttribute('aria-pressed',String(id===selected));
  if(id==='right'||id==='left'){const target=figure.model.root.localToWorld(new THREE.Vector3(...editPose()[id]));unreachable ||= action==='idle'&&target.distanceTo(world)>.025;}
 }
 for(const option of $('joint').options)if(option.value.endsWith('Tip'))option.disabled=!jointPoint(option.value);
 const key=rotationKey(selected),center=selected.endsWith('Tip')&&!jointPoint(selected)?null:jointPoint(selected.endsWith('Tip')?selected.replace('Tip',''):selected);
 $('dials').toggleAttribute('hidden',!key||!center||!$('handles').checked||!!animation);
 if(key&&center){
  const p=center.project(figure.camera);$('dials').style.left=((r.width-drawWidth)/2+(p.x+1)*drawWidth/2)+'px';$('dials').style.top=((r.height-drawHeight)/2+(1-p.y)*drawHeight/2)+'px';
  for(const ring of $('dials').querySelectorAll('.dial')){
   const axis=Number(ring.dataset.axis),value=editPose()[key][axis],radius=axis===2?82:59,dot=$(axis===2?'coronalDot':'sagittalDot');
   dot.setAttribute('cx',100+radius*Math.cos(value));dot.setAttribute('cy',100-radius*Math.sin(value));
   ring.setAttribute('aria-valuemin',Math.round(POSE_LIMITS[key][axis][0]*180/Math.PI));ring.setAttribute('aria-valuemax',Math.round(POSE_LIMITS[key][axis][1]*180/Math.PI));ring.setAttribute('aria-valuenow',Math.round(value*180/Math.PI));
  }
 }
 const manual=Object.keys(editPose()).some(k=>/Shoulder|Elbow|Knee/.test(k)&&editPose()[k].some(Math.abs));
 $('warning').textContent=manual?'หมุนข้อโดยตรง: มือ/เท้าจะตามข้อ อาจยกจากจุดยึดเดิม · ค่าหมุนเป็นมุมเพิ่มจากท่าตั้งต้น':unreachable?'จุดมือเกินระยะแขน — หุ่นจำกัดระยะไว้เพื่อไม่ให้แขนยืดผิดสัดส่วน':'ลากจุดบนหุ่น · ใช้แถบลึกเพื่อขยับเข้า–ออกจากตัว';
}
function changed(){stopAnimation();dirty.add(family);$('status').textContent='แก้ไขแล้ว · ยังไม่ได้บันทึก';render();}
function stopAnimation(){cancelAnimationFrame(animation);animation=0;}
function field(container,label,key,index){
 const bounds=index===null?POSE_LIMITS[key]:POSE_LIMITS[key][index],value=index===null?editPose()[key]:editPose()[key][index],angular=['rotation','leftRotation','body','twist'].includes(key)||/Rotation|Shoulder|Elbow|Knee|Wrist/.test(key),factor=angular?180/Math.PI:1,step=angular?1:.01;
 const row=document.createElement('label');row.className='field';row.innerHTML=`<span>${label}${angular?' (°)':''}</span><input type="range" min="${bounds[0]*factor}" max="${bounds[1]*factor}" step="${step}" value="${value*factor}" aria-label="${label}"><input type="number" min="${bounds[0]*factor}" max="${bounds[1]*factor}" step="${step}" value="${(value*factor).toFixed(angular?0:2)}" aria-label="${label} ตัวเลข">`;
 const inputs=row.querySelectorAll('input');for(const input of inputs)input.oninput=()=>{
  if(input.value===''||!Number.isFinite(Number(input.value)))return;
  const n=Math.max(bounds[0],Math.min(bounds[1],Number(input.value)/factor));if(index===null)editPose()[key]=n;else editPose()[key][index]=n;
  for(const other of inputs)if(other!==input)other.value=(n*factor).toFixed(angular?0:2);changed();
 };container.append(row);
}
function fields(){
 $('positionFields').replaceChildren();if(movable(selected))['ซ้าย–ขวา','สูง–ต่ำ','ลึกเข้า–ออก'].forEach((name,i)=>field($('positionFields'),name,selected,i));
 const key=rotationKey(selected);$('weaponFields').hidden=!key;$('rotationFields').replaceChildren();$('rotationHint').hidden=!key;
 $('weaponFields').querySelector('h2').textContent='หมุน '+(joints[selected]?.[1]||'ข้อ');
 if(key)['Sagittal งอ/เหยียด','บิดตามแกน','Coronal เอียง'].forEach((name,i)=>field($('rotationFields'),name,key,i));
 $('bodyFields').replaceChildren();field($('bodyFields'),'โน้มลำตัว','body',0);field($('bodyFields'),'เอียงไหล่','body',2);field($('bodyFields'),'บิดอก','twist',null);field($('bodyFields'),'ย่อตัว','lower',null);
}
function select(id){selected=id;$('joint').value=id;fields();render();}
function choose(){
 stopAnimation();frame='A';family=$('family').value;if(!drafts[family]){drafts[family]={...defaultPose(family),...saved[family]};if(saved[family]&&!saved[family].attack)delete drafts[family].attack;}save.equipment.weapon=presets[family][1];save.equipment.offhand=presets[family][2];
 if(drafts[family].attack)drafts[family].attack={...cleanPose(drafts[family],false),...drafts[family].attack};
 $('stanceName').textContent=presets[family][0];$('status').textContent=dirty.has(family)?'แก้ไขแล้ว · ยังไม่ได้บันทึก':saved[family]?'ใช้ท่าที่บันทึกไว้':'ท่าตั้งต้น';fields();render();
}
$('equipment').innerHTML=['helm','armor','pants','boots','cloak'].map(slot=>`<label>${SLOTS[slot]}<select data-slot="${slot}"><option value="">None</option>${Object.entries(ITEMS).filter(([,i])=>i.slot===slot).map(([id,i])=>`<option value="${id}">${i.name}</option>`).join('')}</select></label>`).join('');
function outfitFields(){for(const el of $('equipment').querySelectorAll('select'))el.value=save.equipment[el.dataset.slot]||'';}
$('equipment').onchange=e=>{save.equipment[e.target.dataset.slot]=e.target.value||null;render();};
$('currentOutfit').onclick=()=>{for(const slot of ['helm','armor','pants','boots','cloak'])save.equipment[slot]=original.equipment[slot];outfitFields();render();};
$('family').onchange=choose;$('joint').onchange=()=>select($('joint').value);$('view').oninput=()=>render();$('handles').onchange=()=>render();
$('poseA').onclick=()=>selectFrame('A');$('poseB').onclick=()=>selectFrame('B');
$('clearAttack').onclick=()=>{delete drafts[family].attack;frame='A';fields();changed();};
$('reset').onclick=()=>{frame='A';drafts[family]=defaultPose(family);fields();changed();try{writePose(storage,family,null);delete saved[family];dirty.delete(family);$('status').textContent='คืนท่าตั้งต้นแล้ว — ลบเฉพาะท่าที่บันทึกของประเภทนี้';}catch{$('status').textContent='คืนท่าบนหุ่นแล้ว แต่ลบท่าที่บันทึกไม่สำเร็จ';}};
$('apply').onclick=()=>{try{writePose(storage,family,drafts[family]);saved[family]=cleanPose(drafts[family]);dirty.delete(family);$('status').textContent='บันทึกแล้ว — กลับเกมแล้วเปิดหน้าอุปกรณ์เพื่อใช้ท่านี้';}catch{$('status').textContent='บันทึกไม่สำเร็จ: เบราว์เซอร์ไม่อนุญาตหรือพื้นที่เต็ม ท่าที่แก้ยังอยู่ในหน้านี้';}};
$('cut').onclick=()=>{stopAnimation();frame='A';fields();animationStart=performance.now();const tick=now=>{const elapsed=now-animationStart;if(elapsed>=550){animation=0;render();return;}animation=requestAnimationFrame(tick);render(elapsed,'slash');};animation=requestAnimationFrame(tick);};
function prepareExport(){
 const text=exportPoses(storage),count=Object.keys(JSON.parse(text).poses).length;
 $('exportText').value=text;$('exportPanel').hidden=!count;
 $('exportStatus').textContent=count?`ส่งออก ${count} ชุดอาวุธที่บันทึกแล้ว${dirty.size?' — มีท่าที่ยังไม่ได้บันทึก จึงไม่รวมการแก้ล่าสุด':''}`:'ยังไม่พบท่าที่บันทึกไว้ — กดบันทึกท่าก่อน Export';
 return count?text:null;
}
$('exportPoses').onclick=prepareExport;
$('copyPoses').onclick=async()=>{
 const text=prepareExport();if(!text)return;
 try{await navigator.clipboard.writeText(text);$('exportStatus').textContent+=' · คัดลอกแล้ว วางในแชตได้เลย';}
 catch{$('exportText').focus();$('exportText').select();$('exportStatus').textContent+=' · คัดลอกอัตโนมัติไม่ได้ เลือกข้อความให้แล้ว ใช้ Ctrl+C หรือเมนูคัดลอก';}
};
$('downloadPoses').onclick=()=>{
 const text=prepareExport();if(!text)return;
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');
 link.href=url;link.download='emberblade-poses.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
new ResizeObserver(()=>render()).observe($('stage'));
window.addEventListener('pagehide',e=>{stopAnimation();if(!e.persisted)figure.destroy();});
window.addEventListener('pageshow',e=>{if(e.persisted)render();});
outfitFields();choose();
