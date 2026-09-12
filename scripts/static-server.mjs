import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.mp3':'audio/mpeg', '.json':'application/json; charset=utf-8' };

// Development and test server only. The published game consists solely of static files.
export function createStaticServer(directory, prefix = '/') {
  const root = resolve(directory);
  if (!/^\/(?:[\w-]+\/)*[\w-]*\/?$/.test(prefix)) throw new Error('Invalid base path');
  const base = prefix.endsWith('/') ? prefix : prefix + '/';
  return http.createServer(async(req,res)=>{
    try {
      if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const url = new URL(req.url,'http://localhost'), pathname=decodeURIComponent(url.pathname);
      if (base !== '/' && pathname === base.slice(0,-1)) { res.writeHead(308,{Location:base+url.search}).end(); return; }
      if (!pathname.startsWith(base)) { res.writeHead(404).end('Not found'); return; }
      const relative = pathname.slice(base.length) || 'index.html';
      let file = resolve(root,relative);
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const info=await stat(file);
      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) { res.writeHead(308,{Location:pathname+'/'+url.search}).end(); return; }
        file=resolve(file,'index.html');
      }
      const body=await readFile(file);
      const headers={'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
      const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range) {
        const start=Number(range[1]), end=Math.min(range[2]?Number(range[2]):body.length-1,body.length-1);
        if(start>end||start>=body.length){res.writeHead(416,{'Content-Range':`bytes */${body.length}`}).end();return;}
        res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${body.length}`,'Content-Length':end-start+1});
        res.end(req.method==='HEAD'?undefined:body.subarray(start,end+1));
      } else {res.writeHead(200,{...headers,'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);}
    } catch { res.writeHead(404).end('Not found'); }
  });
}
