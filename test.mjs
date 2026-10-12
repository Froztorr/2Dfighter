import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const fps=await import('./fps-player.mjs');
const core = await import('./core.mjs').catch(() => ({}));

test('impact particles follow the hit direction',()=>{assert.ok(core.impactParticles('up',10).every(p=>p.vy<0));assert.ok(core.impactParticles('right',10).every(p=>p.vx>0));});

test('daily quests reset at Bangkok midnight and pay once, minigame prizes are capped and survive reload',()=>{
  const s=core.newSave(),before=Date.parse('2026-09-22T16:59:59Z'),after=before+1000;
  assert.equal(core.dayKey(before),'2026-09-22');assert.equal(core.dayKey(after),'2026-09-23');
  assert.equal(core.claimQuest(s,'hunt',before),null);
  core.progress(s,'kills',6,before);const reward=core.claimQuest(s,'hunt',before);assert.ok(reward.gold>0);
  assert.equal(core.claimQuest(s,'hunt',before),null);
  const restored=core.loadSave(JSON.stringify(s));assert.equal(core.claimQuest(restored,'hunt',before),null);
  assert.equal(core.daily(s,after).counts.kills,0);
  for(let i=0;i<3;i++)assert.ok(core.finishMini(s,'forge',15,after).gold>0);
  assert.equal(core.finishMini(s,'forge',15,after).gold,0);
  assert.equal(core.finishMini(s,'forge',999,after),null);
  assert.equal(core.daily(core.loadSave(JSON.stringify(s)),after).plays.forge,3);
});
test('campaign content has six playable floors and valid new equipment drops',()=>{
  assert.equal(core.FLOORS.length,6);
  for(const floor of core.FLOORS){assert.equal(floor.enemies.length,3);for(const id of floor.drops)assert.ok(core.ITEMS[id]);}
  const s=core.loadSave(JSON.stringify({...core.newSave(),unlocked:6}));assert.equal(s.unlocked,6);
  assert.equal(core.forgeScore(.5),3);assert.equal(core.forgeScore(.99),0);
});

