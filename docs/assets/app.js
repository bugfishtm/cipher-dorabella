/* Dorabella investigation — shared behaviour.
   Every block is feature-detected, so one script serves every page.
   The cipher engine (core.js) and the glyph renderer (ui.js) are the same
   files the toolkit is built from; nothing here re-implements them. */
"use strict";
const NL = String.fromCharCode(10);
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const D = window.Dorabella, U = window.DorUI, DATA = window.DORA;

/* ---------- keys the site offers ---------- */
const FILLS = {
  snowflake: { label: "my snowflake fill (no J, Q)", map: D.FILLS.elgar.map },
  published: { label: "published reading’s key", map: DATA.publishedKey },
  ax:        { label: "A–X, ring by ring", map: D.FILLS.ax.map },
};
/* My transcription names a glyph by the side it OPENS towards (the note's "ε"
   opens east: 2e). ui.js measures angles from screen-right, so its "pointed +90°"
   setting is the one that draws cups the way they look on the manuscript; its
   E-shape prongs point the other way, hence offset 6 for that style. Global
   relabellings only — no statistic changes (core.test.js asserts it). */
const CUPS   = { name: "pointed_cw", style: "arcs" };
const ESHAPE = { name: "custom", offset: 6, mirror: false, style: "eshape" };
const convFor = style => style === "eshape" ? ESHAPE : { name: "pointed_cw", style: style || "arcs" };

/* the 24-cell key as a clock face, north at the top like the snowflake grid
   (ui.js's own dial puts north at the right) */
function renderDial(el, key, size){
  const R=size||300, c=R/2, radii=[R*0.16, R*0.27, R*0.39], f=n=>n.toFixed(1);
  const pt=(r,d)=>{ const a=d*Math.PI/4; return [c+r*Math.sin(a), c-r*Math.cos(a)]; };
  let h=`<svg class="dial" width="${R}" height="${R}" viewBox="0 0 ${R} ${R}" role="img" aria-label="The 24-cell key drawn as a clock face">`;
  for(const rad of radii) h+=`<circle cx="${c}" cy="${c}" r="${f(rad)}" fill="none" stroke="var(--line2)" stroke-width="1"/>`;
  for(let d=0; d<8; d++){
    const [x1,y1]=pt(radii[0]*0.45,d), [x2,y2]=pt(R*0.43,d), [tx,ty]=pt(R*0.465,d);
    h+=`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="var(--line2)" stroke-width="1"/>`
      +`<text x="${f(tx)}" y="${f(ty)}" text-anchor="middle" dominant-baseline="central" font-size="11.5" font-weight="700" font-family="monospace" fill="var(--ink2)">${D.DIRS[d]}</text>`;
  }
  h+=`<circle cx="${c}" cy="${c}" r="${f(R*0.042)}" fill="var(--acc)" opacity=".35"/>`;
  for(let ri=0; ri<3; ri++) for(let d=0; d<8; d++){
    const [x,y]=pt(radii[ri],d), L=key[(ri+1)+"|"+d]||"";
    h+=`<g transform="translate(${f(x)},${f(y)})"><circle r="${f(R*0.038)}" fill="var(--panel3)" stroke="var(--line2)" stroke-width="1"/>`
      +`<text text-anchor="middle" dominant-baseline="central" font-size="${f(R*0.045)}" font-weight="700" font-family="monospace" fill="var(--acc2)">${L}</text></g>`;
  }
  el.innerHTML=h+"</svg>";
}

function blockOf(name){ return D.parseBlock(DATA.readings[name] || DATA.readings.resolved); }
function linesOf(flat, lens){ const out=[]; let i=0; for(const n of lens){ out.push(flat.slice(i,i+n)); i+=n; }
  if(i<flat.length) out.push(flat.slice(i)); return out; }
function opts(el, obj, val, lab){ el.innerHTML = Object.keys(obj).map(k =>
  `<option value="${k}">${esc(lab ? lab(obj[k],k) : obj[k].label)}</option>`).join(""); if(val) el.value = val; }

