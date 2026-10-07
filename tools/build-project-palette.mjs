import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {writePng} from './png.mjs';
const root=new URL('../',import.meta.url),out=new URL('models/project-palette/',root),publicDir=new URL('public/models/',root);
mkdirSync(out,{recursive:true});
const columns=16,rows=16,cellSize=64,width=columns*cellSize,height=rows*cellSize;
const art=JSON.parse(readFileSync(new URL('art-direction.json',out)));
const swatches=[];
const rgb=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
const hex=color=>'#'+color.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
const add=(name,color,group,properties={})=>swatches.push({id:name.toLowerCase().replaceAll(' ','-'),name,group,color,rgb:rgb(color),colorSpace:'srgb',metallic:0,roughness:.85,emissive:false,opacity:1,transmission:0,...properties});
const families=[
 ['Warm neutrals',['#171f23','#424b4b','#a0a39a','#e8e0d0'],{7:'building-base',15:'snow-surface'}],
 ['Stone',['#272d35','#575a61','#999084','#ddd6c6'],{8:'bedrock',9:'cliff',10:'rock',11:'building-pile'}],
 ['Earth and bark',['#30271f','#62432d','#a17f52','#ead6ad'],{6:'tree-bark',11:'building-earth'}],
 ['Meadow',['#303c21','#5a702e','#909c43','#d2d490'],{11:'land-surface'}],
 ['Forest',['#172d24','#374e2a','#7b883e','#bccb7b'],{7:'tree-foliage'}],
 ['Cream paint',['#4e4037','#937c60','#c9b18c','#fff0d3'],{12:'building-wall'}],
 ['Teal paint',['#122d35','#2d545d','#64928e','#cae4d2'],{7:'building-roof'}],
 ['Slate blue',['#182939','#355561','#7999ac','#d5e3eb'],{5:'ocean-surface'}],
 ['Ochre paint',['#48331f','#987235','#d9af51','#ffe8aa'],{}],
 ['Terracotta paint',['#422b2b','#8d493b','#ce7d56','#f3cfaa'],{}],
 ['Plum paint',['#2c283d','#654653','#a67480','#e5c6c9'],{}]
];
for(const [group,anchors,roles] of families){
 const colors=anchors.map(rgb);
 for(let i=0;i<columns;i++){
  const segment=Math.min(2,Math.floor(i/5)),t=(i-segment*5)/5;
  const role=roles[i],color=role?art.swatches[role]:hex(colors[segment].map((v,k)=>v*(1-t)+colors[segment+1][k]*t));
  add(role?role.replaceAll('-',' '):group+' '+String(i+1).padStart(2,'0'),color,group);
 }
}
for(let row=0;row<families.length;row++){
 const ramp=swatches.slice(row*columns,(row+1)*columns).sort((a,b)=>a.rgb.reduce((v,c,i)=>v+c**2.2*[.2126,.7152,.0722][i],0)-b.rgb.reduce((v,c,i)=>v+c**2.2*[.2126,.7152,.0722][i],0));
 for(let i=0;i<ramp.length;i++)if(!art.swatches[ramp[i].id]){ramp[i].name=families[row][0]+' '+String(i+1).padStart(2,'0');ramp[i].id=ramp[i].name.toLowerCase().replaceAll(' ','-');}
 swatches.splice(row*columns,columns,...ramp);
}
const metals=[['Dark alloy','#38464b'],['Gunmetal','#485960'],['Iron','#626c75'],['Titanium','#8996a3'],['Pewter','#898d88'],['Steel','#a6b2b9'],['Nickel','#b6b29e'],['Aluminium','#d1dadd'],['Oxide','#885341'],['Bronze','#987044'],['Copper','#b97752'],['Rose gold','#c69179'],['Brass',art.swatches['building-trim']],['Gold','#ddbd69'],['Champagne','#e5d5be'],['Pale gold','#edd6a1']];
for(const [finish,roughness] of [['brushed',.42],['polished',.18],['worn',.68]])for(const [name,color] of metals)add(name==='Brass'&&finish==='brushed'?'Building trim':name+' '+finish,color,'Metal · '+finish,{metallic:1,roughness});
for(const [name,color] of [['Warm white','#ffe4ab'],['Ivory','#fff2ce'],['Amber','#ffb348'],['Orange','#ff8b42'],['Red','#ff5d4e'],['Coral','#ff9280'],['Pink','#ffa5ce'],['Violet','#d18fff'],['Indigo','#ab9bff'],['Blue','#7e9cff'],['Azure','#8dc9ff'],['Cyan','#60dfff'],['Mint','#7dffb9'],['Green','#a4f26b'],['Lime','#daef83'],['Cool white','#d3f4ff']])add(name+' light',color,'Emission',{roughness:.35,emissive:true});
const glass=[['Smoke','#202b35'],['Petrol',art.swatches['house-glass']],['Azure','#2e5d83'],['Amber','#745331'],['Mint','#376560'],['Violet','#494564'],['Clear','#9bb5b8'],['Rose','#785664']];
for(const transparent of [false,true])for(const [name,color] of glass)add(name==='Petrol'&&!transparent?'House glass':name+(transparent?' clear glass':' reflective glass'),color,'Glass',{metallic:transparent?0:.75,roughness:transparent?.12:.14,opacity:transparent?.3:1,transmission:transparent?.8:0});
if(swatches.length!==rows*columns)throw Error('Palette must fill its layout exactly');
const colorNames={
  "building-base": "Sage gray",
  "snow-surface": "Warm ivory",
  "bedrock": "Taupe gray",
  "cliff": "Warm gray",
  "rock": "Sandstone",
  "building-pile": "Stone beige",
  "tree-bark": "Chestnut brown",
  "building-earth": "Sandy ochre",
  "land-surface": "Meadow olive",
  "tree-foliage": "Moss green",
  "building-wall": "Warm cream",
  "building-roof": "Muted teal",
  "ocean-surface": "Deep slate blue",
  "building-trim": "Brass brushed",
  "house-glass": "Petrol reflective glass"
};
for(const swatch of swatches)swatch.name=colorNames[swatch.id]??swatch.name;
const definition=JSON.parse(readFileSync(new URL('public/blue-home.json',root)));
for(const s of definition.surfaces){s.color=[...swatches.find(v=>v.id===s.id+'-surface').rgb,1];s.cliff=[...swatches.find(v=>v.id==='cliff').rgb,1];}
definition.water.color=[...[1,3,5].map(i=>parseInt(art.water.slice(i,i+2),16)/255),1];
writeFileSync(new URL('public/blue-home.json',root),JSON.stringify(definition,null,2));
const floats=value=>JSON.stringify(value).replace(/(?<![.\d])([01])(?=[,\]])/g,'$1.0');
writeFileSync(new URL('core/src/blue.rs',root),
  'pub const SURFACE_COLORS: [[f32;4];3] = '+floats(definition.surfaces.map(s=>s.color))+';\n'+
  'pub const CLIFF_COLORS: [[f32;4];3] = '+floats(definition.surfaces.map(s=>s.cliff))+';\n'+
  'pub const SURFACE_WATER: [bool;3] = '+JSON.stringify(definition.surfaces.map(s=>s.water))+';\n'+
  'pub const WATER_COLOR: [f32;4] = '+floats(definition.water.color)+';\n'+
  'pub const WATER_LEVEL: f32 = '+definition.water.heightInLevels+';\n'+
  'pub const LAND_VARIATION: f32 = '+definition.landVariation+';\n'+
  'pub const SEED: u32 = '+definition.seed+';\n');
