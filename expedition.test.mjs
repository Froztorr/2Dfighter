import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as core from './core.mjs';
import { Expedition, MAP, angleDelta, spriteView, CLIPS } from './expedition-core.mjs';

test('exploration collision and encounter lock with bounded looking',()=>{
 const w=new Expedition(()=>0);w.enemies=[];
 for(let i=0;i<100;i++)w.move(-1,0,.1);
 assert.ok(w.player.x>=1.2);assert.equal(w.mode,'explore');
 const v=new Expedition(()=>0);v.player.z=8;v.update(.1);
 assert.equal(v.mode,'combat');const p={...v.player};v.move(1,1,1);
 assert.equal(v.player.x,p.x);assert.equal(v.player.z,p.z);
 v.look(100,100);assert.ok(Math.abs(angleDelta(v.player.yaw,v.anchor))<=1.051);assert.equal(v.player.pitch,.35);
});
test('enemies accept 2-3 hits then deflect until stun resets the window',()=>{
 const w=new Expedition(()=>0),e=w.enemies[0];e.hp=999;
 assert.equal(w.strike(e,10),10);assert.equal(w.strike(e,10),10);assert.equal(w.strike(e,10),0);
 w.stun(e);assert.equal(w.strike(e,10),10);assert.equal(w.strike(e,10),10);assert.equal(w.strike(e,10),0);
});
test('special attacks follow 3-4 normals; every attack can consume shield guard',()=>{
 const w=new Expedition(()=>0),e=w.enemies[0];
 assert.deepEqual(Array.from({length:5},()=>w.chooseAttack(e).kind),['normal','normal','normal','special','normal']);
 w.stamina=100;assert.equal(w.receive({kind:'special',power:48},true,0),0);assert.equal(w.stamina,52);
 w.receive({kind:'special',power:60},true,0);assert.equal(w.stamina,0);assert.ok(w.playerStun>0);
});
test('target follows viewing direction and defeated encounters unlock movement',()=>{
 const w=new Expedition(()=>0);w.player.z=8;w.update(.1);
 const [a,b]=w.enemies;w.player.yaw=Math.atan2(b.x-w.player.x,w.player.z-b.z);assert.equal(w.target(),b);
 a.hp=b.hp=0;w.update(.1);assert.equal(w.mode,'explore');
});
test('atlas has 12 eight-frame actions and view directions distinguish front/back',()=>{
 assert.equal(CLIPS.length,12);assert.ok(CLIPS.every(c=>c.frames===8));
 assert.equal(spriteView(0).clip,'walk-front');assert.equal(spriteView(Math.PI).clip,'walk-back');
 assert.notEqual(spriteView(.9).flip,spriteView(-.9).flip);
 assert.ok(MAP.every(row=>row.length===MAP[0].length));
});

async function gameHarness(floor=1){
 const nodes=new Map(),storage=new Map(),handlers=new Map();
 const save=core.newSave();save.unlocked=6;storage.set('emberblade-v1',JSON.stringify(save));
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},dataset:{},open:false,showModal(){this.open=true;},close(){this.open=false;},getContext(){return {};},addEventListener(){},querySelector(){return node('small');}});return nodes.get(id);};
 const context=vm.createContext({...core,Expedition,MAP,CLIPS,spriteView,angleDelta,URLSearchParams,location:{search:`?floor=${floor}`},performance:{now:()=>0},document:{getElementById:node,querySelectorAll:()=>[],addEventListener(){}},addEventListener:(k,f)=>handlers.set(k,f),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},console});
 const source=(await readFile(new URL('./expedition.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/init\(\)\.catch[\s\S]*$/,'');
 vm.runInContext(source,context);const run=s=>vm.runInContext(s,context);
 return {run,nodes,storage};
}
test('actual expedition loop resolves delayed hits, shield breaks, stun, kills and saved clear rewards',async()=>{
 const {run,nodes,storage}=await gameHarness();run('save.unlocked=1;localStorage.setItem("emberblade-v1",JSON.stringify(save))');
 run('paused=false;world.player.z=8;world.update(.01);world.enemies.forEach(e=>{e.nextAttack=999;e.walking=false});world.player.yaw=Math.atan2(world.enemies[0].x-world.player.x,world.player.z-world.enemies[0].z)');
 const hp=run('world.enemies[0].hp');run('strike("right")');assert.equal(run('world.enemies[0].hp'),hp);run('update(.12)');assert.ok(run('world.enemies[0].hp')<hp);
 run('world.enemies[0].hits=3;pulse()');assert.equal(run('world.enemies[0].hits'),0);assert.ok(run('world.enemies[0].stunUntil>world.time'));
 run('world.anchor=0;world.enemies[0].slot=0;world.enemies[0].stunUntil=0;world.enemies[0].x=world.player.x;world.enemies[0].z=world.player.z-2.8;world.enemies[0].attack={kind:"special",power:48,contact:world.time,end:world.time+1};guard=true;world.stamina=100;update(.01)');assert.equal(run('hp'),100);assert.ok(run('world.stamina')<54);
 run('world.enemies[0].attack={kind:"special",power:60,contact:world.time,end:world.time+1};world.stamina=10;update(.01)');assert.ok(run('hp')<100);assert.ok(run('world.playerStun>world.time'));assert.equal(run('guard'),false);
 run('for(const e of world.enemies){e.hp=0;kill(e)}');const saved=JSON.parse(storage.get('emberblade-v1'));assert.equal(saved.unlocked,2);assert.ok(saved.owned.includes(core.FLOORS[0].drops[2]));assert.equal(saved.daily.counts.kills,3);assert.equal(saved.daily.counts.clears,1);
 run('hp=0;update(.01)');assert.equal(run('paused'),true);assert.equal(nodes.get('resume').textContent,'ลองใหม่');
});

test('actual exploration-to-combat loop clears all six difficulties through legal attacks and defenses',async()=>{
 for(let floor=1;floor<=6;floor++){
  const {run,storage}=await gameHarness(floor);
  run(`paused=false;
   for(let step=0;step<12000&&!done&&hp>0;step++){
    setGuard(false);
    if(world.mode==='explore'){world.player.yaw=0;moveAxis=[0,1];}
    else{
     moveAxis=[0,0];
     const active=world.enemies.filter(e=>e.active&&e.hp>0),danger=active.filter(e=>e.attack&&!e.attack.resolved&&e.attack.contact-world.time<.19).sort((a,b)=>a.attack.contact-b.attack.contact)[0];
     const e=danger||active.find(e=>e.hits<e.allowance)||active[0];
     if(e){world.player.yaw=Math.atan2(e.x-world.player.x,world.player.z-e.z);
      if(danger){if(e.attack.kind==='normal')strike(DIR[e.attack.dir]);else dodge();if(e.attack&&!e.attack.resolved)setGuard(true);}
      else{if(e.hits>=e.allowance)pulse();if(!e.attack||e.attack.contact-world.time>.6)strike('right');}
     }
    }
    update(.04);
   }
  `);
  assert.equal(run('done'),true,`floor ${floor}: hp=${run('hp')} enemies=${run('world.enemies.map(e=>e.hp)')}`);
  const saved=JSON.parse(storage.get('emberblade-v1'));assert.equal(saved.daily.counts.kills,3);assert.equal(saved.daily.counts.clears,1);
 }
});
