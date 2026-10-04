import { ITEMS, HERO_REST, heroPose } from './core.mjs';
import { characterRig } from './hero-rig.mjs';

// Each arm is newly authored as a complete rounded segment, never a torso strip.
// Rectangles only select cells of the original unmodified generated PNG.
const armRects=[
  [[126,18,176,328],[466,38,178,308],[793,109,200,241]],
  [[94,362,218,346],[468,376,196,340],[790,460,218,260]],
  [[107,720,200,350],[463,743,189,330],[793,830,206,250]],
  [[98,1083,231,337],[457,1083,234,337],[789,1172,213,250]]
];
const rearArmRects=[
  [[132,35,178,326],[463,30,157,327],[818,100,162,274]],
  [[112,378,214,343],[463,384,169,343],[817,464,170,264]],
  [[114,728,208,335],[462,746,169,316],[822,837,177,253]],
  [[103,1073,243,357],[446,1080,215,347],[818,1170,189,258]]
];
const grips={
  'rust-sword':[.28,.76],'iron-sword':[.30,.77],mace:[.27,.79],axe:[.30,.77],greatsword:[.25,.78],
  'ember-staff':[.24,.79],'parry-dagger':[.30,.77],'venom-dagger':[.31,.77],'fire-wand':[.27,.78],
  'ice-staff':[.25,.78],'frost-sword':[.24,.80],'spider-fang':[.26,.80],'spider-claw':[.70,.76],
  'assassin-dagger':[.66,.35],'inferno-axe':[.25,.81],'demon-staff':[.20,.82]
};
const bodyMasks={
  torso:[[.35,.24],[.65,.24],[.665,.49],[.73,.61],[.27,.61],[.335,.49]],
  torsoMage:[[.35,.24],[.65,.24],[.65,.61],[.35,.61]],
  head:[[.1,0],[.9,0],[.9,.235],[.61,.28],[.39,.28],[.1,.235]],
  thigh:[[.28,.56],[.50,.56],[.49,.79],[.30,.80]],
  shin:[[.29,.75],[.49,.75],[.49,1],[.22,1]],
  skirt:[[.25,.55],[.75,.55],[.82,.91],[.18,.91]]
};
function maskedTexture(scene,key,sheet,sx,sy,sw,sh,polygon){
  if(scene.textures.exists(key))return key;
  const tex=scene.textures.createCanvas(key,sw,sh),c=tex.context;
  c.beginPath();polygon.forEach(([x,y],i)=>i?c.lineTo(x*sw,y*sh):c.moveTo(x*sw,y*sh));c.closePath();c.clip();
  c.drawImage(sheet,sx,sy,sw,sh,0,0,sw,sh);tex.refresh();return key;
}
function addTexture(scene,key,sheet,rect){
  if(scene.textures.exists(key))return key;
  const tex=scene.textures.createCanvas(key,rect[2],rect[3]);tex.context.drawImage(sheet,...rect,0,0,rect[2],rect[3]);tex.refresh();return key;
}
export class PhaserHero {
  constructor(scene,sprites){
    this.scene=scene;this.sprites=sprites;this.root=scene.add.container(0,0);this.body=scene.add.container(0,0);this.root.add(this.body);this.rearArms=scene.add.container(0,0);this.root.addAt(this.rearArms,0);
    this.legs=[-1,1].map(side=>{const hip=scene.add.container(0,0),thigh=scene.add.image(0,0,'__WHITE'),knee=scene.add.container(0,0),shin=scene.add.image(0,0,'__WHITE');hip.add([thigh,knee]);knee.add(shin);this.root.addAt(hip,0);return {side,hip,thigh,knee,shin};});
    this.skirt=scene.add.image(0,0,'__WHITE');this.torso=scene.add.image(0,0,'__WHITE');this.head=scene.add.image(0,0,'__WHITE');this.cloak=scene.add.image(0,0,'__WHITE');this.neck=scene.add.image(0,0,'__WHITE');this.body.add([this.skirt,this.torso,this.cloak,this.head,this.neck]);
    this.arms=['off','main'].map(side=>{const shoulder=scene.add.container(0,0),upper=scene.add.image(0,0,'__WHITE'),elbow=scene.add.container(0,0),fore=scene.add.image(0,0,'__WHITE'),wrist=scene.add.container(0,0),gear=scene.add.image(0,0,'__WHITE'),hand=scene.add.image(0,0,'__WHITE');shoulder.add([upper,elbow]);elbow.add([fore,wrist]);wrist.add([gear,hand]);this.body.add(shoulder);return {side,shoulder,upper,elbow,fore,wrist,gear,hand};});
  }
  bodyPiece(image,name,slot,save,w,h,back,side=0){
    const item=ITEMS[save.equipment[slot]],look=item?.look||0,sheet=this.sprites.hero,cw=sheet.naturalWidth/4,ch=sheet.naturalHeight/2;
    const mask=bodyMasks[name].map(([x,y])=>[side===1?1-x:x,y]);
    const key=maskedTexture(this.scene,`hero-${name}-${look}-${back}-${side}`,sheet,look*cw,back?ch:0,cw,ch,mask);
    image.setTexture(key).setOrigin(.5,.5).setDisplaySize(w,h);image.setTint(item?.hue?Phaser.Display.Color.HSVToRGB(item.hue/360,.28,.95).color:0xffffff);
  }
  gear(image,id,w,h){
    const item=ITEMS[id];image.setVisible(!!item);if(!item)return;
    const sheet=this.sprites[item.atlas||'gear'],cols=item.atlas?4:6,rows=item.atlas?3:6,cw=sheet.naturalWidth/cols,ch=sheet.naturalHeight/rows;
    const key=addTexture(this.scene,`gear-${id}`,sheet,[item.icon%cols*cw,Math.floor(item.icon/cols)*ch,cw,ch]);
    image.setTexture(key).setDisplaySize(w,h).setOrigin(...(item.shield?[.5,.5]:(grips[id]||[.28,.78])));
  }
  sync({save,x,y,width=112,back=true,action='idle',dir='right',elapsed=0,clock=0,aspect=1}){
    const w=width,h=w*4/3,item=ITEMS[save.equipment.weapon],targetPose=heroPose(action,dir,elapsed);
    const key=`${action}:${dir}:${save.equipment.weapon}`;
    if(this.actionKey!==key){
      this.actionKey=key;this.fromRig=this.rig;this.fromPose=this.pose;
      if(this.transition)this.scene.tweens.killTweensOf(this.transition);
      this.transition={value:this.rig?0:1};
      if(this.rig)this.scene.tweens.add({targets:this.transition,value:1,duration:75,ease:'Sine.easeOut'});
    }
    const blend=this.transition.value,pose={...targetPose};
    if(this.fromPose&&blend<1)for(const field of ['torso','leg','knee','x','y'])pose[field]=this.fromPose[field]+(targetPose[field]-this.fromPose[field])*blend;
    const rig=characterRig({action,dir,elapsed,twoHanded:item?.hands===2,width:w,height:h,from:this.fromRig,blend});
    this.root.setPosition(x+pose.x,y+pose.y+Math.sin(clock/650)*.5).setScale(back?1:-1,aspect);this.body.setRotation(pose.torso);this.rearArms.setRotation(pose.torso);
    this.bodyPiece(this.torso,ITEMS[save.equipment.armor]?.look===3?'torsoMage':'torso','armor',save,w,h,back);this.bodyPiece(this.head,'head','helm',save,w,h,back);this.head.setRotation(-pose.torso*.35);
    const robe=ITEMS[save.equipment.pants]?.look===3;this.skirt.setVisible(robe);if(robe)this.bodyPiece(this.skirt,'skirt','pants',save,w,h,back);
    for(const leg of this.legs){const {side,hip,thigh,knee,shin}=leg;hip.setPosition(side*w*.105,h*.09).setRotation(side*pose.leg);knee.setPosition(side*w*.025,h*.17).setRotation(-side*pose.knee);this.bodyPiece(thigh,'thigh','pants',save,w,h,back,side);thigh.setPosition(-side*w*.105,-h*.09).setVisible(!robe);this.bodyPiece(shin,'shin','boots',save,w,h,back,side);shin.setPosition(-side*w*.13,-h*.26);}
    this.cloak.setVisible(back&&!!save.equipment.cloak);if(this.cloak.visible){this.gear(this.cloak,save.equipment.cloak,w*.45,h*.55);this.cloak.setOrigin(.5,.5).setPosition(0,h*.01);}
    this.neck.setVisible(!back&&!!save.equipment.neck);if(this.neck.visible){this.gear(this.neck,save.equipment.neck,w*.10,h*.10);this.neck.setOrigin(.5,.5).setPosition(0,-h*.21);}
    const look=ITEMS[save.equipment.armor]?.look||0;
    for(const arm of this.arms){
      const parent=back?this.rearArms:this.body;if(arm.shoulder.parentContainer!==parent){arm.shoulder.parentContainer.remove(arm.shoulder);parent.add(arm.shoulder);}
      const solved=rig[arm.side],sh=rig.shoulders[arm.side];arm.shoulder.setPosition(sh.x,sh.y).setRotation(-solved.arm);arm.elbow.setPosition(0,rig.upper).setRotation(-solved.forearm);arm.wrist.setPosition(0,rig.lower);
      for(const [image,col,length]of [[arm.upper,0,rig.upper],[arm.fore,1,rig.lower]]){
        const rect=(back?rearArmRects:armRects)[look][col],key=addTexture(this.scene,`arm-${back?'back':'front'}-${look}-${col}`,this.sprites[back?'arms-back':'arms'],rect),ratio=length/(rect[3]*.80);
        image.setTexture(key).setOrigin(.5,.10).setScale(ratio).setPosition(0,-length*.02).setFlipX(arm.side==='main');
      }
      const handRect=(back?rearArmRects:armRects)[look][2],handKey=addTexture(this.scene,`arm-${back?'back':'front'}-${look}-hand`,this.sprites[back?'arms-back':'arms'],handRect);
      const armWorld=-solved.arm-solved.forearm;
      // Wrist orientation follows the handle, independently of elbow bend.
      const handAngle=arm.side==='main'?rig.weaponAngle+.65:rig.twoHanded?rig.weaponAngle+.65:0;
      arm.wrist.setRotation(handAngle-armWorld);
      arm.hand.setTexture(handKey).setOrigin(.52,.70).setDisplaySize(w*.10,h*.085).setFlipX(arm.side==='main');
      const id=save.equipment[arm.side==='main'?'weapon':'offhand'],gearItem=ITEMS[id];
      if(arm.side==='off'&&rig.twoHanded)arm.gear.setVisible(false);
      else {this.gear(arm.gear,id,w*(gearItem?.hands===2?.55:.43),h*(arm.side==='main'?.52:.32));arm.gear.setRotation(arm.side==='main'?-.65:0);}
    }
    this.rig=rig;this.pose=pose;
  }
  destroy(){this.root.destroy(true);}
}

