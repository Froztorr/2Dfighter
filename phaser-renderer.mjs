import { ITEMS } from './core.mjs';
import { equipmentArt, ITEM_GRIPS } from './fps-player.mjs';
import { samplePlayerRig, drawPlayerRig } from './player-rig.mjs';

function addTexture(scene,key,sheet,rect){
  if(scene.textures.exists(key))return key;
  const tex=scene.textures.createCanvas(key,rect[2],rect[3]);tex.context.imageSmoothingEnabled=false;tex.context.drawImage(sheet,...rect,0,0,rect[2],rect[3]);tex.refresh();return key;
}
function drawItem(ctx,sprites,id,x,y,w,h,angle=0,grip=null){
  const item=ITEMS[id];if(!item)return;
  const sheet=sprites[item.atlas||'gear'],cols=item.atlas?4:6,rows=item.atlas?3:6,cw=sheet.naturalWidth/cols,ch=sheet.naturalHeight/rows;
  const origin=grip||(item.shield?[.5,.5]:ITEM_GRIPS[id]||[.28,.78]);
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(sheet,item.icon%cols*cw,Math.floor(item.icon/cols)*ch,cw,ch,-w*origin[0],-h*origin[1],w,h);ctx.restore();
}
function tintedRegion(ctx,sheet,sx,sy,sw,sh,dx,dy,dw,dh,hue=0){
  ctx.save();if(hue)ctx.filter=`hue-rotate(${hue}deg)`;ctx.drawImage(sheet,sx,sy,sw,sh,dx,dy,dw,dh);ctx.restore();
}
let rigSerial=0;
export class FirstPersonPlayer {
  constructor(scene,sprites){
    this.scene=scene;this.sprites=sprites;this.root=scene.add.container(0,0);
    this.key=`player-rig:${rigSerial++}`;this.texture=scene.textures.createCanvas(this.key,240,400);
    this.buffer=document.createElement('canvas');this.buffer.width=240;this.buffer.height=400;this.bufferContext=this.buffer.getContext('2d',{willReadFrequently:true});
    this.image=scene.add.image(0,0,this.key).setOrigin(0).setDisplaySize(240,400);
    this.shade=scene.add.graphics();this.root.add([this.image,this.shade]);
  }
  sync(state){
    this.pose=samplePlayerRig(state);this.art=this.pose.art;
    const c=this.bufferContext;drawPlayerRig(c,this.pose);
    const pixels=c.getImageData(0,0,240,400);
    // Native 240 × 400 pixels, binary silhouettes and 5-bit color channels.
    // This removes subpixel edge blends after rotating rig parts.
    for(let i=0;i<pixels.data.length;i+=4){
      if(!pixels.data[i+3])continue;
      pixels.data[i+3]=pixels.data[i+3]<128*this.pose.alpha?0:Math.round(255*this.pose.alpha);
      for(let channel=0;channel<3;channel++)pixels.data[i+channel]=Math.round(pixels.data[i+channel]/8)*8;
    }
    this.texture.context.putImageData(pixels,0,0);this.texture.refresh();
    this.shade.clear();if(state.action==='death')this.shade.fillStyle(0x090710,Math.min(.82,state.elapsed/1000)).fillRect(0,0,240,400);
  }
  destroy(){this.root.destroy(true);this.scene.textures.remove(this.key);}
}
export class EquipmentPortrait {
  constructor(scene,sprites,save){this.scene=scene;this.sprites=sprites;this.image=scene.add.image(120,200,'__WHITE');this.sync(save);}
  sync(save){
    const signature=Object.values(save.equipment).join(':'),key=`portrait:${signature}`,sheet=this.sprites.portrait,cw=sheet.naturalWidth/4,ch=sheet.naturalHeight;
    if(!this.scene.textures.exists(key)){
      const tex=this.scene.textures.createCanvas(key,240,400),c=tex.context;c.imageSmoothingEnabled=false;
      // Preserve the source figure's proportions within the portrait canvas.
      const figureWidth=400*cw/ch;c.translate((240-figureWidth)/2,0);c.scale(figureWidth/240,1);
      drawItem(c,this.sprites,save.equipment.cloak,120,210,215,305,0,[.5,.5]);
      const art=equipmentArt(save),regions=[['helm',0,.18],['armor',.18,.54],['pants',.54,.76],['boots',.76,1]];
      // Static complete figure regions, with identical pose/scale in all looks.
      for(const [slot,start,end]of regions){const item=ITEMS[save.equipment[slot]],look=item?.look||0;tintedRegion(c,sheet,look*cw,start*ch,cw,(end-start)*ch,0,start*400,240,(end-start)*400,item?.hue||0);}
      if(save.equipment.helm&&['frost-helm','wolf-helm'].includes(save.equipment.helm)){c.clearRect(0,0,240,64);drawItem(c,this.sprites,save.equipment.helm,120,35,110,85,0,[.5,.5]);}
      drawItem(c,this.sprites,save.equipment.weapon,33,198,145,210,-.65);
      drawItem(c,this.sprites,art.offhand,208,205,100,120,0,[.5,.5]);
      for(const [x,width]of [[0,62],[188,52]])tintedRegion(c,sheet,art.look*cw+x/240*cw,185/400*ch,width/240*cw,35/400*ch,x,185,width,35,art.armorHue);
      drawItem(c,this.sprites,save.equipment.neck,121,105,25,30,0,[.5,.5]);
      for(const [slot,x]of [['ring1',30],['ring2',209]])drawItem(c,this.sprites,save.equipment[slot],x,195,11,12,0,[.5,.5]);
      tex.refresh();
    }
    this.image.setTexture(key).setDisplaySize(240,400);this.equipment={...save.equipment};
  }
}

