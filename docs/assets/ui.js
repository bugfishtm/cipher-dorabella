/* =====================================================================
   DORABELLA UI  —  glyph rendering, key diagrams, legend
   =====================================================================

   GLYPH CONVENTION
   ----------------
   A semicircular arc has two features that could "name" it:

       the APEX     — the convex point, the tip of the cup
       the OPENING  — the gap side, opposite the apex

   Elgar's manuscript does not tell us which one his direction names refer
   to, and a transcriber can legitimately anchor on either — or on a
   quarter-turn from either. So the convention is a SETTING, not a constant.

   IMPORTANT, and worth stating plainly: every convention here is a GLOBAL
   RELABELLING of the 24 symbols (a rotation and/or reflection of the whole
   name space). The substitution solver absorbs any global relabelling, and
   the key-free statistics are invariant under it too:

       - orientation chi2 only permutes its bins
       - mirrored-pair counts use (d_i - d_j) mod 8 == 4, and both rotation
         and reflection preserve that difference

   So changing the convention changes the PICTURE and the names you would
   write down — it does not change any conclusion. Its real job is letting
   you eyeball the rendered glyphs against the manuscript and confirm the
   transcription is the one you meant.

   The snowflake key geometry is untouched by all of this: arm = orientation
   index, ring = arc count, exactly as before.
   ===================================================================== */
