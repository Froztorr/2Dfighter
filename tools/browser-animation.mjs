import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const url=process.env.BROWSER_TEST_URL||'http://127.0.0.1:4173';
let server,browser;
try{
  try{await fetch(url);}catch{server=spawn(process.execPath,['server.mjs'],{stdio:'ignore'});for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));try{if((await fetch(url)).ok)break;}catch{}}}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1000,height:1280}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/app.js',async route=>route.fulfill({contentType:'text/javascript',body:await readFile('app.js','utf8')+'\nwindow.__animationTest=code=>eval(code);'}));
  await page.goto(url);
  await page.waitForFunction(()=>window.__animationTest&&window.__animationTest('spritesLoaded===Object.keys(sprites).length&&!!renderer.inspect().hero'));
  assert.equal(await page.evaluate(()=>window.__animationTest('renderer.game instanceof Phaser.Game')),true);
  await page.evaluate(()=>window.__animationTest(`save.owned=Object.keys(ITEMS);equip(save,'helm','frost-helm');equip(save,'armor',null);equip(save,'pants',null);equip(save,'boots','trail-boots');equip(save,'weapon','ember-staff');tab='gear';openPanel();`));
  await page.waitForFunction(()=>window.__animationTest('renderer.inspect().preview?.scene.scenes[0]?.hero?.rig'));
  await mkdir('artifacts',{recursive:true});await page.locator('#heroPreview').screenshot({path:'artifacts/staff-equipment.png'});
  const proof=await page.evaluate(()=>window.__animationTest(`({isPhaser:renderer.inspect().preview instanceof Phaser.Game,upper:renderer.inspect().preview.scene.scenes[0].hero.arms[1].upper.texture.key,rig:renderer.inspect().preview.scene.scenes[0].hero.rig})`));
  assert.equal(proof.isPhaser,true);assert.match(proof.upper,/^arm-/);assert.ok(Math.hypot(proof.rig.main.hand.x-proof.rig.off.hand.x,proof.rig.main.hand.y-proof.rig.off.hand.y)>15);
  const joints=await page.evaluate(async()=>{
    const {PhaserHero}=await import('/phaser-renderer.mjs');const {ITEMS,newSave}=await import('/core.mjs');const sprites=window.__animationTest('sprites');
    const entries=[];for(const weapon of ['rust-sword','greatsword','ember-staff'])for(const dir of ['idle','right','left','up','down'])entries.push({weapon,dir,gear:[],back:true});
    for(const gear of [['wolf-helm','scale-mail','iron-greaves','plate-boots'],['rogue-hood','leather-vest','rogue-pants','trail-boots'],['mage-hat','mage-robe','mage-pants','mage-boots']])for(const dir of ['idle','right','left','up','down'])entries.push({weapon:'ember-staff',dir,gear,back:true});
    const canvas=document.createElement('canvas');canvas.id='animation-gallery';canvas.style.cssText='position:absolute;top:0;left:0;width:1200px;height:2160px;z-index:100;';document.body.append(canvas);const report=[];
    await new Promise(resolve=>{
      class Gallery extends Phaser.Scene {
        create(){entries.forEach((entry,i)=>{const save=newSave();save.owned=Object.keys(ITEMS);save.equipment.weapon=entry.weapon;save.equipment.offhand=ITEMS[entry.weapon].hands===2?null:'wood-shield';['helm','armor','pants','boots'].forEach((slot,j)=>save.equipment[slot]=entry.gear[j]||null);const hero=new PhaserHero(this,sprites),x=120+i%5*240,y=180+Math.floor(i/5)*360;hero.sync({save,x,y,width:140,back:entry.back,action:entry.dir==='idle'?'idle':'slash',dir:entry.dir==='idle'?'right':entry.dir,elapsed:110});this.add.text(x-112,y+145,`${entry.gear[1]||entry.weapon} ${entry.dir}`,{fontSize:'13px',fontFamily:'monospace',color:'#ffffff'});for(const arm of hero.arms){const actual=arm.wrist.getWorldTransformMatrix().transformPoint(0,0),expected=hero.body.getWorldTransformMatrix().transformPoint(hero.rig[arm.side].hand.x,hero.rig[arm.side].hand.y);report.push({error:Math.hypot(actual.x-expected.x,actual.y-expected.y),texture:arm.upper.texture.key,rearParent:arm.shoulder.parentContainer===hero.rearArms,rearBehindBody:hero.root.getIndex(hero.rearArms)<hero.root.getIndex(hero.body),backHead:hero.head.texture.key.includes('-true-')});}});window.__galleryReady=true;resolve();}
      }
      window.__gallery=new Phaser.Game({type:Phaser.CANVAS,canvas,width:1200,height:2160,backgroundColor:'#36313e',pixelArt:true,antialias:false,audio:{noAudio:true},scene:Gallery,banner:false});
    });return report;
  });
  assert.equal(joints.length,60);assert.ok(joints.every(j=>j.error<1e-4&&/^arm-back-/.test(j.texture)&&j.rearParent&&j.rearBehindBody&&j.backHead),`maximum Phaser matrix error: ${Math.max(...joints.map(j=>j.error))}`);
  await page.waitForTimeout(80);await page.locator('#animation-gallery').screenshot({path:'artifacts/phaser-poses.png'});
  await page.evaluate(()=>{window.__gallery.destroy(true);window.__animationTest(`renderer.closePreview();$('panel').hidden=true;$('intro').hidden=true;enter(1);paused=true;`);});
  // Actual native sprites and Phaser tweens run through all enemy attack directions.
  for(const type of ['brute','lizard','wraith','knight','frost','spider','demon'])for(const dir of ['up','down','left','right']){
    await page.evaluate(({type,dir})=>window.__animationTest(`enter(1);enemy.type='${type}';paused=false;attack={dir:'${dir}',kind:'normal',started:time,at:time+900};draw();`),{type,dir});
    await page.waitForTimeout(110);
    assert.ok(await page.evaluate(()=>window.__animationTest('renderer.inspect().enemyImages[1].alpha>.9')));
    await page.evaluate(()=>window.__animationTest('resolveAttack();draw();'));
    await page.waitForTimeout(110);
    assert.ok(await page.evaluate(()=>window.__animationTest('renderer.inspect().enemyImages[1].alpha>.9')));
  }
  await page.evaluate(()=>window.__animationTest('enter(1);flash=0;paused=false;'));
  await page.waitForTimeout(150);await page.evaluate(()=>window.__animationTest('paused=true'));
  await page.screenshot({path:'artifacts/phaser-combat.png'});
  assert.deepEqual(errors,[]);console.log('Phaser browser checks passed: equipment preview, 30 poses / 60 arm chains, 28 enemy attacks. Screenshots: artifacts/');
}finally{await browser?.close();server?.kill();}