export function createPhaserRenderer({canvas,background,sprites,tick,getState}){
  let activeScene,hero,previewGame=null,enemyImages=[],enemyKey='';
  class CombatScene extends Phaser.Scene {
    constructor(){super('Combat');}
    create(){activeScene=this;this.textures.addCanvas('background',background);this.backdrop=this.add.image(0,0,'background').setOrigin(0).setDisplaySize(480,800);const world=this.add.container(0,0).setScale(2);hero=new PhaserHero(this,sprites);world.add(hero.root);this.world=world;enemyImages=[this.add.image(0,0,'__WHITE').setAlpha(0).setVisible(false),this.add.image(0,0,'__WHITE').setAlpha(0).setVisible(false)];world.addAt(enemyImages[0],0);world.addAt(enemyImages[1],1);this.cameras.main.setBackgroundColor('#171522');}
    update(now){if(!hero||!getState().loaded)return;tick(now);const state=getState();this.world.setVisible(state.phase!=='home');if(state.phase==='home')return;this.tweens.timeScale=state.paused?0:1;hero.sync(state.hero);}
  }
  const game=new Phaser.Game({type:Phaser.CANVAS,canvas,width:480,height:800,transparent:false,antialias:false,pixelArt:true,audio:{noAudio:true},scene:CombatScene,banner:false,render:{roundPixels:false},fps:{target:60}});
  return {
    game,
    syncEnemy(frame){
      if(!activeScene)return;
      const {sheet,type,key,x,y,size,aspect,alpha=1,mirror=false,...rect}=frame;
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
        create(){this.hero=new PhaserHero(this,sprites);this.hero.sync({save,x:120,y:200,width:230,back:false});}
      }
      previewGame=new Phaser.Game({type:Phaser.CANVAS,canvas,width:240,height:400,transparent:true,antialias:false,pixelArt:true,audio:{noAudio:true},scene:PreviewScene,banner:false});
    },
    closePreview(){if(previewGame){previewGame.destroy(false);previewGame=null;}},
    inspect(){return {scene:activeScene,hero,enemyImages,preview:previewGame};}
  };
}