/* ============================ NAVIGATION ============================ */
function initNav(){
  const side=$("#side"), tog=$("#navtoggle"), scrim=$("#scrim"), close=$("#navclose");
  const set=o=>{ if(!side) return;
    side.classList.toggle("open",o); if(scrim) scrim.classList.toggle("on",o);
    if(tog) tog.setAttribute("aria-expanded",o?"true":"false"); };
  if(tog) tog.addEventListener("click",()=>set(!side.classList.contains("open")));
  if(close) close.addEventListener("click",()=>set(false));
  if(scrim) scrim.addEventListener("click",()=>set(false));
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") set(false); });
  const page=document.body.dataset.page;
  $$("#side .navlist a").forEach(a=>{ if((a.getAttribute("href")||"")===page) a.classList.add("on"); });
  const meta=$("#sidestat");
  if(meta){ const b=blockOf("resolved"), st=stats(b.flat);
    meta.innerHTML='<span class="statusdot"></span>UNSOLVED since 1897<br><b>'+b.flat.length
      +'</b> glyphs &middot; <b>'+st.distinct+'</b> of 24 used<br>regular rotation <b>ruled out</b>'; }
}

/* ============================ STATISTICS ============================ */
function stats(flat){
  const n=flat.length, keys=flat.map(D.symKey), cnt={};
  keys.forEach(k=>cnt[k]=(cnt[k]||0)+1);
  let ic=0; for(const v of Object.values(cnt)) ic+=v*(v-1); ic = n>1 ? ic/(n*(n-1)) : 0;
  let H=0; for(const v of Object.values(cnt)){ const p=v/n; H-=p*Math.log2(p); }
  const dirs=new Array(8).fill(0), rings=[0,0,0]; flat.forEach(s=>{ dirs[s[1]]++; rings[s[0]-1]++; });
  const e=n/8; let chi=0; dirs.forEach(o=>chi+=(o-e)*(o-e)/e);
  const ang=new Array(8).fill(0); let mirror=0, doubles=0;
  for(let i=0;i+1<n;i++){
    if(keys[i]===keys[i+1]) doubles++;
    if(flat[i][0]===flat[i+1][0]){ const a=((flat[i][1]-flat[i+1][1])%8+8)%8; ang[a]++; if(a===4) mirror++; } }
  const bg={}; for(let i=0;i+1<n;i++){ const k=keys[i]+">"+keys[i+1]; bg[k]=(bg[k]||0)+1; }
  let rep=0; for(const v of Object.values(bg)) if(v>1) rep+=v-1;
  const unused=D.CELLS.filter(c=>!cnt[D.symKey(c)]).map(D.symName);
  return { n, cnt, ic, H, dirs, rings, chi, exp:e, ang, mirror, doubles, rep,
           distinct:Object.keys(cnt).length, unused };
}
/* Sukhotin's vowel algorithm — a port of lab/analysis.py, same tie-break */
function sukhotin(flat){
  const seq=flat.map(D.symName), uniq=Array.from(new Set(seq)).sort(), k=uniq.length;
  const idx={}; uniq.forEach((s,i)=>idx[s]=i);
  const A=Array.from({length:k},()=>new Array(k).fill(0));
  for(let i=0;i+1<seq.length;i++){ const a=idx[seq[i]], b=idx[seq[i+1]]; if(a!==b){ A[a][b]++; A[b][a]++; } }
  const rows=A.map(r=>r.reduce((x,y)=>x+y,0)), alive=new Set(uniq.map((_,i)=>i)), v=[];
  while(alive.size){
    let best=-1; for(const i of alive) if(best<0||rows[i]>rows[best]) best=i;
    if(rows[best]<=0) break;
    v.push(uniq[best]); alive.delete(best);
    for(const j of alive) rows[j]-=2*A[best][j];
  }
  return v;
}
/* crib pattern test — a port of lab/crib.py consistent() */
function cribPositions(keys, crib){
  const out=[];
  for(let p=0;p+crib.length<=keys.length;p++){
    const s2l={}, l2s={}; let ok=true;
    for(let i=0;i<crib.length&&ok;i++){ const s=keys[p+i], c=crib[i];
      if(s in s2l && s2l[s]!==c) ok=false; if(c in l2s && l2s[c]!==s) ok=false;
      s2l[s]=c; l2s[c]=s; }
    if(ok) out.push(p);
  }
  return out;
}
function barRows(rows, max, expAt){
  return '<div class="bars">'+rows.map(r=>{
    const w=max?Math.round(100*r.v/max):0;
    const ex=(expAt!=null&&max)?`<span class="exp" style="left:${(100*expAt/max).toFixed(1)}%"></span>`:"";
    return `<span class="k">${esc(r.k)}</span><span class="bar"><i class="${r.c||""}" style="width:${w}%"></i>${ex}</span><span class="v">${esc(r.label!=null?r.label:r.v)}</span>`;
  }).join("")+'</div>';
}

