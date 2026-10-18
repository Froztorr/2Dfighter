// Eight authored poses; the impact pose is entered only after damage resolves.
export function enemyFrame({phase,time,attack,enemy,stunned=0,transition=0}) {
  if(phase==='walking')return {row:0,column:transition-time>1000?6:7};
  if(stunned>time||enemy?.hit>time)return {row:0,column:Math.floor(time/100)%2?4:5};
  const row=['up','down','left','right'].indexOf(attack?.dir||enemy?.dir)+1;
  if(attack){
    const duration=Math.max(1,attack.at-(attack.started??attack.at-1000));
    const progress=Math.max(0,Math.min(1,1-(attack.at-time)/duration));
    return {row,column:progress<.18?0:progress<.45?1:progress<.85?2:3};
  }
  if(enemy?.recoverUntil>time){
    const remaining=enemy.recoverUntil-time;
    return {row,column:remaining>500?4:remaining>340?5:remaining>160?6:7};
  }
  return {row:0,column:enemy?.guardHit>time?3:Math.floor(time/200)%3};
}
export function enemyArtPose(type,{row,column}){
 // Bind painted trajectories to screen directions; paired two-handed cuts may mirror.
 if(type==='knight'&&row>=3)row=7-row;
 if(type==='frost'&&row===4)return {row:3,column,mirror:true};
 if(type==='demon'&&row===3)return {row:4,column,mirror:true};
 if(type==='demon'&&row===1){
  const poses=[[1,0],[0,6],[1,1],[1,3],[1,2],[1,6],[1,7],[0,0]];
  [row,column]=poses[column];
 }
 return {row,column,mirror:false};
}
export function paintEnemyFrame(context,sheet,frame){
 context.save();context.imageSmoothingEnabled=false;context.beginPath();for(const [x,y,width]of frame.runs)context.rect(x,y,width,1);context.clip();context.drawImage(sheet,frame.sx,frame.sy,frame.sw,frame.sh,0,0,frame.sw,frame.sh);context.restore();
}
