import {cp,mkdir,rm,readdir,stat} from 'node:fs/promises';
const source=new URL('../public/',import.meta.url),target=new URL('../dist/',import.meta.url);
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
const excluded=new Set(['audit','palette.html','house-preview.html']);
for(const name of await readdir(source)){if(excluded.has(name))continue;await cp(new URL(name,source),new URL(name,target),{recursive:true,filter:path=>!path.split('/').at(-1).startsWith('.')});}
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=new URL(entry.name+(entry.isDirectory()?'/':''),dir);if(entry.isDirectory())await check(path);else if((await stat(path)).size>25*1024*1024)throw Error('Asset exceeds 25 MiB: '+entry.name);}}
for(const name of await readdir(new URL('editor/',target)))if(name.endsWith('.html'))await rm(new URL('editor/'+name,target));
await check(target);console.log('Static game packaged in dist/');
