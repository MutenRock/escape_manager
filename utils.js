window.COLORS = {
  white:'#ffffff', black:'#000000', gray:'#d2d2d2',
  blue:'#5c8cff', red:'#f05a5a', green:'#78e678',
  yellow:'#f8e46b', orange:'#ffba73', cyan:'#7fe0e0', wall:'#222'
};
window.CLASS_COLOR = { C: COLORS.gray, B: COLORS.cyan, A: COLORS.orange, S: COLORS.yellow };
window.PRICE = { C: 40, B: 60, A: 90, S: 140 };

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

function rectsIntersect(a,b){ return (a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y); }
function inflateRect(r,ix,iy){ return {x:r.x-ix, y:r.y-iy, w:r.w+ix*2, h:r.h+iy*2}; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function roundRect(ctx,x,y,w,h,r,fill=true){
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r);
  if (fill) ctx.fill(); else ctx.stroke();
}
function darken(hex, factor=0.25){
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); if(!m) return hex;
  let r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
  r = Math.floor(r*(1-factor)); g = Math.floor(g*(1-factor)); b = Math.floor(b*(1-factor));
  return `#${(r<0?0:r).toString(16).padStart(2,'0')}${(g<0?0:g).toString(16).padStart(2,'0')}${(b<0?0:b).toString(16).padStart(2,'0')}`;
}
function biasedInt(min, max, k=2.2){ const u=Math.random(); const b=1-Math.pow(1-u,k); return Math.round(min + b*(max-min)); }
function fmtTime(t){ const s=Math.max(0,Math.floor(t)); const m=Math.floor(s/60), r=s%60; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`; }

window.Utils = { classFromSum, randRoom, rectsIntersect, inflateRect, clamp, roundRect, darken, biasedInt, fmtTime };
