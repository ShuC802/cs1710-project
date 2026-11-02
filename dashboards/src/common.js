/* Shared rules + chart components for both dashboard designs.
   Everything that defines "good enough", "monthly bill" and "flagship" lives here
   so Design A and Design B cannot disagree about it. Needs d3 and DATA in scope. */
(function () {
  const C = (window.C = {});
  C.models = DATA.models;
  C.byId = new Map(C.models.map((m) => [m.id, m]));
  C.N = DATA.n_models;

  C.TASKS = [
    { key: "general", label: "General reasoning", short: "General", index: "Intelligence Index" },
    { key: "coding", label: "Coding", short: "Coding", index: "Coding Index" },
    { key: "math", label: "Math", short: "Math", index: "Math Index" },
  ];
  C.taskOf = (k) => C.TASKS.find((t) => t.key === k);
  C.USAGE = [
    { key: "light", label: "Light", tokens: 1e7 },
    { key: "medium", label: "Medium", tokens: 1e8 },
    { key: "heavy", label: "Heavy", tokens: 1e9 },
  ];
  C.usageOf = (k) => C.USAGE.find((u) => u.key === k);
  C.COHORTS = [2024, 2025, 2026]; // 2023 has only 7 models: too thin to call a "flagship"

  /* ---------- formatting ---------- */
  C.fmtTok = (v) => (v >= 1e9 ? v / 1e9 + "B" : v / 1e6 + "M");
  C.fmtUSD = (v) => {
    if (v === 0) return "$0";
    if (v < 1) return "$" + v.toFixed(v < 0.1 ? 3 : 2);
    if (v < 100) return "$" + v.toFixed(2);
    return "$" + d3.format(",.0f")(v);
  };
  C.trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  /* ---------- shared definitions ---------- */
  // Best score in the snapshot for a task (over every model that has the score).
  C.best = (task) => DATA.best[task].max;
  // "Good enough" = at least pct % of the best score for that task.
  C.thr = (task, pct) => (C.best(task) * pct) / 100;
  // Models that can be placed on a price x score chart: have this score AND a price.
  C.plottable = (task) => C.models.filter((m) => m[task] != null && m.price != null);
  // Monthly bill. blended price is 3:1 input:output, so 75% of tokens are input, 25% output.
  C.bill = (m, tokens) => {
    const inp = ((tokens * 0.75) / 1e6) * m.pin;
    const out = ((tokens * 0.25) / 1e6) * m.pout;
    return { inp, out, total: inp + out };
  };
  C.coverage = (task) => {
    const t = C.taskOf(task);
    const scored = C.models.filter((m) => m[task] != null).length;
    const plotted = C.plottable(task).length;
    const free = C.plottable(task).filter((m) => m.free).length;
    return {
      plotted, scored, free,
      noScore: C.N - scored,
      noPrice: scored - plotted,
      text: `${plotted} of ${C.N} models shown. Left out: ${C.N - scored} with no ${t.index}, ${scored - plotted} scored but with no listed price.`,
    };
  };

  // Flagship of a release-year cohort = highest score (ties: cheaper) among paid models
  // with a year, a price > 0 and a score. "Matches" = LATER cohorts, cheaper, score >= pct % of
  // the flagship's score. Free ($0) matches are counted separately: $0 is a list price, not a bill.
  C.flagships = (task, pct) =>
    C.COHORTS.map((year) => {
      const pool = C.models.filter((m) => m.year === year && m.price > 0 && m[task] != null);
      if (!pool.length) return { year, flag: null };
      const flag = pool.reduce((a, b) => (b[task] > a[task] || (b[task] === a[task] && b.price < a.price) ? b : a));
      const later = C.models.filter(
        (m) => m.year != null && m.year > year && m.price != null && m[task] != null && m.price < flag.price && m[task] >= (pct / 100) * flag[task]
      );
      const paid = later.filter((m) => !m.free);
      const cheapest = paid.length ? paid.reduce((a, b) => (b.price < a.price ? b : a)) : null;
      return { year, flag, later, paid, free: later.filter((m) => m.free), cheapest, poolN: pool.length };
    });

  /* ---------- tooltip ---------- */
  const tip = d3.select("body").append("div").attr("id", "tip");
  C.tip = {
    show(m, ev, tokens, task) {
      const rows = C.TASKS.map((t) => `<tr><td class="k">${t.short}</td><td>${m[t.key] == null ? "<span class='k'>no score</span>" : m[t.key]}</td></tr>`).join("");
      const price = m.price == null ? "<span class='k'>no listed price</span>" : m.free ? "free (self-hosted)" : `${C.fmtUSD(m.price)} / 1M blended <span class='k'>(in ${C.fmtUSD(m.pin)}, out ${C.fmtUSD(m.pout)})</span>`;
      const bill = m.price != null && tokens ? `<tr><td class="k">Monthly</td><td>${m.free ? "$0 list (you host it)" : C.fmtUSD(C.bill(m, tokens).total)}</td></tr>` : "";
      tip.html(
        `<b>${m.name}</b><br><span class="k">${m.provider} · ${m.open ? "open weights" : "proprietary"} · ${m.year ?? "year unknown"}</span>` +
          `<table>${rows}<tr><td class="k">Price</td><td>${price}</td></tr><tr><td class="k">Speed</td><td>${m.speed == null ? "<span class='k'>unknown</span>" : m.speed + " tok/s"}</td></tr>${bill}</table>`
      ).style("display", "block");
      C.tip.move(ev);
    },
    move(ev) {
      const node = tip.node();
      const w = node.offsetWidth, h = node.offsetHeight;
      let x = ev.clientX + 14, y = ev.clientY + 14;
      if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
      if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
      tip.style("left", x + "px").style("top", y + "px");
    },
    hide() { tip.style("display", "none"); },
  };

  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const PRICE_DOMAIN = [0.015, 400];

  /* ---------- price x score scatter ----------
     o: {root, task, w, h, r, brushable}
     hooks: onBrush(idSet|null), onHover(id|null), onClick(id)
     update(s): s = {pct, pass:(m)=>bool, hoverId, focusIds:Set|null, selectedId, budgetPrice|null, tokens} */
  C.scatter = function (o, hooks = {}) {
    const m = { t: 8, r: 10, b: 38, l: 40 };
    const freeW = 28, gap = 12;
    const svg = d3.select(o.root).append("svg").attr("viewBox", `0 0 ${o.w} ${o.h}`);
    const iw = o.w - m.l - m.r, ih = o.h - m.t - m.b;
    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const data = C.plottable(o.task);
    const ymax = C.best(o.task) * 1.05;
    const x = d3.scaleLog().domain(PRICE_DOMAIN).range([freeW + gap, iw]);
    const y = d3.scaleLinear().domain([0, ymax]).range([ih, 0]);
    const px = (d) => (d.free ? freeW / 2 + ((hash(d.id) % 1000) / 1000 - 0.5) * (freeW - 10) : x(d.price));

    g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""));
    g.append("rect").attr("class", "free-lane").attr("x", 0).attr("y", 0).attr("width", freeW).attr("height", ih);
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).tickValues([0.1, 1, 10, 100]).tickFormat((v) => "$" + v).tickSizeOuter(0))
      .select(".domain").attr("transform", `translate(0,0)`);
    g.append("text").attr("x", freeW / 2).attr("y", ih + 14).attr("text-anchor", "middle").text("free");
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickSizeOuter(0));
    g.append("text").attr("class", "title-lab").attr("x", (freeW + gap + iw) / 2).attr("y", ih + 32).attr("text-anchor", "middle").text("blended price per 1M tokens (log) →");
    g.append("text").attr("class", "title-lab").attr("transform", `rotate(-90)`).attr("x", -ih / 2).attr("y", -30).attr("text-anchor", "middle").text(C.taskOf(o.task).index + " ↑");

    const thrFill = g.append("rect").attr("class", "thr-fill").attr("x", 0).attr("width", iw);
    const region = g.append("rect").attr("class", "match-region").style("display", "none");
    const regionLab = g.append("text").attr("class", "region-lab").style("display", "none");
    const thrLine = g.append("line").attr("class", "thr").attr("x1", 0).attr("x2", iw);
    const thrLab = g.append("text").attr("class", "thr-lab").attr("x", freeW + gap + 4).attr("text-anchor", "start").attr("dy", "-0.45em");
    const budLine = g.append("line").attr("class", "budget").attr("y1", 0).attr("y2", ih);
    const budLab = g.append("text").attr("class", "budget-lab").attr("y", 10).attr("dx", "0.4em");

    const dots = g.append("g").selectAll("circle").data(data, (d) => d.id).join("circle")
      .attr("class", (d) => "dot " + (d.open ? "open" : "prop")).attr("cx", px).attr("cy", (d) => y(d[o.task])).attr("r", o.r);
    const ringLayer = g.append("g");

    let brushG = null, brush = null, silent = false;
    if (o.brushable) {
      brush = d3.brush().extent([[0, 0], [iw, ih]]).on("brush end", (ev) => {
        if (silent) return;
        if (!ev.selection) { if (ev.type === "end") hooks.onBrush && hooks.onBrush(null); return; }
        const [[x0, y0], [x1, y1]] = ev.selection;
        const ids = new Set(data.filter((d) => { const cx = px(d), cy = y(d[o.task]); return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1; }).map((d) => d.id));
        hooks.onBrush && hooks.onBrush(ids);
      });
      brushG = g.append("g").attr("class", "brush").call(brush);
      brushG.select(".selection").attr("class", "selection");
    }

    // nearest-dot pointer handling (works on top of the brush overlay too)
    const nearest = (ev) => {
      const [mx, my] = d3.pointer(ev, g.node());
      let best = null, bd = 11 * 11;
      for (const d of data) { const dx = px(d) - mx, dy = y(d[o.task]) - my, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = d; } }
      return best;
    };
    let tokensNow = 0;
    svg.on("mousemove", (ev) => {
      const d = nearest(ev);
      if (d) { C.tip.show(d, ev, tokensNow, o.task); } else C.tip.hide();
      hooks.onHover && hooks.onHover(d ? d.id : null);
    }).on("mouseleave", () => { C.tip.hide(); hooks.onHover && hooks.onHover(null); });
    if (hooks.onClick) svg.on("click", (ev) => { const d = nearest(ev); if (d && !(ev.defaultPrevented)) hooks.onClick(d.id); });

    return {
      data, x, y, px,
      clearBrush() { if (brush) { silent = true; brushG.call(brush.move, null); silent = false; } },
      update(s) {
        tokensNow = s.tokens || 0;
        const t = C.thr(o.task, s.pct);
        thrFill.attr("y", 0).attr("height", y(t));
        thrLine.attr("y1", y(t)).attr("y2", y(t));
        thrLab.attr("y", y(t)).text(`good enough ≥ ${t.toFixed(1)} (${s.pct}% of ${C.best(o.task)})`);
        if (s.budgetPrice != null && s.budgetPrice >= PRICE_DOMAIN[0] && s.budgetPrice <= PRICE_DOMAIN[1]) {
          budLine.style("display", null).attr("x1", x(s.budgetPrice)).attr("x2", x(s.budgetPrice));
          budLab.style("display", null).attr("x", x(s.budgetPrice)).attr("text-anchor", x(s.budgetPrice) > iw - 90 ? "end" : "start").attr("dx", x(s.budgetPrice) > iw - 90 ? "-0.4em" : "0.4em").text("budget cap");
        } else { budLine.style("display", "none"); budLab.style("display", "none"); }
        const focus = s.focusIds && s.focusIds.size ? s.focusIds : null;
        dots.attr("opacity", (d) => (focus ? (focus.has(d.id) ? 1 : 0.1) : s.pass(d) ? 0.92 : 0.22));
        dots.sort((a, b) => (s.pass(a) - s.pass(b)) || 0);
        if (s.region) {
          const rx = Math.max(x(Math.min(Math.max(s.region.price, PRICE_DOMAIN[0]), PRICE_DOMAIN[1])), freeW + gap);
          region.style("display", null).attr("x", 0).attr("y", 0).attr("width", rx).attr("height", Math.max(y(s.region.score), 0));
          regionLab.style("display", null).attr("x", 4).attr("y", 12).text("cheaper and still matches");
        } else { region.style("display", "none"); regionLab.style("display", "none"); }
        const ringed = [];
        const sel = s.selectedId && data.find((q) => q.id === s.selectedId); if (sel) ringed.push({ d: sel, big: true });
        const hov = s.hoverId && data.find((q) => q.id === s.hoverId); if (hov) ringed.push({ d: hov, big: true });
        ringLayer.selectAll("circle").data(ringed).join("circle").attr("class", "ring")
          .attr("cx", (q) => px(q.d)).attr("cy", (q) => y(q.d[o.task])).attr("r", (q) => o.r + (q.big ? 4 : 2)).attr("stroke-width", (q) => (q.big ? 2.2 : 1.2));
      },
    };
  };

  /* ---------- monthly bill (horizontal stacked bars) ----------
     update({rows, tokens, hoverId, selectedId, total, note}) ; hooks: onHover(id|null), onClick(id) */
  C.billChart = function (o, hooks = {}) {
    const svg = d3.select(o.root).append("svg");
    const rowH = o.rowH || 24, m = { t: 6, r: 70, b: 28, l: 226 };
    const render = (s) => {
      const rows = s.rows;
      const H = m.t + m.b + Math.max(rows.length, 1) * rowH;
      svg.attr("viewBox", `0 0 ${o.w} ${H}`);
      svg.selectAll("*").remove();
      const iw = o.w - m.l - m.r;
      const bills = rows.map((d) => ({ d, b: C.bill(d, s.tokens) }));
      const maxV = d3.max(bills, (q) => q.b.total) || 1;
      const x = d3.scaleLinear().domain([0, maxV]).range([0, iw]).nice();
      const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
      if (!rows.length) { g.append("text").attr("x", -m.l + 8).attr("y", 18).text(s.empty || "No models to show."); return; }
      g.append("g").attr("class", "grid").call(d3.axisBottom(x).ticks(4).tickSize(rows.length * rowH).tickFormat("")).attr("transform", "translate(0,0)");
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${rows.length * rowH})`).call(d3.axisBottom(x).ticks(4).tickFormat((v) => C.fmtUSD(v)).tickSizeOuter(0));
      const row = g.selectAll("g.bill-row").data(bills).join("g")
        .attr("class", (q) => "bill-row" + (q.d.id === s.hoverId ? " hl" : "") + (q.d.id === s.selectedId ? " sel" : ""))
        .attr("transform", (q, i) => `translate(0,${i * rowH})`)
        .on("mouseenter", (ev, q) => { hooks.onHover && hooks.onHover(q.d.id); C.tip.show(q.d, ev, s.tokens, null); })
        .on("mousemove", (ev) => C.tip.move(ev))
        .on("mouseleave", () => { hooks.onHover && hooks.onHover(null); C.tip.hide(); })
        .on("click", (ev, q) => hooks.onClick && hooks.onClick(q.d.id));
      row.append("rect").attr("class", "hit").attr("x", -m.l).attr("width", o.w).attr("y", 0).attr("height", rowH);
      row.append("circle").attr("cx", -m.l + 8).attr("cy", rowH / 2).attr("r", 4.5).attr("class", (q) => "dot " + (q.d.open ? "open" : "prop"));
      row.append("text").attr("class", "nm").attr("x", -m.l + 18).attr("y", rowH / 2).attr("dy", "0.33em").text((q) => (s.below && s.below.has(q.d.id) ? "▾ " : "") + C.trunc(q.d.name, 30));
      // free rows: no bar, an explicit label (a $0 list price is not a $0 bill: you host it)
      row.filter((q) => q.d.free).append("text").attr("class", "val").attr("x", 4).attr("y", rowH / 2).attr("dy", "0.33em").style("fill", "var(--text-secondary)").text("free list price · you host it");
      row.filter((q) => !q.d.free).each(function (q) {
        const r = d3.select(this), h = rowH - 9, y0 = 4.5;
        const wIn = x(q.b.inp), wOut = x(q.b.out);
        r.append("rect").attr("x", 0).attr("y", y0).attr("height", h).attr("width", Math.max(wIn - (wOut > 0 ? 1 : 0), 1)).attr("fill", "var(--seg-in)").attr("rx", 2);
        if (wOut > 0.5) r.append("rect").attr("x", wIn + 1).attr("y", y0).attr("height", h).attr("width", Math.max(wOut - 1, 1)).attr("fill", "var(--seg-out)").attr("rx", 2);
        r.append("text").attr("class", "val").attr("x", wIn + wOut + 6).attr("y", rowH / 2).attr("dy", "0.33em").text(C.fmtUSD(q.b.total));
      });
    };
    return { update: render };
  };

  /* ---------- flagship vs cheapest later model that is good enough (dumbbells) ----------
     update({task, pct, selectedYear}) ; hooks: onSelect(year) */
  C.flagChart = function (o, hooks = {}) {
    const svg = d3.select(o.root).append("svg");
    const m = { t: 22, r: 8, b: 98, l: 46 };
    const H = o.h || 380;
    svg.attr("viewBox", `0 0 ${o.w} ${H}`);
    const render = (s) => {
      svg.selectAll("*").remove();
      const rows = C.flagships(s.task, s.pct);
      const iw = o.w - m.l - m.r, ih = H - m.t - m.b, colW = iw / rows.length;
      const y = d3.scaleLog().domain(PRICE_DOMAIN).range([ih, 0]);
      const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
      g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickValues([0.1, 1, 10, 100]).tickSize(-iw).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues([0.1, 1, 10, 100]).tickFormat((v) => "$" + v).tickSizeOuter(0));
      g.append("text").attr("class", "title-lab").attr("x", 0).attr("y", -9).text("price per 1M tokens (log scale)");
      const tIdx = C.taskOf(s.task).short;
      const back = g.append("g"), front = g.append("g").style("pointer-events", "none");
      rows.forEach((r, i) => {
        const cx = i * colW + colW / 2;
        back.append("g").attr("class", "flag-row" + (r.year === s.selectedYear ? " sel" : "")).style("cursor", "pointer").on("click", () => hooks.onSelect && hooks.onSelect(r.year))
          .append("rect").attr("class", "hit").attr("x", i * colW + 3).attr("y", -4).attr("width", colW - 6).attr("height", ih + m.b - 6).attr("rx", 8);
        const col = front.append("g").attr("class", "flag-row");
        const lab = col.append("text").attr("text-anchor", "middle").attr("x", cx).attr("y", ih + 18);
        lab.append("tspan").attr("class", "t1").style("font-weight", 600).text(`Best of ${r.year}`);
        if (!r.flag) { lab.append("tspan").attr("x", cx).attr("dy", "1.3em").text("no scored, priced model"); return; }
        const f = r.flag;
        lab.append("tspan").attr("x", cx).attr("dy", "1.3em").text(C.trunc(f.name, 26));
        lab.append("tspan").attr("x", cx).attr("dy", "1.3em").text(`${tIdx} ${f[s.task]} · ${C.fmtUSD(f.price)}`);
        const last = r.year === C.COHORTS[C.COHORTS.length - 1];
        const fy = y(f.price);
        if (r.paid && r.paid.length) {
          const c = r.cheapest, cy = y(c.price), k = f.price / c.price;
          col.append("line").attr("class", "stem").attr("x1", cx).attr("x2", cx).attr("y1", fy + 7).attr("y2", cy - 6);
          col.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 6).attr("class", "hollow " + (c.open ? "open" : "prop"));
          col.append("text").attr("class", "mult halo").attr("x", cx + 24).attr("y", (fy + cy) / 2).attr("dy", "0.33em").text(`${k >= 10 ? k.toFixed(0) : k.toFixed(1)}× cheaper`);
          col.append("text").attr("class", "halo").attr("x", cx + 12).attr("y", cy + 14).text(C.fmtUSD(c.price));
          lab.append("tspan").attr("x", cx).attr("dy", "1.3em").style("fill", "var(--text-muted)").text(`${r.later.length} cheaper later model${r.later.length > 1 ? "s match" : " matches"}${r.free.length ? ` (${r.free.length} free)` : ""}`);
          lab.append("tspan").attr("x", cx).attr("dy", "1.3em").text(`○ ${C.trunc(c.name, 24)}`);
        } else {
          col.append("text").attr("class", "halo").attr("x", cx + 14).attr("y", fy).attr("dy", "0.33em").style("fill", "var(--text-muted)").text(last ? "latest year:" : "no cheaper");
          col.append("text").attr("class", "halo").attr("x", cx + 14).attr("y", fy).attr("dy", "1.6em").style("fill", "var(--text-muted)").text(last ? "no later models" : "match" + (r.free.length ? `; ${r.free.length} free` : ""));
        }
        col.append("circle").attr("cx", cx).attr("cy", fy).attr("r", 7.5).attr("class", "big");
      });
    };
    return { update: render };
  };
})();
