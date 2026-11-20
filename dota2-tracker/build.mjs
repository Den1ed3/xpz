import fs from 'node:fs/promises';
import path from 'node:path';
const types={'.mjs':'text/javascript; charset=utf-8','.png':'image/png','.wasm':'application/wasm','.svg':'image/svg+xml','.txt':'text/plain','.md':'text/plain','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.jpg':'image/jpeg','.glb':'model/gltf-binary','.webm':'video/webm'};
const files={};
async function collect(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isDirectory())await collect(name);else if(types[path.extname(name)])files[name.slice(2)]=[types[path.extname(name)],(await fs.readFile(name)).toString('base64')];}}
await collect('ui');
const backend=await fs.readFile('server.js','utf8');
const runtime=`
export default {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(path.startsWith('/api/'))return api(request,env,ctx);
 const entry=files[path==='/'?'/index.html':path];
 if(!Array.isArray(entry))return new Response('File not found',{status:404});
 const headers={'Content-Type':entry[0],'Cache-Control':path.startsWith('/assets/')?'public, max-age=86400':'no-cache'};
 if(request.method==='HEAD')return new Response(null,{headers});
 const bytes=typeof Uint8Array.fromBase64==='function'?Uint8Array.fromBase64(entry[1]):Uint8Array.from(atob(entry[1]),c=>c.charCodeAt(0));return new Response(bytes,{headers});
}};
`;
await fs.mkdir('dist/server',{recursive:true});
await fs.mkdir('dist/.openai',{recursive:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await fs.writeFile('dist/server/index.js',backend+'\nconst files='+JSON.stringify(files)+';\n'+runtime);
console.log('Built worker with '+Object.keys(files).length+' assets.');
