/* Story page: hook (flagship dumbbell + linked scatter), main message cards. Uses C (common.js) and STATS. */
(function () {
  const $ = (id) => document.getElementById(id);
  const S = { task: "general", pct: 100, year: 2024 };
  const H = STATS.hook, M = STATS.main, cov = STATS.coverage;
  const usd = (v) => C.fmtUSD(v);
  const bill = (v) => "$" + v.toFixed(2);

  // hero: a poster made of the data. Every paid model with a general score is one thin stroke rising from the
  // baseline to its list price (log), placed in its release-year column. The ink line is the cheapest paid model
  // scoring at least the 2024 best model's score (a16z "LLMflation" style), drawn through the real dots.
  $("hero-ratio").textContent = `${H.ratio}×`;
  $("hero-sub").innerHTML = `cheaper, for the same score.<br><b>${H.old.name}</b>, 2024: ${usd(H.old.price)} per million tokens.<br><b>${H.new.name}</b>, 2026: ${usd(H.new.price)}.`;
  (function heroBg() {
    const svg = d3.select("#hero-bg"), hero = $("hero");
    const pts = DATA.models.filter((m) => m.price > 0 && !m.free && m.general != null && C.COHORTS.includes(m.year));
    const thr = H.old.score;
    const steps = C.COHORTS.map((y) => ({ year: y, m: d3.least(pts.filter((m) => m.year <= y && m.general >= thr), (m) => m.price) }));
    $("hero-cap").innerHTML = `Each stroke is one of ${pts.length} paid models, rising to its list price per million tokens (log scale), in its release-year column; darker strokes score at least ${thr}, ${H.old.name}'s general score. The ink line is the cheapest of those. The data has release years only, so placement inside a year is arbitrary.`;
    // deterministic position inside each year's column
    const jit = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };
    const px = (m) => m.year + 0.06 + 0.88 * jit(m.id);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastW = 0, lastH = 0;
    function draw() {
      const w = hero.clientWidth, h = hero.clientHeight;
      if (!w || (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2)) return;
      lastW = w; lastH = h;
      svg.selectAll("*").remove();
      const narrow = w < 760, pad = Math.max(16, w / 2 - 604);
      const L = pad, R = pad + (narrow ? 0 : 44), base = hero.querySelector(".hero-foot").offsetTop - 44, top = h * (narrow ? 0.34 : 0.26);
      const x = d3.scaleLinear([C.COHORTS[0], C.COHORTS[C.COHORTS.length - 1] + 1], [L, w - R]);
      const y = d3.scaleLog(d3.extent(pts, (m) => m.price), [base, top]).nice();
      const defs = svg.append("defs");
      // hand-drawn wobble for the ink line, paper grain for the whole poster
      defs.append("filter").attr("id", "hero-ink").call((f) => {
        f.append("feTurbulence").attr("type", "fractalNoise").attr("baseFrequency", 0.035).attr("numOctaves", 2).attr("seed", 7).attr("result", "n");
        f.append("feDisplacementMap").attr("in", "SourceGraphic").attr("in2", "n").attr("scale", 2.4);
      });
      defs.append("filter").attr("id", "hero-grain").call((f) => {
        f.append("feTurbulence").attr("type", "fractalNoise").attr("baseFrequency", 0.9).attr("numOctaves", 2).attr("seed", 3);
        f.append("feColorMatrix").attr("values", "0 0 0 0 0.4  0 0 0 0 0.33  0 0 0 0 0.22  0 0 0 0.09 0");
      });
      svg.append("rect").attr("width", w).attr("height", h).attr("filter", "url(#hero-grain)");
      // everything data-ish sits in one dimmed layer; the words on top stay the main read
      const art = svg.append("g").attr("class", "h-art");
      // faint price rules
      const decades = y.ticks().filter((v) => Number.isInteger(Math.log10(v)) && v <= 100);
      const rules = art.append("g").attr("class", "h-rule");
      rules.selectAll("line").data(decades).join("line").attr("x1", L).attr("x2", w - R).attr("y1", y).attr("y2", y);
      if (!narrow) rules.selectAll("text").data(decades).join("text").attr("x", w - R + 8).attr("y", y).attr("dy", "0.32em").text((v) => C.fmtUSD(v).replace(".00", ""));
      // the strokes
      const g = art.append("g").attr("class", "h-strokes");
      const s = g.selectAll("line").data(d3.sort(pts, (m) => m.general >= thr)).join("line")
        .attr("class", (m) => (m.open ? "open" : "prop") + (m.general >= thr ? " hit" : ""))
        .attr("x1", (m) => x(px(m))).attr("x2", (m) => x(px(m))).attr("y1", base).attr("y2", base);
      s.transition().duration(reduce ? 0 : 900).ease(d3.easeCubicOut).delay((m) => (reduce ? 0 : (x(px(m)) - L) / (w - L - R) * 1100))
        .attr("y2", (m) => y(m.price));
      g.selectAll("circle").data(pts.filter((m) => m.general >= thr)).join("circle")
        .attr("class", (m) => (m.open ? "open" : "prop")).attr("r", 1.9).attr("cx", (m) => x(px(m))).attr("cy", (m) => y(m.price))
        .attr("opacity", 0).transition().delay((m) => (reduce ? 0 : 700 + (x(px(m)) - L) / (w - L - R) * 1100)).duration(reduce ? 0 : 400).attr("opacity", 1);
      // baseline and year labels
      art.append("line").attr("class", "h-base").attr("x1", L).attr("x2", w - R).attr("y1", base).attr("y2", base);
      art.append("g").attr("class", "h-year").selectAll("text").data(C.COHORTS).join("text")
        .attr("x", (d) => x(d) + 2).attr("y", base + 22).text((d) => d);
      // ink line through the real cheapest-match dots
      const line = [];
      steps.filter((st, i) => !i || st.m !== steps[i - 1].m).forEach((st, i) => { if (i) line.push([px(st.m), line[line.length - 1][1]]); line.push([px(st.m), st.m.price]); });
      line.push([x.domain()[1], line[line.length - 1][1]]);
      const d = d3.line((p) => x(p[0]), (p) => y(p[1]))(line);
      const ink = art.append("g").attr("class", "h-ink").attr("filter", "url(#hero-ink)");
      const paths = [ink.append("path").attr("d", d).attr("class", "thick"), ink.append("path").attr("d", d).attr("class", "thin").attr("transform", "translate(1.5,-2)")];
      paths.forEach((p, i) => {
        const len = p.node().getTotalLength();
        p.attr("stroke-dasharray", len).attr("stroke-dashoffset", reduce ? 0 : len)
          .transition().delay(reduce ? 0 : 1300 + i * 250).duration(reduce ? 0 : 2000).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0);
      });
      // annotations: each year's flagship (best paid model, the shared definition) and the two cheaper steps
      const flags = C.flagships("general", 100).filter((r) => r.flag).map((r) => r.flag);
      const sc = (m) => `score ${m.general} · ${usd(m.price)}`;
      const notes = [
        ...flags.map((m, i) => ({ m, kind: "flag", kicker: `Best of ${m.year}`, text: `${C.trunc(m.name, narrow ? 16 : 26)}`, sub: sc(m), dx: i === flags.length - 1 ? -12 : 12, dy: i === 1 ? 24 : -50, end: i === flags.length - 1 })),
        ...(narrow ? [] : [{ m: steps[1].m, kind: "cheap", text: `${steps[1].m.name}`, sub: `score ${steps[1].m.general} · ${usd(steps[1].m.price)}`, dx: -12, dy: 22, end: true }]),
        { m: steps[steps.length - 1].m, kind: "cheap", text: narrow ? "" : steps[steps.length - 1].m.name, sub: `score ${steps[steps.length - 1].m.general} · ${usd(steps[steps.length - 1].m.price)}`, dx: 12, dy: 24 },
      ];
      const a = svg.append("g").attr("class", "h-note").selectAll("g").data(narrow ? notes.filter((n) => n.kind === "flag") : notes).join("g")
        .attr("class", (n) => n.kind).attr("opacity", 0);
      a.filter((n) => n.kind === "flag").append("line").attr("class", "stem")
        .attr("x1", (n) => x(px(n.m))).attr("x2", (n) => x(px(n.m))).attr("y1", base).attr("y2", (n) => y(n.m.price));
      const at = a.append("g").attr("transform", (n) => `translate(${x(px(n.m))},${y(n.m.price)})`);
      at.append("circle").attr("r", (n) => (n.kind === "flag" ? 5 : 4.5));
      const t = at.append("text").attr("x", (n) => n.dx).attr("y", (n) => n.dy).attr("text-anchor", (n) => (n.end ? "end" : "start"));
      if (narrow) t.remove();
      t.filter((n) => n.kicker).append("tspan").attr("class", "k").text((n) => n.kicker);
      t.append("tspan").attr("class", "nm").attr("x", (n) => n.dx).attr("dy", (n) => (n.kicker ? "1.25em" : 0)).text((n) => n.text);
      t.append("tspan").attr("class", "sub").attr("x", (n) => n.dx).attr("dy", (n) => (n.text ? "1.25em" : 0)).text((n) => n.sub);
      a.transition().delay((n, i) => (reduce ? 0 : 1600 + i * 350)).duration(reduce ? 0 : 500).attr("opacity", 1);
    }
    draw();
    new ResizeObserver(draw).observe(hero);
  })();

  $("hook-line").innerHTML = `In 2024, <b>${H.old.name}</b> scored ${H.old.score} on the general index at <b>${usd(H.old.price)}</b> per million tokens. Today <b>${H.new.name}</b> scores ${H.new.score} at <b>${usd(H.new.price)}</b>: about <b>${H.ratio}× cheaper</b> for the same level or better.`;

  // controls
  const seg = $("h-task");
  C.TASKS.forEach((t) => { const b = document.createElement("button"); b.textContent = t.label; b.dataset.k = t.key; b.onclick = () => { S.task = t.key; buildScatter(); render(); }; seg.appendChild(b); });
  $("h-pct").oninput = (e) => { S.pct = +e.target.value; render(); };

  const flags = C.flagChart({ root: $("h-flags"), w: 560, h: 400 }, { onSelect: (y) => { S.year = S.year === y ? null : y; render(); } });
  let sc = null;
  function buildScatter() { $("h-sc").innerHTML = ""; sc = C.scatter({ root: $("h-sc"), task: S.task, w: 520, h: 360, r: 3.6 }, {}); }
  buildScatter();

  function row() { return S.year == null ? null : C.flagships(S.task, S.pct).find((q) => q.year === S.year); }
  function render() {
    const t = C.taskOf(S.task);
    seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.task));
    $("h-pct-val").textContent = S.pct + "%";
    $("h-flag-title").textContent = `What each year's best model cost, and what matches it later · ${t.short}`;
    $("h-sc-title").textContent = `All models: price vs. score · ${t.short}`;
    $("h-flag-hint").textContent = "Each column is a release year. The black dot is that year's best paid model. The open circle is the cheapest model released later that still matches its score, and the line is the saving. Click a column to see these models on the right.";
    flags.update({ task: S.task, pct: S.pct, selectedYear: S.year });
    const r = row();
    const focus = r && r.flag ? new Set([r.flag.id, ...r.later.map((m) => m.id)]) : null;
    sc.update({ pct: S.pct, tokens: 0, pass: () => true, focusIds: focus, selectedId: r && r.flag ? r.flag.id : null,
      region: r && r.flag ? { price: r.flag.price, score: (S.pct / 100) * r.flag[S.task] } : null });
    $("h-sc-hint").textContent = r && r.flag ? `Each dot is a model: further right costs more, higher scores better. Ringed: ${r.flag.name}, best of ${S.year} (score ${r.flag[S.task]}, ${usd(r.flag.price)}). The shaded box holds the ${r.later.length} later models that are cheaper and score at least ${S.pct}% of that. The rest fade.` : "Each dot is a model: further right costs more, higher scores better. Click a column on the left to focus on one year.";
    const c = C.coverage(S.task); $("h-cov").textContent = c.text;
  }
  render();

  // main message
  $("msg-line").innerHTML = `On the general index, a model that reaches 80% of the best score costs <b>${(M.price_ratio * 100).toFixed(0)}%</b> as much as the top model. At 100M tokens a month that is <b>${bill(M.cheap_bill)}</b> against <b>${bill(M.top_bill)}</b>.`;
  const T = STATS.tasks, sp = STATS.speed, sh = STATS.shu;
  const cards = [
    [`${H.ratio}×`, `${H.old.name} (best of 2024) vs ${H.new.name} at a similar score`],
    [`${Math.round(T.general.share_of_top_score * 100)}%`, `of the top general score, from ${T.general.cheapest_model}, at ${Math.round(T.general.price_ratio * 100)}% of the price`],
    [`${Math.round(1 / T.math.price_ratio)}×`, `cheaper for math: ${T.math.cheapest_model} at ${Math.round(T.math.share_of_top_score * 100)}% of the best score`],
    [`${sp.n_fast} of ${sp.n_speed_known}`, `good-enough general models with known speed run at 100 tokens/s or more`],
  ];
  $("stats").innerHTML = cards.map(([n, d]) => `<div class="stat"><div class="n">${n}</div><div class="d">${d}</div></div>`).join("");
  $("msg-cov").textContent = `Based on ${cov.n_general_paid} paid models with a general score (${cov.n_coding_paid} for coding, ${cov.n_math_paid} for math). ${cov.n_no_price} of ${cov.n_models} models have no price and ${cov.n_free} are free; neither group is counted in price ratios. Only 6 models score above 50, so the top end is thin. List prices only.`;
})();