test('equipment enforces two hands, shields, unique rings and migrates old saves',()=>{
  const s=core.newSave();s.owned=Object.keys(core.ITEMS);
  assert.equal(core.stats(s).canBlock,true);
  assert.equal(core.equip(s,'weapon','greatsword'),true);
  assert.equal(s.equipment.offhand,null);assert.equal(core.stats(s).canBlock,false);
  assert.equal(core.equip(s,'offhand','wood-shield'),false);
  core.equip(s,'weapon','rust-sword');core.equip(s,'offhand','parry-dagger');
  assert.equal(core.stats(s).canBlock,false);
  core.equip(s,'offhand','wood-shield');assert.equal(core.stats(s).canBlock,true);
  core.equip(s,'offhand',null);assert.equal(core.loadSave(JSON.stringify(s)).equipment.offhand,null);
  core.equip(s,'ring1','moon-ring');assert.equal(core.equip(s,'ring2','moon-ring'),false);
  const old=core.loadSave(JSON.stringify({owned:['moon-ring'],equipment:{ring:'moon-ring'}}));
  assert.equal(old.equipment.ring1,'moon-ring');
  assert.equal(Object.keys(old.equipment).length,10);
});
test('enemy defense strengthens with level and opens after counters; rating counts damage and potions',()=>{
  assert.ok(core.guardReduction(8)>core.guardReduction(1));
  assert.equal(core.stars({damage:0,potions:0,maxHp:100}),3);
  assert.equal(core.stars({damage:30,potions:0,maxHp:100}),2);
  assert.equal(core.stars({damage:0,potions:2,maxHp:100}),1);
});
test('opposite slashes parry; matching dodges evade, only inside the timing window', () => {
  assert.equal(typeof core.defend, 'function');
  for (const [incoming, opposite] of [['up','down'],['down','up'],['left','right'],['right','left']]) {
    assert.equal(core.defend(incoming, opposite, 'slash', 100), 'perfect');
    assert.equal(core.defend(incoming, incoming, 'dodge', 300), 'normal');
    assert.equal(core.defend(incoming, incoming, 'slash', 100), null);
  }
  assert.equal(core.defend('up','down','slash',451), null);
  assert.equal(core.defend('up','down','slash',-1), null);
});
test('staff runes distinguish a circle, V and Z from lines and old overlapping shapes',()=>{
 const circle=Array.from({length:65},(_,i)=>[100+60*Math.cos(i*Math.PI/32),100+60*Math.sin(i*Math.PI/32)]);
 assert.equal(core.recognize(circle),'circle');
 assert.equal(core.recognize([[20,20],[80,120],[140,20]]),'chevron');
 assert.equal(core.recognize([[20,20],[140,20],[20,120],[140,120]]),'bolt');
 for(const points of [[[0,0],[50,0],[100,0]],[[1,1],[2,2]],[[20,20],[140,20],[140,140],[20,140],[20,20]],circle.concat(circle.slice(1))])assert.equal(core.recognize(points),null);
});
test('shop refuses unaffordable and duplicate purchases; gear and upgrades change stats', () => {
  assert.equal(typeof core.newSave, 'function');
  const s=core.newSave(); s.gold=0;
  assert.equal(core.buy(s,'iron-sword'),false);
  assert.equal(s.gold,0);
  s.gold=1000;
  assert.equal(core.buy(s,'iron-sword'),true);
  const balance=s.gold;
  assert.equal(core.buy(s,'iron-sword'),false);
  assert.equal(s.gold,balance);
  s.equipment.weapon='iron-sword';
  assert.ok(core.stats(s).attack>core.stats(core.newSave()).attack);
});
test('save loading rejects invalid equipment and clamps corrupt progression',()=>{
  assert.equal(typeof core.loadSave,'function');
  const s=core.loadSave('{"gold":-5,"level":999,"unlocked":999,"owned":["hacked"],"equipment":{"weapon":"hacked"}}');
  assert.equal(s.gold,0); assert.equal(s.unlocked,6); assert.equal(s.level,20);
  assert.equal(s.equipment.weapon,'rust-sword');
  assert.deepEqual(core.loadSave('invalid'),core.newSave());
});
test('staff runes tolerate finger jitter, sparse events, reverse strokes and different sizes',()=>{
 const densify=points=>points.slice(1).flatMap((p,i)=>Array.from({length:17},(_,j)=>points[i].map((v,k)=>v+(p[k]-v)*j/17))).concat([points.at(-1)]);
 const samples=[
  ['circle',Array.from({length:55},(_,i)=>[90+53*Math.cos(.5+i*6.03/54),110+43*Math.sin(.5+i*6.03/54)])],
  ['chevron',densify([[20,35],[80,150],[125,55]])],
  ['bolt',densify([[25,25],[130,40],[35,115],[140,135]])]
 ];
 for(const [expected,points]of samples)for(const scale of [.55,1,1.8])for(const reverse of [false,true]){
  const jittered=points.map(([x,y],i)=>[(x+Math.sin(i*1.7)*1.1)*scale+30,(y+Math.cos(i*2.3)*1.1)*scale+50]);
  assert.equal(core.recognize(reverse?jittered.reverse():jittered),expected,expected+' scale='+scale+' reverse='+reverse);
 }
 assert.equal(core.recognize([[NaN,0],[20,20],[80,120],[140,20],[Infinity,3]]),'chevron');
 assert.equal(core.recognize([[0,0],[1,0],[1,1],[0,1],[0,0]]),null);
});
test('heavy and sweep attacks reject both parry and dodge; guard stops every attack type',()=>{
  assert.equal(core.defend('up','down','slash',100,'heavy'),null);
  assert.equal(core.defend('up','up','dodge',100,'heavy'),null);
  assert.equal(core.defend('up','down','slash',100,'sweep'),null);
  assert.equal(core.defend('up','up','dodge',100,'sweep'),null);
  for(const kind of ['normal','heavy','sweep']){
    const result=core.blockHit(100,kind);
    assert.equal(result.broken,false);
    assert.ok(result.stamina<100&&result.stamina>0);
  }
});
test('guard breaks on insufficient or exactly depleted stamina and recovers gradually',()=>{
  assert.equal(typeof core.blockHit,'function');
  for(const amount of [0,5,24]){
    assert.deepEqual(core.blockHit(amount,'normal'),{stamina:0,broken:true});
  }
  assert.deepEqual(core.blockHit(25,'normal'),{stamina:1,broken:false});
  assert.equal(core.regenStamina(98,1,false),100);
  assert.equal(core.regenStamina(0,1,false),16);
  assert.equal(core.regenStamina(0,1,true),4);
});
test('real game loop: six floors, parry stun, dodge, spells, rewards, death, and pause', async()=>{
  const nodes=new Map(), events=new Map(), storage=new Map();
  const imageCalls=[];
  const drawing=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):key==='drawImage'?(...args)=>imageCalls.push(args):()=>{},set:()=>true});
  const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{setProperty(){}},dataset:{},hidden:true,setAttribute(){},classList:{toggle(){}},addEventListener(type,fn){events.set(id+':'+type,fn);},getContext:()=>drawing,querySelector:()=>node('heading'),getBoundingClientRect:()=>({left:0,top:0,width:240,height:400}),setPointerCapture(){}});return nodes.get(id);};
  const context=vm.createContext({...core,...fps,createPhaserRenderer:()=>({syncEnemy:r=>imageCalls.push([r.sheet,r.sx,r.sy,r.sw,r.sh,0,0,r.sw,r.sh]),preview(){},closePreview(){}}),Image:class{complete=true;naturalWidth=1122;naturalHeight=1402;set src(path){if(/\/(frost|spider|demon)\.png$/.test(path)){this.naturalWidth=1024;this.naturalHeight=1536;}}},document:{createElement:()=>node("background"),getElementById:node,querySelectorAll:()=>[],addEventListener(type,fn){events.set("document:"+type,fn);},hidden:false},window:{addEventListener(){}},performance:{now:()=>0},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame(){},console});
  const source=(await readFile(new URL('./app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
  vm.runInContext(source,context);
  const run=s=>vm.runInContext(s,context);
  assert.equal(run('phase'),'home');run('loop(500)');assert.equal(run('enemy'),undefined);
  const clickButton=button=>events.get('document:click')({target:{closest:()=>({id:'',dataset:{},hasAttribute:()=>false,...button})}});
  clickButton({id:'start'});assert.equal(run('phase'),'home');assert.match(nodes.get('homeBody').innerHTML,/THE EXPEDITION/);
  clickButton({dataset:{embark:'6'}});assert.equal(run('phase'),'home','locked floor is not entered');
  run('spritesLoaded=Object.keys(sprites).length');clickButton({dataset:{embark:'1'}});assert.equal(run('phase'),'combat');
  run('enemy.openUntil=time+1000');const beforeContact=run('enemy.hp');
  events.get('scene:pointerdown')({pointerId:9,clientX:100,clientY:200});events.get('scene:pointermove')({pointerId:9,clientX:140,clientY:200});
  assert.equal(run('heroAction.type'),'slash');assert.equal(run('enemy.hp'),beforeContact,'damage waits for contact');
  run('time+=110;resolvePlayerStrike()');assert.ok(run('enemy.hp')<beforeContact);assert.ok(run('particles.length')>0);
  events.get('scene:pointerup')({pointerId:9,clientX:160,clientY:200});assert.equal(run('pendingSlash'),null,'release does not double strike');
  run('save.equipment.offhand="parry-dagger";nextSlash=time;enemy.hp=500;enemy.openUntil=time+2000;slash("right")');
  const combinedDamage=run('stats(save).attack'),rightDamage=run('pendingSlash.damage');
  run('time+=109;resolvePlayerStrike()');assert.equal(run('enemy.hp'),500);
  run('time++;resolvePlayerStrike()');assert.equal(run('enemy.hp'),500-rightDamage);
  run('time+=54;resolvePlayerStrike()');assert.equal(run('enemy.hp'),500-rightDamage);
  run('time++;resolvePlayerStrike()');assert.equal(run('enemy.hp'),500-combinedDamage);assert.equal(run('pendingSlash'),null);
  run('resolvePlayerStrike()');assert.equal(run('enemy.hp'),500-combinedDamage,'offhand hit resolves only once');
  run('save.equipment.offhand="wood-shield"');
  clickButton({dataset:{home:'hall'}});assert.equal(run('phase'),'home');assert.equal(run('attack'),null);
  run('enter(1);attack={dir:"up",at:time+100};slash("down")');
  assert.equal(run('attack'),null);assert.ok(run('stunned>time'));assert.equal(run('hp'),100);
  const enemyBefore=run('enemy.hp');run('time+=310;slash("left");time+=120;resolvePlayerStrike()');assert.ok(run('enemy.hp')<enemyBefore);
  run('attack={dir:"right",at:time+100};evade("right")');assert.equal(run('attack'),null);
  run('save.equipment.weapon="ember-staff"');
  const circle=Array.from({length:65},(_,i)=>[100+60*Math.cos(i*Math.PI/32),100+60*Math.sin(i*Math.PI/32)]);
  context.rune=circle;run('cast(rune)');const after=run('enemy.hp');run('cast(rune)');assert.equal(run('enemy.hp'),after);
  context.rune=[[20,20],[80,120],[140,20]];run('cast(rune)');assert.equal(run('shield'),2);
  run('attack={dir:"up",at:time};loop(last+16)');assert.equal(run('hp'),100);assert.equal(run('shield'),1);
  run('shield=0;attack={dir:"up",at:time};openPanel();loop(last+16)');assert.equal(run('hp'),100);
  run('paused=false;hitStop=0;loop(last+16)');assert.ok(run('hp')<100);
  run('save.equipment.weapon="rust-sword";enter(1)');
  run('enter(3)');const guardedHp=run('enemy.hp');
  run('for(let i=0;i<30;i++){time+=310;slash("left");time+=120;resolvePlayerStrike()}');assert.equal(run('enemy.hp'),guardedHp,'late enemies must stop blind swipe spam');
  run('attack={dir:"up",kind:"normal",at:time+300};time+=1;defensive("down","slash");time+=310;slash("left");time+=120;resolvePlayerStrike()');assert.ok(run('enemy.hp')<guardedHp);
  run('enter(1);hp=40;drinkPotion()');assert.equal(run('hp'),90);assert.equal(run('run.potions'),1);assert.equal(run('save.potions'),2);
  run('enter(1);drinkPotion()');assert.equal(run('save.potions'),2,'full health must not consume potion');
  for(let floor=1;floor<=6;floor++){
    const startingGold=run('save.gold');
    run(`enter(${floor})`);
    for(let room=0;room<3;room++){
      for(let strikes=0;strikes<50&&run('phase')==='combat';strikes++)run('attack={dir:"right",kind:"normal",at:time+100};defensive("left","slash");time+=310;slash("left");time+=120;resolvePlayerStrike()');
      assert.equal(run('phase'),'walking');assert.match(nodes.get('rewardToast').innerHTML,/EXP/);assert.equal(nodes.get('rewardToast').hidden,false);
      const earned=run('save.gold');run('hit(999)');assert.equal(run('save.gold'),earned,'defeated enemy pays once');
      run('time=rewardUntil+1;hud()');assert.equal(nodes.get('rewardToast').hidden,true);
      run('loop(last+16)');
    }
    assert.equal(run('phase'),'won');assert.equal(run('save.gold')-startingGold,run('run.gold'));assert.ok(run('run.xp')>0);assert.equal(run('run.items.length'),3);assert.equal(run('stars(run)'),3);
    assert.match(nodes.get('panelBody').innerHTML,/3 of 3 stars/);
    const balance=run('save.gold');run('loop(last+16)');assert.equal(run('save.gold'),balance);
  }
  assert.equal(run('save.unlocked'),6);assert.ok(storage.has('emberblade-v1'));
  run('enter(3);hp=1;attack={dir:"up",at:time};loop(last+16)');assert.equal(run('phase'),'dead');assert.equal(run('paused'),false);run('for(let i=0;i<30;i++)loop(last+50)');assert.equal(run('paused'),true);
  run('enter(3)');assert.equal(run('hp'),100);assert.equal(run('phase'),'combat');
  run('stamina=100;setBlocking(true);attack={dir:"up",kind:"heavy",at:time};loop(last+16)');
  assert.equal(run('hp'),100);assert.equal(run('stamina'),58);
  run('stamina=10;attack={dir:"up",kind:"heavy",at:time};loop(last+16)');
  assert.ok(run('hp')<100);assert.equal(run('stamina'),0);assert.ok(run('playerStunned>time'));assert.equal(run('currentHero().action'),'stun');
  const hurt=run('enemy.hp');run('slash("left");evade("left");setBlocking(true)');
  assert.equal(run('enemy.hp'),hurt);assert.equal(run('blocking'),false);
  run('time=playerStunned+1;setBlocking(true)');assert.equal(run('blocking'),true);
  run('openPanel()');assert.equal(run('blocking'),false);
  run('enter(1);attack={dir:"up",kind:"sweep",at:time+100};evade("up")');assert.notEqual(run('attack'),null);
  run('setBlocking(true);attack.at=time;loop(last+16)');assert.equal(run('hp'),100);
  run('setBlocking(false)');
  events.get('blockBtn:pointerdown')({pointerId:1,preventDefault(){}});assert.equal(run('blocking'),true);
  events.get('blockBtn:pointerup')({pointerId:2});assert.equal(run('blocking'),true);
  events.get('blockBtn:pointercancel')({pointerId:1});assert.equal(run('blocking'),false);
  run('equip(save,"weapon","ember-staff");enter(1);setBlocking(true)');assert.equal(run('blocking'),false);
  run('equip(save,"weapon","rust-sword");equip(save,"offhand","wood-shield");enter(1);draw()');
  assert.ok(imageCalls.some(frame=>frame[0]===run('sprites.brute')),'guard must retain the combat character atlas');
  assert.ok(!imageCalls.some(frame=>frame[0]===run('sprites.guards')),'guard must not replace the enemy anatomy');
  imageCalls.length=0;run('hit(10);draw()');
  assert.ok(imageCalls.some(frame=>frame[0]===run('sprites.brute')),'guard impact must retain the combat character atlas');
  for(const type of ['brute','lizard','wraith','knight'])for(const [dir,expectedRow] of [['up',1],['down',2],['left',type==='wraith'?4:3],['right',type==='wraith'?3:4]]){
    run(`enter(1);enemy.type='${type}';attack={dir:'${dir}',kind:'normal',at:time+900};draw()`);
    const prep=imageCalls.findLast(frame=>frame[0]===run(`sprites['${type}']`));
    assert.equal(Math.floor((prep[2]+prep[4]/2)/280.4),expectedRow);
    run('resolveAttack();draw()');const strike=imageCalls.findLast(frame=>frame[0]===run(`sprites['${type}']`));
    assert.equal(Math.floor((strike[2]+strike[4]/2)/280.4),expectedRow);
    assert.notEqual(prep[1],strike[1],'windup and strike must be different frames');
    for(const frame of [prep,strike]){assert.ok(frame.slice(1).every(Number.isFinite));assert.ok(frame[1]>=0&&frame[2]>=0&&frame[1]+frame[3]<=1122&&frame[2]+frame[4]<=1402);}
  }
  for(const [i,type] of ['frost','spider','demon'].entries())for(const dir of ['up','down','left','right']){
    run(`enter(${i+4});enemy.type='${type}';draw();attack={dir:'${dir}',kind:'normal',at:time+900};draw()`);
    const prep=imageCalls.findLast(frame=>frame[0]===run(`sprites.${type}`));
    run('resolveAttack();draw()');const strike=imageCalls.findLast(frame=>frame[0]===run(`sprites.${type}`));
    assert.notEqual(prep[1],strike[1]);
    for(const frame of [prep,strike])assert.ok(frame[1]>=0&&frame[2]>=0&&frame[1]+frame[3]<=1024&&frame[2]+frame[4]<=1536);
  }
  run('save=newSave()');
  for(let f=1;f<=6;f++){
    run(`enter(${f})`);
    // Play the actual scheduler at 60 fps with starter gear, without injecting enemies or damage.
    run(`for(let frames=0;frames<18000&&!['won','dead'].includes(phase);frames++){
      loop(last+16);
      if(attack&&attack.at-time<=130){if(attack.kind!=='normal')setBlocking(true);else if(attack.kind==='heavy')evade(attack.dir);else slash(DIR[attack.dir]);}
      else if(!attack){setBlocking(false);if(enemy.openUntil>time)slash('left');}
    }`);
    assert.equal(run('phase'),'won',`starter equipment can finish floor ${f} using correctly timed defenses`);
    assert.equal(run('run.damage'),0);
  }
});

test('first-person frames preserve directional contact and terminal states',async()=>{
  const {playerFrame,equipmentArt}=await import('./fps-player.mjs');
  const rows={right:1,left:2,up:3,down:4};
  for(const [dir,row]of Object.entries(rows)){
    assert.equal(playerFrame('slash',dir,109).column,3);
    assert.deepEqual(playerFrame('slash',dir,110),{row,column:4,index:row*8+4});
    assert.equal(playerFrame('slash',dir,300).row,0);
    assert.equal(new Set(Array.from({length:300},(_,ms)=>playerFrame('slash',dir,ms).index)).size,8);
  }
  for(const action of Object.keys(core.HERO_ACTIONS))for(let ms=0;ms<1500;ms+=7){const f=playerFrame(action,'left',ms);assert.ok(f.row>=0&&f.row<8&&f.column>=0&&f.column<8);}
  assert.equal(playerFrame('death','right',2000).index,63);
  assert.equal(playerFrame('stun','right',2000).row,7);
  assert.deepEqual(playerFrame('block','right',360),playerFrame('guard','right',0));
  const save=core.newSave();save.owned=Object.keys(core.ITEMS);
  for(const [armor,look]of [[null,0],['scale-mail',1],['leather-vest',2],['mage-robe',3]]){core.equip(save,'armor',armor);assert.equal(equipmentArt(save).look,look);}
  core.equip(save,'weapon','ember-staff');assert.equal(equipmentArt(save).twoHanded,true);assert.equal(equipmentArt(save).offhand,null);
});

test('3D arm IK preserves bone lengths and attaches both grips across combat actions',async()=>{
 const {samplePlayerRig,gripPoint,RIGHT_WRIST,LEFT_WRIST,ARM_LENGTHS,SUPPORT_GRIP}=await import('./player-rig.mjs');
 const {WEAPON_STYLES}=await import('./player-3d.mjs');
 const save=core.newSave();save.owned=Object.keys(core.ITEMS);
 assert.deepEqual(fps.playerAssets(save),[]);
 for(const weapon of fps.PLAYER_WEAPONS){
  assert.ok(WEAPON_STYLES[weapon],`missing weapon geometry: ${weapon}`);save.equipment.weapon=weapon;
  for(const action of Object.keys(core.HERO_ACTIONS))for(const dir of Object.keys(core.DIR))for(let elapsed=0;elapsed<1200;elapsed+=23){
   const pose=samplePlayerRig({save,action,dir,elapsed});
   for(const side of ['left','right']){
    const arm=pose[side];for(const joint of ['shoulder','elbow','wrist'])assert.ok(arm[joint].toArray().every(Number.isFinite));
    assert.ok(Math.abs(arm.shoulder.distanceTo(arm.elbow)-ARM_LENGTHS.upper)<1e-6);
    assert.ok(Math.abs(arm.elbow.distanceTo(arm.wrist)-ARM_LENGTHS.forearm)<1e-6);
    assert.ok(arm.reachError<1e-6,`${weapon}/${action}/${dir}/${elapsed}: arm target out of reach`);
   }
   assert.ok(pose.right.wrist.distanceTo(gripPoint(pose.grip,RIGHT_WRIST))<1e-6);
   assert.ok(pose.left.wrist.distanceTo(gripPoint(pose.leftGrip,LEFT_WRIST))<1e-6);
   if(pose.art.twoHanded){assert.equal(pose.art.offhand,null);assert.ok(pose.leftGrip.position.distanceTo(gripPoint(pose.grip,SUPPORT_GRIP))<1e-6);}
  }
 }
});
test('3D cuts travel in the requested direction, move elbows and torso, and remain continuous',async()=>{
 const {samplePlayerRig,gripPoint}=await import('./player-rig.mjs');const {Vector3}=await import('./vendor/three.module.js');const save=core.newSave();
 const contacts=[];
 for(const dir of ['left','right','up','down']){
  const sample=elapsed=>samplePlayerRig({save,action:'slash',dir,elapsed});
  assert.equal(sample(110).contact,true);assert.equal(sample(109).contact,false);contacts.push(sample(110).grip.position.toArray());
  assert.ok(sample(109).right.wrist.distanceTo(sample(111).right.wrist)>.0015,'cut should keep moving through contact');
  const start=sample(48),end=sample(185),a=gripPoint(start.grip,new Vector3(0,.49,0)),b=gripPoint(end.grip,new Vector3(0,.49,0));
  if(dir==='right')assert.ok(b.x>a.x+.4);if(dir==='left')assert.ok(b.x<a.x-.4);
  if(dir==='up')assert.ok(b.y>a.y+.6);if(dir==='down')assert.ok(b.y<a.y-.6);
  assert.ok(start.right.elbow.distanceTo(end.right.elbow)>.04,'elbow should drive a cut');
  assert.ok(start.right.shoulder.distanceTo(end.right.shoulder)>.012,'shoulder girdle should turn');
  assert.ok(Math.abs(start.grip.position.z-end.grip.position.z)>.005||Math.abs(a.z-b.z)>.05,'cut must travel in depth');
  for(let elapsed=1;elapsed<=301;elapsed++){
   const a=sample(elapsed-1),b=sample(elapsed);
   assert.ok(a.right.wrist.distanceTo(b.right.wrist)<.013,`${dir} wrist discontinuity at ${elapsed}`);
   assert.ok(a.grip.quaternion.angleTo(b.grip.quaternion)<.09,`${dir} rotation discontinuity at ${elapsed}`);
   assert.ok(a.right.elbow.distanceTo(b.right.elbow)<.015);
  }
 }
 assert.equal(new Set(contacts.map(JSON.stringify)).size,4);
 assert.equal(samplePlayerRig({save,action:'death',elapsed:2000}).alpha,0);
 const idle=elapsed=>samplePlayerRig({save,elapsed,reducedMotion:true}).grip.position.toArray();assert.deepEqual(idle(0),idle(500));
});

test('actual 3D bone hierarchy puts hands and equipment at the solved grips',async()=>{
 const {Player3D}=await import('./player-3d.mjs');const {Vector3,Quaternion}=await import('./vendor/three.module.js');
 const {gripPoint,LEFT_WRIST}=await import('./player-rig.mjs');
 const model=new Player3D({render(){},renderLists:{dispose(){}}}),save=core.newSave();
 try{
  for(const weapon of ['rust-sword','greatsword','ember-staff'])for(const offhand of [null,'wood-shield','steel-shield','parry-dagger']){
   save.equipment.weapon=weapon;save.equipment.offhand=offhand;
   for(const dir of Object.keys(core.DIR))for(const action of ['slash','block','parry','death'])for(const elapsed of [0,48,110,185,300,1000]){
    const pose=model.sync({save,action,dir,elapsed});
    for(const side of ['left','right'])assert.ok(model[side].wrist.getWorldPosition(new Vector3()).distanceTo(pose[side].wrist)<1e-6);
    assert.ok(model.weapon.getWorldPosition(new Vector3()).distanceTo(pose.grip.position)<1e-6);
    assert.ok(model.weapon.getWorldQuaternion(new Quaternion()).angleTo(pose.grip.quaternion)<1e-6);
    assert.ok(model.left.wrist.getWorldPosition(new Vector3()).distanceTo(gripPoint(pose.leftGrip,LEFT_WRIST))<1e-6);
   }
  }
 }finally{model.destroy();}
});


test('pixel equipment extrusion has real thickness, open holes and outward surface normals',async()=>{
 const {extrudePixels,solidPixelMask}=await import('./pixel-equipment.mjs');
 const specks=new Uint8Array(6*4);for(const i of[0,1,5])specks.set([100,100,100,255],i*4);const cleaned=solidPixelMask(specks,6,1);assert.equal(cleaned[5*4+3],0);assert.equal(cleaned[3],255);assert.equal(cleaned[7],255);
 const data=new Uint8Array(3*3*4);for(let i=0;i<9;i++){data.set([140,90,30,255],i*4);}data[4*4+3]=0;
 const solid=extrudePixels(data,3,3,{depth:.04,length:.3,shield:true});
 for(const[name,z]of[['front',.02],['back',-.02]]){
  const g=solid[name];for(let i=0;i<g.attributes.position.count;i++){
   assert.ok(Math.abs(g.attributes.position.getZ(i)-z)<1e-7);
   assert.ok(g.attributes.normal.getZ(i)*Math.sign(z)>.99);
  }
  // The central transparent pixel has no surface triangles.
  const p=g.attributes.position;for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;assert.ok(Math.abs(x)>=.05||Math.abs(y)>=.05);}
 }
 assert.equal(solid.walls.attributes.position.count,16*6); // 12 exterior edges + 4 inside the hole.
 assert.ok(solid.walls.attributes.color.count>0);
 for(const g of Object.values(solid))g.dispose();
});

