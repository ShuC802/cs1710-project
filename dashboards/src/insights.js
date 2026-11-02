/* Rising insight 1: price by score band. Dots = paid models, bar = median, shaded = middle half.
   Uses C (common.js). The task is shared with the hook through the "taskchange" event. */
(function () {
  const $ = (id) => document.getElementById(id);
  const S = { task: "general", lic: "all", band: null };
  // band edges on each task's own score scale (last band is open-ended)
  const EDGES = { general: [0, 10, 20, 30, 40, 50], coding: [0, 10, 20, 30, 40, 50], math: [0, 20, 40, 60, 80] };
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const usd = (v) => C.fmtUSD(v);

  const mk = (el, items, get, set) => items.forEach((it) => {
    const b = document.createElement("button"); b.textContent = it.label; b.dataset.k = it.key;
    b.onclick = () => set(it.key); el.appendChild(b);
  });
  mk($("i-task"), C.TASKS, null, (k) => setTask(k, true));
  mk($("i-lic"), [{ key: "all", label: "All" }, { key: "open", label: "Open weights" }, { key: "closed", label: "Proprietary" }], null, (k) => { S.lic = k; draw(); });
  function setTask(k, announce) {
    if (S.task === k) return;
    S.task = k; S.band = null; draw();
    if (announce) window.dispatchEvent(new CustomEvent("taskchange", { detail: k }));
  }
  window.addEventListener("taskchange", (e) => setTask(e.detail, false));

  const paid = C.models.filter((m) => m.price > 0);
  const [pmin, pmax] = d3.extent(paid, (m) => m.price);
  const W = 780, H = 400, m = { t: 12, r: 12, b: 56, l: 58 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const svg = d3.select($("i1-chart")).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
  const y = d3.scaleLog().domain([pmin / 1.6, pmax * 1.6]).range([ih, 0]);

  function bandsFor(data) {
    const e = EDGES[S.task];
    const bands = e.map((lo, i) => ({ i, lo, hi: i + 1 < e.length ? e[i + 1] : Infinity, ms: [] }));
    bands.forEach((b) => { b.label = b.hi === Infinity ? `${b.lo}+` : `${b.lo}–${b.hi}`; });
    data.forEach((d) => { let k = 0; while (k + 1 < e.length && d[S.task] >= e[k + 1]) k++; bands[k].ms.push(d); });
    bands.forEach((b) => { b.ms.sort((p, q) => p.price - q.price); b.med = d3.median(b.ms, (d) => d.price); b.q1 = d3.quantile(b.ms.map((d) => d.price), 0.25); b.q3 = d3.quantile(b.ms.map((d) => d.price), 0.75); });
    return bands;
  }

  function draw() {
    const t = C.taskOf(S.task);
    $("i-task").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.task));
    $("i-lic").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.lic));
    const data = C.models.filter((d) => d[S.task] != null && d.price > 0 && (S.lic === "all" || (S.lic === "open") === d.open));
    const bands = bandsFor(data);
    const x = d3.scaleBand().domain(bands.map((b) => b.i)).range([0, iw]).paddingInner(0.12);
    const bw = x.bandwidth();

    $("i1-title").textContent = `What does each step up in score cost? · ${t.short}`;
    $("i1-hint").textContent = "Each dot is one paid model. Models are grouped by score. The black bar is the group's median price and the shaded block covers the middle half of its models. Click a band for its cheapest and most expensive model.";

    // takeaway: only statements the numbers support
    const used = bands.filter((b) => b.ms.length);
    const first = used[0], last = used[used.length - 1];
    const wide = bands.filter((b) => b.ms.length >= 10).map((b) => ({ b, r: b.q3 / b.q1 })).sort((p, q) => q.r - p.r)[0];
    $("i1-take").innerHTML = used.length ? `Median price is <b>${usd(first.med)}</b> in the ${first.label} band (${first.ms.length} models) and <b>${usd(last.med)}</b> in the ${last.label} band (${last.ms.length} models).` +
      (wide ? ` Inside the ${wide.b.label} band, the middle half of the models costs between ${usd(wide.b.q1)} and ${usd(wide.b.q3)}, <b>${wide.r >= 10 ? Math.round(wide.r) : wide.r.toFixed(1)}×</b> apart.` : "") : "No models match these settings.";

    // chart
    g.selectAll("*").remove();
    const ticks = [0.1, 1, 10, 100].filter((v) => v >= y.domain()[0] && v <= y.domain()[1]);
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickValues(ticks).tickSize(-iw).tickFormat(""));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues(ticks).tickFormat((v) => "$" + v).tickSizeOuter(0));
    g.append("text").attr("class", "title-lab").attr("transform", "rotate(-90)").attr("x", -ih / 2).attr("y", -44).attr("text-anchor", "middle").text("price per 1M tokens (log scale)");
    g.append("text").attr("class", "title-lab").attr("x", iw / 2).attr("y", ih + 48).attr("text-anchor", "middle").text(`${t.index} score band (higher = better) →`);

    bands.forEach((b) => {
      const bx = x(b.i), cx = bx + bw / 2;
      const col = g.append("g").style("cursor", "pointer").on("click", () => { S.band = S.band === b.i ? null : b.i; draw(); });
      col.append("rect").attr("x", bx).attr("y", 0).attr("width", bw).attr("height", ih).attr("rx", 6)
        .attr("fill", S.band === b.i ? "var(--hl-bg)" : "transparent").attr("stroke", S.band === b.i ? "var(--accent)" : "none");
      if (b.ms.length) {
        col.append("rect").attr("x", bx + bw * 0.08).attr("width", bw * 0.84).attr("y", y(b.q3)).attr("height", Math.max(y(b.q1) - y(b.q3), 1)).attr("fill", "var(--text-muted)").attr("opacity", 0.18);
        col.selectAll("circle").data(b.ms).join("circle")
          .attr("class", (d) => "dot " + (d.open ? "open" : "prop")).attr("r", 3.6).attr("opacity", 0.8)
          .attr("cx", (d) => cx + ((hash(d.id) % 1000) / 1000 - 0.5) * bw * 0.78).attr("cy", (d) => y(d.price))
          .on("mouseenter", (ev, d) => C.tip.show(d, ev, 0, S.task)).on("mousemove", (ev) => C.tip.move(ev)).on("mouseleave", () => C.tip.hide());
        col.append("line").attr("x1", bx + bw * 0.04).attr("x2", bx + bw * 0.96).attr("y1", y(b.med)).attr("y2", y(b.med)).attr("stroke", "var(--text-primary)").attr("stroke-width", 2.6).style("pointer-events", "none");
        col.append("text").attr("class", "halo").attr("x", cx).attr("y", y(b.med) - 6).attr("text-anchor", "middle").style("fill", "var(--text-primary)").style("font-weight", 600).style("pointer-events", "none").text(usd(b.med));
      } else {
        col.append("text").attr("x", cx).attr("y", ih / 2).attr("text-anchor", "middle").style("fill", "var(--text-muted)").text("no models");
      }
      const lab = g.append("text").attr("x", cx).attr("y", ih + 16).attr("text-anchor", "middle").style("pointer-events", "none");
      lab.append("tspan").style("fill", "var(--text-primary)").style("font-weight", 600).text(b.label);
      lab.append("tspan").attr("x", cx).attr("dy", "1.25em").text(`${b.ms.length} model${b.ms.length === 1 ? "" : "s"}`);
    });

    // detail line for the clicked band
    const sb = S.band != null ? bands[S.band] : null;
    $("i1-detail").innerHTML = sb && sb.ms.length
      ? `<b>${t.short} ${sb.label}:</b> ${sb.ms.length} models, median ${usd(sb.med)}. Cheapest: ${sb.ms[0].name} (${usd(sb.ms[0].price)}). Most expensive: ${sb.ms[sb.ms.length - 1].name} (${usd(sb.ms[sb.ms.length - 1].price)}).`
      : (sb ? `No models in the ${sb.label} band with these settings.` : "");

    const cv = C.coverage(S.task);
    $("i1-cov").textContent = `${cv.plotted - cv.free} paid models with a ${t.index} are in the bands. Left out: ${cv.noScore} with no ${t.index}, ${cv.noPrice} scored but with no listed price, ${cv.free} free ($0 cannot sit on a log axis).` + (S.lic !== "all" ? ` License filter: showing ${data.length} ${S.lic === "open" ? "open-weight" : "proprietary"} models.` : "");
  }
  draw();
})();

