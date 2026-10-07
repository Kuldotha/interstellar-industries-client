export function waterGeometry(B,subdivisions=8){
  const data=new B.VertexData(),positions=[],indices=[];
  const point=(i,j)=>[-1+i/subdivisions+.5*j/subdivisions,-Math.sqrt(3)/2*j/subdivisions,0];
  const triangle=(a,b,c)=>{const index=positions.length/3;positions.push(...a,...b,...c);indices.push(index,index+1,index+2);};
  for(let j=0;j<subdivisions;j++)for(let i=0;i<subdivisions-j;i++){
    triangle(point(i,j),point(i+1,j),point(i,j+1));
    if(i+j<subdivisions-1)triangle(point(i+1,j),point(i+1,j+1),point(i,j+1));
  }
  data.positions=positions;data.indices=indices;
  return data;
}
