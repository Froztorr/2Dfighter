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
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1000,height:1280}}),errors=[];await setup(page,errors);await mkdir('artifacts',{recursive:true});
 assert.equal(await page.evaluate(()=>window.__animationTest('renderer.game instanceof Phaser.Game')),true);
 // Combat never loads the generated player frame atlases.
 assert.ok(await page.evaluate(()=>window.__animationTest("!Object.keys(sprites).some(key=>key.startsWith('fps-'))")));
 await page.evaluate(()=>window.__animationTest(`save.owned=Object.keys(ITEMS);equip(save,'armor','scale-mail');equip(save,'weapon','rust-sword');equip(save,'offhand','wood-shield');$('intro').hidden=true;enter(1);paused=false;nextAttack=time+100000;`));
 await page.waitForTimeout(180);await page.evaluate(()=>window.__animationTest('paused=true'));await page.screenshot({path:'artifacts/first-person-combat.png'});
 const report=await page.evaluate(async()=>{
  const {FirstPersonPlayer}=await import('/phaser-renderer.mjs');const {ITEMS,newSave,HERO_ACTIONS}=await import('/core.mjs');const {PLAYER_WEAPONS}=await import('/fps-player.mjs');const sprites=window.__animationTest('sprites');
  const canvas=document.createElement('canvas');canvas.id='first-person-gallery';canvas.style.cssText='position:absolute;top:0;left:0;width:1920px;height:5040px;z-index:100';document.body.append(canvas);const report=[];
  await new Promise(resolve=>{class Gallery extends Phaser.Scene{create(){
   const examples=[['idle',0,'right'],['slash',82,'right'],['slash',110,'left'],['slash',110,'up'],['slash',110,'down'],['guard',0,'right'],['cast',230,'up'],['death',700,'right']],armors=[null,'scale-mail','leather-vest','mage-robe','frost-plate','inferno-robe'];
   const verify=new FirstPersonPlayer(this,sprites),state=newSave();state.owned=Object.keys(ITEMS);
   for(const armor of armors)for(const weapon of PLAYER_WEAPONS){state.equipment.armor=armor;state.equipment.weapon=weapon;state.equipment.offhand=ITEMS[weapon].hands===2?null:'wood-shield';for(const action of Object.keys(HERO_ACTIONS))for(const elapsed of [110]){verify.sync({save:state,action,dir:'left',elapsed});if(!verify.image.visible)throw Error('Missing held weapon '+weapon+'/'+armor);if(!verify.pose||!Number.isFinite(verify.pose.right.wrist.x))throw Error('Missing joint pose');if(verify.art.weapon!==weapon)throw Error('Equipment mismatch');}report.push({weapon,armor,key:verify.image.texture.key});}
   verify.sync({save:state,action:'idle',elapsed:0,reducedMotion:true});
   assertPixels(verify.texture.context.getImageData(0,0,240,400).data);
   function assertPixels(data){for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;if(data[i+3]!==255)throw Error('Blended pixel silhouette');for(let k=0;k<3;k++)if(data[i+k]!==255&&data[i+k]%8)throw Error('Non-pixel color palette');}}
   verify.destroy();
   let row=0;for(const armor of armors.slice(0,4))for(const weapon of ['rust-sword','greatsword','ember-staff']){examples.forEach(([action,elapsed,dir],col)=>{const save=newSave();save.equipment.armor=armor;save.equipment.weapon=weapon;save.equipment.offhand=ITEMS[weapon].hands===2?null:'wood-shield';const hero=new FirstPersonPlayer(this,sprites);hero.sync({save,action,dir,elapsed});hero.root.setPosition(col*240,row*420);this.add.text(col*240+5,row*420+400,`${armor||'linen'} / ${weapon} / ${action} ${dir}`,{fontSize:'10px',color:'#f7dec3'});});row++;}
   window.__galleryReady=true;resolve();}}
   window.__gallery=new Phaser.Game({type:Phaser.CANVAS,canvas,width:1920,height:5040,backgroundColor:'#302c36',pixelArt:true,antialias:false,audio:{noAudio:true},scene:Gallery,banner:false});
  });return report;
 });
 assert.equal(report.length,78);await page.waitForTimeout(120);await page.locator('#first-person-gallery').screenshot({path:'artifacts/first-person-poses.png'});
 await page.evaluate(()=>window.__gallery.destroy(true));
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
 // Weapons/offhands really change artwork; shields show their held rear surface and attached grip.
 const offKeys=new Set();for(const off of ['wood-shield','steel-shield','guardian-shield','frost-shield','parry-dagger','assassin-dagger','spider-claw']){
  await page.evaluate(off=>window.__animationTest(`equip(save,'offhand','${off}');animateHero('idle');`),off);await page.waitForTimeout(25);
  offKeys.add(await page.evaluate(()=>window.__animationTest('renderer.inspect().hero.texture.canvas.toDataURL()')));
 }assert.equal(offKeys.size,7);
 await page.evaluate(()=>window.__animationTest(`enter(1);hp=1;attack={dir:'down',kind:'normal',at:time};resolveAttack();hud();`));
 assert.equal(await page.evaluate(()=>window.__animationTest('phase==="dead"&&!paused&&currentHero().action==="death"')),true);
 await page.waitForTimeout(650);await page.screenshot({path:'artifacts/first-person-death.png'});await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>window.__animationTest('paused')),true);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__animationTest(`equip(save,'weapon','ember-staff');equip(save,'armor','mage-robe');enter(1);nextAttack=time+100000;`));await page.waitForTimeout(120);await page.screenshot({path:'artifacts/first-person-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Phaser rig browser checks passed: 78 weapon/material combinations, all combat states, 7 offhands, full-body portraits, block-only cues, delayed death, mobile viewport. Screenshots: artifacts/');
}finally{await browser?.close();server?.kill();}
