"""Draft mockups (static, real data) for the three views not yet implemented. Run from repo root."""
import json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

D = json.load(open("dashboards/data/models.json"))
S = json.load(open("dashboards/data/story_stats.json"))
M = D["models"]
OPEN, PROP, INK, MUTE = "#2a78d6", "#eb6834", "#222", "#77766f"
plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False, "font.family": "DejaVu Sans"})

# Draft 1: price by score band (box-like range + median)
fig, ax = plt.subplots(figsize=(7, 4.2))
bands = [(0, 20, "0-20"), (20, 30, "20-30"), (30, 40, "30-40"), (40, 50, "40-50"), (50, 99, "50+")]
G = [m for m in M if m["price"] and m["price"] > 0 and m["general"] is not None]
import random; random.seed(1)
for i, (lo, hi, lab) in enumerate(bands):
    ms = [m for m in G if lo <= m["general"] < hi]
    for m in ms:
        ax.scatter(i + random.uniform(-.28, .28), m["price"], s=14, color=OPEN if m["open"] else PROP, alpha=.55, lw=0)
    med = sorted(m["price"] for m in ms)[len(ms) // 2] if len(ms) % 2 else sum(sorted(m["price"] for m in ms)[len(ms)//2-1:len(ms)//2+1]) / 2
    ax.hlines(med, i - .38, i + .38, color=INK, lw=2.2)
    ax.text(i + .4, med, f"${med:.2f}", va="center", fontsize=9)
    ax.text(i, 0.012, f"n={len(ms)}", ha="center", color=MUTE, fontsize=8.5)
ax.set_yscale("log"); ax.set_ylim(0.01, 80)
ax.set_xticks(range(5)); ax.set_xticklabels([b[2] for b in bands])
ax.set_xlabel("general intelligence index (score band)"); ax.set_ylabel("price per 1M tokens (log)")
ax.set_yticks([0.1, 1, 10]); ax.set_yticklabels(["$0.1", "$1", "$10"])
ax.set_title("DRAFT 1 · How much more does each step up in score cost?", loc="left", fontsize=11, fontweight="bold")
ax.text(0, 1.0, "", transform=ax.transAxes)
fig.text(.01, .01, f"Bar = median. Blue open weights, orange proprietary. {len(G)} paid models with a general score. Free and unpriced models not shown.", fontsize=7.5, color=MUTE)
fig.tight_layout(rect=(0, .03, 1, 1)); fig.savefig("docs/img/draft-1-price-by-score-band.png", dpi=160); plt.close()

# Draft 2: top model vs cheapest good-enough, per task (monthly bill at 100M tokens)
fig, ax = plt.subplots(figsize=(7, 4))
names = {"general": "General", "coding": "Coding", "math": "Math"}
for i, t in enumerate(["general", "coding", "math"]):
    r = S["tasks"][t]
    a, b = r["top_price"] * 100, r["cheapest_price"] * 100
    ax.barh(i + .2, a, .36, color="#8d8c85"); ax.barh(i - .2, b, .36, color=OPEN)
    ax.text(a, i + .2, f"  {r['top_model']}  ${a:,.0f}", va="center", fontsize=8.5)
    ax.text(b, i - .2, f"  {r['cheapest_model']}  ${b:,.0f}  ({r['share_of_top_score']*100:.0f}% of top score)", va="center", fontsize=8.5)
ax.set_yticks(range(3)); ax.set_yticklabels([names[t] for t in ["general", "coding", "math"]])
ax.set_xlim(0, 950); ax.invert_yaxis()
ax.set_xlabel("monthly bill at 100M tokens (75% input / 25% output), USD")
ax.set_title("DRAFT 2 · Top model vs cheapest model that is good enough (80%)", loc="left", fontsize=11, fontweight="bold")
fig.text(.01, .01, "Gray = best-scoring paid model. Blue = cheapest paid model scoring at least 80% of the best score in that task.", fontsize=7.5, color=MUTE)
fig.tight_layout(rect=(0, .03, 1, 1)); fig.savefig("docs/img/draft-2-top-vs-cheapest.png", dpi=160); plt.close()

# Draft 3: speed x price for general-80% passers
thr = .8 * D["best"]["general"]["max"]
P = [m for m in G if m["general"] >= thr]
fig, ax = plt.subplots(figsize=(7, 4.2))
sp = [m for m in P if m["speed"]]
for m in sp:
    ax.scatter(m["speed"], m["price"], s=40, color=OPEN if m["open"] else PROP, alpha=.85, lw=0)
for n in ("MiniMax-M2.7", "Gemini 3 Flash Preview (Reasoning)", "GPT-5.4 (xhigh)"):
    m = next((q for q in sp if q["name"] == n), None)
    if m: ax.annotate(n.replace(" Preview", ""), (m["speed"], m["price"]), xytext=(6, 4), textcoords="offset points", fontsize=8)
ax.set_ylim(0.4, 12); ax.axvline(100, color=MUTE, ls="--", lw=1); ax.text(101, 0.45, " 100 tok/s", fontsize=8, color=MUTE, va="bottom")
ax.set_yscale("log"); ax.set_yticks([0.5, 1, 2, 5]); ax.set_yticklabels(["$0.5", "$1", "$2", "$5"])
ax.set_xlabel("output speed (tokens per second)"); ax.set_ylabel("price per 1M tokens (log)")
ax.set_title("DRAFT 3 · Among good-enough models, is cheap also fast?", loc="left", fontsize=11, fontweight="bold")
fig.text(.01, .01, f"{len(P)} general-task models score at least 80% of the best; {len(sp)} have a speed value, {len(P)-len(sp)} do not and are left out.", fontsize=7.5, color=MUTE)
fig.tight_layout(rect=(0, .03, 1, 1)); fig.savefig("docs/img/draft-3-speed-vs-price.png", dpi=160); plt.close()
print("ok", len(P), len(sp))