/* ============================ STATIC RENDERS ============================ */
function initRenders(){
  $$("[data-ct]").forEach(el=>{
    const b=blockOf(el.dataset.ct||"resolved"), size=+(el.dataset.size||26);
    const mark=(el.dataset.mark||"").split(",").filter(Boolean).map(Number);
    let letters=null;
    if(el.dataset.letters){ const f=FILLS[el.dataset.letters]; letters=D.applyKey(b.flat, f.map); }
    U.renderGlyphs(el, b.lines, letters, { size, conv: convFor(el.dataset.style),
      showLetters: !!letters, showNames: el.dataset.names==="1",
      mark: mark.length ? (i=>mark.includes(i)) : null });
  });
  $$("[data-legend]").forEach(el=>{
    U.renderLegend(el, convFor(el.dataset.legend), { size: +(el.dataset.size||34) });
  });
  $$("[data-dial]").forEach(el=>{
    renderDial(el, (FILLS[el.dataset.dial]||FILLS.snowflake).map, +(el.dataset.size||300));
  });
  $$("[data-grid]").forEach(el=>{
    U.renderGrid(el, (FILLS[el.dataset.grid]||FILLS.snowflake).map, function(){});
    el.querySelectorAll("input").forEach(i=>{ i.readOnly=true; i.tabIndex=-1; });
  });
  $$("[data-seq]").forEach(el=>{
    const rows=el.dataset.seq.split("|").map(r=>D.parseBlock(r).flat);
    U.renderGlyphs(el, rows, null, { size:+(el.dataset.size||30), showLetters:false,
      showNames: el.dataset.names==="1", conv: CUPS });
  });
  $$("[data-courage]").forEach(el=>{
    const c=[]; for(let d=0; d<8; d++) c.push([3,d]); c.push([2,0]); c.push([1,0]);
    U.renderGlyphs(el, [c], null, { size:34, showLetters:false, showNames:true, conv:CUPS });
  });
  $$("[data-msg]").forEach(el=>{
    const f=FILLS[el.dataset.fill||"snowflake"];
    const letters=el.dataset.msg.toUpperCase().replace(/[^A-Z]/g,"");
    const r=D.encipher(letters, [letters.length], { key:f.map, order:"ident", spec:D.defaultSpec() });
    U.renderGlyphs(el, [r.flat.filter(Boolean)], r.kept, { size:28, conv:CUPS });
    if(r.dropped.length){ const n=document.createElement("div"); n.className="glyphcap";
      n.textContent="not in this key, dropped: "+r.dropped.join(" "); el.after(n); }
  });
}

