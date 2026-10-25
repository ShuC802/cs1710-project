"""Data pipeline: Kaggle CSV -> cleaned JSON for the site, plus a cleaning log and story stats.

Run from the repo root:   python3 dashboards/prep_data.py

Input   dashboards/data/llm_price_performance_tracker_2026-03-31.csv
        (LLM Price-Performance Tracker, Kaggle, scrape date 2026-03-31. Downloaded, not scraped by us.)
Output  dashboards/data/models.json        one record per model, nulls kept as null
        dashboards/data/story_stats.json   every number the story page quotes
        dashboards/data/cleaning_log.txt   what was kept, dropped and why

Cleaning rules
  1. Keep one row per model (checked: no duplicate slug, name or id).
  2. Keep only the fields the story uses; rename them to short names.
  3. Never impute. A missing value stays null and each view says how many models it leaves out.
  4. price = the dataset's blended price (3:1 input:output, verified against the input/output columns).
     price == 0 means free / self-hosted (all such rows are open-weight). It is flagged `free`,
     never drawn on a log axis and never used for "x cheaper".
  5. Only the release YEAR exists. There is no release date.
"""
import json
import numpy as np
import pandas as pd

SRC = "dashboards/data/llm_price_performance_tracker_2026-03-31.csv"
OUT = "dashboards/data/models.json"
STATS = "dashboards/data/story_stats.json"
LOG = "dashboards/data/cleaning_log.txt"

raw = pd.read_csv(SRC)
log = []
say = lambda s: (log.append(s), print(s))

# ---- 1. checks on the raw file
say(f"Raw file: {len(raw)} rows x {raw.shape[1]} columns, scrape date {raw.scrape_date.unique().tolist()}")
for col in ("model_slug", "model_name", "aa_id"):
    say(f"  duplicates in {col}: {int(raw[col].duplicated().sum())}")
x = raw.dropna(subset=["blended_cost_usd_per_1m", "input_cost_usd_per_1m", "output_cost_usd_per_1m"])
w = ((x.blended_cost_usd_per_1m - x.input_cost_usd_per_1m) / (x.output_cost_usd_per_1m - x.input_cost_usd_per_1m)).round(2)
say(f"  blended price = input + 0.25 * (output - input) in {int((w == 0.25).sum())} of {len(x)} priced rows with different in/out prices")

# ---- 2. keep + rename fields, keep nulls
def num(v, nd=4):
    return None if pd.isna(v) else round(float(v), nd)

KEEP = {
    "model_slug": "id", "model_name": "name", "provider": "provider", "is_open_source": "open",
    "release_year": "year", "aa_intelligence_index": "general", "aa_coding_index": "coding",
    "aa_math_index": "math", "blended_cost_usd_per_1m": "price", "input_cost_usd_per_1m": "pin",
    "output_cost_usd_per_1m": "pout", "output_tokens_per_second": "speed",
}
say(f"Kept {len(KEEP)} of {raw.shape[1]} columns: " + ", ".join(f"{a}->{b}" for a, b in KEEP.items()))
dropped = [c for c in raw.columns if c not in KEEP]
say("Dropped columns (not used by the story): " + ", ".join(dropped))

rows = []
for _, r in raw.iterrows():
    price = num(r.blended_cost_usd_per_1m)
    rows.append({
        "id": r.model_slug, "name": r.model_name, "provider": r.provider, "open": bool(r.is_open_source),
        "year": None if pd.isna(r.release_year) else int(r.release_year),
        "general": num(r.aa_intelligence_index, 1), "coding": num(r.aa_coding_index, 1), "math": num(r.aa_math_index, 1),
        "price": price, "pin": num(r.input_cost_usd_per_1m), "pout": num(r.output_cost_usd_per_1m),
        "free": price == 0, "speed": num(r.output_tokens_per_second, 1),
    })
df = pd.DataFrame(rows)

say("Missing values in kept fields (left as null):")
for c in ("year", "general", "coding", "math", "price", "speed"):
    say(f"  {c}: {int(df[c].isna().sum())} of {len(df)}")
say(f"  free models (price = 0): {int((df.price == 0).sum())}; models with no price: {int(df.price.isna().sum())} "
    f"({int((df.price.isna() & df.open).sum())} of them open-weight)")

best = {t: {"max": float(df[t].max()), "n_scored": int(df[t].notna().sum()),
            "n_scored_priced": int((df[t].notna() & df.price.notna()).sum())} for t in ("general", "coding", "math")}
