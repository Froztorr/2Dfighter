import {newSave,ITEMS,SLOTS,fitsSlot} from '../core.mjs';
import {ENEMY_ATLAS} from '../enemy-atlas.mjs';
import {enemyFrame,enemyArtPose,paintEnemyFrame} from '../enemy-animation.mjs';
import {RiggedEquipmentFigure,rigItemIcon} from '../equipment-rig.mjs';
import {PORTRAIT_FILES} from '../equipment-art.mjs';
import {Player3D} from '../player-3d.mjs';
const $=id=>document.getElementById(id),save=newSave(),sprites={};
$('action').parentElement.insertAdjacentHTML('afterend','<label>Turn (radians)<input id="angle" type="number" min="-0.7" max="0.7" step="0.1" value="0.55"></label>');
$('outfitGallery').previousElementSibling.textContent='One skeleton · interchangeable meshes · mixed builds';
$('dollCheck').previousElementSibling.textContent='Shared rig and slot replacement';$('capeBack').parentElement.remove();
$('gear').parentElement.insertAdjacentHTML('afterend','<button id="checkFits">Check all equipment fits</button><p id="fitReport" role="status"></p>');
$('outfitGallery').parentElement.insertAdjacentHTML('afterend','<section style="width:100%"><h2>Same rig · idle / cut / cast / walk</h2><div id="poseGallery" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">'+['idle','slash','cast','walk'].map(action=>`<figure style="margin:0"><h3>${action}</h3><canvas id="pose-${action}" width="256" height="426"></canvas></figure>`).join('')+'</div></section>');
for(const name of ['gear','relics',...Object.keys(PORTRAIT_FILES),...Object.keys(ENEMY_ATLAS)]){
 const image=new Image();image.src=PORTRAIT_FILES[name]?'../'+PORTRAIT_FILES[name]:`../assets/${name}${ENEMY_ATLAS[name]?'-v2':''}.png`;sprites[name]=image;
}
await Promise.all(Object.values(sprites).map(image=>image.decode()));
const portrait=new RiggedEquipmentFigure(sprites),combat=new Player3D(undefined,sprites);
const presets={
 regression:{helm:'rogue-hood',armor:null,pants:'rogue-pants',boots:null,weapon:'venom-dagger',offhand:'parry-dagger',cloak:null,neck:null},
 warrior:{helm:'wolf-helm',armor:'scale-mail',pants:'iron-greaves',boots:'plate-boots',weapon:'iron-sword',offhand:'steel-shield',cloak:'red-cape',neck:'sun-necklace'},
 rogue:{helm:'rogue-hood',armor:'leather-vest',pants:'rogue-pants',boots:'trail-boots',weapon:'venom-dagger',offhand:'assassin-dagger',cloak:'forest-cloak',neck:'spider-pendant'},
 mage:{helm:'mage-hat',armor:'mage-robe',pants:'mage-pants',boots:'mage-boots',weapon:'ember-staff',offhand:null,cloak:'astral-cloak',neck:'arcane-pendant'},
 mixed:{helm:'mage-hat',armor:'frost-plate',pants:'rogue-pants',boots:'plate-boots',weapon:'inferno-axe',offhand:null,cloak:'silk-cloak',neck:'spider-pendant'}
};
$('enemy').innerHTML=Object.keys(ENEMY_ATLAS).map(name=>`<option>${name}</option>`).join('');
$('gear').innerHTML=Object.entries(SLOTS).map(([slot,name])=>`<label>${name}<select data-slot="${slot}"><option value="">Empty</option>${Object.entries(ITEMS).filter(([,item])=>fitsSlot(item,slot)).map(([id,item])=>`<option value="${id}">${item.name}</option>`).join('')}</select></label>`).join('');
function outfit(){save.equipment={...newSave().equipment,...presets[$('outfit').value]};for(const select of document.querySelectorAll('[data-slot]'))select.value=save.equipment[select.dataset.slot]||'';render();}
function render(){
 const clock=Number($('time').value),type=$('enemy').value,dir=$('direction').value;
 portrait.sync(save,{time:clock,action:$('action').value,angle:Number($('angle').value)});const portraitContext=$('portrait').getContext('2d');portraitContext.clearRect(0,0,480,800);portraitContext.drawImage(portrait.canvas,0,0,480,800);
 const model=portrait.model;
 $('dollCheck').textContent=`${model.skeleton.bones.length} shared bones · ${Object.keys(model.equipment).join(' / ')} · base trousers ${model.base.pants.visible?'visible':'replaced'} · weapons parented to palm sockets`;
 for(const [action,time]of [['idle',0],['slash',270],['cast',250],['walk',1200]]){portrait.sync(save,{action,time,angle:Number($('angle').value)});const c=$('pose-'+action).getContext('2d');c.clearRect(0,0,256,426);c.drawImage(portrait.canvas,0,0,256,426);}
 combat.sync({save,action:$('action').value,dir,elapsed:clock%300,aspect:1,reducedMotion:true});
 const context=$('combat').getContext('2d');context.clearRect(0,0,480,800);context.drawImage(combat.renderer.domElement,0,0);
 const bottom=context.getImageData(0,798,480,2).data,focus=context.getImageData(144,240,192,280).data;
 let edgePixels=0,focusPixels=0;for(let index=3;index<bottom.length;index+=4)if(bottom[index]>20)edgePixels++;for(let index=3;index<focus.length;index+=4)if(focus[index]>20)focusPixels++;
 $('framing').textContent=`${$('outfit').value} / ${$('action').value}: ${edgePixels} pixels reach bottom edge; ${(focusPixels/(192*280)*100).toFixed(1)}% of enemy focus covered`;
 const enemy={dir,recoverUntil:1640},frame=enemyFrame({phase:'combat',time:clock,attack:clock<1000?{dir,at:1000,started:0}:null,enemy});
 const pose=enemyArtPose(type,frame),meta=ENEMY_ATLAS[type],crop=meta.frames[pose.row*8+pose.column];
 const source=document.createElement('canvas');source.width=crop.sw;source.height=crop.sh;paintEnemyFrame(source.getContext('2d'),sprites[type],crop);
 const enemyContext=$('sequence').getContext('2d');enemyContext.clearRect(0,0,480,800);enemyContext.imageSmoothingEnabled=false;
 const scale=250/meta.bodyHeight;enemyContext.save();enemyContext.translate(240,0);if(pose.mirror)enemyContext.scale(-1,1);enemyContext.drawImage(source,(crop.sx-crop.anchorX)*scale,565+(crop.sy-crop.ground)*scale,crop.sw*scale,crop.sh*scale);enemyContext.restore();
 $('status').textContent=`${clock} ms · ${type} ${dir} · pose ${frame.column+1}/8 · ${clock<1000?'windup':clock<1640?'strike / recovery':'idle'} · 40 source poses`;
 if($('atlasReview').dataset.type!==type){
  $('atlasReview').dataset.type=type;const context=$('atlasReview').getContext('2d');context.clearRect(0,0,1280,1000);context.imageSmoothingEnabled=false;
  for(const crop of meta.frames){const image=document.createElement('canvas');image.width=crop.sw;image.height=crop.sh;paintEnemyFrame(image.getContext('2d'),sprites[type],crop);const scale=125/meta.bodyHeight;context.drawImage(image,crop.column*160+80+(crop.sx-crop.anchorX)*scale,crop.row*200+165+(crop.sy-crop.ground)*scale,crop.sw*scale,crop.sh*scale);context.strokeStyle='#5b6656';context.strokeRect(crop.column*160,crop.row*200,160,200);}
 }
}
let playing=false,previous=0;
$('play').onclick=()=>{playing=!playing;};
$('outfit').onchange=outfit;
for(const id of ['time','direction','action','enemy','angle'])$(id).oninput=render;
$('gear').onchange=event=>{save.equipment[event.target.dataset.slot]=event.target.value||null;if(ITEMS[save.equipment.weapon]?.hands===2)save.equipment.offhand=null;portrait.signature=null;render();};
$('checkFits').onclick=()=>{
 let count=0,failures=[];
 const cases=Object.entries(ITEMS).map(([id,item])=>({id,equipment:{[item.slot==='ring'?'ring1':item.slot]:id},frames:[['idle',270],['slash',270]]}));
 for(const [id,weapon,offhand]of [...stances,['Mirrored mixed','mace','iron-sword']])cases.push({id,equipment:{...presets.rogue,weapon,offhand},frames:[['idle',0],... [0,120,275,430,550].map(t=>['slash',t])]});
 for(const {id,equipment,frames}of cases){
  const state={...newSave(),equipment:{...newSave().equipment,...equipment}};
  for(const [action,time]of frames){
   portrait.sync(state,{action,time});const m=portrait.model;
   for(const [slot,item]of Object.entries(equipment))if(item&&!m.equipment[slot])failures.push(id+' missing '+slot);
   m.root.traverse(o=>{if(o.isSkinnedMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i+=53){const v=o.applyBoneTransform(i,new o.position.constructor().fromBufferAttribute(p,i));if(!Number.isFinite(v.x+v.y+v.z))failures.push(id+' invalid deformation');}}});
   const data=portrait.context.getImageData(0,0,480,800).data;let solid=0,edge=0,edgeAt='';for(let i=3;i<data.length;i+=4)if(data[i]>100){solid++;const pixel=(i-3)/4,x=pixel%480,y=Math.floor(pixel/480);if(x<2||x>477||y<2||y>797){edge++;edgeAt||=`${x},${y}`;}}
   if(solid<1000||edge>0)failures.push(`${id} ${action}:${time} invisible / clipped (${edge} at ${edgeAt})`);count++;
  }
 }
 for(const id of Object.keys(ITEMS))if(!rigItemIcon(id).startsWith('data:image/png'))failures.push(id+' missing fitted icon');
 $('fitReport').textContent=failures.length?'FAIL · '+failures.join(' · '):`PASS · ${count} renders: 47 items + 6 reference postures + mirrored mixed through cut/recovery · 47 fitted icons · finite skinning · no clipped silhouette`;
 render();
};
function loop(now){if(playing&&now-previous>32){$('time').value=(Number($('time').value)+now-previous)%1800;render();previous=now;}else if(!playing)previous=now;requestAnimationFrame(loop);}
$('outfitGallery').innerHTML=Object.entries(presets).map(([id,gear])=>`<figure style="margin:0"><h3>${id==='regression'?'Reported outfit':id}</h3><canvas id="look-${id}" width="256" height="426"></canvas><div>${Object.values(gear).filter(Boolean).map(item=>`<img alt="${ITEMS[item].name}" title="${ITEMS[item].name}" src="${rigItemIcon(item)}" width="25" height="25" style="object-fit:contain;image-rendering:pixelated">`).join('')}</div></figure>`).join('');
for(const [id,equipment]of Object.entries(presets)){const figure=new RiggedEquipmentFigure(sprites);figure.sync({...newSave(),equipment:{...newSave().equipment,...equipment}},{reducedMotion:true});$(`look-${id}`).getContext('2d').drawImage(figure.canvas,0,0,256,426);figure.destroy();}
const stances=[['1 · Greatsword','greatsword',null],['2 · Sword + mace','iron-sword','mace'],['3 · Mage staff','ember-staff',null],['4 · Twin swords','iron-sword','rust-sword'],['5 · Sword + shield','iron-sword','steel-shield'],['6 · Dagger + mace','venom-dagger','mace']];
$('outfitGallery').parentElement.insertAdjacentHTML('afterend','<section style="width:100%"><h2>Six reference postures · same outfit and rig</h2><div id="stanceGallery" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">'+stances.map(([name],i)=>`<figure style="margin:0"><h3>${name}</h3><canvas id="stance-${i}" width="240" height="400"></canvas></figure>`).join('')+'</div></section>');
for(const [i,[,weapon,offhand]]of stances.entries()){const figure=new RiggedEquipmentFigure(sprites);figure.sync({...newSave(),equipment:{...presets.rogue,helm:null,cloak:null,neck:null,weapon,offhand}},{reducedMotion:true});const c=$('stance-'+i).getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(figure.canvas,0,0,240,400);figure.destroy();}
outfit();requestAnimationFrame(loop);
