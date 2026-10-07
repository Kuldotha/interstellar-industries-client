import struct,re,json
from pathlib import Path
class Blend:
 def __init__(self,path):
  self.raw=Path(path).read_bytes(); self.blocks=[]; self.ptr={}; off=12
  while off<len(self.raw):
   code,size,addr,dna,count=struct.unpack_from('<4sIQII',self.raw,off); off+=24
   data=self.raw[off:off+size]; off+=size
   b=dict(code=code.decode(errors='replace').rstrip('\0'),size=size,addr=addr,dna=dna,count=count,data=data)
   self.blocks.append(b);self.ptr[addr]=b
   if code==b'DNA1': dna_bytes=data
   if code==b'ENDB':break
  d=dna_bytes; i=8
  def strings():
   nonlocal i
   n=struct.unpack_from('<I',d,i)[0];i+=4;out=[]
   for _ in range(n):
    end=d.index(0,i);out.append(d[i:end].decode());i=end+1
   i=(i+3)//4*4;return out
  self.names=strings();assert d[i:i+4]==b'TYPE';i+=4;self.types=strings();assert d[i:i+4]==b'TLEN';i+=4
  self.lens=struct.unpack_from('<'+'H'*len(self.types),d,i);i+=2*len(self.types);i=(i+3)//4*4
  assert d[i:i+4]==b'STRC';i+=4;n=struct.unpack_from('<I',d,i)[0];i+=4;self.structs=[];self.bytype={}
  for _ in range(n):
   t,nf=struct.unpack_from('<HH',d,i);i+=4;fields={};pos=0
   for _ in range(nf):
    ft,fn=struct.unpack_from('<HH',d,i);i+=4;name=self.names[fn];dims=re.findall(r'\[(\d+)\]',name);count=1
    for dim in dims:count*=int(dim)
    size=(8 if '*' in name else self.lens[ft])*count
    key=re.sub(r'\[.*','',name).lstrip('*');fields[key]=(pos,self.types[ft],name,count,size);pos+=size
   self.structs.append((self.types[t],fields));self.bytype[self.types[t]]=fields
   assert pos==self.lens[t],(self.types[t],pos,self.lens[t])
 def record(self,b,typ=None,off=0):return Record(self,b['data'],typ or self.structs[b['dna']][0],off)
class Record:
 def __init__(self,blend,data,typ,off=0):self.b=blend;self.data=data;self.typ=typ;self.off=off
 def get(self,key):
  pos,t,name,n,size=self.b.bytype[self.typ][key];pos+=self.off
  if '*' in name:return struct.unpack_from('<Q',self.data,pos)[0]
  if t in self.b.bytype:return Record(self.b,self.data,t,pos)
  if t=='char' and n>1:return self.data[pos:pos+size].split(b'\0')[0].decode(errors='replace')
  fmt={'int':'i','unsigned int':'I','short':'h','unsigned short':'H','float':'f','double':'d','char':'b','int64_t':'q','uint64_t':'Q','int8_t':'b'}.get(t)
  if fmt:
   vals=struct.unpack_from('<'+fmt*n,self.data,pos);return vals[0] if n==1 else vals
  return self.data[pos:pos+size].hex()
 def dump(self):return {k:(v.dump() if isinstance(v,Record) else v) for k in self.b.bytype[self.typ] for v in [self.get(k)]}
