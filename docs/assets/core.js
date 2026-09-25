/* =====================================================================
   DORABELLA CORE  —  the polar-key cipher engine
   =====================================================================

   THE IDEA (bugfish's snowflake, generalised)

   Elgar's own 1920s notebook diagram draws his alphabet as a CLOCK FACE:
   the glyphs are polar coordinates, radius 1–3 (number of semicircular
   arcs) and angle in steps of pi/4 (8 orientations) = 24 symbols.

   The snowflake grid IS that diagram. So the natural cipher operations are
   the SYMMETRIES OF A POLAR KEY, not arbitrary shuffles:

       Rotate(k)     theta -> theta + k          (the original idea)
       Reflect(a)    theta -> a - theta          (mirror across an axis)
       RingShift(m)  r     -> ((r-1+m) mod 3)+1  (arc count cycles)
       RingPerm(p)   r     -> p(r)               (any of 6 permutations)

   Rotate+Reflect generate the dihedral group D8 (16 elements); with the
   ring permutations that is D8 x S3 = 96 elements. Every one of them is a
   position-INDEPENDENT relabelling EXCEPT when applied on a SCHEDULE —
   and a scheduled operation is what makes this a real cipher rather than
   a renaming.

   WHY THAT MATTERS: a substitution solver absorbs any fixed relabelling of
   the 24 symbols. So a static grid fill, a once-off rotation, "orientation
   is the letter and arcs are a modifier" — all already covered, no test
   needed. Only SCHEDULED symmetry and READING ORDER change what a solver
   sees. That is the entire search space, and it is small enough to sweep.
   ===================================================================== */

