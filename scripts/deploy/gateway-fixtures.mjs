// Synthetic host processes for gateway tests; no application, database, or credentials.
import http from 'node:http';
for (const [name,port] of [['blue',18081],['green',18082]]) {
  let started=false;
  http.createServer((req,res)=>{
    res.setHeader('Content-Type','text/plain');
    if(req.url==='/started') return res.end(String(started));
    if(req.url==='/slow') {started=true; return setTimeout(()=>res.end(name),2000);}
    if(req.url==='/_next/static/old.js' && name==='green') {res.statusCode=404;return res.end('missing');}
    res.end(name);
  }).listen(port,'0.0.0.0');
}