export function createPhaserRenderer({canvas,background,sprites,tick,getState}){
  let activeScene,hero,previewGame=null,enemyImages=[],enemyKey='',dangerAura;
  class CombatScene extends Phaser.Scene {
    constructor(){super('Combat');}
    create(){activeScene=this;this.textures.addCanvas('background',background);this.backdrop=this.add.image(0,0,'background').setOrigin(0).setDisplaySize(480,800);const world=this.add.container(0,0).setScale(2);hero=new FirstPersonPlayer(this,sprites);world.add(hero.root);this.world=world;dangerAura=this.add.graphics();world.addAt(dangerAura,0);enemyImages=[this.add.image(0,0,'__WHITE').setAlpha(0).setVisible(false),this.add.image(0,0,'__WHITE').setAlpha(0).setVisible(false)];world.addAt(enemyImages[0],1);world.addAt(enemyImages[1],2);this.cameras.main.setBackgroundColor('#171522');}
    update(now){if(!hero)return;const initial=getState();this.world.setVisible(initial.phase!=='home');if(!initial.loaded){hero.root.setVisible(false);this.tweens.timeScale=0;return;}hero.root.setVisible(true);tick(now);const state=getState();this.world.setVisible(state.phase!=='home');if(state.phase==='home')return;this.tweens.timeScale=state.paused?0:1;hero.sync(state.hero);}
  }
  const game=new Phaser.Game({type:Phaser.CANVAS,canvas,width:480,height:800,transparent:false,antialias:false,pixelArt:true,audio:{noAudio:true},scene:CombatScene,banner:false,render:{roundPixels:false},fps:{target:60}});
  return {
    game,
    syncEnemy(frame){
      if(!activeScene)return;
      const {sheet,type,key,x,y,size,aspect,alpha=1,mirror=false,danger=null,...rect}=frame;
      dangerAura.clear();if(danger){const urgency=1-Math.min(1,Math.max(0,danger.remaining)/1300),pulse=danger.reducedMotion?.55:(1+Math.sin(danger.clock/(100-urgency*40)))/2;for(let ring=4;ring>=1;ring--)dangerAura.fillStyle(0xf52b43,.025+pulse*.015).fillEllipse(x,y+size*aspect*.12,size*(.62+ring*.1+pulse*.08),size*aspect*(.48+ring*.12+pulse*.08));dangerAura.lineStyle(1.5+pulse,0xff4057,.35+pulse*.45).strokeEllipse(x,y+size*aspect*.38,size*(.85+pulse*.12),size*aspect*.25);}
      const textureKey=addTexture(activeScene,`enemy-${type}-${key}`,sheet,[rect.sx,rect.sy,rect.sw,rect.sh]);
      if(key+type!==enemyKey){
        enemyKey=key+type;
        const [old,current]=enemyImages;old.setTexture(current.texture.key).setPosition(current.x,current.y).setDisplaySize(current.displayWidth,current.displayHeight).setOrigin(current.originX,current.originY).setFlipX(current.flipX).setAlpha(current.alpha);
        activeScene.tweens.killTweensOf(enemyImages);
        current.setTexture(textureKey).setAlpha(0);activeScene.tweens.add({targets:current,alpha:1,duration:85,ease:'Sine.easeInOut'});activeScene.tweens.add({targets:old,alpha:0,duration:85,ease:'Sine.easeInOut'});
      }
      const current=enemyImages[1],scale=size/(sheet.naturalWidth/4);current.setPosition(x-size/2+(rect.sx-rect.column*sheet.naturalWidth/4)*scale,y-size*aspect/2+(rect.sy-rect.row*rect.cellH)*scale*aspect).setOrigin(0).setDisplaySize(rect.sw*scale,rect.sh*scale*aspect).setFlipX(mirror);current.setVisible(alpha>0);enemyImages[0].setVisible(alpha>0);
      if(alpha<1){current.setAlpha(alpha);enemyImages[0].setAlpha(0);}
    },
    preview(canvas,save){
      if(previewGame){previewGame.destroy(false);previewGame=null;}
      class PreviewScene extends Phaser.Scene {
        create(){this.hero=new EquipmentPortrait(this,sprites,save);}
      }
      previewGame=new Phaser.Game({type:Phaser.CANVAS,canvas,width:240,height:400,transparent:true,antialias:false,pixelArt:true,audio:{noAudio:true},scene:PreviewScene,banner:false});
    },
    closePreview(){if(previewGame){previewGame.destroy(false);previewGame=null;}},
    inspect(){return {scene:activeScene,hero,enemyImages,dangerAura,preview:previewGame};}
  };
}
