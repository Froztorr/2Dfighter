import { Player3D } from './player-3d.mjs';
import { RiggedEquipmentFigure } from './equipment-rig.mjs';
import { paintEnemyFrame } from './enemy-animation.mjs';

function addTexture(scene,key,sheet,rect,runs){
  if(scene.textures.exists(key))return key;
  const tex=scene.textures.createCanvas(key,rect[2],rect[3]),context=tex.context;context.imageSmoothingEnabled=false;
  paintEnemyFrame(context,sheet,{sx:rect[0],sy:rect[1],sw:rect[2],sh:rect[3],runs});tex.refresh();return key;
}
let rigSerial=0;
export class FirstPersonPlayer {
  constructor(scene,sprites){
    this.scene=scene;this.sprites=sprites;this.root=scene.add.container(0,0);
    this.key=`player-3d:${rigSerial++}`;this.texture=scene.textures.createCanvas(this.key,480,800);
    this.model=new Player3D(undefined,sprites);this.image=scene.add.image(0,0,this.key).setOrigin(0).setDisplaySize(240,400);
    this.shade=scene.add.graphics();this.root.add([this.image,this.shade]);
    scene.events.once('shutdown',()=>this.destroy());
  }
  sync(state){
    const stamp=[...Object.values(state.save.equipment),state.action,state.dir,state.elapsed,state.aspect,state.reducedMotion].join(':');if(stamp===this.stamp)return;this.stamp=stamp;
    this.pose=this.model.sync(state);this.art=this.pose.art;
    const c=this.texture.context;c.clearRect(0,0,480,800);c.drawImage(this.model.renderer.domElement,0,0,480,800);this.texture.refresh();this.image.setAlpha(this.pose.alpha);
    this.shade.clear();if(state.action==='death')this.shade.fillStyle(0x090710,Math.min(.82,state.elapsed/1000)).fillRect(0,0,240,400);
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;this.model.destroy();this.root.destroy(true);this.scene.textures.remove(this.key);}
}
export class EquipmentPortrait {
  constructor(scene,sprites,save){this.scene=scene;this.key=`portrait:${rigSerial++}`;this.texture=scene.textures.createCanvas(this.key,240,400);this.model=new RiggedEquipmentFigure(sprites);this.image=scene.add.image(120,200,this.key);this.sync(save);scene.events.once('shutdown',()=>{this.model.destroy();scene.textures.remove(this.key);});}
  sync(save,state={}){
    this.model.sync(save,state);const context=this.texture.context;context.clearRect(0,0,240,400);context.imageSmoothingEnabled=true;context.drawImage(this.model.canvas,0,0,240,400);this.texture.refresh();this.equipment={...save.equipment};
  }
}

export function createPhaserRenderer({canvas,background,sprites,tick,getState,onRenderError}){
  let activeScene,hero,previewGame=null,enemyImages=[],enemyKey='',dangerAura,previewAngle=.08,previewAction='idle',previewStarted=0;
  class CombatScene extends Phaser.Scene {
    constructor(){super('Combat');}
    create(){activeScene=this;this.textures.addCanvas('background',background);this.backdrop=this.add.image(0,0,'background').setOrigin(0).setDisplaySize(480,800);const world=this.add.container(0,0).setScale(2);try{hero=new FirstPersonPlayer(this,sprites);}catch(error){onRenderError?.(error);this.scene.pause();return;}world.add(hero.root);this.world=world;dangerAura=this.add.graphics();world.addAt(dangerAura,0);enemyImages=[this.add.image(0,0,'__WHITE').setAlpha(0).setVisible(false),this.add.image(0,0,'__WHITE').setAlpha(0).setVisible(false)];world.addAt(enemyImages[0],1);world.addAt(enemyImages[1],2);this.cameras.main.setBackgroundColor('#171522');}
    update(now){if(!hero)return;const initial=getState();this.world.setVisible(initial.phase!=='home');if(!initial.loaded){hero.root.setVisible(false);this.tweens.timeScale=0;return;}hero.root.setVisible(true);tick(now);const state=getState();this.world.setVisible(state.phase!=='home');if(state.phase==='home')return;this.tweens.timeScale=state.paused?0:1;hero.sync(state.hero);}
  }
  const game=new Phaser.Game({type:Phaser.CANVAS,canvas,width:480,height:800,transparent:false,antialias:false,pixelArt:true,audio:{noAudio:true},scene:CombatScene,banner:false,render:{roundPixels:false},fps:{target:60}});
  return {
    game,
    syncEnemy(frame){
      if(!activeScene)return;
      const {sheet,type,key,x,y,size,aspect,alpha=1,mirror=false,danger=null,...rect}=frame;
      dangerAura.clear();if(danger){const urgency=1-Math.min(1,Math.max(0,danger.remaining)/1300),pulse=danger.reducedMotion?.55:(1+Math.sin(danger.clock/(100-urgency*40)))/2;for(let ring=4;ring>=1;ring--)dangerAura.fillStyle(0xf52b43,.025+pulse*.015).fillEllipse(x,y+size*aspect*.12,size*(.62+ring*.1+pulse*.08),size*aspect*(.48+ring*.12+pulse*.08));dangerAura.lineStyle(1.5+pulse,0xff4057,.35+pulse*.45).strokeEllipse(x,y+size*aspect*.38,size*(.85+pulse*.12),size*aspect*.25);}
      const textureKey=addTexture(activeScene,`enemy-${type}-${key}`,sheet,[rect.sx,rect.sy,rect.sw,rect.sh],rect.runs);
      if(key+type!==enemyKey){
        enemyKey=key+type;
        enemyImages[0].setVisible(false);enemyImages[1].setTexture(textureKey).setAlpha(alpha);
      }
      const current=enemyImages[1],scale=size*.78/rect.bodyHeight;current.setPosition(x+(mirror?rect.anchorX-rect.sx-rect.sw:rect.sx-rect.anchorX)*scale,y+size*aspect*.4-(rect.ground-rect.sy)*scale*aspect).setOrigin(0).setDisplaySize(rect.sw*scale,rect.sh*scale*aspect).setFlipX(mirror).setAlpha(alpha);current.setVisible(alpha>0);enemyImages[0].setVisible(false);
      if(alpha<1){current.setAlpha(alpha);enemyImages[0].setAlpha(0);}
    },
    preview(canvas,save){
      if(previewGame){previewGame.destroy(false);previewGame=null;}
      class PreviewScene extends Phaser.Scene {
        create(){this.hero=new EquipmentPortrait(this,sprites,save);}
        update(now){if(!this.hero||document.hidden||now-(this.lastFrame||0)<33)return;this.lastFrame=now;const elapsed=performance.now()-previewStarted;if(previewAction==='slash'&&elapsed>650)previewAction='idle';this.hero.sync(save,{time:previewAction==='idle'?now:elapsed,action:previewAction,angle:previewAngle,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});}
      }
      previewGame=new Phaser.Game({type:Phaser.CANVAS,canvas,width:240,height:400,transparent:true,antialias:false,pixelArt:true,audio:{noAudio:true},scene:PreviewScene,banner:false});
    },
    previewPose(action){if(action==='left'||action==='right')previewAngle=Math.max(-.7,Math.min(.7,previewAngle+(action==='left'?-.22:.22)));else{previewAction=action;previewStarted=performance.now();}},
    closePreview(){if(previewGame){previewGame.destroy(false);previewGame=null;}},
    inspect(){return {scene:activeScene,hero,enemyImages,dangerAura,preview:previewGame};}
  };
}
