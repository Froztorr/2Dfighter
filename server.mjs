import { PLAYER_SHEETS } from './fps-player.mjs';
import { PORTRAIT_FILES } from './equipment-art.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root=process.cwd();
const publicFiles = new Set(['/index.html','/style.css','/app.js','/enemy-animation.mjs','/enemy-atlas.mjs','/core.mjs','/fps-player.mjs','/player-rig.mjs','/player-3d.mjs','/pixel-equipment.mjs','/player-sculpt.mjs','/player-materials.mjs','/vendor/three.module.js','/vendor/MarchingCubes.js','/vendor/RoomEnvironment.js','/vendor/three.core.js','/phaser-renderer.mjs','/vendor/phaser.min.js',...['hall','brute','lizard','wraith','knight','gear','guards','frost','spider','demon','relics','portrait',...PLAYER_SHEETS].map(name=>`/assets/${name}.png`)]);
for(const path of ['/expedition.html','/expedition.css','/expedition.mjs','/expedition-core.mjs','/sentinel-sprites.mjs','/assets/moss-sentinel.png'])publicFiles.add(path);
publicFiles.add('/appearance.mjs');publicFiles.add('/player-portrait.mjs');publicFiles.add('/equipment-rig.mjs');publicFiles.add('/equipment-ui.mjs');publicFiles.add('/equipment.css');
for(const path of ['/authored-poses.mjs','/pose-settings.mjs','/tools/pose-studio.html','/tools/pose-studio.css','/tools/pose-studio.mjs'])publicFiles.add(path);
for(const path of ['/equipment-art.mjs','/paperdoll-atlas.mjs',...Object.values(PORTRAIT_FILES).map(path=>'/'+path)])publicFiles.add(path);
for(const name of ['brute','lizard','wraith','knight','frost','spider','demon'])publicFiles.add(`/assets/${name}-v2.png`);
if(process.argv.includes('--studio')){publicFiles.add('/tools/art-review.html');publicFiles.add('/tools/art-review.mjs');}
createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost');
    const name = url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
    if(!publicFiles.has(name)){res.writeHead(404).end('Not found');return;}
    const path=resolve(root,'.'+name);
    const body=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png'})[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(Number(process.env.PORT)||4173,process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1',()=>console.log(`Emberblade: http://127.0.0.1:${Number(process.env.PORT)||4173}`));