/* ============================ PAGE: transcription ============================ */
function initReadings(){
  const sel=$("#rdSel"); if(!sel) return;
  const INFO={
    primary:"The first-pass reading: every flagged glyph takes the first of its two options.",
    resolved:"The default: each of the nine flagged glyphs set to the variant that best fits a 1:1 substitution (82/87, zero collisions).",
    corrected:"Resolved plus five re-reads inferred <b>from</b> the published solution. Circular — never use it to test that solution.",
  };
  const base=blockOf("resolved").flat.map(D.symName);
  const draw=()=>{
    const name=sel.value, b=blockOf(name), names=b.flat.map(D.symName);
    const diff=[]; names.forEach((s,i)=>{ if(s!==base[i]) diff.push(i); });
    U.renderGlyphs($("#rdGlyphs"), b.lines, null, { size:26, showLetters:false, showNames:true, conv:CUPS,
      mark: i => diff.includes(i) });
    $("#rdText").textContent=DATA.readings[name];
    $("#rdInfo").innerHTML=INFO[name]+(diff.length ? ` <b>${diff.length}</b> glyph${diff.length>1?"s":""} differ from the resolved reading (boxed): `
      +diff.map(i=>`#${i+1} ${esc(base[i])}→${esc(names[i])}`).join(", ")+"." : "");
  };
  sel.addEventListener("change",draw); draw();

  const cmp=$("#pubCompare");
  if(cmp){
    const row=name=>{
      const t=D.applyKey(blockOf(name).flat, DATA.publishedKey), P=DATA.published;
      let html="", ok=0;
      for(let i=0;i<t.length;i++){ const hit=t[i]===P[i]; if(hit) ok++;
        html+= hit ? t[i] : `<span class="bad">${t[i]}</span>`;
        if(i===28||i===59) html+=NL; }
      return {html, ok};
    };
    const r=row("resolved"), c=row("corrected"), p=row("primary");
    cmp.innerHTML=`<div class="data">${r.html}</div>`
      +`<p class="hint">Resolved reading through the key implied by the published solution: <b>${r.ok}/87</b> letters agree `
      +`(disagreements in red). The primary reading gives <b>${p.ok}/87</b>. The corrected reading gives <b>${c.ok}/87</b> `
      +`— by construction, because its five re-reads were taken from that solution.</p>`;
  }
}
function initConvView(){
  const c=$("#cvConv"), s=$("#cvStyle"); if(!c) return;
  opts(c, U.CONVENTIONS, "pointed_cw"); opts(s, U.STYLES, "arcs");
  const draw=()=>{
    const conv={ name:c.value, style:s.value };
    U.renderLegend($("#cvLegend"), conv, { size:34 });
    U.renderGlyphs($("#cvCT"), blockOf("resolved").lines, null, { size:24, showLetters:false, conv });
    $("#cvNote").innerHTML=(U.CONVENTIONS[c.value].tip||"")+" &middot; "+(U.STYLES[s.value].tip||"");
  };
  c.addEventListener("change",draw); s.addEventListener("change",draw); draw();
}

/* ============================ PAGE: measurements ============================ */
function initMeasurements(){
  const ro=$("#mReadout"); if(!ro) return;
  const sel=$("#mReading");
  const draw=()=>{
    const name=sel?sel.value:"resolved", b=blockOf(name), st=stats(b.flat), res=name==="resolved";
    const cell=(k,v,ref,cls)=>`<div class="cell"><span class="k">${k}</span><span class="v ${cls||""}">${v}</span><span class="ref">${ref}</span></div>`;
    ro.innerHTML=cell("glyphs",st.n,b.lens.join(" / "))
      +cell("distinct",st.distinct,"of 24 possible")
      +cell("index of coinc.",st.ic.toFixed(4),"flat over 20: 0.0500")
      +cell("entropy",st.H.toFixed(3),"bits per glyph")
      +cell("orientation χ²",st.chi.toFixed(1),res?"7 df · p = 0.0003":"7 df","bad")
      +cell("mirrored pairs",st.mirror,res?"chance ≈ 5.2 · p = 0.03":"same ring, 180°","warn");
    const f=Object.entries(st.cnt).sort((a,b)=>b[1]-a[1]);
    const maxf=f.length?f[0][1]:1;
    $("#mFreq").innerHTML=barRows(f.map(([k,v])=>{ const [r,d]=k.split("|"); return {k:r+D.DIRS[+d], v}; })
      .concat(st.unused.map(u=>({k:u, v:0, label:"0 — unused"}))), maxf);
    $("#mDirs").innerHTML=barRows(st.dirs.map((v,d)=>({k:D.DIRS[d], v, c: Math.abs(v-st.exp)>5?"hot":""})), 24, st.exp)
      +`<p class="hint">The white tick is the flat expectation, 87 / 8 = ${st.exp.toFixed(2)} per direction, which every regular rotating key pushes the counts towards. χ² = <b>${st.chi.toFixed(2)}</b> on 7 degrees of freedom.</p>`;
    $("#mRings").innerHTML=barRows(st.rings.map((v,i)=>({k:(i+1)+" arc"+(i?"s":""), v, c:"cool"})), 40);
    $("#mAngles").innerHTML=barRows(st.ang.map((v,a)=>({k:(a*45)+"°", v, c:a===4?"hot":""})), 12)
      +`<p class="hint">Consecutive glyphs with the same arc count, by the turn between them, (dᵢ − dᵢ₊₁) mod 8 × 45°. The 180° bin holds <b>${st.ang[4]}</b>.</p>`;
    const v=sukhotin(b.flat), share=v.reduce((a,s)=>a+(st.cnt[D.symKey(D.parseSym(s))]||0),0)/st.n;
    $("#mVowels").innerHTML=`<div class="data">${v.join("  ")}</div><p class="hint">Sukhotin picks <b>${v.length}</b> symbols as vowel-like; together they cover <b>${(100*share).toFixed(1)}%</b> of the text. The vowels A E I O U cover roughly 38–40% of English.</p>`;
    const more=$("#mMore");
    if(more) more.innerHTML=`doubled glyphs <b>${st.doubles}</b> &middot; repeated bigrams (occurrences beyond the first) <b>${st.rep}</b> &middot; unused: <b>${st.unused.join(" ")||"none"}</b>`;
  };
  if(sel){ sel.addEventListener("change",draw); }
  draw();
}

