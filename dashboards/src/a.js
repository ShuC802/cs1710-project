/* Design A: performance first. Brush a region in a task scatter -> the bill shows those models. */
(function () {
  const S = { pct: 80, usage: "medium", active: "general", brush: null, hover: null, flagYear: null };
  const tok = () => C.usageOf(S.usage).tokens;
  const $ = (id) => document.getElementById("a-" + id);

  // ---- controls ----
  const usageSeg = $("usage");
  C.USAGE.forEach((u) => {
    const b = document.createElement("button");
    b.textContent = `${u.label} · ${C.fmtTok(u.tokens)}`; b.dataset.k = u.key;
    b.onclick = () => { S.usage = u.key; render(); };
    usageSeg.appendChild(b);
  });
  $("pct").oninput = (e) => { S.pct = +e.target.value; render(); };

  // ---- task selector: which task drives ② and ③ ----
  const taskSeg = $("task");
  C.TASKS.forEach((t) => {
    const b = document.createElement("button");
    b.textContent = t.label; b.dataset.k = t.key;
    b.onclick = () => { S.active = t.key; S.brush = null; S.flagYear = null; clearBrushes(); render(); };
    taskSeg.appendChild(b);
  });

  // ---- panels (one scatter per task) ----
  const panels = {};
  C.TASKS.forEach((t) => {
    const card = document.createElement("section");
    card.className = "card"; card.id = "a-card-" + t.key;
    card.innerHTML = `<h2>① ${t.label}</h2>
      <p class="hint" id="a-hint-${t.key}"></p><div id="a-sc-${t.key}"></div><p class="coverage" id="a-cov-${t.key}">${C.coverage(t.key).text}</p>`;
    $("panels").appendChild(card);
    panels[t.key] = C.scatter({ root: $("sc-" + t.key), task: t.key, w: 400, h: 300, r: 3.6, brushable: true }, {
      onBrush: (ids) => {
        if (ids === null) { if (S.brush && S.brush.task === t.key) { S.brush = null; render(); } return; }
        C.TASKS.forEach((o) => o.key !== t.key && panels[o.key].clearBrush());
        S.brush = { task: t.key, ids }; S.active = t.key; S.flagYear = null; render();
      },
      onHover: (id) => { if (S.hover !== id) { S.hover = id; renderLinked(); } },
    });
  });
  const clearBrushes = () => C.TASKS.forEach((t) => panels[t.key].clearBrush());
  $("clear").onclick = () => { S.brush = null; clearBrushes(); render(); };

  // ---- ② bill, ③ flagship comparison ----
  const bill = C.billChart({ root: $("bill"), w: 560, rowH: 25 }, {
    onHover: (id) => { if (S.hover !== id) { S.hover = id; renderLinked(); } },
  });
  const flags = C.flagChart({ root: $("flags"), w: 560, h: 400 }, {
    onSelect: (y) => { S.flagYear = S.flagYear === y ? null : y; render(); },
  });

  function billRows() {
    const t = S.active, thr = C.thr(t, S.pct);
    let rows = S.brush ? [...S.brush.ids].map((id) => C.byId.get(id)) : C.plottable(t).filter((m) => m[t] >= thr);
    rows.sort((a, b) => C.bill(a, tok()).total - C.bill(b, tok()).total);
    return rows;
  }
  function focusIds() {
    if (S.flagYear == null) return null;
    const r = C.flagships(S.active, S.pct).find((q) => q.year === S.flagYear);
    if (!r || !r.flag) return null;
    return new Set([r.flag.id, ...r.later.map((m) => m.id)]);
  }

  function flagId() {
    if (S.flagYear == null) return null;
    const r = C.flagships(S.active, S.pct).find((q) => q.year === S.flagYear);
    return r && r.flag ? r.flag.id : null;
  }

  function flagRegion() {
    if (S.flagYear == null) return null;
    const r = C.flagships(S.active, S.pct).find((q) => q.year === S.flagYear);
    return r && r.flag ? { price: r.flag.price, score: (S.pct / 100) * r.flag[S.active] } : null;
  }

  // hover only changes rings and the highlighted bill row
  function renderLinked() {
    const focus = focusIds();
    C.TASKS.forEach((t) => panels[t.key].update({ pct: S.pct, tokens: tok(), pass: (m) => m[t.key] >= C.thr(t.key, S.pct), hoverId: S.hover, focusIds: t.key === S.active ? focus : null, selectedId: t.key === S.active ? flagId() : null, region: t.key === S.active ? flagRegion() : null }));
    drawBill();
  }
  function drawBill() {
    const rows = billRows(), shown = rows.slice(0, 12);
    const t = C.taskOf(S.active);
    const paid = rows.filter((m) => !m.free).length;
    const th = C.thr(S.active, S.pct);
    const belowIds = S.brush ? new Set(rows.filter((m) => !(m[S.active] >= th)).map((m) => m.id)) : null;
    const brushNote = belowIds ? (belowIds.size ? ` Your brush overrides the good-enough line (≥ ${th.toFixed(1)}): <b>${belowIds.size}</b> of these score below it, marked ▾.` : ` All of them clear the good-enough line (≥ ${th.toFixed(1)}).`) : "";
    $("bill-hint").innerHTML = S.brush
      ? `<b>Filter:</b> the ${rows.length} models inside your ${t.short} brush (${rows.length - paid} free). Showing the ${shown.length} cheapest.${brushNote}`
      : `Models that clear the good-enough line in <b>${t.short}</b>: ${rows.length}. Showing the ${shown.length} cheapest. Brush any scatter to choose your own region.`;
    bill.update({ rows: shown, tokens: tok(), hoverId: S.hover, below: belowIds, empty: "No model clears this line. Lower the good-enough slider or brush a region." });
  }

  function render() {
    // controls
    usageSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.usage));
    $("pct-val").textContent = S.pct + "%";
    $("clear").disabled = !S.brush;
    // panel chrome + hints
    C.TASKS.forEach((t) => {
      $("card-" + t.key).classList.toggle("active", t.key === S.active);
      const thr = C.thr(t.key, S.pct);
      const pass = C.plottable(t.key).filter((m) => m[t.key] >= thr).length;
      $("hint-" + t.key).textContent = `${pass} models clear ≥ ${thr.toFixed(1)}` + (S.brush && S.brush.task === t.key ? ` · brushed ${S.brush.ids.size}` : "");
    });
    taskSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.active));
    $("bill-title").textContent = `② Monthly bill · ${C.usageOf(S.usage).label.toLowerCase()} use (${C.fmtTok(tok())} tokens)`;
    $("flag-title").textContent = `③ Best model of each year vs. cheaper later models that match · ${C.taskOf(S.active).short}`;
    $("flag-hint").textContent = S.flagYear ? `Linked: in the ${C.taskOf(S.active).short} scatter ① the best model of ${S.flagYear} is ringed. Models inside the shaded box are cheaper and match it; the rest fade. Click the column again to clear.` : "Click a column to see, in scatter ①, that year's best model and the cheaper later models that match it.";
    flags.update({ task: S.active, pct: S.pct, selectedYear: S.flagYear });
    renderLinked();
  }
  render();
})();