/* Rising insight 2: top-scoring paid model vs cheapest paid model that is good enough, per task.
   One dollar axis shared by all three tasks. Colour = role (violet top, aqua cheapest); the bill is also written at the end of each bar. */
(function () {
  const $ = (id) => document.getElementById(id);
  const S = { usage: "medium", pct: 80 };
  const usd = (v) => C.fmtUSD(v);
  const seg = $("i2-usage");
  C.USAGE.forEach((u) => { const b = document.createElement("button"); b.textContent = `${u.label} · ${C.fmtTok(u.tokens)}`; b.dataset.k = u.key; b.onclick = () => { S.usage = u.key; draw(); }; seg.appendChild(b); });
  $("i2-pct").oninput = (e) => { S.pct = +e.target.value; draw(); };

  const W = 780, m = { t: 4, r: 150, b: 54, l: 190 }, rowH = 44, headH = 46, gap = 14;
  const svg = d3.select($("i2-chart")).append("svg");

  function pick(task) {
    const pool = C.models.filter((d) => d[task] != null && d.price > 0);
    const top = pool.slice().sort((a, b) => b[task] - a[task] || a.price - b.price)[0];
    const thr = (S.pct / 100) * top[task];
    const ok = pool.filter((d) => d[task] >= thr).sort((a, b) => a.price - b.price || b[task] - a[task]);
    return { task, top, thr, n: ok.length, cheap: ok[0] };
  }

  function draw() {
    const tok = C.usageOf(S.usage).tokens;
    seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === S.usage));
    $("i2-pct-val").textContent = S.pct + "%";
    const groups = C.TASKS.map((t) => pick(t.key));
    const gH = headH + 2 * rowH, plotH = groups.length * (gH + gap) - gap;
    svg.attr("viewBox", `0 0 ${W} ${m.t + m.b + plotH}`).selectAll("*").remove();
    const iw = W - m.l - m.r;
    const x = d3.scaleLinear().domain([0, d3.max(groups, (g) => C.bill(g.top, tok).total)]).range([0, iw]).nice();
    const root = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    root.append("g").attr("class", "grid").call(d3.axisBottom(x).ticks(5).tickSize(plotH).tickFormat(""));
    root.append("g").attr("class", "axis").attr("transform", `translate(0,${plotH})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => usd(v)).tickSizeOuter(0));
    root.append("text").attr("class", "title-lab").attr("x", iw / 2).attr("y", plotH + 38).attr("text-anchor", "middle").text(`monthly bill at ${C.fmtTok(tok)} tokens, list prices (USD) →`);

    groups.forEach((g, gi) => {
      const t = C.taskOf(g.task), y0 = gi * (gH + gap);
      const bt = C.bill(g.top, tok).total, bc = C.bill(g.cheap, tok).total;
      const share = g.cheap[g.task] / g.top[g.task], ratio = bc / bt;
      const head = root.append("text").attr("x", -m.l).attr("y", y0 + 14);
      head.append("tspan").style("fill", "var(--text-primary)").style("font-weight", 700).style("font-size", "13px").text(t.label);
      head.append("tspan").style("fill", "var(--text-muted)").text(`  ·  top score ${g.top[g.task]}, good enough ≥ ${g.thr.toFixed(1)}, ${g.n} model${g.n === 1 ? "" : "s"} qualify`);
      root.append("text").attr("x", -m.l).attr("y", y0 + 32).style("fill", "var(--text-secondary)")
        .text(g.cheap.id === g.top.id ? "Only the top model clears this line." : `The cheapest scores ${Math.round(share * 100)}% of the top score at ${ratio >= 0.1 ? Math.round(ratio * 100) : (ratio * 100).toFixed(1)}% of its bill.`);

      [[g.top, bt, "var(--role-top)"], [g.cheap, bc, "var(--role-cheap)"]].forEach(([d, bill, col], ri) => {
        const y = y0 + headH + ri * rowH, w = x(bill), h = 20, y1 = (rowH - h) / 2;
        const row = root.append("g").attr("class", "bill-row").attr("transform", `translate(0,${y})`)
          .on("mouseenter", (ev) => C.tip.show(d, ev, tok, g.task)).on("mousemove", (ev) => C.tip.move(ev)).on("mouseleave", () => C.tip.hide());
        row.append("rect").attr("class", "hit").attr("x", -m.l).attr("width", W).attr("y", 0).attr("height", rowH);
        row.append("rect").attr("x", -m.l + 4).attr("y", rowH / 2 - 5).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", col);
        row.append("text").attr("x", -m.l + 20).attr("y", rowH / 2).attr("dy", "0.33em").style("fill", "var(--text-primary)").style("font-size", "12px").text(C.trunc(d.name, 30));
        row.append("rect").attr("x", 0).attr("y", y1).attr("height", h).attr("width", Math.max(w, 1.5)).attr("fill", col).attr("rx", 2);
        row.append("text").attr("x", w + 6).attr("y", rowH / 2).attr("dy", "0.33em").style("fill", "var(--text-primary)").text(`${usd(bill)} · score ${d[g.task]}`);
      });
    });

    const missing = C.TASKS.map((t) => `${t.short}: ${C.models.filter((d) => d[t.key] != null && d.price == null).length} scored but unpriced`).join("; ");
    $("i2-cov").textContent = `Only models with a score and a list price above $0 are compared (${missing}). Free models are left out because a $0 list price is not a $0 bill. Bills use list prices; reasoning models often use more tokens.`;
  }
  draw();
})();

/* Rising insight 3: what the cheapest paid model costs to reach a score, one curve per release year.
   For each score x, a year's curve is the lowest price among that year's models that score at least x.
   A curve that stops early means no model from that year scored higher. The good-enough slider adds a
   vertical line; the dots on it are the cheapest model of each year at that score. */
(function () {
  const $ = (id) => document.getElementById(id);
  const S = { task: "general", pct: 80 };
  const YEARS = C.COHORTS;                                  // 2024, 2025, 2026 (2023 has 1 model)
  const STYLE = { 2024: { w: 2.6, col: "var(--yr24)", dash: "6 4" }, 2025: { w: 2.8, col: "var(--yr25)", dash: null }, 2026: { w: 3.4, col: "var(--yr26)", dash: null } };
  const usd = (v) => "$" + (v >= 1 ? v.toFixed(2) : String(+v.toPrecision(3)));

  C.TASKS.forEach((t) => { const b = document.createElement("button"); b.textContent = t.label; b.dataset.k = t.key; b.onclick = () => setTask(t.key, true); $("i3-task").appendChild(b); });
  function setTask(k, announce) { if (S.task === k) return; S.task = k; draw(); if (announce) window.dispatchEvent(new CustomEvent("taskchange", { detail: k })); }
  window.addEventListener("taskchange", (e) => setTask(e.detail, false));
  $("i3-pct").oninput = (e) => { S.pct = +e.target.value; draw(); };

  const W = 780, H = 400, m = { t: 20, r: 70, b: 50, l: 58 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const svg = d3.select($("i3-chart")).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

  // step curve: (0,c1) (s1,c1) (s1,c2) (s2,c2) ... (sk,ck)
  function curve(ms, task) {
    const sorted = ms.slice().sort((a, b) => a[task] - b[task]);
    const pts = []; let prev = 0;
    sorted.forEach((d, i) => {
      if (i && d[task] === sorted[i - 1][task]) return;
      const c = d3.min(sorted.filter((q) => q[task] >= d[task]), (q) => q.price);
      pts.push([prev, c], [d[task], c]); prev = d[task];
    });
    // vertical jumps: each step starts at the previous score with the new cheapest price
    return pts;
  }

  function draw() {
    const task = S.task, t = C.taskOf(task), thr = C.thr(task, S.pct), best = C.best(task);
    $("i3-task").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === task));
    $("i3-pct-val").textContent = S.pct + "%";
    const priced = C.models.filter((d) => d[task] != null && d.price > 0);
    const pool = priced.filter((d) => YEARS.includes(d.year));
    const per = YEARS.map((yr) => {
      const ms = pool.filter((d) => d.year === yr);
      const ok = ms.filter((d) => d[task] >= thr).sort((a, b) => a.price - b.price || b[task] - a[task]);
      return { yr, ms, total: ms.length, n: ok.length, d: ok[0] || null, maxScore: d3.max(ms, (d) => d[task]) };
    });
    const have = per.filter((p) => p.d);

    let take = `Score at least <b>${thr.toFixed(1)}</b> on ${t.short}: `;
    if (have.length >= 2) {
      const a = have[0], b = have[have.length - 1], k = a.d.price / b.d.price;
      take += `the cheapest paid model costs <b>${usd(a.d.price)}</b> for ${a.yr} releases and <b>${usd(b.d.price)}</b> for ${b.yr} releases` + (k >= 1.05 ? `, <b>${k >= 10 ? Math.round(k) : k.toFixed(1)}× less</b>.` : k <= 0.95 ? `, <b>${(1 / k) >= 10 ? Math.round(1 / k) : (1 / k).toFixed(1)}× more</b>.` : ", about the same.");
      const none = per.filter((p) => !p.d);
      if (none.length) take += ` No ${none.map((p) => p.yr).join(" or ")} release scores this high.`;
    } else if (have.length === 1) take += `only ${have[0].yr} releases reach it, the cheapest at <b>${usd(have[0].d.price)}</b>.`;
    else take += "no paid model reaches it.";
    $("i3-take").innerHTML = take;

    g.selectAll("*").remove();
    const x = d3.scaleLinear().domain([0, best * 1.03]).range([0, iw]);
    const y = d3.scaleLog().domain([d3.min(priced, (d) => d.price) / 1.3, 60]).range([ih, 0]);
    const yt = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].filter((v) => v >= y.domain()[0] && v <= y.domain()[1]);
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickValues(yt).tickSize(-iw).tickFormat(""));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues(yt).tickFormat((v) => "$" + v).tickSizeOuter(0));
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(6).tickSizeOuter(0));
    g.append("text").attr("class", "title-lab").attr("transform", "rotate(-90)").attr("x", -ih / 2).attr("y", -44).attr("text-anchor", "middle").text("cheapest price per 1M tokens (log scale)");
    g.append("text").attr("class", "title-lab").attr("x", iw / 2).attr("y", ih + 40).attr("text-anchor", "middle").text(`${t.index} score the model has to reach →`);

    // good-enough line
    g.append("line").attr("x1", x(thr)).attr("x2", x(thr)).attr("y1", 0).attr("y2", ih).attr("stroke", "var(--thr)").attr("stroke-dasharray", "5 4").attr("stroke-width", 1.3);
    g.append("text").attr("class", "halo").attr("x", x(thr) + (x(thr) > iw - 150 ? -6 : 6)).attr("y", 10).attr("text-anchor", x(thr) > iw - 150 ? "end" : "start").style("fill", "var(--text-primary)").text(`good enough ≥ ${thr.toFixed(1)}`);

    // one step curve per year, labelled at its end
    per.forEach((p) => {
      if (!p.ms.length) return;
      const st = STYLE[p.yr], pts = curve(p.ms, task);
      const line = d3.line().x((q) => x(q[0])).y((q) => y(q[1]));
      g.append("path").attr("d", line(pts)).attr("fill", "none").attr("stroke", st.col).attr("stroke-width", st.w).attr("stroke-dasharray", st.dash);
      const end = pts[pts.length - 1];
      g.append("text").attr("class", "halo").attr("x", x(end[0]) + 6).attr("y", y(end[1])).attr("dy", "0.33em").style("fill", STYLE[p.yr].col).style("font-weight", 700).text(p.yr);
    });
    // the cheapest model of each year at the good-enough score
    have.forEach((p) => {
      g.append("circle").attr("cx", x(thr)).attr("cy", y(p.d.price)).attr("r", 5.5).attr("fill", STYLE[p.yr].col).attr("stroke", "var(--surface-1)").attr("stroke-width", 1.5)
        .on("mouseenter", (ev) => C.tip.show(p.d, ev, 0, task)).on("mousemove", (ev) => C.tip.move(ev)).on("mouseleave", () => C.tip.hide());
      const flip = x(thr) > iw - 90;
      g.append("text").attr("class", "halo").attr("x", x(thr) + (flip ? -9 : 9)).attr("y", y(p.d.price) - 9).attr("text-anchor", flip ? "end" : "start").style("fill", "var(--text-primary)").style("font-weight", 600).text(usd(p.d.price));
    });

    const noYear = priced.filter((d) => !d.year).length;
    $("i3-cov").textContent = `${pool.length} of ${priced.length} paid models with a ${t.index} have a release year in 2024 to 2026 (${per.map((p) => `${p.yr}: ${p.total}`).join(", ")}); ${noYear} have no year and cannot be placed. 2026 has the most models, so it has more chances to contain a cheap one. Free models are left out.`;
  }
  draw();
})();
