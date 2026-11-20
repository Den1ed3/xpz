import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import worker from './dist/server/index.js';
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
function statement(sql,args=[]){const q=db.prepare(sql);return {bind:(...a)=>statement(sql,a),first:async()=>q.get(...args),all:async()=>({results:q.all(...args)}),run:async()=>q.columns().length?{results:q.all(...args)}:{meta:q.run(...args)}}}
const env={DB:{prepare:statement,batch:async ss=>Promise.all(ss.map(s=>s.run()))}};
http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const r=await worker.fetch(new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})}),env,{});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))}catch(e){console.error(e);res.writeHead(500);res.end('Request failed')}}).listen(Number(process.argv[process.argv.indexOf('--port')+1])||Number(process.env.PORT)||5173,'0.0.0.0');
