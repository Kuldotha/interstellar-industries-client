export function fitShoreline(B,parts,names,{coast,water}){
 const unit=.075,oldCoast=Math.sin(.075)*8/unit,oldWater=.04/unit;
 const fit=(part,oldStart,oldEnd,start,end)=>{
  const a=new B.Vector3(...oldStart),b=new B.Vector3(...oldEnd),c=new B.Vector3(...start),d=new B.Vector3(...end),oldAxis=b.subtract(a),axis=d.subtract(c),ratio=axis.length()/oldAxis.length();oldAxis.normalize();axis.normalize();
  const oldUp=B.Vector3.Cross(oldAxis,B.Axis.X).normalize(),up=B.Vector3.Cross(axis,B.Axis.X).normalize();
  const positions=[],normals=[];
  for(let i=0;i<part.positions.length;i+=3){const p=B.Vector3.FromArray(part.positions,i).subtract(a),n=B.Vector3.FromArray(part.normals,i);positions.push(...c.add(B.Axis.X.scale(p.x)).add(up.scale(B.Vector3.Dot(p,oldUp))).add(axis.scale(B.Vector3.Dot(p,oldAxis)*ratio)).asArray());normals.push(...B.Axis.X.scale(n.x).add(up.scale(B.Vector3.Dot(n,oldUp))).add(axis.scale(B.Vector3.Dot(n,oldAxis)/ratio)).normalize().asArray());}
  return {...part,positions,normals};
 };
 return parts.map((part,i)=>{
  const name=names[i];
  if(name==='dock-walkway')return fit(part,[0,.08/unit,.18/unit],[0,.08/unit,oldCoast-.08/unit],[0,.08/unit,.18/unit],[0,.08/unit,coast-.08/unit]);
  if(name==='dock-gangway')return fit(part,[0,.08/unit,oldCoast-.08/unit],[0,oldWater,oldCoast+.11/unit],[0,.08/unit,coast-.08/unit],[0,water,coast+.11/unit]);
  if(['dock-pier','dock-pile','fish-crate'].includes(name))return {...part,positions:part.positions.map((v,k)=>v+(k%3===1?water-oldWater:k%3===2?coast-oldCoast:0))};
  return part;
 });
}