(function (root) {
'use strict';

/* ---------- symbols ---------- */
const DIRS = ['n','ne','e','se','s','sw','w','nw'];
const ORD  = {};  DIRS.forEach((d,i)=>ORD[d]=i);
const RINGS = [1,2,3];
const CELLS = [];
for (const r of RINGS) for (let d=0; d<8; d++) CELLS.push([r,d]);

const SYM_RE = /^([123])(n|ne|e|se|s|sw|w|nw)$/i;
function parseSym(t){
  const m = SYM_RE.exec(String(t).trim());
  return m ? [ +m[1], ORD[m[2].toLowerCase()] ] : null;
}
function symName(s){ return s ? s[0] + DIRS[s[1]] : '??'; }
function symKey(s){ return s[0] + '|' + s[1]; }

/* Parse a whole ciphertext block: lines of space-separated symbols. */
function parseBlock(text){
  const lines = [], bad = [];
  for (const raw of String(text).trim().split(/\r?\n+/)){
    const row = [];
    for (const tok of raw.trim().split(/\s+/)){
      if (!tok) continue;
      const s = parseSym(tok);
      if (s) row.push(s); else bad.push(tok);
    }
    if (row.length) lines.push(row);
  }
  return { lines, bad, flat: lines.flat(), lens: lines.map(l=>l.length) };
}

/* ---------- reading order (as an index permutation, so it inverts) ---------- */
const ORDERS = {
  ident:    { label:'as written',           fn:L=>L.flat() },
  revall:   { label:'reversed (whole)',     fn:L=>L.flat().reverse() },
  revlines: { label:'each line reversed',   fn:L=>L.flatMap(l=>[...l].reverse()) },
  boustro:  { label:'boustrophedon',        fn:L=>L.flatMap((l,i)=>i%2?[...l].reverse():l) },
  l321:     { label:'lines 3,2,1',          fn:L=>[...L].reverse().flat() },
  cols:     { label:'columns (interleave)', fn:L=>{
               const out=[], m=Math.max(0,...L.map(l=>l.length));
               for(let c=0;c<m;c++) for(const l of L) if(c<l.length) out.push(l[c]);
               return out; } },
  spiral:   { label:'spiral (out→in)',      fn:L=>{
               /* read line1 L→R, line3 R→L, line2 L→R: a flattened spiral */
               const o=[]; if(L[0])o.push(...L[0]);
               if(L[2])o.push(...[...L[2]].reverse());
               if(L[1])o.push(...L[1]);
               for(let i=3;i<L.length;i++)o.push(...L[i]);
               return o; } },
};
function orderPerm(lens, mode){
  const L=[]; let i=0;
  for(const n of lens){ L.push(Array.from({length:n},(_,x)=>x+i)); i+=n; }
  return (ORDERS[mode]||ORDERS.ident).fn(L);
}
function invertPerm(p){ const q=new Array(p.length); p.forEach((v,i)=>q[v]=i); return q; }

/* ---------- schedules: WHEN the key advances ---------- */
const SCHEDULES = {
  none:   { label:'never (static key)',      tip:'The key never moves. A plain substitution.' },
  every:  { label:'every symbol',            tip:'Advance after each symbol — a progressive-key cipher, period 8.' },
  every2: { label:'every 2 symbols',         tip:'Advance on every second symbol.' },
  every3: { label:'every 3 symbols',         tip:'Advance on every third symbol.' },
  every5: { label:'every 5 symbols',         tip:'Advance on every fifth symbol.' },
  line:   { label:'once per line',           tip:'Advance only at a line break — three key states total.' },
  word:   { label:'every 5 (word-ish)',      tip:'Stand-in for word boundaries, which Dorabella does not mark.' },
  repeat: { label:'on a repeated symbol',    tip:'Advance only when a symbol equals the one before it. Irregular — this is the variant the orientation test cannot rule out.' },
  ring:   { label:'on an arc-count change',  tip:'Advance when the number of arcs changes. Irregular, driven by the text itself.' },
  mirror: { label:'on a 180° mirrored pair', tip:'Advance when two consecutive same-ring symbols face opposite ways. Dorabella has 10 of these (p=0.03) — far more than chance.' },
};
function advance(sched, i, sym, prev){
  switch(sched){
    case 'every':  return 1;
    case 'every2': return (i+1)%2===0 ?1:0;
    case 'every3': return (i+1)%3===0 ?1:0;
    case 'every5': case 'word': return (i+1)%5===0 ?1:0;
    case 'repeat': return (prev && prev[0]===sym[0] && prev[1]===sym[1]) ?1:0;
    case 'ring':   return (prev && prev[0]!==sym[0]) ?1:0;
    case 'mirror': return (prev && prev[0]===sym[0] &&
                           ((prev[1]-sym[1])%8+8)%8===4) ?1:0;
    default:       return 0;                       /* 'none', 'line' handled outside */
  }
}

/* ---------- the symmetry group element applied at step k ---------- */
const RINGPERMS = {
  id:   { label:'identity',      p:[1,2,3] },
  cyc:  { label:'cycle 1→2→3',   p:[2,3,1] },
  cyc2: { label:'cycle 1→3→2',   p:[3,1,2] },
  sw12: { label:'swap 1↔2',      p:[2,1,3] },
  sw23: { label:'swap 2↔3',      p:[1,3,2] },
  sw13: { label:'swap 1↔3',      p:[3,2,1] },
};

/* order of a ring permutation: 1 (identity), 2 (a swap), 3 (a 3-cycle) */
function permOrder(p){
  let q=[1,2,3], n=0;
  do { q = q.map(x=>p[x-1]); n++; } while (!(q[0]===1&&q[1]===2&&q[2]===3) && n<6);
  return n;
}
function permPow(p, t){                 /* p applied t times (t may be negative) */
  const ord = permOrder(p);
  t = ((t % ord) + ord) % ord;
  let q=[1,2,3];
  for (let i=0;i<t;i++) q = q.map(x=>p[x-1]);
  return q;
}
function ringTimes(k, spec){
  if (!spec.ring || spec.ring==='id') return 0;
  return spec.ringEvery ? Math.floor(k/spec.ringEvery) : k;
}

/* FORWARD op for step k: base cell -> cipher symbol.
   Order of application: reflect, then rotate, then ring-permute.
   spec = {step, dir, reflect, axis, reflectEvery, ring, ringEvery}        */
function opForward(cell, k, spec){
  let r = cell[0], d = cell[1];
  if (spec.reflect && k % (spec.reflectEvery||1) === 0)
    d = (((spec.axis||0) - d) % 8 + 8) % 8;
  d = ((d + spec.dir*spec.step*k) % 8 + 8) % 8;
  const t = ringTimes(k, spec);
  if (t) r = permPow(RINGPERMS[spec.ring].p, t)[r-1];
  return [r,d];
}
/* INVERSE op: cipher symbol -> base cell. Undo in the opposite order. */
function opInverse(sym, k, spec){
  let r = sym[0], d = sym[1];
  const t = ringTimes(k, spec);
  if (t) r = permPow(RINGPERMS[spec.ring].p, -t)[r-1];
  d = ((d - spec.dir*spec.step*k) % 8 + 8) % 8;
  if (spec.reflect && k % (spec.reflectEvery||1) === 0)
    d = (((spec.axis||0) - d) % 8 + 8) % 8;   /* reflection is its own inverse */
  return [r,d];
}

function defaultSpec(){
  return { step:1, dir:1, sched:'none', reflect:false, axis:0,
           reflectEvery:1, ring:'id', ringEvery:0 };
}

/* ---------- convention relabelling ----------
   Re-express a symbol stream as it WOULD have been transcribed under a
   different naming convention: d -> (mirror ? -d : d) + offset.

   This is a GLOBAL relabelling of the 24 names, so every statistic that
   matters is invariant under it (orientation chi2 only permutes its bins;
   mirrored pairs are defined by a difference mod 8, which both rotation and
   reflection preserve; IC and entropy depend only on the partition). It is
   provided so you can regenerate the transcription text under whichever
   convention matches the manuscript you are reading — not because it moves
   the analysis. core.test.js asserts the invariance.                      */
function relabel(cells, offset, mirror){
  offset = offset|0;
  return cells.map(([r,d]) => [r, (((mirror ? -d : d) + offset) % 8 + 8) % 8]);
}

/* ---------- the two pipelines ---------- */

/* DECIPHER: symbols on the page -> plaintext letters.
   Phase 2 sequences, phase 3 UNWINDS the scheduled symmetry (inverse op). */
function unwind(seq, lineOf, spec){
  const out=[]; let k=0, prev=null;
  for (let i=0;i<seq.length;i++){
    out.push(opInverse(seq[i], k, spec));
    if (spec.sched==='line'){
      if (lineOf && i+1<lineOf.length && lineOf[i+1]!==lineOf[i]) k++;
    } else k += advance(spec.sched, i, seq[i], prev);
    prev = seq[i];
  }
  return out;
}

/* ENCIPHER: plaintext letters -> symbols. Phase 3 APPLIES the symmetry. */
function wind(cells, lineOf, spec){
  const out=[]; let k=0, prev=null;
  for (let i=0;i<cells.length;i++){
    if (!cells[i]){ out.push(null); prev=null; continue; }
    const sym = opForward(cells[i], k, spec);
    out.push(sym);
    if (spec.sched==='line'){
      if (lineOf && i+1<lineOf.length && lineOf[i+1]!==lineOf[i]) k++;
    } else k += advance(spec.sched, i, sym, prev);
    prev = sym;
  }
  return out;
}

/* ---------- key grid ---------- */
const FILLS = {
  elgar: { label:"Elgar / original snowflake.html",
    map:{ '3|7':'A','3|0':'B','3|1':'C', '2|7':'G','2|0':'H','2|1':'I',
          '1|7':'N','1|0':'O','1|1':'P', '3|6':'U','2|6':'V','1|6':'W',
          '1|2':'X','2|2':'Y','3|2':'Z', '1|5':'R','1|4':'S','1|3':'T',
          '2|5':'K','2|4':'L','2|3':'M', '3|5':'D','3|4':'E','3|3':'F' } },
  ax:    { label:'A–X, ring-major', map:(()=>{ const m={},L='ABCDEFGHIJKLMNOPQRSTUVWX';
             let i=0; for(const c of CELLS) m[symKey(c)]=L[i++]; return m; })() },
  spiral:{ label:'A–X, spiral from centre', map:(()=>{ const m={},L='ABCDEFGHIJKLMNOPQRSTUVWX';
             let i=0; for(const r of [1,2,3]) for(let d=0;d<8;d++) m[r+'|'+d]=L[i++];
             return m; })() },
};
function invertKey(key){ const m={}; for(const k in key){ const v=key[k];
  if(v && !(v in m)) m[v]=k; } return m; }

function applyKey(cells, key){
  return cells.map(c => c ? (key[symKey(c)] || '·') : '·').join('');
}

/* ---------- top-level convenience ---------- */
function decipher(block, opts){
  const perm   = orderPerm(block.lens, opts.order||'ident');
  const lineOf = []; block.lens.forEach((n,i)=>{ for(let j=0;j<n;j++) lineOf.push(i); });
  const seq    = perm.map(i=>block.flat[i]);
  const seqLine= perm.map(i=>lineOf[i]);
  const cells  = unwind(seq, seqLine, opts.spec||defaultSpec());
  return { perm, seq, cells, text: applyKey(cells, opts.key||{}) };
}
function encipher(text, lens, opts){
  const key  = opts.key||{}, inv = invertKey(key);
  const letters = String(text).toUpperCase().replace(/[^A-Z]/g,'').split('');
  const kept = letters.filter(c=>inv[c]);
  const dropped = [...new Set(letters.filter(c=>!inv[c]))];
  const useLens = (lens && lens.reduce((a,b)=>a+b,0)===kept.length) ? lens : [kept.length];
  const perm   = orderPerm(useLens, opts.order||'ident');
  const lineOf = []; useLens.forEach((n,i)=>{ for(let j=0;j<n;j++) lineOf.push(i); });
  const cells  = kept.map(c=>{ const s=inv[c]; const [r,d]=s.split('|'); return [+r,+d]; });
  const syms   = wind(cells, perm.map(i=>lineOf[i]), opts.spec||defaultSpec());
  const flat   = new Array(kept.length).fill(null);
  perm.forEach((p,i)=>{ flat[p]=syms[i]; });
  return { flat, lens:useLens, kept:kept.join(''), dropped };
}

root.Dorabella = {
  DIRS, ORD, RINGS, CELLS, ORDERS, SCHEDULES, RINGPERMS, FILLS,
  parseSym, symName, symKey, parseBlock, orderPerm, invertPerm,
  opForward, opInverse, defaultSpec, relabel, unwind, wind, applyKey, invertKey,
  decipher, encipher, advance,
};
})(typeof window!=='undefined' ? window : globalThis);
