export const TILE_RADIUS_METERS=10;
export const TILE_RADIUS_UNITS=.75;
export const METERS_TO_TILE_UNITS=TILE_RADIUS_UNITS/TILE_RADIUS_METERS;
export const metersToWorldScale=resolution=>METERS_TO_TILE_UNITS/resolution;
export function scaleModelMatrices(matrices){
 for(let i=0;i<matrices.length;i+=16)for(let column=0;column<3;column++)for(let row=0;row<3;row++)matrices[i+column*4+row]*=METERS_TO_TILE_UNITS;
 return matrices;
}

export const tileCornerOffset=side=>[Math.sin((side+.5)*Math.PI/3)*TILE_RADIUS_METERS,Math.cos((side+.5)*Math.PI/3)*TILE_RADIUS_METERS];
export const tileNeighborOffset=side=>[Math.sin(side*Math.PI/3)*Math.sqrt(3)*TILE_RADIUS_METERS,Math.cos(side*Math.PI/3)*Math.sqrt(3)*TILE_RADIUS_METERS];
