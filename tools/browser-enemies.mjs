import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const source=await readFile('app.js','utf8'),errors=[];
const server=spawn(process.execPath,['server.mjs'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<30;i++){try{if((await fetch('http://127.0.0.1:4173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1000,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/app.js',route=>route.fulfill({contentType:'text/javascript',body:source+'\nwindow.check=code=>eval(code);'}));
 await page.goto('http://127.0.0.1:4173');
 await page.waitForFunction(()=>window.check&&window.check('spritesLoaded===Object.keys(sprites).length&&!!renderer.inspect().hero'));
 const run=code=>page.evaluate(code=>window.check(code),code);
 await run("$('intro').hidden=true;enter(1);paused=true;nextAttack=time+100000;renderer.game.loop.stop();");
 // Manually tick/render so validation does not allocate a second live render loop.
 const render=async()=>{await run('hud();draw();renderer.inspect().hero.sync({save,...currentHero(),aspect:1,reducedMotion:true});renderer.inspect().enemyImages[1].setAlpha(1);renderer.inspect().enemyImages[0].setAlpha(0);renderer.game.step(performance.now(),0)');};
 await mkdir('artifacts',{recursive:true});
 for(const type of ['brute','lizard','wraith','knight','frost','spider','demon']){
  await run(`enemy.type='${type}';enemy.name=enemyTypes['${type}'];enemy.hit=0;enemy.hitDir=null;enemy.dir=null;stunned=0;attack=null;enemy.recoverUntil=0;flash=0;shakeUntil=0;effects=[];particles=[];`);await render();
  await page.locator('#game').screenshot({path:`artifacts/enemy-${type}.png`});
  for(const dir of ['up','down','left','right']){
   await run(`attack={dir:'${dir}',kind:'normal',started:time,at:time+1000};draw();`);
   const keys=[];
   for(const elapsed of [0,300,700,900]){await run(`time=attack.started+${elapsed};draw();`);keys.push(await run('renderer.inspect().enemyImages[1].texture.key'));}
   await run('resolveAttack();draw();');keys.push(await run('renderer.inspect().enemyImages[1].texture.key'));
   assert.equal(new Set(keys).size,5,`${type}/${dir}: distinct ready/windup/windup/travel/contact poses`);
   await run('hp=stats(save).maxHp;phase="combat";enemy.recoverUntil=0;');
  }
 }
 await run("enter(1);paused=true;attack={dir:'left',kind:'sweep',started:time,at:time+100};hud();draw();");
 assert.equal(await page.locator('#attackRule').textContent(),'DODGE ONLY');
 assert.equal(await page.locator('#attackArrow').isVisible(),true);
 await run('paused=false;evade("left");paused=true;');assert.equal(await run('attack'),null);
 await run('paused=false;setBlocking(true);shield=2;attack={dir:"left",kind:"sweep",at:time};paused=false;resolveAttack();paused=true;');
 assert.ok(await run('hp<stats(save).maxHp'));assert.equal(await run('shield'),2);assert.equal(await run('stamina'),100);
 await run('enter(1);paused=true;flash=0;shakeUntil=0;effects=[];particles=[];attack={dir:"left",kind:"sweep",at:time+600};');await render();
 await page.locator('#game').screenshot({path:'artifacts/skull-dodge-only.png'});
 // Forearms must reach the actual bottom edge, rather than a scaled inner rectangle.
 for(const weapon of ['iron-sword','greatsword','ember-staff','inferno-axe']){
  await run(`save.equipment.weapon='${weapon}';save.equipment.offhand=ITEMS['${weapon}'].hands===2?null:'wood-shield';`);
  for(const [action,dir]of [['idle','right'],['slash','up'],['slash','down'],['slash','left'],['slash','right'],['guard','right'],['block','left'],['cast','up'],['dodge','down'],['hurt','right'],['death','right']]){
   const bounds=await page.evaluate(({action,dir})=>{
    const hero=window.check('renderer.inspect().hero'),save=window.check('save');hero.sync({save,action,dir,elapsed:110,aspect:1,reducedMotion:true});
    const pixels=hero.texture.context.getImageData(0,0,480,800).data;let top=800,bottom=0;
    for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20){const y=Math.floor((i-3)/4/480);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    return {top,bottom};
   },{action,dir});
   assert.ok(bounds.top>=0&&bounds.bottom>400,`${weapon}/${action}: invisible`);
   if(action!=='death')assert.ok(bounds.bottom>=798,`${weapon}/${action}: arm ends inside the viewport`);
  }
 }
 await page.setViewportSize({width:390,height:844});
 await run('enter(1);paused=true;flash=0;shakeUntil=0;effects=[];particles=[];attack=null;');await render();await page.locator('#game').screenshot({path:'artifacts/enemy-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Passed: 7 enemies × 4 directions, distinct windup/contact frames, skull cues/dodge/shield/ward behavior, 44 weapon-action bounds, desktop/mobile rendering.');
}finally{await browser?.close();server.kill();}
