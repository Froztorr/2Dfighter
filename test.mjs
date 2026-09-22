import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const core = await import('./core.mjs').catch(() => ({}));
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
test('gestures distinguish a line, closed circle, square, and spiral', () => {
  assert.equal(typeof core.recognize, 'function');
  const circle = Array.from({length:65},(_,i)=>[100+70*Math.cos(i*Math.PI/32),100+70*Math.sin(i*Math.PI/32)]);
  const spiral = Array.from({length:100},(_,i)=>[100+(10+i*.7)*Math.cos(i*Math.PI/24),100+(10+i*.7)*Math.sin(i*Math.PI/24)]);
  const square = [[20,20],[80,20],[140,20],[140,80],[140,140],[80,140],[20,140],[20,80],[20,20]];
  assert.equal(core.recognize(circle),'circle');
  assert.equal(core.recognize(square),'square');
  assert.equal(core.recognize(spiral),'spiral');
  assert.equal(core.recognize([[0,0],[100,0]]),null);
  assert.equal(core.recognize([[1,1],[2,2]]),null);
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
  assert.equal(s.gold,0); assert.equal(s.unlocked,3); assert.equal(s.level,20);
  assert.equal(s.equipment.weapon,'rust-sword');
  assert.deepEqual(core.loadSave('invalid'),core.newSave());
});
test('gesture recognition handles squares started mid-edge and an open spiral',()=>{
  const square=[[80,20],[140,20],[140,80],[140,140],[80,140],[20,140],[20,80],[20,20],[80,20]];
  const spiral=Array.from({length:90},(_,i)=>[100+(8+i*.8)*Math.cos(i*Math.PI/27),100+(8+i*.8)*Math.sin(i*Math.PI/27)]);
  assert.equal(core.recognize(square),'square');
  assert.equal(core.recognize(spiral),'spiral');
  assert.equal(core.recognize([[0,0],[1,0],[1,1],[0,1],[0,0]]),null);
});
test('heavy attacks cannot be parried; sweeps demand a block; guard stops every attack type',()=>{
  assert.equal(core.defend('up','down','slash',100,'heavy'),null);
  assert.equal(core.defend('up','up','dodge',100,'heavy'),'perfect');
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
test('real game loop: three floors, parry stun, dodge, spells, rewards, death, and pause', async()=>{
  const nodes=new Map(), events=new Map(), storage=new Map();
  const imageCalls=[];
  const drawing=new Proxy({}, {get:(_,key)=>key==='drawImage'?(...args)=>imageCalls.push(args):()=>{},set:()=>true});
  const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{setProperty(){}},dataset:{},hidden:true,setAttribute(){},classList:{toggle(){}},addEventListener(type,fn){events.set(id+':'+type,fn);},getContext:()=>drawing,querySelector:()=>node('heading'),getBoundingClientRect:()=>({left:0,top:0,width:240,height:400}),setPointerCapture(){}});return nodes.get(id);};
  const context=vm.createContext({...core,Image:class{complete=true;naturalWidth=1122;naturalHeight=1402},document:{getElementById:node,querySelectorAll:()=>[],addEventListener(){},hidden:false},window:{addEventListener(){}},performance:{now:()=>0},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame(){},console});
  const source=(await readFile(new URL('./app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
  vm.runInContext(source,context);
  const run=s=>vm.runInContext(s,context);
  run('enter(1);attack={dir:"up",at:time+100};slash("down")');
  assert.equal(run('attack'),null);assert.ok(run('stunned>time'));assert.equal(run('hp'),100);
  const enemyBefore=run('enemy.hp');run('time+=250;slash("left")');assert.ok(run('enemy.hp')<enemyBefore);
  run('attack={dir:"right",at:time+100};evade("right")');assert.equal(run('attack'),null);
  run('save.equipment.weapon="ember-staff"');
  const circle=Array.from({length:65},(_,i)=>[100+60*Math.cos(i*Math.PI/32),100+60*Math.sin(i*Math.PI/32)]);
  context.rune=circle;run('cast(rune)');const after=run('enemy.hp');run('cast(rune)');assert.equal(run('enemy.hp'),after);
  context.rune=[[20,20],[100,20],[100,100],[20,100],[20,20]];run('cast(rune)');assert.equal(run('shield'),2);
  run('attack={dir:"up",at:time};loop(16)');assert.equal(run('hp'),100);assert.equal(run('shield'),1);
  run('shield=0;attack={dir:"up",at:time};openPanel();loop(32)');assert.equal(run('hp'),100);
  run('paused=false;loop(48)');assert.ok(run('hp')<100);
  run('save.equipment.weapon="rust-sword";enter(1)');
  for(let floor=1;floor<=3;floor++){
    run(`enter(${floor})`);
    for(let room=0;room<3;room++){
      for(let strikes=0;strikes<40&&run('phase')==='combat';strikes++)run('time+=230;slash("left")');
      assert.equal(run('phase'),'walking');run('time=transition;loop(last+16)');
    }
    assert.equal(run('phase'),'won');assert.equal(run('save.gold'),[300,590,950][floor-1]);
    const balance=run('save.gold');run('loop(last+16)');assert.equal(run('save.gold'),balance);
  }
  assert.equal(run('save.unlocked'),3);assert.ok(storage.has('emberblade-v1'));
  run('enter(3);hp=1;attack={dir:"up",at:time};loop(last+16)');assert.equal(run('phase'),'dead');assert.equal(run('paused'),true);
  run('enter(3)');assert.equal(run('hp'),100);assert.equal(run('phase'),'combat');
  run('stamina=100;setBlocking(true);attack={dir:"up",kind:"heavy",at:time};loop(last+16)');
  assert.equal(run('hp'),100);assert.equal(run('stamina'),58);
  run('stamina=10;attack={dir:"up",kind:"heavy",at:time};loop(last+16)');
  assert.ok(run('hp')<100);assert.equal(run('stamina'),0);assert.ok(run('playerStunned>time'));
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
  for(const type of ['brute','lizard','wraith','knight'])for(const [dir,expectedRow] of [['up',1],['down',2],['left',type==='wraith'?4:3],['right',type==='wraith'?3:4]]){
    run(`enter(1);enemy.type='${type}';attack={dir:'${dir}',kind:'normal',at:time+900};draw()`);
    const prep=imageCalls.at(-1);
    assert.equal(Math.floor((prep[2]+prep[4]/2)/280.4),expectedRow);
    run('resolveAttack();draw()');const strike=imageCalls.at(-1);
    assert.equal(Math.floor((strike[2]+strike[4]/2)/280.4),expectedRow);
    assert.notEqual(prep[1],strike[1],'windup and strike must be different frames');
    for(const frame of [prep,strike]){assert.ok(frame.slice(1).every(Number.isFinite));assert.ok(frame[1]>=0&&frame[2]>=0&&frame[1]+frame[3]<=1122&&frame[2]+frame[4]<=1402);}
  }
});
