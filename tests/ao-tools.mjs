import assert from 'node:assert/strict';
import {topology,connected,mapFaces,bakeMappings,matchEdges} from '../public/editor/ao-tools.js';
import {createRegions,compileAppearance,validateAuthoring} from '../public/editor/model-data.js';
import {readFileSync} from 'node:fs';
// Two stacked panels with duplicate vertices at their shared boundary.
const p={positions:[0,0,0,1,0,0,1,1,0,0,1,0,0,1,0,1,1,0,1,2,0,0,2,0],indices:[0,1,2,0,2,3,4,5,6,4,6,7],normals:Array.from({length:24},(_,i)=>i%3===2?1:0),uvs:Array(16).fill(.5)};
const topo=topology([p]),ids=[...topo.faces.keys()];assert.equal(connected(topo,[ids[0]]).length,4);
const m={ao:[Array(12).fill(1)]};const maps=mapFaces(topo,ids,{continuous:true,start:-1,end:1});bakeMappings(m,maps);
for(const f of topo.faces.values())for(const link of f.links)for(const k of link.corners){const other=topo.faces.get(link.to),j=other.keys.indexOf(f.keys[k]);assert(Math.abs(m.ao[0][f.ref[1]*3+k]-m.ao[0][other.ref[1]*3+j])<1e-6);}
assert(Math.max(...m.ao[0])>1,'Vertical neighbours extend the ramp');
const repeated=mapFaces(topo,ids,{start:0,end:1});assert(Object.values(repeated).every(f=>Math.min(...f.uv.map(p=>p[1]))===0&&Math.max(...f.uv.map(p=>p[1]))===1));
const rotated=mapFaces(topo,[ids[0]],{turn:1,start:0,end:1});assert.notDeepEqual(rotated[ids[0]].uv,repeated[ids[0]].uv);
const seam=topo.faces.get(ids[1]).links.find(l=>l.to===ids[2]).edge;assert.equal(connected(topo,[ids[0]],[seam]).length,2);
const matched={ao:[Array(12).fill(.8)]};matched.ao[0].splice(0,3,.1,.2,.3);matchEdges(topo,matched,ids);for(const f of topo.faces.values())for(const l of f.links)for(const k of l.corners){const g=topo.faces.get(l.to),j=g.keys.indexOf(f.keys[k]);assert.equal(matched.ao[0][f.ref[1]*3+k],matched.ao[0][g.ref[1]*3+j]);}
const palette=JSON.parse(readFileSync(new URL('../public/models/palette.json',import.meta.url))),model=createRegions([p],palette);bakeMappings(model,maps);
const data={version:1,models:{test:model},appearances:{a:{name:'A',colors:model.colors}},bindings:{test:'a'}};validateAuthoring(JSON.parse(JSON.stringify(data)));const result=compileAppearance([p],model,data.appearances.a,palette);assert.deepEqual(result[0].ao,model.ao[0]);assert(result[0].ao.some(v=>v<0));assert(result[0].ao.some(v=>v>1));
const bent={...p,positions:p.positions.map((v,i)=>i>=18&&i%3===1?1:i>=18&&i%3===2?1:v)};const bt=topology([bent]);const bm=mapFaces(bt,[...bt.faces.keys()],{continuous:true,start:0,end:1});assert(Object.values(bm).flatMap(m=>m.uv.flat()).every(Number.isFinite));
console.log('AO: seam-aware adjacency, repeat, continuous unfolding, rotation, matched edges, bent surfaces, and persistent unclamped coordinates pass.');
