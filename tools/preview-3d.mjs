// Record the actual WebGL player model, with slow playback for pose review.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:1280}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const source=await readFile('app.js','utf8');
 await page.route('**/app.js',route=>route.fulfill({contentType:'text/javascript',body:source+'\nwindow.__animationTest=code=>eval(code);'}));
 await page.goto(process.env.BROWSER_TEST_URL||'http://127.0.0.1:4173');await page.waitForFunction(()=>window.__animationTest&&window.__animationTest('spritesLoaded===Object.keys(sprites).length&&!!renderer.inspect().hero'));
 await rm('artifacts/3d-frames',{recursive:true,force:true});await mkdir('artifacts/3d-frames',{recursive:true});
 await page.evaluate(()=>window.__animationTest(`save.owned=Object.keys(ITEMS);equip(save,'armor','scale-mail');equip(save,'weapon','iron-sword');equip(save,'offhand','wood-shield');$('intro').hidden=true;enter(1);paused=false;nextAttack=time+100000;animateHero('idle');`));
 await page.waitForFunction(()=>window.__animationTest('renderer.inspect().enemyImages[1].alpha>=.99'));await page.evaluate(()=>window.__animationTest('paused=true'));await page.screenshot({path:'artifacts/3d-combat.png'});
 await page.evaluate(async()=>{
  const{FirstPersonPlayer}=await import('/phaser-renderer.mjs');const{newSave}=await import('/core.mjs');const scene=window.__animationTest('renderer.inspect().scene'),sprites=window.__animationTest('sprites');
  window.__animationTest('renderer.inspect().hero.model.renderer.setSize(240,400)');
  window.__reviewPlayers=['iron-sword','greatsword'].flatMap((weapon,row)=>['right','left','up','down'].map(dir=>{const hero=new FirstPersonPlayer(scene,sprites),save=newSave();save.equipment.armor=row?'leather-vest':'scale-mail';save.equipment.weapon=weapon;save.equipment.offhand=row?null:'wood-shield';return {dir,hero,save,row};}));
 });
 let idleFrame;
 for(let frame=0;frame<30;frame++){
  const png=(frame>0&&frame<4)||frame>=21?idleFrame:await page.evaluate(frame=>{
   const canvas=document.createElement('canvas');canvas.width=960;canvas.height=840;const c=canvas.getContext('2d');c.fillStyle='#252332';c.fillRect(0,0,960,840);
   c.fillStyle='#d5d1c7';c.font='12px monospace';c.fillText('REAL 3D / SLOW PLAYBACK / SHOULDER - ELBOW - WRIST',15,18);
   window.__reviewPlayers.forEach(({dir,hero,save,row},i)=>{const col=i%4;const elapsed=(frame-4)*18;hero.sync({save,action:elapsed<0||elapsed>=300?'idle':'slash',dir,elapsed:Math.max(0,elapsed),reducedMotion:true});c.drawImage(hero.texture.canvas,col*240,30+row*410,240,400);c.fillStyle='#d5d1c7';c.fillText((row?'TWO-HANDED / ':'SHIELD / ')+dir.toUpperCase(),col*240+12,48+row*410);});return canvas.toDataURL('image/png').split(',')[1];
  },frame);if(frame===0)idleFrame=png;await writeFile(`artifacts/3d-frames/${String(frame).padStart(3,'0')}.png`,Buffer.from(png,'base64'));
 }
 if(errors.length)throw Error(errors.join('\n'));
 console.log('3D preview frames saved to artifacts/3d-frames; combat screenshot: artifacts/3d-combat.png');
}finally{await browser.close();}
