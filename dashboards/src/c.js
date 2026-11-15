/* Design C: find a cheaper match for one model.
   Your model = one paid model. A match = a paid model that costs less per month AND scores at least pct% of your model's score in the chosen task.
   Uses C (common.js); the task is shared with the other views through the "taskchange" event. */
(function () {
  const $ = (id) => document.getElementById(id);
  const usd = (v) => C.fmtUSD(v);
  const SHOW = 6;
  const paid = C.models.filter((m) => m.price > 0);
  const S = { id: "o1", task: "general", usage: "medium", pct: 90, lic: "all" };
  const PREVW = {};

  const mk = (el, items, key, set) => items.forEach((it) => { const b = document.createElement("button"); b.textContent = it.label; b.dataset.k = it.key; b.onclick = () => set(it.key); el.appendChild(b); });
  mk($("c-task"), C.TASKS, "task", (k) => { S.task = k; draw(); window.dispatchEvent(new CustomEvent("taskchange", { detail: k })); });
  mk($("c-usage"), C.USAGE.map((u) => ({ key: u.key, label: `${u.label} · ${C.fmtTok(u.tokens)}` })), "usage", (k) => { S.usage = k; draw(); });
  window.addEventListener("taskchange", (e) => { if (S.task !== e.detail) { S.task = e.detail; draw(); } });
  $("c-pct").oninput = (e) => { S.pct = +e.target.value; draw(); };
  $("c-lic").onchange = (e) => { S.lic = e.target.value; draw(); };

  const dl = $("c-models");
  paid.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((m) => { const o = document.createElement("option"); o.value = m.name; dl.appendChild(o); });
  const input = $("c-model");
  const byName = (txt) => { const t = txt.trim().toLowerCase(); return paid.find((m) => m.name.toLowerCase() === t); };
  input.onchange = () => { const m = byName(input.value); if (m) { S.id = m.id; draw(); } else { $("c-take").textContent = `"${input.value}" is not a priced model in this data. Pick a name from the list.`; } };
  // clicking the box clears it so the full list drops down; leaving it empty puts the current model back
  input.onfocus = () => { input.placeholder = C.byId.get(S.id).name; input.value = ""; };
  input.onblur = () => { if (!byName(input.value)) input.value = C.byId.get(S.id).name; };

  // quick picks: the hook's example plus the top paid model of each task
  const picks = [C.byId.get("o1")].concat(C.TASKS.map((t) => paid.filter((m) => m[t.key] != null).sort((a, b) => b[t.key] - a[t.key] || a.price - b.price)[0])).filter((m, i, a) => m && a.indexOf(m) === i);
  const tryEl = $("c-try"); tryEl.append("Try: ");
  picks.forEach((m, i) => { const b = document.createElement("button"); b.className = "linkbtn"; b.textContent = m.name; b.onclick = () => { S.id = m.id; draw(); }; tryEl.append(b); if (i < picks.length - 1) tryEl.append(" · "); });

  const W = 780, m = { t: 4, r: 170, b: 44, l: 240 }, rowH = 40;
  const svg = d3.select($("c-chart")).append("svg");
  const root = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

  function draw() {
    const t = C.taskOf(S.task), me = C.byId.get(S.id), tok = C.usageOf(S.usage).tokens;
    input.value = me.name;
    $("c-task").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.task));
    $("c-usage").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.usage));
    $("c-pct-val").textContent = S.pct + "%";
    $("c-lic").value = S.lic;
    const myBill = C.bill(me, tok).total;
    const ok = me[S.task] != null;
    const thr = ok ? (S.pct / 100) * me[S.task] : null;
    const pool = ok ? paid.filter((d) => d.id !== me.id && d[S.task] != null && d[S.task] >= thr && C.bill(d, tok).total < myBill && (S.lic === "all" || (S.lic === "open") === d.open)) : [];
    pool.sort((a, b) => C.bill(a, tok).total - C.bill(b, tok).total || b[S.task] - a[S.task]);
    // keep only matches that no other match beats on both price and score, so every bar tells something new
    const front = [];
    pool.forEach((d) => { if (!front.length || d[S.task] > front[front.length - 1][S.task]) front.push(d); });
    const shown = front.length <= SHOW ? front : d3.range(SHOW).map((i) => front[Math.round((i * (front.length - 1)) / (SHOW - 1))]);
    const rows = [me].concat(shown);

    // one sentence: the answer
    let take;
    if (!ok) take = `<b>${me.name}</b> has no ${t.index} in this data, so it cannot be compared on ${t.short}. Pick another task or another model.`;
    else if (!pool.length) take = `No cheaper model scores at least ${thr.toFixed(1)} (${S.pct}% of ${me.name}'s ${me[S.task]}) on ${t.short}${S.lic === "all" ? "" : " with this license"}. Lower the bar to see more.`;
    else {
      const cheap = front[0], top = front[front.length - 1], less = (d) => Math.floor((1 - C.bill(d, tok).total / myBill) * 100);
      take = `<b>${pool.length}</b> cheaper model${pool.length === 1 ? " scores" : "s score"} at least ${thr.toFixed(1)} on ${t.short} (${S.pct}% of ${me.name}'s ${me[S.task]}). ` +
        `The cheapest, <b>${cheap.name}</b>, scores ${cheap[S.task]} and costs <b>${usd(C.bill(cheap, tok).total)}</b> a month instead of ${usd(myBill)} (${less(cheap)}% less).` +
        (top.id !== cheap.id ? ` The highest score, <b>${top.name}</b>, is ${top[S.task]} at ${usd(C.bill(top, tok).total)} (${less(top)}% less).` : "");
    }
    $("c-take").innerHTML = take;

    // chart: one bar per model on a shared monthly-bill axis
    const iw = W - m.l - m.r, plotH = rows.length * rowH;
    svg.attr("viewBox", `0 0 ${W} ${m.t + m.b + plotH}`);
    const x = d3.scaleLinear().domain([0, myBill]).range([0, iw]).nice();
    root.selectAll(".ax").remove();
    root.append("g").attr("class", "grid ax").call(d3.axisBottom(x).ticks(5).tickSize(plotH).tickFormat(""));
    root.append("g").attr("class", "axis ax").attr("transform", `translate(0,${plotH})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => usd(v)).tickSizeOuter(0));
    root.append("text").attr("class", "title-lab ax").attr("x", iw / 2).attr("y", plotH + 36).attr("text-anchor", "middle").text(`monthly bill at ${C.fmtTok(tok)} tokens, API prices (USD) →`);
    const D = C.dur();
    const row = root.selectAll("g.crow").data(ok ? rows : [], (d) => d.id);
    row.exit().remove();
    const en = row.enter().append("g").attr("class", "bill-row crow").attr("transform", (d, i) => `translate(0,${i * rowH + 10})`).attr("opacity", 0);
    en.append("rect").attr("class", "hit").attr("x", -m.l).attr("width", W).attr("height", rowH);
    en.append("rect").attr("class", "sw").attr("x", -m.l + 4).attr("y", rowH / 2 - 5).attr("width", 10).attr("height", 10).attr("rx", 2);
    en.append("text").attr("class", "nm").attr("x", -m.l + 20).attr("y", rowH / 2 - 5).style("fill", "var(--text-primary)").style("font-size", "12px");
    en.append("text").attr("class", "sub").attr("x", -m.l + 20).attr("y", rowH / 2 + 9).style("fill", "var(--text-muted)").style("font-size", "11px");
    en.append("rect").attr("class", "bar").attr("x", 0).attr("y", (rowH - 20) / 2).attr("height", 20).attr("rx", 2).attr("width", (d) => PREVW[d.id] || 1.5);
    en.append("text").attr("class", "val").attr("y", rowH / 2).attr("dy", "0.33em").style("fill", "var(--text-primary)");
    const all = en.merge(row);
    all.each(function (d) {
      const isMe = d.id === me.id, bill = C.bill(d, tok).total;
      const g = d3.select(this);
      const label = isMe ? `Your model: ${d.name}, ${t.short} score ${d[S.task]}, monthly bill ${usd(bill)}` : `${d.name}, ${t.short} score ${d[S.task]}, monthly bill ${usd(bill)}, ${Math.floor((1 - bill / myBill) * 100)}% less than ${me.name}. Press Enter to compare this model instead.`;
      g.attr("data-id", d.id).on("mouseenter", (ev) => C.tip.show(d, ev, tok, S.task)).on("mousemove", (ev) => C.tip.move(ev)).on("mouseleave", () => C.tip.hide())
        .on("click", () => { if (!isMe) { S.id = d.id; draw(); } });
      C.focusable(g, label, function () { C.tipFocus(this, d, tok, S.task); }, null, isMe ? null : () => { S.id = d.id; draw(); });
      g.select(".sw").attr("fill", isMe ? "var(--role-top)" : "var(--role-cheap)");
      g.select(".nm").text(C.trunc(d.name, 36));
      g.select(".sub").text(`score ${d[S.task]} · ${d.open ? "open weights" : "proprietary"}`);
      g.select(".bar").attr("fill", isMe ? "var(--role-top)" : "var(--role-cheap)");
      const w = x(bill);
      g.select(".bar").transition().duration(D).ease(d3.easeCubicOut).attr("width", Math.max(w, 1.5));
      g.select(".val").transition().duration(D).ease(d3.easeCubicOut).attr("x", w + 6)
        .on("start", function () { d3.select(this).text(isMe ? `${usd(bill)} · your model` : `${usd(bill)} · ${Math.floor((1 - bill / myBill) * 100)}% less`); });
      PREVW[d.id] = Math.max(w, 1.5);
    });
    all.transition().duration(D).attr("transform", (d, i) => `translate(0,${rows.indexOf(d) * rowH})`).attr("opacity", 1);
    $("c-chart").style.display = $("c-leg").style.display = ok ? "" : "none";
    C.describe(svg, `Monthly bill of ${me.name} next to the cheapest models that score at least ${S.pct}% of it on ${t.short}. ` + $("c-take").textContent);

    const freeMatch = ok ? C.models.filter((d) => d.free && d[S.task] != null && d[S.task] >= thr).length : 0;
    $("c-cov").textContent = `Only models with an API price above $0 are compared: ${paid.length} of ${C.N} models. ${freeMatch ? `${freeMatch} free model${freeMatch === 1 ? "" : "s"} also score this high but are left out, because a $0 price is not a $0 bill. ` : ""}A match must cost less per month than your model and score at least ${S.pct}% of its ${t.index}. ${C.defs(["score", "bill", "snap"], S.task)}`;
  }
  draw();
})();
