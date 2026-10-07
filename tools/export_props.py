import json,struct,math,shutil
from pathlib import Path
from read_blend import Blend
root=Path(__file__).resolve().parents[1]
source=Path('/Users/tedosijses/projects/industries/Assets/Application/Models/Fiver/Thinira/props.blend')
b=Blend(source)
def layers(m,key):
 cd=m.get(key);lb=b.ptr[cd.get('layers')];size=b.lens[b.types.index('CustomDataLayer')]
 return {r.get('name'):r for i in range(cd.get('totlayer')) for r in [b.record(lb,'CustomDataLayer',i*size)]}
from mesh_geometry import triangulate,cross,sub
out=[]
for name in ['tree_temperate_01','rock_small_01','rock_small_02','rock_small_03']:
 o=next(b.record(x) for x in b.blocks if x['code']=='OB' and b.record(x).get('id').get('name')=='OB'+name)
 m=b.record(b.ptr[o.get('data')]);v=layers(m,'vdata');l=layers(m,'ldata')
 ps=list(struct.iter_unpack('<fff',b.ptr[v['position'].get('data')]['data']))
 loops=list(struct.iter_unpack('<i',b.ptr[l['.corner_vert'].get('data')]['data']));loops=[x[0] for x in loops]
 uv=list(struct.iter_unpack('<ff',b.ptr[l['UVMap'].get('data')]['data']))
 offsets=list(struct.iter_unpack('<i',b.ptr[m.get('poly_offset_indices')]['data']));offsets=[x[0] for x in offsets]
 positions=[];normals=[];uvs=[];indices=[]
 for a,end in zip(offsets,offsets[1:]):
  face=list(range(a,end));lp=[ps[loops[i]] for i in face]
  for tri in triangulate(list(range(len(face))),lp):
   points=[lp[i] for i in tri];n=cross(sub(points[1],points[0]),sub(points[2],points[0]));length=math.sqrt(sum(x*x for x in n))
   if length<1e-12:continue
   for i in tri:
    indices.append(len(indices));positions+=lp[i];normals += [x/length for x in n];uvs+=uv[a+i]
 out.append(dict(name=name,positions=positions,normals=normals,uvs=uvs,indices=indices))
(root/'public/props.json').write_text(json.dumps(out,separators=(',',':')))
shutil.copyfile(source.parent/'Color.png',root/'public/props-color.png')
print([(x['name'],len(x['indices'])//3) for x in out])
