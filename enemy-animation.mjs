// Six columns per sequence: ready, anticipation, travel, contact, follow-through, settle.
// Contact begins only when combat resolves damage; windup cannot show an impact early.
export function enemyFrame({phase,time,attack,enemy,stunned=0,transition=0}) {
  if(phase==='walking')return {row:0,column:transition-time>1000?4:5};
  if(stunned>time||enemy?.hit>time)return {row:0,column:3};
  const row=['up','down','left','right'].indexOf(attack?.dir||enemy?.dir)+1;
  if(attack){
    const duration=Math.max(1,attack.at-(attack.started??attack.at-1000));
    const progress=Math.max(0,Math.min(1,1-(attack.at-time)/duration));
    return {row,column:progress<.35?0:progress<.82?1:2};
  }
  if(enemy?.recoverUntil>time){
    const remaining=enemy.recoverUntil-time;
    return {row,column:remaining>480?3:remaining>240?4:5};
  }
  return {row:0,column:enemy?.guardHit>time?2:Math.floor(time/280)%2};
}
