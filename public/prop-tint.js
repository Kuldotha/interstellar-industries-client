const variation=seed=>{
  let x=seed>>>0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);
  return ((x^(x>>>15))>>>0)/4294967296;
};
export function propTint(id,kind) {
  const brightness=1+(variation(id^0x53a91)-.5)*(kind===0?.44:.20);
  const warmth=(variation(id^0x92fe3)-.5)*2;
  const shift=kind===0?.16:.035;
  return [brightness*(1+warmth*shift),brightness*(1+warmth*shift*.25),brightness*(1-warmth*shift),1];
}