for(let i=0;i<swatches.length;i++){const s=swatches[i];s.row=Math.floor(i/columns);s.column=i%columns;s.uvCenter=[(s.column+.5)/columns,1-(s.row+.5)/rows];}
const map=(name,fn)=>{const pixels=new Uint8Array(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const s=swatches[Math.floor(y/cellSize)*columns+Math.floor(x/cellSize)];pixels.set(fn(s),(y*width+x)*4);}writePng(new URL(name+'.png',out),width,height,pixels);copyFileSync(new URL(name+'.png',out),new URL('project-'+name+'.png',publicDir));};
const bytes=s=>[1,3,5].map(i=>parseInt(s.color.slice(i,i+2),16));
map('base-color',s=>[...bytes(s),255]);map('metallic',s=>[...Array(3).fill(Math.round(s.metallic*255)),255]);map('roughness',s=>[...Array(3).fill(Math.round(s.roughness*255)),255]);map('emission',s=>[...(s.emissive?bytes(s):[0,0,0]),255]);map('opacity',s=>[...Array(3).fill(Math.round(s.opacity*255)),255]);map('transmission',s=>[...Array(3).fill(Math.round(s.transmission*255)),255]);map('orm',s=>[255,Math.round(s.roughness*255),Math.round(s.metallic*255),255]);
const manifest={width,height,columns,rows,cellSize,origin:'UV bottom-left; rows top-to-bottom',ao:{darkEnd:.4375,lightStart:.5625,uvChannel:2,whiteUV:[1,.5]},swatches};
writeFileSync(new URL('manifest.json',out),JSON.stringify(manifest,null,2));copyFileSync(new URL('manifest.json',out),new URL('palette.json',publicDir));
const ramp=new Uint8Array(256*8*4);for(let y=0;y<8;y++)for(let x=0;x<256;x++){const a=Math.round(255*Math.max(0,Math.min(1,((x+.5)/256-.4375)/.125)));ramp.set([a,a,a,255],(y*256+x)*4);}writePng(new URL('ao-gradient.png',out),256,8,ramp);copyFileSync(new URL('ao-gradient.png',out),new URL('ao-gradient.png',publicDir));
const groupOrder=swatches.map(s=>s.group);
const groups=[...new Set([...groupOrder,...swatches.map(s=>s.group)])];
const html=`<!doctype html><meta charset="utf-8"><title>Interstellar material palette</title><style>body{background:#162028;color:#e9e5d9;font:14px system-ui;margin:32px}h1{font-weight:500}section{display:grid;grid-template-columns:repeat(16,minmax(70px,1fr));gap:4px}article{background:#25313a;border-radius:6px;overflow:hidden}i{display:block;height:56px}p{margin:8px;font-size:12px}small{color:#bec7cb}h2{margin-top:32px}code{font-size:11px}</style><h1>Interstellar · Material palette</h1><p><a style="color:#d9b861" href="http://127.0.0.1:8767/editor/model-editor.html">Open model studio</a> · Paint regions and vertex AO without a second UV map.</p><p>UV0 selects a material. UV2.x samples the shared AO gradient; UV2.y = 0.5. White is U ≥ 0.5625, black is U ≤ 0.4375. Texture addressing clamps at the edges.</p><p>Reflective glass is opaque and shares the opaque batch. Transparent glass uses its own transparency pass.</p>${groups.filter(g=>g!=='Reserved').map(group=>`<h2>${group}</h2><section>${swatches.filter(s=>s.group===group).map(s=>`<article><i style="background:${s.color}"></i><p>${s.name}<br><code>${s.color}</code><br><small>M ${s.metallic} · R ${s.roughness}${s.emissive?' · Emissive':''}${s.opacity<1?' · α '+s.opacity:''}<br>Row ${s.row+1} · Column ${s.column+1}<br>UV ${s.uvCenter.map(v=>v.toFixed(5)).join(', ')}</small></p></article>`).join('')}</section>`).join('')}`;
writeFileSync(new URL('reference.html',out),html);writeFileSync(new URL('public/palette.html',root),html);
console.log(`${swatches.length} swatches · ${width}×${height}`);
