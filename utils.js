// Couleurs / prix / classes
window.COLORS = {
  white:'#ffffff', black:'#000000', gray:'#d2d2d2',
  blue:'#5c8cff', red:'#f05a5a', green:'#78e678',
  yellow:'#f8e46b', orange:'#ffba73', cyan:'#7fe0e0', wall:'#222'
};
window.CLASS_COLOR = { C: COLORS.gray, B: COLORS.cyan, A: COLORS.orange, S: COLORS.yellow };
window.PRICE = { C: 40, B: 60, A: 90, S: 140 };

// Règle classes via somme des indices (avec 30..39 -> B par hypothèse)
function classFromSum(sum){
  if (sum <= 9) return 'S';
  if (sum <= 29) return 'A';
  if (sum >= 40 && sum <= 79) return 'B';
  if (sum >= 80 && sum <= 98) return 'C';
  return 'B';
}
function randRoom(){
  const oi = Math.floor(Math.random()*OBJECTS.length);
  const ti = Math.floor(Math.random()*THEMES.length);
  return { name: `${OBJECTS[oi]} - ${THEMES[ti]}`, class: classFromSum(oi+ti) };
}

// Géo utils
function rectsIntersect(a,b){ return (a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y); }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function inflateRect(r,ix,iy){ return {x:r.x-ix, y:r.y-iy, w:r.w+ix*2, h:r.h+iy*2}; }

// Dessin util
function roundRect(ctx,x,y,w,h,r,fill=true){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  if (fill) ctx.fill(); else ctx.stroke();
}

window.Utils = { classFromSum, randRoom, rectsIntersect, inflateRect, clamp, roundRect };
