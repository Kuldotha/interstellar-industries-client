export function meadowVariant(value){return value<.018?2:value<.085?1:0;}
export function meadowGeometry(kind){
 const positions=[],normals=[],colors=[],indices=[];
 const triangle=(points,tint)=>{for(const [x,y,z] of points){positions.push(x,y,z);normals.push(0,1,0);colors.push(...tint.map(c=>c*(.94+.06*Math.min(1,y))),1);indices.push(indices.length);}};
 const blade=(a,h,w,tint)=>{const x=Math.cos(a),z=Math.sin(a);triangle([[-z*w,0,x*w],[z*w,0,-x*w],[x*.13,h,z*.13]],tint);};
 if(kind===1){
  for(let i=0;i<3;i++)blade(i*2.4,1.35+i*.23,.025,[1,1,1]);
  for(let i=0;i<3;i++){const a=i*2.4,x=Math.cos(a)*.13,z=Math.sin(a)*.13,h=1.35+i*.23;triangle([[x-.055,h-.28,z],[x+.055,h-.24,z],[x,h+.08,z]],[1.08,1.05,.91]);}
 }else{
  blade(.4,.27,.025,[.34,.49,.2]);blade(2.1,.11,.085,[.39,.55,.24]);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,b=a+.47,c=a-.47;triangle([[.12,.26,.05],[.12+Math.cos(b)*.20,.27,.05+Math.sin(b)*.20],[.12+Math.cos(c)*.20,.27,.05+Math.sin(c)*.20]],[.98,.92,.69]);}
  triangle([[.06,.273,.02],[.18,.273,.02],[.12,.273,.13]],[.94,.63,.15]);
 }
 return {positions,normals,colors,indices};
}