test('closed glove encloses the shaft on every side without passing through its contact volume',async()=>{
 const {sculptedHand}=await import('./player-sculpt.mjs');
 for(const side of ['right','left'])for(const profile of [{radiusX:.014,radiusZ:.012},{radiusX:.014,radiusZ:.0175},{radiusX:.012,radiusZ:.012,round:true}]){
  const g=sculptedHand(side,profile),p=g.attributes.position,counts=[0,0,0,0];
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(y<-.027||y>.031)continue;
   const inside=profile.round?Math.hypot(x/profile.radiusX,z/profile.radiusZ)<.82:Math.abs(x)<profile.radiusX-.002&&Math.abs(z)<profile.radiusZ-.002;
   assert.equal(inside,false,'glove penetrates held shaft');
   if(Math.abs(x)<profile.radiusX&&z>profile.radiusZ)counts[0]++;
   if(Math.abs(x)<profile.radiusX&&z<-profile.radiusZ)counts[1]++;
   if(x>profile.radiusX&&Math.abs(z)<profile.radiusZ)counts[2]++;
   if(x<-profile.radiusX&&Math.abs(z)<profile.radiusZ)counts[3]++;
  }
  assert.ok(counts.every(n=>n>30),'fingers must enclose the front, rear and both sides');g.dispose();
 }
});

