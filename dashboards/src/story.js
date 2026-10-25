/* Story page: hook (flagship dumbbell + linked scatter), main message cards. Uses C (common.js) and STATS. */
(function () {
  const $ = (id) => document.getElementById(id);
  const S = { task: "general", pct: 100, year: 2024 };
  const H = STATS.hook, M = STATS.main, cov = STATS.coverage;
  const usd = (v) => C.fmtUSD(v);
  const bill = (v) => "$" + v.toFixed(2);

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
    $("h-flag-title").textContent = `Same capability, later price · ${t.short}`;
    $("h-sc-title").textContent = `Where the models sit · ${t.short}`;
    $("h-flag-hint").textContent = "Click a cohort column to see its flagship and its cheaper matches on the right.";
    flags.update({ task: S.task, pct: S.pct, selectedYear: S.year });
    const r = row();
    const focus = r && r.flag ? new Set([r.flag.id, ...r.later.map((m) => m.id)]) : null;
    sc.update({ pct: S.pct, tokens: 0, pass: () => true, focusIds: focus, selectedId: r && r.flag ? r.flag.id : null,
      region: r && r.flag ? { price: r.flag.price, score: (S.pct / 100) * r.flag[S.task] } : null });
    $("h-sc-hint").textContent = r && r.flag ? `${S.year} flagship ringed: ${r.flag.name}. Shaded = later, cheaper and still within ${S.pct}% of its score; ${r.later.length} models.` : "No cohort selected: all models shown.";
    const c = C.coverage(S.task); $("h-cov").textContent = c.text;
  }
  render();

  // main message
  $("msg-line").innerHTML = `On the general index, a model that reaches 80% of the best score costs <b>${(M.price_ratio * 100).toFixed(0)}%</b> as much as the top model. At 100M tokens a month that is <b>${bill(M.cheap_bill)}</b> against <b>${bill(M.top_bill)}</b>.`;
  const T = STATS.tasks, sp = STATS.speed, sh = STATS.shu;
  const cards = [
    [`${H.ratio}×`, `${H.old.name} (2024 flagship) vs ${H.new.name} at a similar score`],
    [`${Math.round(T.general.share_of_top_score * 100)}%`, `of the top general score, from ${T.general.cheapest_model}, at ${Math.round(T.general.price_ratio * 100)}% of the price`],
    [`${Math.round(1 / T.math.price_ratio)}×`, `cheaper for math: ${T.math.cheapest_model} at ${Math.round(T.math.share_of_top_score * 100)}% of the best score`],
    [`${sp.n_fast} of ${sp.n_speed_known}`, `good-enough general models with known speed run at 100 tokens/s or more`],
  ];
  $("stats").innerHTML = cards.map(([n, d]) => `<div class="stat"><div class="n">${n}</div><div class="d">${d}</div></div>`).join("");
  $("msg-cov").textContent = `Based on ${cov.n_general_paid} paid models with a general score (${cov.n_coding_paid} for coding, ${cov.n_math_paid} for math). ${cov.n_no_price} of ${cov.n_models} models have no price and ${cov.n_free} are free; neither group is counted in price ratios. Only 6 models score above 50, so the top end is thin. List prices only.`;
})();