/* ============================ PAGE: workbench ============================ */
function specFrom(p){ const ring=$(p+"Ring").value; return {
  step:+$(p+"Step").value, dir:+$(p+"Dir").value, sched:$(p+"Sched").value,
  reflect:$(p+"Refl").value==="1", axis:+$(p+"Axis").value, reflectEvery:1,
  ring, ringEvery: ring==="id" ? 0 : +($(p+"RingEvery") ? $(p+"RingEvery").value : 1) }; }
function fillSettings(p){
  opts($(p+"Order"), D.ORDERS, "ident");
  opts($(p+"Sched"), D.SCHEDULES, "none");
  opts($(p+"Ring"), D.RINGPERMS, "id");
  $(p+"Axis").innerHTML=D.DIRS.map((d,i)=>`<option value="${i}">${d} axis</option>`).join("");
  opts($(p+"Fill"), FILLS, "snowflake");
}
function initEncipher(){
  if(!$("#encPt")) return;
  fillSettings("#enc");
  const run=()=>{
    const txt=$("#encPt").value, letters=txt.toUpperCase().replace(/[^A-Z]/g,"");
    const key=FILLS[$("#encFill").value].map, inv=D.invertKey(key);
    const kept=letters.split("").filter(c=>inv[c]).length;
    const lens=($("#encLayout").value==="dora" && kept===87) ? [29,31,27] : [kept];
    const r=D.encipher(txt, lens, { key, order:$("#encOrder").value, spec:specFrom("#enc") });
    const lines=linesOf(r.flat, r.lens);
    U.renderGlyphs($("#encGlyphs"), lines.map(l=>l.filter(Boolean)), r.kept, { size:30, conv:CUPS });
    $("#encOut").value=lines.map(l=>l.map(D.symName).join(" ")).join(NL);
    $("#encInfo").innerHTML=`<b>${r.kept.length}</b> letters → <b>${r.flat.length}</b> glyphs`
      +(r.dropped.length?` &middot; <span class="bad">not in the key, dropped: ${esc(r.dropped.join(" "))}</span>`:"");
    $("#encRT").textContent="";
    return r;
  };
  ["#encPt","#encFill","#encLayout","#encOrder","#encSched","#encStep","#encDir","#encRefl","#encAxis","#encRing"]
    .forEach(id=>{ $(id).addEventListener(id==="#encPt"?"input":"change", run); });
  $("#encVerify").addEventListener("click",()=>{
    const r=run(), key=FILLS[$("#encFill").value].map;
    const back=D.decipher({lines:[],lens:r.lens,flat:r.flat},{ key, order:$("#encOrder").value, spec:specFrom("#enc") }).text;
    $("#encRT").innerHTML= back===r.kept
      ? '<span class="good">round-trip PASS</span> — deciphering with the same key and settings returns the plaintext exactly.'
      : '<span class="bad">round-trip FAIL</span><br>in&nbsp; '+esc(r.kept)+'<br>out '+esc(back);
  });
  $("#encToDec").addEventListener("click",()=>{
    $("#decCt").value=$("#encOut").value;
    ["Order","Sched","Step","Dir","Refl","Axis","Ring","Fill"].forEach(k=>{ $("#dec"+k).value=$("#enc"+k).value; });
    $("#decRun").click(); $("#decCt").scrollIntoView({behavior:"smooth",block:"center"});
  });
  run();
}
function initDecipher(){
  if(!$("#decCt")) return;
  fillSettings("#dec");
  opts($("#decReading"), {primary:{label:"primary"},resolved:{label:"resolved (default)"},corrected:{label:"corrected (circular)"}}, "resolved");
  const load=()=>{ $("#decCt").value=DATA.readings[$("#decReading").value]; run(); };
  const run=()=>{
    const b=D.parseBlock($("#decCt").value);
    if(!b.flat.length){ $("#decInfo").textContent="no glyphs parsed"; return; }
    const key=FILLS[$("#decFill").value].map, sp=specFrom("#dec"), order=$("#decOrder").value;
    const r=D.decipher(b,{ key, order, spec:sp });
    const before=stats(r.seq), after=stats(r.cells);
    const lens = order==="ident" ? b.lens : [r.seq.length];
    U.renderGlyphs($("#decGlyphs"), linesOf(r.seq, lens), r.text, { size:26, conv:CUPS });
    $("#decUnwound").textContent=linesOf(r.cells.map(D.symName), lens).map(l=>l.join(" ")).join(NL);
    $("#decText").textContent=linesOf(r.text.split(""), lens).map(l=>l.join("")).join(NL);
    $("#decInfo").innerHTML=`<b>${b.flat.length}</b> glyphs &middot; lines ${b.lens.join(" / ")}`
      +(b.bad.length?` &middot; <span class="bad">unparsed: ${esc(b.bad.join(" "))}</span>`:"")
      +`<br>orientation χ² before unwinding <b>${before.chi.toFixed(1)}</b>, after <b>${after.chi.toFixed(1)}</b>`
      +` &middot; mirrored pairs ${before.mirror} → ${after.mirror} &middot; distinct after ${after.distinct}/24`
      +(sp.sched==="none"?" &middot; <span>static key: this is a plain substitution</span>":"");
  };
  $("#decReading").addEventListener("change",load);
  $("#decRun").addEventListener("click",run);
  ["#decFill","#decOrder","#decSched","#decStep","#decDir","#decRefl","#decAxis","#decRing","#decRingEvery"]
    .forEach(id=>{ if($(id)) $(id).addEventListener("change",run); });
  load();
}
function initCrib(){
  if(!$("#cribIn")) return;
  opts($("#cribOrder"), D.ORDERS, "ident");
  const run=()=>{
    const crib=$("#cribIn").value.toUpperCase().replace(/[^A-Z]/g,"");
    const b=blockOf("resolved"), perm=D.orderPerm(b.lens, $("#cribOrder").value);
    const keys=perm.map(i=>D.symKey(b.flat[i]));
    if(crib.length<2){ $("#cribOut").textContent="type a word of two letters or more"; return; }
    const pos=cribPositions(keys, crib);
    const pat=[], m={}; for(const c of crib){ if(!(c in m)) m[c]=Object.keys(m).length; pat.push(m[c]); }
    $("#cribOut").innerHTML=`pattern <b>${pat.join("")}</b> &middot; `
      +(pos.length ? `consistent at <b>${pos.length}</b> of ${keys.length-crib.length+1} positions: `
          +pos.map(p=>p+1).join(", ")
        : `<span class="bad">no position is consistent</span> — the glyph repetition pattern rules it out everywhere in this reading order.`);
  };
  $("#cribIn").addEventListener("input",run); $("#cribOrder").addEventListener("change",run); run();
}

/* ============================ boot ============================ */
initNav();
if(D && U && DATA){
  initRenders(); initReadings(); initConvView(); initMeasurements();
  initEncipher(); initDecipher(); initCrib();
}