test('inventory hilt is centered on the physical grip for both hands',async()=>{
 const {extrudePixels,fitEquipmentGrip,gripSection}=await import('./pixel-equipment.mjs');
 const data=new Uint8Array(10*20*4);for(let y=0;y<20;y++)for(let x=6;x<9;x++)data.set([90,50,20,255],(y*10+x)*4);
 const g=extrudePixels(data,10,20,{grip:[.5,.5],length:.6,depth:.024,shield:true});
 assert.ok(gripSection(g.front,0).center>.1);fitEquipmentGrip(g,true);
 for(const y of [0,-.125]){const s=gripSection(g.front,y);assert.ok(Math.abs(s.center)<.0001);assert.ok(Math.abs(s.halfWidth-.014)<.0001);}
 for(const mesh of Object.values(g))mesh.dispose();
});


test('dual-wielded cuts drive both hands through directional attacks and preserve total nominal damage',async()=>{
 const {samplePlayerRig,gripPoint}=await import('./player-rig.mjs');const {Vector3}=await import('./vendor/three.module.js');
 const save=core.newSave();save.equipment.weapon='iron-sword';
 for(const offhand of ['parry-dagger','assassin-dagger','spider-claw']){
  save.equipment.offhand=offhand;
  const hits=core.strikeContacts(save);assert.deepEqual(hits.map(h=>[h.hand,h.at]),[['right',110],['left',165]]);assert.equal(hits.reduce((n,h)=>n+h.damage,0),core.stats(save).attack);
  for(const dir of Object.keys(core.DIR)){
   const sample=elapsed=>samplePlayerRig({save,action:'slash',dir,elapsed}),a=sample(75),b=sample(230),tip=new Vector3(0,.28,0),from=gripPoint(a.leftGrip,tip),to=gripPoint(b.leftGrip,tip);
   assert.ok(a.left.elbow.distanceTo(b.left.elbow)>.035,'left elbow must drive the strike');assert.ok(a.leftGrip.quaternion.angleTo(b.leftGrip.quaternion)>1,'offhand must swing rather than bob');
   if(dir==='right')assert.ok(to.x>from.x+.25);if(dir==='left')assert.ok(to.x<from.x-.25);if(dir==='up')assert.ok(to.y>from.y+.35);if(dir==='down')assert.ok(to.y<from.y-.35);
   assert.equal(sample(165).offhandContact,true);assert.equal(sample(110).offhandContact,false);
   for(let elapsed=0;elapsed<=300;elapsed+=5){const p=sample(elapsed);assert.ok(p.left.reachError<1e-6);assert.ok(p.right.reachError<1e-6);if(elapsed<300)assert.ok(p.left.wrist.distanceTo(sample(elapsed+5).left.wrist)<.06,'continuous offhand recovery');}
  }
 }
 save.equipment.offhand='wood-shield';assert.equal(core.strikeContacts(save).length,1);save.equipment.weapon='greatsword';save.equipment.offhand='parry-dagger';assert.equal(core.strikeContacts(save).length,1);
});