(function (root) {
'use strict';
const D = root.Dorabella;

/* ---------- conventions ---------- */
/* effective apex angle = ((mirror ? -d : d) + offset) * 45 degrees        */
const CONVENTIONS = {
  pointed:      { label:'pointed — apex points at the named direction',
                  offset:0, mirror:false,
                  tip:'The convex tip of the cup points the way it is named. <b>2e</b> = a two-arc cup bulging east, opening west.' },
  opening:      { label:'opening — the gap faces the named direction',
                  offset:4, mirror:false,
                  tip:'The open side faces the way it is named. <b>2e</b> = a two-arc cup opening east, bulging west. This is the exact opposite of <i>pointed</i>.' },
  antipointed:  { label:'anti-pointed — apex opposite the name',
                  offset:4, mirror:false,
                  tip:'Identical in effect to <i>opening</i>: if the apex points away from the name, the opening points at it. Kept as a separate entry because people mean it as a different idea.' },
  pointed_cw:   { label:'pointed +90° — apex a quarter-turn clockwise',
                  offset:2, mirror:false,
                  tip:'Apex sits 90° clockwise of the name. Under this, a cup <b>opening west</b> is called <b>n</b>.' },
  pointed_ccw:  { label:'pointed −90° — apex a quarter-turn anticlockwise',
                  offset:6, mirror:false,
                  tip:'Apex sits 90° anticlockwise of the name.' },
  mirrored:     { label:'mirrored — handedness flipped',
                  offset:0, mirror:true,
                  tip:'Reflects the direction index (d → −d) before drawing. Use if your transcription numbered the arms anticlockwise instead of clockwise.' },
  mirror_open:  { label:'mirrored + opening',
                  offset:4, mirror:true,
                  tip:'Reflected handedness with the opening anchoring the name.' },
  custom:       { label:'custom — set offset and mirror by hand',
                  offset:0, mirror:false,
                  tip:'Free control: pick any 45° offset and toggle handedness.' },
};

/* ---------- glyph styles ---------- */
const STYLES = {
  arcs:   { label:'concentric arcs (cups)',
            tip:'r nested semicircles. The usual reading of the manuscript.' },
  eshape: { label:'rotated E (Elgar’s "EE")',
            tip:'The Cipher Foundation describes the key as "3 versions each of 8 rotated E-shapes", likely a pun on Edward Elgar’s initials. Same 24 symbols, drawn as a spine with r prongs.' },
  bars:   { label:'bars — spine with r ticks',
            tip:'A minimal rendering: one spine along the direction with r cross-ticks. Useful when the cups are hard to tell apart at small sizes.' },
  wedge:  { label:'wedge — filled sector',
            tip:'A filled sector of r/3 radius. Fast to scan when comparing long rows.' },
};

function resolveConv(conv){
  if (!conv) return { offset:0, mirror:false, style:'arcs' };
  const base = CONVENTIONS[conv.name] || CONVENTIONS.pointed;
  return {
    offset: conv.name === 'custom' ? (conv.offset|0) : base.offset,
    mirror: conv.name === 'custom' ? !!conv.mirror : base.mirror,
    style:  conv.style || 'arcs',
  };
}
/* the on-screen apex angle, in radians, for direction index d */
function apexAngle(d, c){
  const e = (((c.mirror ? -d : d) + c.offset) % 8 + 8) % 8;
  return e * 45 * Math.PI / 180;
}

/* ---------- path builders ---------- */
function pathArcs(r, base, S){
  let p = '';
  for (let i=1;i<=r;i++){
    const rad = S*0.115*i + S*0.055;
    const a1 = base - Math.PI/2, a2 = base + Math.PI/2;
    const c = S/2;
    p += `M${(c+rad*Math.cos(a1)).toFixed(2)} ${(c+rad*Math.sin(a1)).toFixed(2)} `
       + `A${rad.toFixed(2)} ${rad.toFixed(2)} 0 0 1 `
       + `${(c+rad*Math.cos(a2)).toFixed(2)} ${(c+rad*Math.sin(a2)).toFixed(2)} `;
  }
  return p;
}
function pathE(r, base, S){
  /* spine perpendicular to `base`, r prongs pointing along `base` */
  const c = S/2, L = S*0.34, P = S*0.24;
  const ux = Math.cos(base), uy = Math.sin(base);      /* along the apex dir */
  const vx = -Math.sin(base), vy = Math.cos(base);     /* along the spine    */
  const sx = c - ux*P*0.55, sy = c - uy*P*0.55;        /* spine sits behind  */
  let p = `M${(sx-vx*L).toFixed(2)} ${(sy-vy*L).toFixed(2)} `
        + `L${(sx+vx*L).toFixed(2)} ${(sy+vy*L).toFixed(2)} `;
  for (let i=0;i<r;i++){
    const t = r===1 ? 0 : (-1 + 2*i/(r-1));            /* -1 .. +1 along spine */
    const bx = sx + vx*L*t, by = sy + vy*L*t;
    p += `M${bx.toFixed(2)} ${by.toFixed(2)} L${(bx+ux*P).toFixed(2)} ${(by+uy*P).toFixed(2)} `;
  }
  return p;
}
function pathBars(r, base, S){
  const c = S/2, L = S*0.33, W = S*0.13;
  const ux = Math.cos(base), uy = Math.sin(base);
  const vx = -Math.sin(base), vy = Math.cos(base);
  let p = `M${(c-ux*L).toFixed(2)} ${(c-uy*L).toFixed(2)} `
        + `L${(c+ux*L).toFixed(2)} ${(c+uy*L).toFixed(2)} `;
  for (let i=0;i<r;i++){
    const t = -L*0.55 + (r===1?0:(i/(r-1))*L*1.1);
    const bx = c+ux*t, by = c+uy*t;
    p += `M${(bx-vx*W).toFixed(2)} ${(by-vy*W).toFixed(2)} `
       + `L${(bx+vx*W).toFixed(2)} ${(by+vy*W).toFixed(2)} `;
  }
  return p;
}
function pathWedge(r, base, S){
  const c = S/2, rad = S*0.13*r + S*0.08;
  const a1 = base - Math.PI/3, a2 = base + Math.PI/3;
  return `M${c} ${c} L${(c+rad*Math.cos(a1)).toFixed(2)} ${(c+rad*Math.sin(a1)).toFixed(2)} `
       + `A${rad.toFixed(2)} ${rad.toFixed(2)} 0 0 1 `
       + `${(c+rad*Math.cos(a2)).toFixed(2)} ${(c+rad*Math.sin(a2)).toFixed(2)} Z`;
}

function glyphPath(r, d, size, conv){
  const c = resolveConv(conv), base = apexAngle(d, c);
  switch (c.style){
    case 'eshape': return pathE(r, base, size);
    case 'bars':   return pathBars(r, base, size);
    case 'wedge':  return pathWedge(r, base, size);
    default:       return pathArcs(r, base, size);
  }
}
function isFilled(conv){ return resolveConv(conv).style === 'wedge'; }

function glyphSVG(r, d, size, conv, color){
  const fill = isFilled(conv);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
       + `<path d="${glyphPath(r,d,size,conv)}" `
       + (fill ? `fill="${color||'currentColor'}" stroke="none"`
               : `fill="none" stroke="${color||'currentColor'}" `
                 +`stroke-width="${Math.max(1.2,size*0.055)}" stroke-linecap="round"`)
       + `/></svg>`;
}

/* ---------- ciphertext as glyph rows ---------- */
function renderGlyphs(el, lines, letters, opts){
  opts = opts || {};
  const S = opts.size || 30, GAP = 6;
  const LH = S + (opts.showLetters === false ? 8 : 20);
  const conv = opts.conv, fill = isFilled(conv);
  const sw = Math.max(1.3, S*0.055);
  let idx = 0, html = '';
  const cols = Math.max(1, ...lines.map(l=>l.length));
  html += `<svg width="${cols*(S+GAP)}" height="${lines.length*LH+6}">`;
  lines.forEach((line, li) => {
    line.forEach((sym, ci) => {
      const x = ci*(S+GAP), y = li*LH;
      const hi = opts.mark && opts.mark(idx);
      const col = hi ? 'var(--accent)' : (opts.color || 'var(--ink)');
      html += `<g transform="translate(${x},${y})">`;
      if (hi) html += `<rect x="-2" y="-2" width="${S+4}" height="${S+4}" rx="2" `
                    + `fill="none" stroke="var(--accent)" stroke-width="1"/>`;
      html += `<path d="${glyphPath(sym[0],sym[1],S,conv)}" `
            + (fill ? `fill="${col}" stroke="none"`
                    : `fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"`)
            + `/>`;
      if (opts.showLetters !== false && letters && letters[idx])
        html += `<text x="${S/2}" y="${S+14}" text-anchor="middle" font-size="12.5" `
              + `font-family="monospace" font-weight="700" fill="var(--accent)">${letters[idx]}</text>`;
      if (opts.showNames)
        html += `<text x="${S/2}" y="${S+14}" text-anchor="middle" font-size="10.5" `
              + `font-family="monospace" font-weight="700" fill="var(--dim)">${D.symName(sym)}</text>`;
      html += `</g>`;
      idx++;
    });
  });
  el.innerHTML = html + '</svg>';
}

/* ---------- the legend: all 24 glyphs with their names ---------- */
function renderLegend(el, conv, opts){
  opts = opts || {};
  const S = opts.size || 34, GAP = 8, fill = isFilled(conv);
  const sw = Math.max(1.3, S*0.055);
  let h = `<svg width="${8*(S+GAP)+8}" height="${3*(S+20)+6}">`;
  for (let ri=0; ri<3; ri++){
    for (let d=0; d<8; d++){
      const r = ri+1, x = d*(S+GAP)+4, y = ri*(S+20);
      h += `<g transform="translate(${x},${y})">`
        +  `<path d="${glyphPath(r,d,S,conv)}" `
        +  (fill ? `fill="var(--accent2)" stroke="none"`
                 : `fill="none" stroke="var(--accent2)" stroke-width="${sw}" stroke-linecap="round"`)
        +  `/>`
        +  `<text x="${S/2}" y="${S+13}" text-anchor="middle" font-size="10.5" `
        +  `font-family="monospace" font-weight="700" fill="var(--dim)">${r}${D.DIRS[d]}</text></g>`;
    }
  }
  el.innerHTML = h + '</svg>';
}

/* ---------- the polar key (Elgar's clock face) ---------- */
function renderKeyDial(el, key, opts){
  opts = opts || {};
  const R = opts.size || 300, c = R/2;
  const radii = [R*0.16, R*0.27, R*0.39];
  let h = `<svg width="${R}" height="${R}" viewBox="0 0 ${R} ${R}" class="dial">`;
  for (const rad of radii)
    h += `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
  for (let d=0; d<8; d++){
    const a = d*45*Math.PI/180;
    h += `<line x1="${c+radii[0]*0.45*Math.cos(a)}" y1="${c+radii[0]*0.45*Math.sin(a)}" `
       + `x2="${c+(radii[2]+R*0.07)*Math.cos(a)}" y2="${c+(radii[2]+R*0.07)*Math.sin(a)}" `
       + `stroke="var(--line)" stroke-width="1"/>`;
    h += `<text x="${c+(radii[2]+R*0.105)*Math.cos(a)}" y="${c+(radii[2]+R*0.105)*Math.sin(a)+4}" `
       + `text-anchor="middle" font-size="11.5" font-weight="700" fill="var(--dim)" `
       + `font-family="monospace">${D.DIRS[d]}</text>`;
  }
  h += `<circle cx="${c}" cy="${c}" r="${R*0.042}" fill="var(--accent)" opacity=".3"/>`;
  for (let ri=0; ri<3; ri++) for (let d=0; d<8; d++){
    const r = ri+1, a = d*45*Math.PI/180;
    const x = c+radii[ri]*Math.cos(a), y = c+radii[ri]*Math.sin(a);
    const k = r+'|'+d, L = key[k]||'';
    const hi = opts.highlight && opts.highlight.has && opts.highlight.has(k);
    h += `<g class="cell" data-k="${k}" transform="translate(${x},${y})">`
       + `<circle r="${R*0.038}" fill="${hi?'var(--accent)':'var(--panel3)'}" `
       + `stroke="${hi?'var(--accent)':'var(--line2)'}" stroke-width="1"/>`
       + `<text y="4" text-anchor="middle" font-size="${R*0.045}" font-weight="700" `
       + `font-family="monospace" fill="${hi?'#180d02':'var(--accent2)'}">${L}</text></g>`;
  }
  el.innerHTML = h + `</svg>`;
}

/* ---------- the 7x7 snowflake grid (unchanged geometry) ---------- */
const LAYOUT = (()=>{ const m={};
  for (let r=1;r<=3;r++){
    m[(3-r)+','+3]=[r,0];      m[(3+r)+','+3]=[r,4];
    m[3+','+(3+r)]=[r,2];      m[3+','+(3-r)]=[r,6];
    m[(3-r)+','+(3+r)]=[r,1];  m[(3+r)+','+(3+r)]=[r,3];
    m[(3+r)+','+(3-r)]=[r,5];  m[(3-r)+','+(3-r)]=[r,7];
  } return m; })();

function renderGrid(el, key, onEdit){
  let h='<table class="grid">';
  for (let row=0; row<7; row++){
    h+='<tr>';
    for (let col=0; col<7; col++){
      if (row===3&&col===3){ h+='<td class="on hub" title="key centre"></td>'; continue; }
      const c = LAYOUT[row+','+col];
      if (!c){ h+='<td></td>'; continue; }
      h += `<td class="on"><input maxlength="1" data-k="${c[0]}|${c[1]}" `
         + `title="${c[0]} arc${c[0]>1?'s':''}, direction ${D.DIRS[c[1]]}">`
         + `<span class="tag">${c[0]}${D.DIRS[c[1]]}</span></td>`;
    }
    h+='</tr>';
  }
  el.innerHTML = h+'</table>';
  el.querySelectorAll('input').forEach(i=>{
    i.value = key[i.dataset.k]||'';
    i.addEventListener('input', ()=>onEdit(i.dataset.k, i.value.toUpperCase()));
  });
}
function syncGrid(el, key){
  el.querySelectorAll('input').forEach(i=>{ i.value = key[i.dataset.k]||''; });
}

function tip(text){
  return `<span class="tip" tabindex="0"><span class="tip-i"></span>`
       + `<span class="tip-b">${text}</span></span>`;
}

root.DorUI = { CONVENTIONS, STYLES, resolveConv, apexAngle,
               glyphPath, glyphSVG, renderGlyphs, renderLegend,
               renderKeyDial, renderGrid, syncGrid, tip, LAYOUT };
})(typeof window!=='undefined' ? window : globalThis);
