import {newSave,ITEMS,SLOTS} from '../core.mjs';
import {ENEMY_ATLAS} from '../enemy-atlas.mjs';
import {enemyFrame,enemyArtPose,paintEnemyFrame} from '../enemy-animation.mjs';
import {Portrait3D} from '../player-portrait.mjs';
import {Player3D} from '../player-3d.mjs';
const $=id=>document.getElementById(id),save=newSave(),sprites={};
for(const name of ['portrait','gear','relics',...Object.keys(ENEMY_ATLAS)]){
 const image=new Image();image.src=`../assets/${name}${ENEMY_ATLAS[name]?'-v2':''}.png`;sprites[name]=image;
}
await Promise.all(Object.values(sprites).map(image=>image.decode()));
const portrait=new Portrait3D(undefined,sprites),combat=new Player3D(undefined,sprites);
const presets={
 warrior:{helm:'wolf-helm',armor:'scale-mail',pants:'iron-greaves',boots:'plate-boots',weapon:'iron-sword',offhand:'steel-shield',cloak:'red-cape',neck:'sun-necklace'},
 rogue:{helm:'rogue-hood',armor:'leather-vest',pants:'rogue-pants',boots:'trail-boots',weapon:'venom-dagger',offhand:'assassin-dagger',cloak:'forest-cloak',neck:'spider-pendant'},
 mage:{helm:'mage-hat',armor:'mage-robe',pants:'mage-pants',boots:'mage-boots',weapon:'ember-staff',offhand:null,cloak:'astral-cloak',neck:'arcane-pendant'},
 mixed:{helm:'mage-hat',armor:'frost-plate',pants:'rogue-pants',boots:'plate-boots',weapon:'inferno-axe',offhand:null,cloak:'silk-cloak',neck:'spider-pendant'}
};
$('enemy').innerHTML=Object.keys(ENEMY_ATLAS).map(name=>`<option>${name}</option>`).join('');
$('gear').innerHTML=Object.entries(SLOTS).map(([slot,name])=>`<label>${name}<select data-slot="${slot}"><option value="">Empty</option>${Object.entries(ITEMS).filter(([,item])=>item.slot===(slot.startsWith('ring')?'ring':slot)).map(([id,item])=>`<option value="${id}">${item.name}</option>`).join('')}</select></label>`).join('');
function outfit(){save.equipment={...newSave().equipment,...presets[$('outfit').value]};for(const select of document.querySelectorAll('[data-slot]'))select.value=save.equipment[select.dataset.slot]||'';render();}
function render(){
 const clock=Number($('time').value),type=$('enemy').value,dir=$('direction').value;
 portrait.sync(save);const portraitContext=$('portrait').getContext('2d');portraitContext.clearRect(0,0,480,800);portraitContext.drawImage(portrait.renderer.domElement,0,0);
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
for(const id of ['time','direction','action','enemy'])$(id).oninput=render;
$('gear').onchange=event=>{save.equipment[event.target.dataset.slot]=event.target.value||null;if(ITEMS[save.equipment.weapon]?.hands===2)save.equipment.offhand=null;portrait.signature=null;render();};
function loop(now){if(playing&&now-previous>32){$('time').value=(Number($('time').value)+now-previous)%1800;render();previous=now;}else if(!playing)previous=now;requestAnimationFrame(loop);}
outfit();requestAnimationFrame(loop);
