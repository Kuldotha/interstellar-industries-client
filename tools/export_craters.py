import json,struct
from pathlib import Path
from read_blend import Blend
from mesh_geometry import triangulate
root=Path(__file__).resolve().parents[1]
b=Blend('/Users/tedosijses/projects/industries/Assets/Application/Models/props.blend')
def layers(m,key):
 cd=m.get(key);lb=b.ptr[cd.get('layers')];size=b.lens[b.types.index('CustomDataLayer')]
 return {r.get('name'):r for i in range(cd.get('totlayer')) for r in [b.record(lb,'CustomDataLayer',i*size)]}
models=[]
for name in ['crater_01','crater_02']:
 o=next(b.record(x) for x in b.blocks if x['code']=='OB' and b.record(x).get('id').get('name')=='OB'+name)
 m=b.record(b.ptr[o.get('data')]);v=layers(m,'vdata');l=layers(m,'ldata')
 ps=list(struct.iter_unpack('<fff',b.ptr[v['position'].get('data')]['data']))
 loops=[x[0] for x in struct.iter_unpack('<i',b.ptr[l['.corner_vert'].get('data')]['data'])]
 offsets=[x[0] for x in struct.iter_unpack('<i',b.ptr[m.get('poly_offset_indices')]['data'])]
 indices=[]
 for a,end in zip(offsets,offsets[1:]):
  face=loops[a:end]
  for tri in triangulate(list(range(len(face))),[ps[i] for i in face]):indices.extend(face[i] for i in tri)
 models.append(dict(name=name,positions=[v for p in ps for v in p],indices=indices))
 print(name,len(ps),len(indices)//3)
(root/'public/craters.json').write_text(json.dumps(models,separators=(',',':')))
