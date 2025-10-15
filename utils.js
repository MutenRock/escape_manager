// Couleurs & constantes dessin
window.COLORS = {
  white:'#ffffff', black:'#000000', gray:'#d2d2d2',
  blue:'#5c8cff', red:'#f05a5a', green:'#78e678',
  yellow:'#f8e46b', orange:'#ffba73', cyan:'#7fe0e0', wall:'#222'
};
window.CLASS_COLOR = { C: COLORS.gray, B: COLORS.cyan, A: COLORS.orange, S: COLORS.yellow };
window.PRICE = { C: 40, B: 60, A: 90, S: 140 };

// Mapping classe par somme indices (règle utilisateur + hypothèse 30..39 => B)
function classFromSum(sum){
  if (sum <= 9) return 'S';
  if (sum <= 29) return 'A';
  if (sum >= 40 && sum <= 79) return 'B';
  if (sum >= 80 && sum <= 98) return 'C';
  return 'B'; // 30..39 non spécifié -> B
}
function randRoom(){
  const oi = Math.floor(Math.random()*OBJECTS.length);
  const ti = Math.floor(Math.random()*THEMES.length);
  return { name: `${OBJECTS[oi]} - ${THEMES[ti]}`, class: classFromSum(oi+ti) };
}

// Geom utils
function rectsIntersect(a,b){ return (a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y); }
function inflateRect(r,ix,iy){ return {x:r.x-ix, y:r.y-iy, w:r.w+ix*2, h:r.h+iy*2}; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

window.Utils = { classFromSum, randRoom, rectsIntersect, inflateRect, clamp };