json.dump({"source": "LLM Price-Performance Tracker (Kaggle), scrape 2026-03-31", "n_models": len(df), "best": best, "models": rows},
          open(OUT, "w"), separators=(",", ":"))
say(f"Wrote {OUT} ({len(df)} models)")

# ---- 3. analysis population used in the story: has a score and a price above zero
paid = df[df.price > 0]
G = paid[paid.general.notna()]
say(f"Story population (general score and price > 0): {len(G)} models. Coding: {int(paid.coding.notna().sum())}, math: {int(paid.math.notna().sum())}")


def pick(name):
    r = df[df.name == name].iloc[0]
    return {"name": r["name"], "score": r.general, "price": r.price, "speed": None if pd.isna(r.speed) else float(r.speed)}


stats = {"coverage": {
    "n_models": len(df), "n_free": int((df.price == 0).sum()), "n_no_price": int(df.price.isna().sum()),
    "n_no_year": int(df.year.isna().sum()), "n_general_paid": len(G),
    "n_coding_paid": int(paid.coding.notna().sum()), "n_math_paid": int(paid.math.notna().sum())}}

# Hook: one 2024 flagship vs a later model that matches it
o1, q9 = pick("o1"), pick("Qwen3.5 9B (Reasoning)")
stats["hook"] = {"old": o1, "new": q9, "ratio": round(o1["price"] / q9["price"])}

# Rising 1: price by score band (median price, paid models)
bands = [(0, 20, "0-20"), (20, 30, "20-30"), (30, 40, "30-40"), (40, 50, "40-50"), (50, 999, "50+")]
stats["bands"] = [{"band": b, "n": int(((G.general >= lo) & (G.general < hi)).sum()),
                   "median_price": round(float(G[(G.general >= lo) & (G.general < hi)].price.median()), 2)} for lo, hi, b in bands]

# Rising 2: cheapest model that reaches 80% of the best score, per task
tasks = {}
for t in ("general", "coding", "math"):
    s = paid[paid[t].notna()]
    top = s.loc[s[t].idxmax()]
    thr = 0.8 * df[t].max()
    ok = s[s[t] >= thr].sort_values("price")
    c = ok.iloc[0]
    tasks[t] = {"best_score": float(df[t].max()), "threshold": round(thr, 1), "n_pass": len(ok),
                "top_model": top["name"], "top_price": float(top.price),
                "cheapest_model": c["name"], "cheapest_score": float(c[t]), "cheapest_price": float(c.price),
                "share_of_top_score": round(float(c[t]) / float(df[t].max()), 3),
                "price_ratio": round(float(c.price) / float(top.price), 3)}
stats["tasks"] = tasks

# Rising 3: speed among the models that clear the general 80% bar
ok = G[G.general >= 0.8 * df.general.max()]
fast = ok[ok.speed >= 100]
stats["speed"] = {"n_pass": len(ok), "n_speed_known": int(ok.speed.notna().sum()), "n_fast": len(fast),
                  "cheapest": pick("MiniMax-M2.7"), "fast_cheap": pick("Gemini 3 Flash Preview (Reasoning)")}

# Main message: monthly bill at 100M tokens (75% input / 25% output = blended price)
top = tasks["general"]
stats["main"] = {"tokens_per_month": 1e8, "top_model": top["top_model"], "top_bill": round(top["top_price"] * 100, 2),
                 "cheap_model": top["cheapest_model"], "cheap_bill": round(top["cheapest_price"] * 100, 2),
                 "share_of_top_score": top["share_of_top_score"], "price_ratio": top["price_ratio"]}

# Shu's insights (kept for the process book and as a check on the page text)
b = G[(G.general >= 40) & (G.general <= 45)]
stats["shu"] = {"band_40_45": {"n": len(b), "min_price": float(b.price.min()), "max_price": float(b.price.max()),
                               "ratio": round(float(b.price.max() / b.price.min()))},
                "open_median_price": round(float(G[G.open].price.median()), 2),
                "closed_median_price": round(float(G[~G.open].price.median()), 2),
                "best_open_score": float(df[df.open].general.max()), "top_score": float(df.general.max())}
json.dump(stats, open(STATS, "w"), indent=1, default=float)
say(f"Wrote {STATS}")
open(LOG, "w").write("\n".join(log) + "\n")
print("Wrote", LOG)
