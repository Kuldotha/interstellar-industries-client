from read_blend import Blend,Record
import struct,json
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
b=Blend(sys.argv[1])
def layers(mesh,key):
 cd=mesh.get(key);blk=b.ptr.get(cd.get('layers'));out={}
 if not blk:return out
 size=b.lens[b.types.index('CustomDataLayer')]
 for i in range(cd.get('totlayer')):
  r=b.record(blk,'CustomDataLayer',i*size);out[r.get('name')]=r.dump()
 return out
out={}
for blk in b.blocks:
 if blk['code']!='OB':continue
 o=b.record(blk);name=o.get('id').get('name')[2:]
 if '.' in name:continue
 mesh=b.record(b.ptr[o.get('data')]);v=layers(mesh,'vdata');l=layers(mesh,'ldata');p=layers(mesh,'pdata')
 print(name,'transform',o.get('loc'),o.get('rot'),o.get('size'),'layers',list(v),list(l),list(p))
 pos=list(struct.iter_unpack('<fff',b.ptr[v['position']['data']]['data']))
 loops=list(struct.unpack('<'+'i'*mesh.get('totloop'),b.ptr[l['.corner_vert']['data']]['data']))
 offsets=list(struct.unpack('<'+'i'*(mesh.get('totpoly')+1),b.ptr[mesh.get('poly_offset_indices')]['data']))
 faces=[loops[offsets[i]:offsets[i+1]] for i in range(len(offsets)-1)]
 colors=[]
 col=l.get('Col') or next((val for val in l.values() if val['type'] in [17,47]),None)
 if col:
  raw=b.ptr[col['data']]['data']; colors=list(struct.iter_unpack('<BBBB' if col['type']==17 else '<ffff',raw))
 out[name]={'positions':pos,'faces':faces,'loopColors':colors,'colorType':col['type'] if col else None,'transform':{'loc':o.get('loc'),'rot':o.get('rot'),'scale':o.get('size')}}
 print('vertices',len(pos),'faces',len(faces),'bounds',[(min(a[i] for a in pos),max(a[i] for a in pos)) for i in range(3)])
(root/'assets/tiles-raw.json').write_text(json.dumps(out))
