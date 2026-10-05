import { ITEMS } from './core.mjs';
import { playerFrame, equipmentArt, PLAYER_LOOKS, MATERIAL_PROFILES, materialProfile, OFFHAND_ROWS, offhandFrame, ITEM_GRIPS } from './fps-player.mjs';

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
function sheetFrame(scene,key,sheet,row,column){
  const existing=scene.textures.exists(key)?scene.textures.get(key):null;
  if(!existing?.has(0)){
    const texture=existing||scene.textures.addImage(key,sheet);const width=sheet.naturalWidth||sheet.width,height=sheet.naturalHeight||sheet.height;
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const x=Math.round(c*width/8),y=Math.round(r*height/8);
      texture.add(r*8+c,0,x,y,Math.round((c+1)*width/8)-x,Math.round((r+1)*height/8)-y);
    }
  }
  return row*8+column;
}
function materialTexture(scene,sprites,save){
  const art=equipmentArt(save),look=PLAYER_LOOKS[art.look],sourceKey=`fps-${art.weapon}-plate`;
  if(look==='plate'&&!art.armorHue)return sourceKey;
  const profile=materialProfile(save),maskLook=look==='plate'?'mage':look,key=`fps-equipped:${art.weapon}:${look}:${art.armorHue}`;
  if(art.weapon===MATERIAL_PROFILES[profile]&&profile!=='heavy'&&!art.armorHue&&look!=='plate')return `fps-material-${profile}-${look}`;
  if(scene.textures.exists(key))return key;
  const source=sprites[sourceKey],reference=sprites[`fps-${MATERIAL_PROFILES[profile]}-plate`],skin=sprites[`fps-material-${profile}-${maskLook}`];
  if(!source?.naturalWidth||!reference?.naturalWidth||!skin?.naturalWidth)return null;
  const w=source.naturalWidth,h=source.naturalHeight,tex=scene.textures.createCanvas(key,w,h),ctx=tex.context;
  ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0);const actual=ctx.getImageData(0,0,w,h);
  // Registered material reference frames recolor sleeve/glove pixels ONLY.
  // Shape, finger overlap and weapon/handle contact remain the painted source.
  ctx.drawImage(reference,0,0,w,h);const base=ctx.getImageData(0,0,w,h).data;
  ctx.clearRect(0,0,w,h);ctx.drawImage(skin,0,0,w,h);const target=ctx.getImageData(0,0,w,h).data;
  for(let i=0;i<actual.data.length;i+=4){
    if(actual.data[i+3]<128||base[i+3]<128||target[i+3]<128)continue;
    const localY=(Math.floor(i/4/w)%(h/8))/(h/8);if(localY<.3)continue;
    const difference=Math.abs(base[i]-target[i])+Math.abs(base[i+1]-target[i+1])+Math.abs(base[i+2]-target[i+2]);
    const materialColor=maskLook==='mage'?target[i+2]>target[i+1]*1.2:look==='rogue'?target[i+1]>target[i+2]*1.1:target[i]>target[i+2]*1.15||localY>.78;
    if(difference<65||!materialColor)continue;
    for(let channel=0;channel<3;channel++)if(look!=='plate')actual.data[i+channel]=Math.min(255,actual.data[i+channel]*Math.max(.35,Math.min(2.3,(target[i+channel]+12)/(base[i+channel]+12))));
    if(art.armorHue){const color=Phaser.Display.Color.RGBToHSV(actual.data[i],actual.data[i+1],actual.data[i+2]);const rgb=Phaser.Display.Color.HSVToRGB((color.h+art.armorHue/360)%1,color.s,color.v);actual.data[i]=rgb.r;actual.data[i+1]=rgb.g;actual.data[i+2]=rgb.b;}
  }
  ctx.putImageData(actual,0,0);tex.refresh();return key;
}
export class FirstPersonPlayer {
  constructor(scene,sprites){this.scene=scene;this.sprites=sprites;this.root=scene.add.container(0,0);this.offImage=scene.add.image(0,0,'__WHITE').setOrigin(0).setVisible(false);this.image=scene.add.image(0,0,'__WHITE').setOrigin(0).setVisible(false);this.shade=scene.add.graphics();this.root.add([this.offImage,this.image,this.shade]);}
  show(image,key,row,column,aspect){
    const canvasTexture=this.scene.textures.exists(key)?this.scene.textures.get(key):null;const sheet=this.sprites[key]||canvasTexture?.getSourceImage();if(!(sheet?.naturalWidth||sheet?.width)){image.setVisible(false);return;}
    const frame=sheetFrame(this.scene,key,sheet,row,column),height=240*(sheet.naturalHeight||sheet.height)/(sheet.naturalWidth||sheet.width)*aspect;
    image.setTexture(key,frame).setVisible(true).setPosition(0,400-height+6).setDisplaySize(240,height);
  }
  sync({save,action='idle',dir='right',elapsed=0,aspect=1}){
    const frame=playerFrame(action,dir,elapsed),art=equipmentArt(save),look=PLAYER_LOOKS[art.look];this.frame=frame;this.art=art;
    if(art.weapon){const key=materialTexture(this.scene,this.sprites,save);if(key)this.show(this.image,key,frame.row,frame.column,aspect);else this.image.setVisible(false);}else this.image.setVisible(false);
    if(!art.twoHanded)this.show(this.offImage,`fps-offhand-${look}`,OFFHAND_ROWS[art.offhand]??7,offhandFrame(action==='slash'&&!art.weapon?'parry':action,elapsed),aspect);else this.offImage.setVisible(false);
    // Complete painted hands AND their held equipment: only native frame changes.
    // There is no weapon overlay, per-frame equipment transform, IK or joint rig.
    this.root.moveTo(this.offImage,['guard','block'].includes(action)?1:0);
    this.shade.clear();if(action==='death')this.shade.fillStyle(0x090710,Math.min(.82,elapsed/1000)).fillRect(0,0,240,400);
  }
  destroy(){this.root.destroy(true);}
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
