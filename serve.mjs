import {createChainRoutes} from './server/chain.mjs';
import http from 'node:http';
import {validateCompositions} from './public/tile-composition.js';
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateAuthoring,compileAppearance} from './public/editor/model-data.js';
import {geometryFingerprint} from './public/editor/model-data.js';
import {createModelLibrary} from './server/model-library.mjs';
const port=Number(process.env.PORT||8766),production=process.env.NODE_ENV==='production';
if(production&&!process.env.PUBLIC_ORIGIN)throw Error('Set PUBLIC_ORIGIN to the public HTTPS origin');
if(production&&!process.env.INTERSTELLAR_ADMIN_KEY&&!process.env.INTERSTELLAR_ADMIN_SECRET)throw Error('Configure the sponsor signing key through deployment secrets');
const root=fileURLToPath(new URL('public/',import.meta.url));
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const chainRoutes=createChainRoutes();
const modelLibrary=createModelLibrary(root,fileURLToPath(new URL('./models/imported/',import.meta.url)));
http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/healthz'){json(res,200,{ok:true});return;}
 if(production&&(path.startsWith('/editor/')&&path.endsWith('.html')||path.startsWith('/audit/')||path.startsWith('/api/')&&!path.startsWith('/api/chain/'))){res.writeHead(404).end();return;}
 if(!production&&await modelLibrary.route(req,res))return;
 if(await chainRoutes(req,res))return;
 if(req.url==='/api/tile-compositions'&&req.method==='PUT'){
  let temp;
  try{
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'Origin not allowed'});
   let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>1_000_000)return json(res,413,{error:'Configuration is too large'});body+=chunk;}
   const [library,authoring]=await Promise.all([modelLibrary.read(),readFile(resolve(root,'models/authoring.json'),'utf8').then(JSON.parse)]);
   const data=validateCompositions(JSON.parse(body),library,authoring);
   const palette=JSON.parse(await readFile(resolve(root,'models/palette.json'),'utf8'));
   for(const config of data.configs)for(const entry of [...config.fixed,...config.scatter])for(const id of entry.models||[entry.model]){
    const model=authoring.models[id],look=authoring.appearances[entry.appearance||authoring.bindings[id]],source=library.models.find(m=>m.id===id);
    if(model&&look)compileAppearance(source.parts,model,look,palette,{includeUnassigned:false});
   }
   temp=resolve(root,'configs/tiles.'+crypto.randomUUID()+'.tmp');await writeFile(temp,JSON.stringify(data,null,2)+'\n');await rename(temp,resolve(root,'configs/tile-compositions.json'));return json(res,200,{ok:true});
  }catch(error){return json(res,400,{error:error.message});}finally{if(temp)await unlink(temp).catch(()=>{});}
 }
 if(req.url==='/api/authoring'&&req.method==='PUT'){
  let temp;
  try{
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'Origin not allowed'});
   let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>5_000_000)return json(res,413,{error:'Configuration is too large'});body+=chunk;}
   const data=validateAuthoring(JSON.parse(body));
   const [library,palette]=await Promise.all([modelLibrary.read(),readFile(resolve(root,'models/palette.json'),'utf8').then(JSON.parse)]);
   const catalog=new Map(library.models.map(m=>[m.id,m.parts]));
   for(const [id,model] of Object.entries(data.models)){if(!catalog.has(id))throw Error('Unknown model: '+id);const appearance=data.appearances[data.bindings[id]];if(!appearance)throw Error('Model needs an appearance');if(model.fingerprint===geometryFingerprint(catalog.get(id)))compileAppearance(catalog.get(id),model,appearance,palette);}
   temp=resolve(root,'models/authoring.'+crypto.randomUUID()+'.tmp');await writeFile(temp,JSON.stringify(data,null,2)+'\n');await rename(temp,resolve(root,'models/authoring.json'));return json(res,200,{ok:true});
  }catch(error){return json(res,400,{error:error.message});}finally{if(temp)await unlink(temp).catch(()=>{});}
 }
 try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403).end();return;}const body=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'})[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404).end();}
}).listen(port,process.env.HOST||(production?'0.0.0.0':'127.0.0.1'),()=>console.log(`http://127.0.0.1:${port}/`));
