export async function parseDem(file,onProgress=()=>{}) {
 if(await file.slice(0,8).text()!=='PBDEMS2\0')throw Error('Choose a complete, uncompressed Dota 2 .dem file.');
 return new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./dem-worker.js',import.meta.url),{type:'module'});
   const finish=(fn,value)=>{worker.terminate();fn(value)};
   worker.onmessage=({data})=>{
     if(data.error)finish(reject,new Error(data.error));
     else if(data.match)finish(resolve,data.match);
     else onProgress(data.progress);
   };
   worker.onerror=()=>finish(reject,new Error('The replay reader stopped. Check the file is complete and try again in a desktop browser.'));
   worker.postMessage(file);
 });
}
