/* Design B: budget first. Shared controls filter both views; selecting a model links them. */
(function () {
  const S = { task: "general", usage: "medium", pct: 80, budgetPos: 60, license: "all", minSpeed: 0, hover: null, selected: null };
  const $ = (id) => document.getElementById("b-" + id);
  const tok = () => C.usageOf(S.usage).tokens;
  const budget = () => (S.budgetPos >= 100 ? Infinity : Math.round(Math.pow(10, S.budgetPos * 0.05)));

  const seg = (el, items, key) => items.forEach((it) => {
    const b = document.createElement("button"); b.textContent = it.label; b.dataset.k = it.key;
    b.onclick = () => { S[key] = it.key; render(); }; el.appendChild(b);
  });
  seg($("task"), C.TASKS, "task");
  seg($("usage"), C.USAGE.map((u) => ({ key: u.key, label: `${u.label} · ${C.fmtTok(u.tokens)}` })), "usage");
  $("pct").oninput = (e) => { S.pct = +e.target.value; render(); };
  $("budget").oninput = (e) => { S.budgetPos = +e.target.value; render(); };
  $("license").onchange = (e) => { S.license = e.target.value; render(); };
  $("speed").oninput = (e) => { S.minSpeed = +e.target.value; render(); };

  // first filter a model fails (in funnel order), or null if it passes everything
  function fails(m) {
    const t = S.task;
    if (!(m[t] >= C.thr(t, S.pct))) return "score";
    if (S.license !== "all" && (S.license === "open") !== m.open) return "license";
    if (!m.free && C.bill(m, tok()).total > budget()) return "budget";
    if (S.minSpeed > 0 && !(m.speed >= S.minSpeed)) return "speed";
    return null;
  }

  const scat = {};
  C.TASKS.forEach((t) => { const el = document.createElement("div"); el.hidden = true; $("sc").appendChild(el);
    scat[t.key] = C.scatter({ root: el, task: t.key, w: 600, h: 430, r: 4.4, brushable: false }, {
      onHover: (id) => { if (S.hover !== id) { S.hover = id; draw(); } },
      onClick: (id) => { S.selected = S.selected === id ? null : id; draw(); },
    }); scat[t.key].el = el; });
  const bill = C.billChart({ root: $("bill"), w: 600, rowH: 25 }, {
    onHover: (id) => { if (S.hover !== id) { S.hover = id; draw(); } },
    onClick: (id) => { S.selected = S.selected === id ? null : id; draw(); },
  });

  function detail() {
    const m = S.selected && C.byId.get(S.selected);
    const el = $("detail");
    if (!m) { el.innerHTML = "Click a bar or a dot to pin a model here."; return; }
    const sc = C.TASKS.map((t) => `<tr><th>${t.index}</th><td class="v">${m[t.key] == null ? "no score" : m[t.key]}</td></tr>`).join("");
    const costs = C.USAGE.map((u) => `<tr><th>${u.label} · ${C.fmtTok(u.tokens)} tok/mo</th><td class="v">${m.price == null ? "no price" : m.free ? "$0 list (you host)" : C.fmtUSD(C.bill(m, u.tokens).total)}</td></tr>`).join("");
    el.innerHTML = `<b style="color:var(--text-primary)">${m.name}</b> · ${m.provider} · ${m.open ? "open weights" : "proprietary"} · ${m.year ?? "year unknown"}
      <table>${sc}<tr><th>Speed</th><td class="v">${m.speed == null ? "unknown" : m.speed + " tok/s"}</td></tr>${costs}</table>`;
  }

  function draw() {
    const t = S.task, th = C.thr(t, S.pct), tk = tok(), bg = budget();
    // funnel
    let pool = C.plottable(t); const steps = [["plotted with price & score", pool.length]];
    const stage = (label, fn) => { pool = pool.filter(fn); steps.push([label, pool.length]); };
    stage(`≥ ${th.toFixed(1)} (${S.pct}% of best)`, (m) => m[t] >= th);
    if (S.license !== "all") stage(S.license === "open" ? "open weights" : "proprietary", (m) => (S.license === "open") === m.open);
    if (bg !== Infinity) stage(`within ${C.fmtUSD(bg)}/month`, (m) => m.free || C.bill(m, tk).total <= bg);
    let unknownSpeed = 0;
    if (S.minSpeed > 0) { unknownSpeed = pool.filter((m) => m.speed == null).length; stage(`≥ ${S.minSpeed} tok/s`, (m) => m.speed >= S.minSpeed); }
    $("funnel").innerHTML = steps.map((s, i) => `<span>${i ? "→ " : ""}<b>${s[1]}</b> ${s[0]}</span>`).join(" ") +
      (unknownSpeed ? ` <span class="k">(${unknownSpeed} dropped for unknown speed)</span>` : "");
    const rows = pool.slice().sort((a, b) => C.bill(a, tk).total - C.bill(b, tk).total);
    const shown = rows.slice(0, 14);
    $("bill-hint").textContent = rows.length ? `${rows.length} models pass every control. Showing the ${shown.length} cheapest.` : "";
    bill.update({ rows: shown, tokens: tk, hoverId: S.hover, selectedId: S.selected, empty: "Nothing passes all controls. Relax the good-enough share, the budget or the speed floor." });
    C.TASKS.forEach((q) => { scat[q.key].el.hidden = q.key !== t; });
    scat[t].update({ pct: S.pct, tokens: tk, pass: (m) => fails(m) === null, hoverId: S.hover, selectedId: S.selected, budgetPrice: bg === Infinity ? null : bg / (tk / 1e6) });
    detail();
  }

  function render() {
    $("task").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.task));
    $("usage").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.usage));
    $("pct-val").textContent = S.pct + "%";
    const bg = budget(); $("budget-val").textContent = bg === Infinity ? "no limit" : C.fmtUSD(bg) + " / month";
    $("speed-val").textContent = S.minSpeed ? `≥ ${S.minSpeed} tok/s` : "any";
    const t = C.taskOf(S.task);
    $("bill-title").textContent = `① Models you could pay for · ${t.short}, ${C.usageOf(S.usage).label.toLowerCase()} use`;
    $("sc-title").textContent = `② ${t.label}: price × score`;
    $("cov").textContent = C.coverage(S.task).text;
    draw();
  }
  render();
})();
