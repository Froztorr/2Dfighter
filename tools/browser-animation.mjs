import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const url=process.env.BROWSER_TEST_URL||'http://127.0.0.1:4173';
let server,browser;
const source=await readFile('app.js','utf8');
async function setup(page,errors){
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/app.js',async route=>route.fulfill({contentType:'text/javascript',body:source+'\nwindow.__animationTest=code=>eval(code);'}));
 await page.goto(url);await page.waitForFunction(()=>window.__animationTest&&window.__animationTest('spritesLoaded===Object.keys(sprites).length&&!!renderer.inspect().hero'));
}
try{
 try{await fetch(url);}catch{server=spawn(process.execPath,['server.mjs'],{stdio:'ignore'});for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));try{if((await fetch(url)).ok)break;}catch{}}}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1000,height:1280}}),errors=[];await setup(page,errors);await mkdir('artifacts',{recursive:true});
 assert.equal(await page.evaluate(()=>window.__animationTest('renderer.game instanceof Phaser.Game')),true);
 // Combat never loads the generated player frame atlases.
 assert.ok(await page.evaluate(()=>window.__animationTest("!Object.keys(sprites).some(key=>key.startsWith('fps-'))")));
 await page.evaluate(()=>window.__animationTest(`save.owned=Object.keys(ITEMS);equip(save,'armor','scale-mail');equip(save,'weapon','rust-sword');equip(save,'offhand','wood-shield');$('intro').hidden=true;enter(1);paused=false;nextAttack=time+100000;`));
 await page.waitForFunction(()=>window.__animationTest('renderer.inspect().enemyImages[1].alpha>=.99'));await page.evaluate(()=>window.__animationTest('paused=true'));await page.screenshot({path:'artifacts/first-person-combat.png'});
 const framing=await page.evaluate(async()=>{
  const hero=window.__animationTest('renderer.inspect().hero'),save=window.__animationTest('save'),report=[];
  for(const weapon of ['iron-sword','greatsword','ember-staff','inferno-axe']){
   save.equipment.weapon=weapon;save.equipment.offhand=['greatsword','ember-staff','inferno-axe'].includes(weapon)?null:'wood-shield';hero.sync({save,action:'idle',elapsed:0,reducedMotion:true});
   const pixels=hero.texture.context.getImageData(170,280,140,200).data;let occupied=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)occupied++;
   report.push({weapon,coverage:occupied/(140*200)});
  }
  return report;
 });
 for(const {weapon,coverage}of framing)assert.ok(coverage<.06,weapon+' obscures enemy focus area: '+coverage);
 const report=await page.evaluate(async()=>{
  const {FirstPersonPlayer}=await import('/phaser-renderer.mjs');const {ITEMS,newSave,HERO_ACTIONS}=await import('/core.mjs');const {PLAYER_WEAPONS}=await import('/fps-player.mjs');const sprites=window.__animationTest('sprites');
  const canvas=document.createElement('canvas');canvas.id='first-person-gallery';canvas.style.cssText='position:absolute;top:0;left:0;width:1920px;height:5040px;z-index:100';document.body.append(canvas);const report=[];
  await new Promise(resolve=>{class Gallery extends Phaser.Scene{create(){
   const examples=[['idle',0,'right'],['slash',82,'right'],['slash',110,'left'],['slash',110,'up'],['slash',110,'down'],['guard',0,'right'],['cast',230,'up'],['death',700,'right']],armors=[null,'scale-mail','leather-vest','mage-robe','frost-plate','inferno-robe'];
   const verify=new FirstPersonPlayer(this,sprites),state=newSave();verify.model.renderer.setSize(180,300);state.owned=Object.keys(ITEMS);
   for(const armor of armors)for(const weapon of PLAYER_WEAPONS){state.equipment.armor=armor;state.equipment.weapon=weapon;state.equipment.offhand=ITEMS[weapon].hands===2?null:'wood-shield';for(const action of ['slash'])for(const elapsed of [110]){verify.sync({save:state,action,dir:'left',elapsed});if(!verify.image.visible)throw Error('Missing held weapon '+weapon+'/'+armor);if(!verify.pose||!Number.isFinite(verify.pose.right.wrist.x))throw Error('Missing joint pose');if(verify.art.weapon!==weapon)throw Error('Equipment mismatch');const object=verify.model.weapon;if(!object.userData.pixelEquipment||object.userData.sourceIcon!==ITEMS[weapon].icon||object.userData.sourceAtlas!==(ITEMS[weapon].atlas||'gear'))throw Error('Weapon must use its original inventory art');}report.push({weapon,armor,key:verify.image.texture.key});}
   for(const weapon of ['iron-sword','greatsword','ember-staff']){
    state.equipment.weapon=weapon;state.equipment.offhand=ITEMS[weapon].hands===2?null:'wood-shield';
    for(const action of Object.keys(HERO_ACTIONS)){verify.sync({save:state,action,dir:'right',elapsed:110});if(verify.pose.action!==action)throw Error('Combat state did not render');}
   }
   state.equipment.weapon='iron-sword';state.equipment.armor='scale-mail';
   for(const offhand of ['parry-dagger','assassin-dagger','spider-claw'])for(const dir of ['left','right','up','down']){
    state.equipment.offhand=offhand;verify.sync({save:state,action:'slash',dir,elapsed:75});const before=verify.pose.leftGrip.quaternion.clone();verify.sync({save:state,action:'slash',dir,elapsed:230});if(before.angleTo(verify.pose.leftGrip.quaternion)<1)throw Error('Offhand did not swing');
   }
   if(!verify.model.inspect().renderer.isWebGLRenderer)throw Error('Combat must render real 3D meshes');
   verify.destroy();
   let row=0;for(const armor of armors.slice(0,4))for(const weapon of ['rust-sword','greatsword','ember-staff']){examples.forEach(([action,elapsed,dir],col)=>{const save=newSave();save.equipment.armor=armor;save.equipment.weapon=weapon;save.equipment.offhand=ITEMS[weapon].hands===2?null:'wood-shield';const hero=new FirstPersonPlayer(this,sprites);hero.sync({save,action,dir,elapsed});hero.root.setPosition(col*240,row*420);this.add.text(col*240+5,row*420+400,`${armor||'linen'} / ${weapon} / ${action} ${dir}`,{fontSize:'10px',color:'#f7dec3'});});row++;}
   window.__galleryReady=true;resolve();}}
   window.__gallery=new Phaser.Game({type:Phaser.CANVAS,canvas,width:1920,height:5040,backgroundColor:'#302c36',pixelArt:true,antialias:false,audio:{noAudio:true},scene:Gallery,banner:false});
  });return report;
 });
 assert.equal(report.length,78);await page.waitForTimeout(120);await page.locator('#first-person-gallery').screenshot({path:'artifacts/first-person-poses.png'});
 await page.evaluate(()=>{window.__gallery.destroy(true);window.__animationTest('renderer.inspect().hero.model.renderer.setSize(480,800)');});
 // Independent menu equipment uses the new complete figure art at its native proportions.
 for(const [armor,weapon]of [['scale-mail','rust-sword'],['leather-vest','venom-dagger'],['mage-robe','ember-staff']]){
  await page.evaluate(({armor,weapon})=>window.__animationTest(`equip(save,'armor','${armor}');equip(save,'weapon','${weapon}');tab='gear';openPanel();`),{armor,weapon});
  await page.waitForFunction(()=>window.__animationTest('renderer.inspect().preview?.scene.scenes[0]?.hero?.equipment'));
  assert.equal(await page.evaluate(()=>window.__animationTest('renderer.inspect().preview instanceof Phaser.Game')),true);
  await page.locator('#heroPreview').screenshot({path:`artifacts/portrait-${armor}.png`});
 }
 await page.evaluate(()=>window.__animationTest(`renderer.closePreview();$('panel').hidden=true;equip(save,'armor','scale-mail');equip(save,'weapon','rust-sword');equip(save,'offhand','wood-shield');enter(1);`));
 for(const kind of ['heavy','sweep']){
  await page.evaluate(kind=>window.__animationTest(`attack={dir:'left',kind:'${kind}',started:time,at:time+1300};hud();draw();`),kind);
  assert.equal(await page.locator('#attackArrow').isVisible(),false);assert.equal(await page.locator('#attackArrow').textContent(),'');
  const aura=await page.evaluate(()=>window.__animationTest('renderer.inspect().dangerAura.commandBuffer.slice()'));assert.ok(aura.length>0);await page.waitForTimeout(150);assert.notDeepEqual(aura,await page.evaluate(()=>window.__animationTest('renderer.inspect().dangerAura.commandBuffer.slice()')));
  await page.screenshot({path:`artifacts/first-person-${kind}.png`});await page.evaluate(()=>window.__animationTest('setBlocking(true);resolveAttack();hud();'));
  assert.equal(await page.evaluate(()=>window.__animationTest('currentHero().action')),'block');await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>window.__animationTest('renderer.inspect().hero.pose.action')), 'block');
  await page.evaluate(()=>window.__animationTest('releaseGuard();stamina=100'));
 }
 // Weapons/offhands use the inventory atlas on solid extruded geometry.
 const offKeys=new Set();for(const off of ['wood-shield','steel-shield','guardian-shield','frost-shield','parry-dagger','assassin-dagger','spider-claw']){
  await page.evaluate(off=>window.__animationTest(`equip(save,'offhand','${off}');animateHero('idle');`),off);await page.waitForTimeout(25);
  await page.waitForFunction(off=>window.__animationTest('renderer.inspect().hero.art.offhand')===off,off);
  assert.equal(await page.evaluate(()=>window.__animationTest('renderer.inspect().hero.model.offhand.userData.pixelEquipment')),true);
  offKeys.add(await page.evaluate(()=>window.__animationTest('renderer.inspect().hero.texture.canvas.toDataURL()')));
 }assert.equal(offKeys.size,7);
 await page.evaluate(()=>window.__animationTest(`enter(1);hp=1;attack={dir:'down',kind:'normal',at:time};resolveAttack();hud();`));
 assert.equal(await page.evaluate(()=>window.__animationTest('phase==="dead"&&!paused&&currentHero().action==="death"')),true);
 await page.waitForFunction(()=>window.__animationTest('time>=deathPanelAt-450'));await page.screenshot({path:'artifacts/first-person-death.png'});await page.waitForFunction(()=>window.__animationTest('paused'));assert.equal(await page.evaluate(()=>window.__animationTest('paused')),true);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__animationTest(`equip(save,'weapon','ember-staff');equip(save,'armor','mage-robe');enter(1);nextAttack=time+100000;`));await page.waitForTimeout(120);await page.screenshot({path:'artifacts/first-person-mobile.png'});
 // Staff runes are verified through actual pointer drawing, not only direct cast calls.
 const bounds=await page.locator('#scene').boundingBox();
 const drawRune=async points=>{const position=([x,y])=>[bounds.x+x/240*bounds.width,bounds.y+y/400*bounds.height];await page.mouse.move(...position(points[0]));await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(...position(p),{steps:3});await page.mouse.up();};
 const circle=Array.from({length:25},(_,i)=>[120+40*Math.cos(i*Math.PI/12),190+40*Math.sin(i*Math.PI/12)]);
 for(const [spell,points]of [['circle',circle],['chevron',[[78,155],[120,230],[162,155]]],['bolt',[[78,160],[162,160],[78,225],[162,225]]]]){
  await page.evaluate(()=>window.__animationTest(`enter(1);nextAttack=time+100000;enemy.hp=2000;enemy.max=2000;enemy.openUntil=time+100000;cooldown={};shield=0;hud();`));
  await drawRune(points);
  assert.equal(await page.evaluate(spell=>window.__animationTest(`cooldown['${spell}']>time`),spell),true,'wrong rune from pointer input: '+spell);
  assert.equal(await page.evaluate(()=>window.__animationTest('heroAction.type')),'cast');
  if(spell==='chevron')assert.equal(await page.evaluate(()=>window.__animationTest('shield')),2);
  else assert.ok(await page.evaluate(()=>window.__animationTest('enemy.hp'))<2000);
 }
 await page.evaluate(()=>window.__animationTest(`cooldown={};shield=0;enemy.hp=2000;animateHero('idle');`));
 await drawRune([[78,150],[162,150],[162,225],[78,225],[78,150]]);
 assert.equal(await page.evaluate(()=>window.__animationTest('enemy.hp')),2000,'old square must not accidentally cast Fire');
 assert.equal(await page.evaluate(()=>window.__animationTest('Object.keys(cooldown).length')),0);
 assert.match(await page.locator('#spellHint').innerText(),/V WARD/);assert.match(await page.locator('#spellHint').innerText(),/Z NOVA/);
 assert.deepEqual(errors,[]);console.log('3D combat browser checks passed: clear enemy framing, dual-hand swings, circle/V/Z pointer gestures, 78 weapon/material combinations, all combat states, 7 offhands, full-body portraits, block-only cues, delayed death, mobile viewport. Screenshots: artifacts/');
}finally{await browser?.close();server?.kill();}
