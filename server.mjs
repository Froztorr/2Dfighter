import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root=process.cwd();
const publicFiles = new Set(['/index.html','/style.css','/app.js','/core.mjs',...['brute','lizard','wraith','knight','gear','hero','guards','frost','spider','demon','relics'].map(name=>`/assets/${name}.png`)]);
createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost');
    const name = url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
    if(!publicFiles.has(name)){res.writeHead(404).end('Not found');return;}
    const path=resolve(root,'.'+name);
    const body=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png'})[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(4173,process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1',()=>console.log('Emberblade: http://127.0.0.1:4173'));
