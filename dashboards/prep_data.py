"""Turn the Kaggle CSV into a compact JSON for the dashboards.

Run:  python3 dashboards/prep_data.py
Reads  dashboards/data/llm_price_performance_tracker_2026-03-31.csv
Writes dashboards/data/models.json

Rules (see the process book):
  * Nothing is imputed. A missing value stays null and each view says how many
    models it had to leave out.
  * `price` is the dataset's own blended price (3 : 1 input : output, verified
    against input/output columns). price == 0 means free / self-hosted (all such
    rows are open-weight models) and is flagged `free`, never plotted on a log axis.
  * `year` is release_year only. The dataset has no release date.
"""
import json, math
import pandas as pd

SRC = "dashboards/data/llm_price_performance_tracker_2026-03-31.csv"
OUT = "dashboards/data/models.json"

d = pd.read_csv(SRC)


def num(v, nd=4):
    return None if pd.isna(v) else round(float(v), nd)


rows = []
for i, r in d.iterrows():
    price = num(r.blended_cost_usd_per_1m)
    rows.append(
        {
            "id": r.model_slug,
            "name": r.model_name,
            "provider": r.provider,
            "open": bool(r.is_open_source),
            "year": None if pd.isna(r.release_year) else int(r.release_year),
            "general": num(r.aa_intelligence_index, 1),
            "coding": num(r.aa_coding_index, 1),
            "math": num(r.aa_math_index, 1),
            "price": price,
            "pin": num(r.input_cost_usd_per_1m),
            "pout": num(r.output_cost_usd_per_1m),
            "free": price == 0,
            "speed": num(r.output_tokens_per_second, 1),
        }
    )

best = {}
for t in ("general", "coding", "math"):
    vals = [m[t] for m in rows if m[t] is not None]
    top = max(vals)
    best[t] = {"max": top, "n_scored": len(vals), "n_scored_priced": sum(1 for m in rows if m[t] is not None and m["price"] is not None)}

out = {
    "source": "LLM Price-Performance Tracker (Kaggle, kanchana1990), scrape 2026-03-31",
    "n_models": len(rows),
    "best": best,
    "models": rows,
}
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print("wrote", OUT, len(rows), "models;", "best:", best)
