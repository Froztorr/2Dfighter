import * as T from './vendor/three.module.js';
import {Expedition,MAP,CLIPS,spriteView,angleDelta} from './expedition-core.mjs';
import {makeSentinelAtlas,sentinelFrame} from './sentinel-sprites.mjs';
import {Player3D,combatWebGLRenderer} from './player-3d.mjs';
import {newSave,loadSave,stats,ITEMS,FLOORS,grant,progress,DIR,strikeContacts} from './core.mjs';

const $=id=>document.getElementById(id),menu=$('menu');menu.showModal();
let save=newSave();try{const raw=localStorage.getItem('emberblade-v1');if(raw)save=loadSave(raw);}catch{}
const requested=Number(new URLSearchParams(location.search).get('floor'))||1,floor=Math.max(1,Math.min(save.unlocked,6,Math.floor(requested))),world=new Expedition(Math.random,floor),s=stats(save);
let hp=s.maxHp,guard=false,paused=true,done=false,nextSlash=0,nextDodge=0,novaAt=0,dodgeUntil=0,flashUntil=0,hero={action:'idle',dir:'right',at:0},pending=[],fx=[],keys=new Set(),movePointer=null,moveAxis=[0,0],pointer=null,noticeUntil=0;
let renderer,scene,camera,atlas,figures=[],hands,handRenderer,w=1,h=1,last=performance.now();const overlay=$('effects'),ctx=overlay.getContext('2d');
const arrows={up:'↑',down:'↓',left:'←',right:'→'},specialNames={thrust:'PIERCING THRUST',kick:'GUARD BREAKER',cast:'HEX FIRE'};
function say(text,seconds=2){$('notice').textContent=text;noticeUntil=world.time+seconds;}
function persistReward(fn){
 // Read latest save before applying rewards so a second tab's equipment choices survive.
 try{const raw=localStorage.getItem('emberblade-v1');if(raw)save=loadSave(raw);}catch{}
 fn(save);
 try{localStorage.setItem('emberblade-v1',JSON.stringify(save));}
 catch{say('บันทึกไม่ได้ · รางวัลอยู่ในรอบนี้เท่านั้น',6);}
}
function animate(action,dir='right'){hero={action,dir,at:world.time};}
function hitEffect(e,text,dir='right',blood=true){
 fx.push({e,text,dir,blood,at:world.time});
}
function kill(e){
 const item=FLOORS[floor-1].drops[e.id];persistReward(v=>{grant(v,{gold:35+floor*5,xp:40+floor*10});progress(v,'kills');if(!v.owned.includes(item))v.owned.push(item);else grant(v,{gold:30});});
 say(`DEFEATED · +${35+floor*5} GOLD · ${ITEMS[item].name}`,3);
 if(world.enemies.every(x=>x.hp<=0)){
  done=true;persistReward(v=>{grant(v,{gold:150+floor*70});progress(v,'clears');v.unlocked=Math.max(v.unlocked,Math.min(6,floor+1));v.bestStars[floor]=Math.max(v.bestStars[floor]||0,hp===s.maxHp?3:hp>s.maxHp*.5?2:1);});
  $('result').textContent=`FLOOR CLEAR · +${150+floor*70} GOLD · อุปกรณ์และค่าประสบการณ์บันทึกแล้ว`;$('resume').textContent='สำรวจลานต่อ';say('THE GATE IS CLEAR · เดินสำรวจต่อได้',8);
 }
}
function strike(dir){
 if(paused||hp<=0||world.mode!=='combat'||guard||world.time<world.playerStun||world.time<nextSlash)return;
 nextSlash=world.time+.36;animate('slash',dir);const e=world.target();if(!e){say('หันเข้าหาศัตรูให้ตรงเป้า');return;}
 if(e.attack?.kind==='normal'&&DIR[e.attack.dir]===dir){
  const remain=e.attack.contact-world.time;if(remain>=0&&remain<=.45){
   if(remain<=.2){world.stun(e);hitEffect(e,'PERFECT · STUN',dir,false);}else{e.attack=null;e.nextAttack=world.time+1.4;hitEffect(e,'PARRY',dir,false);}
   persistReward(v=>progress(v,'defenses'));animate('parry',dir);return;
  }
 }
 for(const contact of strikeContacts(save))pending.push({e,dir,at:world.time+contact.at/1000,damage:contact.damage});
}
function dodge(){
 if(paused||world.mode!=='combat'||hp<=0||world.time<world.playerStun||world.time<nextDodge)return;
 guard=false;dodgeUntil=world.time+.32;nextDodge=world.time+.85;animate('dodge','left');
}
function pulse(){
 if(paused||world.mode!=='combat'||hp<=0||world.time<world.playerStun||world.time<novaAt)return;
 const e=world.target();if(!e)return;novaAt=world.time+10;world.stun(e);hitEffect(e,'STUN', 'up',false);animate('cast');say('ศัตรูสตั้น · เปิดช่องโจมตีใหม่');
}
function setGuard(v){guard=!!v&&s.canBlock&&world.mode==='combat'&&hp>0&&!paused&&world.time>=world.playerStun;}
function texture(kind){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 const base=kind==='wall'?[63,77,89]:[49,58,59];
 for(let y=0;y<128;y++)for(let i=0;i<128;i++){
  const n=((i*19+y*23+i*y*7)%19)-9;let a=base.map(v=>v+n);
  const joint=kind==='wall'?y%24<2||(i+(Math.floor(y/24)%2)*32)%64<2:y%32<2||i%32<2;
  if(joint)a=[22,30,35];else if(kind==='wall'&&y%24===3)a=a.map(v=>v+22);
  if((i*31+y*17)%71<4&&y>70)a=[44,63,46];x.fillStyle=`rgb(${a.join(',')})`;x.fillRect(i,y,1,1);
 }
 const t=new T.CanvasTexture(c);t.magFilter=T.NearestFilter;t.minFilter=T.NearestMipmapNearestFilter;t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;return t;
}
async function init(){
 renderer=new T.WebGLRenderer({canvas:$('view'),antialias:false,alpha:false,powerPreference:'high-performance'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0x172333);scene=new T.Scene();scene.fog=new T.Fog(0x172333,5,17);camera=new T.PerspectiveCamera(67,1,.06,28);camera.rotation.order='YXZ';
 scene.add(new T.HemisphereLight(0xbacfe8,0x43533b,2.3));const moon=new T.DirectionalLight(0xc6ddff,2);moon.position.set(-4,8,2);scene.add(moon);
 const wallMap=texture('wall'),groundMap=texture('ground');groundMap.repeat.set(13,14);
 const wallMat=new T.MeshLambertMaterial({map:wallMap}),groundMat=new T.MeshLambertMaterial({map:groundMap});
 const ground=new T.Mesh(new T.PlaneGeometry(13,14),groundMat);ground.rotation.x=-Math.PI/2;ground.position.set(6.5,0,7);scene.add(ground);
 const wallGeo=new T.BoxGeometry(1,3.2,1),capGeo=new T.BoxGeometry(1.05,.14,1.05),capMat=new T.MeshLambertMaterial({color:0x63717a});
 MAP.forEach((row,z)=>[...row].forEach((cell,x)=>{if(cell!=='#')return;const o=new T.Mesh(wallGeo,wallMat);o.position.set(x+.5,1.6,z+.5);scene.add(o);const cap=new T.Mesh(capGeo,capMat);cap.position.set(x+.5,3.25,z+.5);scene.add(cap);}));
 for(const [x,z]of [[3.5,4],[9.5,4],[3.5,8],[9.5,8]]){
  const post=new T.Mesh(new T.BoxGeometry(.13,.8,.13),new T.MeshLambertMaterial({color:0x3b3029}));post.position.set(x,1.9,z);scene.add(post);
  const flame=new T.Mesh(new T.OctahedronGeometry(.12),new T.MeshBasicMaterial({color:0xffc477}));flame.position.set(x,2.4,z);scene.add(flame);const light=new T.PointLight(0xffb86c,3,4);light.position.copy(flame.position);scene.add(light);
 }
 const gate=new T.Mesh(new T.BoxGeometry(1.8,2.7,.15),new T.MeshLambertMaterial({color:0x293b3e}));gate.position.set(6.5,1.35,1.06);scene.add(gate);
 for(let i=0;i<9;i++){const bar=new T.Mesh(new T.BoxGeometry(.045,2.6,.17),capMat);bar.position.set(5.7+i*.2,1.3,1.16);scene.add(bar);}
 if(new URLSearchParams(location.search).has('bake')){
  atlas=makeSentinelAtlas(renderer);
  $('view').dataset.atlasCheck=JSON.stringify({frames:atlas.spriteChecks.length,clipped:atlas.spriteChecks.filter(c=>c.minX===0||c.minY===0||c.maxX===191||c.maxY===191||c.count<100),unique:CLIPS.map(c=>({clip:c.name,frames:new Set(atlas.spriteChecks.filter(f=>f.clip===c.name).map(f=>f.hash)).size}))});
 }else{
  atlas=new Image();atlas.src='./assets/moss-sentinel.png';await atlas.decode();
 }
 figures=world.enemies.map(e=>{
  const map=new T.CanvasTexture(atlas);map.magFilter=map.minFilter=T.NearestFilter;map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=false;
  const mat=new T.MeshBasicMaterial({map,transparent:true,alphaTest:.1,side:T.DoubleSide});const mesh=new T.Mesh(new T.PlaneGeometry(3.8,3.8),mat);scene.add(mesh);
  const shadow=new T.Mesh(new T.CircleGeometry(.43,20),new T.MeshBasicMaterial({color:0x020a10,transparent:true,opacity:.5,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;scene.add(shadow);return {mesh,map,shadow};
 });
 handRenderer=combatWebGLRenderer();hands=new Player3D(handRenderer);
 resize();addEventListener('resize',resize);$('location').textContent=`${FLOORS[floor-1].name} · MOSS GATE`;$('resume').disabled=false;$('resume').textContent='ออกเดินทาง';say('WASD / แป้นเดิน · ลากเพื่อหันมอง',8);
 if(new URLSearchParams(location.search).has('atlas')){const img=document.createElement('img');img.src=atlas.toDataURL?atlas.toDataURL():atlas.src;img.style.cssText='width:100%;image-rendering:pixelated';menu.append(img);}
 requestAnimationFrame(frame);
}
function resize(){w=innerWidth;h=innerHeight;const scale=Math.min(1,900/w,900/h);renderer.setSize(Math.round(w*scale),Math.round(h*scale),false);overlay.width=w;overlay.height=h;camera.aspect=w/h;camera.fov=Math.max(67,T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(34))/camera.aspect)));camera.updateProjectionMatrix();handRenderer.setSize(Math.round(w*scale),Math.round(h*scale),false);}
function project(e,y=1.4){const v=new T.Vector3(e.x,y,e.z).project(camera);return {x:(v.x+1)*w/2,y:(1-v.y)*h/2,visible:v.z<1&&v.z>-1};}
function update(dt){
 const previous=world.mode;
 world.move(moveAxis[0]+Number(keys.has('KeyD'))-Number(keys.has('KeyA')),moveAxis[1]+Number(keys.has('KeyW'))-Number(keys.has('KeyS')),dt);
 world.look((Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')))*dt, (Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')))*dt*.5);world.update(dt);
 if(previous!==world.mode){guard=false;if(world.mode==='combat')say('ENCOUNTER · ล็อกการเดิน · ลากแป้น ✥ เพื่อเล็ง',3);else say('ปลดล็อกการเดิน · ไปต่อที่ประตู',3);}
 world.stamina=Math.min(100,world.stamina+dt*(guard?3:17));
 for(const hit of pending.filter(v=>v.at<=world.time)){
  if(hit.e.hp>0&&hit.e.active){const damage=world.strike(hit.e,hit.damage);hitEffect(hit.e,damage?String(damage):'DEFLECT',hit.dir,damage>0);if(!damage)say('ศัตรูปัดแล้ว · Perfect parry หรือ ✦ เพื่อสตั้น');if(hit.e.hp===0)kill(hit.e);}
 }pending=pending.filter(v=>v.at>world.time);
 for(const e of world.enemies){
  if(!e.active||e.hp<=0||e.stunUntil>world.time||e.walking)continue;
  if(!e.attack&&e.nextAttack<=world.time){e.attack={...world.chooseAttack(e),start:world.time,contact:world.time+1.25,end:world.time+1.85,resolved:false};}
  const a=e.attack;if(!a)continue;
  if(world.time>=a.contact&&!a.resolved){
   a.resolved=true;
   if(world.time<dodgeUntil){hitEffect(e,'DODGE','left',false);persistReward(v=>progress(v,'defenses'));}
   else {const damage=world.receive(a,guard,s.armor);hp=Math.max(0,hp-damage);if(damage){flashUntil=world.time+.4;animate('hurt');say(world.time<world.playerStun?'GUARD BROKEN · STUNNED':`-${damage} HP`);}else{animate('block');hitEffect(e,'BLOCK','up',false);persistReward(v=>progress(v,'defenses'));}if(world.time<world.playerStun)guard=false;}
  }
  if(world.time>=a.end){e.attack=null;e.nextAttack=world.time+1.35+world.random()*.6;}
 }
 if(hp<=0){guard=false;pending=[];paused=true;$('result').textContent='YOU FELL · รางวัลที่เก็บแล้วไม่หาย';$('resume').textContent='ลองใหม่';menu.showModal();}
}
function draw(){
 const p=world.player;camera.position.set(p.x,1.52,p.z);camera.rotation.set(p.pitch,-p.yaw,0);
 if(world.time<flashUntil){camera.rotation.z=Math.sin(world.time*85)*.015;camera.position.x+=Math.sin(world.time*103)*.025;}
 const target=world.target();
 world.enemies.forEach((e,i)=>{
  const {mesh,map,shadow}=figures[i];mesh.visible=shadow.visible=e.hp>0;if(e.hp<=0)return;
  mesh.position.set(e.x,1.65,e.z);mesh.rotation.y=Math.atan2(camera.position.x-e.x,camera.position.z-e.z);shadow.position.x=e.x;shadow.position.z=e.z;
  let clip='idle',frame=Math.floor(world.time*8)%8,flip=false;
  if(e.walking){const v=spriteView(angleDelta(Math.atan2(p.x-e.x,p.z-e.z),e.yaw));clip=v.clip;flip=v.flip;}
  if(e.attack){clip=e.attack.clip;const age=world.time-e.attack.start;frame=age<1.25?Math.min(3,Math.floor(age/1.25*4)):Math.min(7,4+Math.floor((age-1.25)/.6*4));}
  if(e.stunUntil>world.time){clip='idle';frame=0;mesh.rotation.z=Math.sin(world.time*12)*.035;}else mesh.rotation.z=0;
  sentinelFrame(map,clip,frame,flip);mesh.material.color.setHex(e.hitUntil>world.time?0xff7777:e===target?0xffffff:0xc1cbd3);
 });
 renderer.render(scene,camera);ctx.clearRect(0,0,w,h);
 const elapsed=(world.time-hero.at)*1000,action=world.time<world.playerStun?'stun':guard?'guard':elapsed<600?hero.action:world.mode==='explore'&&(moveAxis.some(Boolean)||['KeyW','KeyA','KeyS','KeyD'].some(k=>keys.has(k)))?'walk':'idle';
 hands.sync({save,action,dir:hero.dir,elapsed,aspect:w/h/.6});ctx.drawImage(handRenderer.domElement,0,0,w,h);
 // Effects are projected from each enemy and composited after the player's hands.
 for(const e of world.enemies){
  if(e.hp<=0||!e.active)continue;const at=project(e,2.45);if(!at.visible)continue;
  if(e.stunUntil>world.time){for(let n=0;n<5;n++){const a=world.time*4+n*Math.PI*2/5;ctx.font='bold 24px Georgia';ctx.fillStyle='#ffe289';ctx.strokeStyle='#4b381d';ctx.lineWidth=3;const x=at.x+Math.cos(a)*34,y=at.y+Math.sin(a)*10;ctx.strokeText('★',x,y);ctx.fillText('★',x,y);}}
  if(e.attack&&!e.attack.resolved){const a=e.attack,center=project(e,2.12),remaining=a.contact-world.time;center.x=Math.max(45,Math.min(w-45,center.x));ctx.textAlign='center';ctx.font='bold 34px Georgia';ctx.fillStyle=a.kind==='special'?'#ffe2b2':'#ffb6a2';ctx.strokeStyle='#311517';ctx.lineWidth=6;const text=a.kind==='special'?'☠':arrows[a.dir];ctx.strokeText(text,center.x,center.y);ctx.fillText(text,center.x,center.y);ctx.font='bold 10px Tahoma';ctx.fillText(a.kind==='special'?specialNames[a.clip]:'PARRY / BLOCK',center.x,center.y+19);ctx.strokeStyle=remaining<.25?'#fff5d7':'#df775c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(center.x,center.y-12,29,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,remaining/1.25));ctx.stroke();}
 }
 fx=fx.filter(f=>world.time-f.at<.75);
 for(const f of fx){const age=world.time-f.at,at=project(f.e,1.25);if(!at.visible)continue;const a={right:0,left:Math.PI,up:-Math.PI/2,down:Math.PI/2}[f.dir];ctx.globalAlpha=1-age/.75;
  if(f.blood){for(let i=0;i<16;i++){const ang=a+(i%5-2)*.22,speed=45+i*7;ctx.fillStyle=i%3?'#b72d3d':'#f47567';ctx.fillRect(at.x+Math.cos(ang)*age*speed,at.y+Math.sin(ang)*age*speed+age*age*100,3+i%3,3+i%2);}if(age<.2){ctx.strokeStyle='#ffeed2';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(at.x-Math.cos(a)*65,at.y-Math.sin(a)*65);ctx.lineTo(at.x+Math.cos(a)*65,at.y+Math.sin(a)*65);ctx.stroke();}}
  ctx.textAlign='center';ctx.font='bold 26px Georgia';ctx.strokeStyle='#13202b';ctx.lineWidth=4;ctx.fillStyle=f.blood?'#fff0c4':'#99eeed';ctx.strokeText(f.text,at.x,at.y-30-age*55);ctx.fillText(f.text,at.x,at.y-30-age*55);ctx.globalAlpha=1;
 }
 if(world.time<flashUntil){const g=ctx.createRadialGradient(w/2,h/2,h*.15,w/2,h/2,h*.7);g.addColorStop(0,'#90000000');g.addColorStop(1,`rgba(175,14,28,${(flashUntil-world.time)*1.5})`);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
 $('enemyInfo').hidden=!target;$('enemyLabel').textContent=target?`${target.boss?'GATE WARDEN':'MOSSBOUND SENTINEL'} · ${target.id+1}`:'';$('enemyHealth').style.width=`${target?target.hp/target.max*100:0}%`;$('enemyGuard').textContent=target?(target.stunUntil>world.time?'STUNNED · โจมตีได้':target.hits>=target.allowance?'DEFLECTING · ทำให้สตั้นเพื่อเปิดช่อง':`OPEN · ${target.allowance-target.hits} HITS`):'';
 $('hpText').textContent=`${Math.ceil(hp)} / ${s.maxHp}`;$('health').style.width=`${hp/s.maxHp*100}%`;$('guardText').textContent=`${Math.floor(world.stamina)} / 100`;$('stamina').style.width=`${world.stamina}%`;$('potions').textContent=save.potions;$('guard').disabled=!s.canBlock;$('guard').classList.toggle('held',guard);$('nova').disabled=world.time<novaAt;$('nova').querySelector('small').textContent=world.time<novaAt?`${Math.ceil(novaAt-world.time)}s`:'STUN · F';
 document.body.dataset.mode=world.mode;$('mode').textContent=world.mode==='combat'?'COMBAT · MOVEMENT LOCKED':done?'GATE CLEARED · FREE ROAM':'FREE ROAM · APPROACH THE GATE';$('compass').textContent=['N','NE','E','SE','S','SW','W','NW'][((Math.round(p.yaw/(Math.PI/4))%8)+8)%8];if(world.time>noticeUntil)$('notice').textContent='';
}
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused)update(dt);draw();requestAnimationFrame(frame);}
function pause(){paused=true;guard=false;keys.clear();moveAxis=[0,0];pointer=null;if(!menu.open)menu.showModal();}
$('pause').onclick=pause;menu.addEventListener('cancel',e=>{e.preventDefault();resume();});
function resume(){if(!renderer||$('resume').disabled)return;if(hp<=0){location.reload();return;}paused=false;last=performance.now();menu.close();}
$('resume').onclick=resume;$('dodge').onclick=dodge;$('nova').onclick=pulse;
$('potion').onclick=()=>{if(paused||hp<=0||hp>=s.maxHp||!save.potions)return;persistReward(v=>{if(v.potions){v.potions--;hp=Math.min(s.maxHp,hp+50);}});animate('heal');};
$('guard').addEventListener('pointerdown',e=>{e.currentTarget.setPointerCapture(e.pointerId);setGuard(true);});for(const type of['pointerup','pointercancel','lostpointercapture'])$('guard').addEventListener(type,()=>setGuard(false));
document.querySelectorAll('[data-strike]').forEach(b=>b.onclick=()=>strike(b.dataset.strike));
document.querySelectorAll('[data-move]').forEach(b=>{b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);movePointer=e.pointerId;moveAxis=b.dataset.move.split(',').map(Number);});for(const type of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>{if(e.pointerId===movePointer){moveAxis=[0,0];movePointer=null;}});});
function startLook(e,lookOnly){if(paused)return;e.currentTarget.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,look:lookOnly||world.mode==='explore'||e.button===2};}
for(const el of[$('view'),$('lookPad')]){
 el.addEventListener('contextmenu',e=>e.preventDefault());el.addEventListener('pointerdown',e=>startLook(e,el.id==='lookPad'));
 el.addEventListener('pointermove',e=>{if(!pointer||e.pointerId!==pointer.id)return;if(pointer.look)world.look((e.clientX-pointer.x)*.004,(e.clientY-pointer.y)*.003);pointer.x=e.clientX;pointer.y=e.clientY;});
 el.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.sx,dy=e.clientY-pointer.sy;if(!pointer.look)strike(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');pointer=null;});el.addEventListener('pointercancel',()=>pointer=null);
}
addEventListener('keydown',e=>{if(e.code==='Escape'){pause();return;}if(paused)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='ShiftLeft'||e.code==='ShiftRight')setGuard(true);if(e.code==='Space')dodge();if(e.code==='KeyF')pulse();const index=['Digit1','Digit2','Digit3','Digit4'].indexOf(e.code);if(index>=0)strike(['up','left','down','right'][index]);});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code.startsWith('Shift'))setGuard(false);});addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
init().catch(error=>{console.error(error);$('result').textContent='เปิดฉาก 3D ไม่สำเร็จ · ตรวจว่าเบราว์เซอร์รองรับ WebGL แล้วลองใหม่';$('resume').disabled=true;});
