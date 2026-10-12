# CLAUDE.md

CS171 group project, dashboard-prototype milestone (Milestone 6): two coordinated-view prototypes for **The Evolution of LLM Value**, built on the REAL Kaggle data (LLM Price-Performance Tracker, scrape 2026-03-31).

**Shared question:** for my task, how good does a model need to be, which cheaper models are good enough, and what will each cost me per month?

## Layout
- `dashboards/data/*.csv` Kaggle file; `dashboards/prep_data.py` -> `dashboards/data/models.json` (no imputation, nulls stay null).
- `dashboards/src/common.js|css` shared rules and chart components (good enough, monthly bill, flagship matching, scatter, bill, flagship chart).
- `dashboards/src/a.*` Design A (performance first: brush -> filter bill; hover/click -> link). `dashboards/src/b.*` Design B (budget first: shared controls filter; click/hover link).
- `python3 dashboards/build.py` inlines d3 + data + code into single-file pages `docs/a/index.html`, `docs/b/index.html` (GitHub Pages serves `main:/docs`).
- Old SvelteKit prototypes (`src/`, `docs/p1`, `docs/p2`) used a synthetic seed dataset, not the Kaggle data. Do not cite them.

## Shared definitions (never redefine per page)
- Good enough = score >= X% of the best score in that task (default 80%; general 57.2, coding 57.3, math 99.0 on different scales).
- Monthly bill = usage tokens x list prices at 75% input / 25% output (dataset blended price is 3:1). Light/medium/heavy = 10M/100M/1B tokens.
- Flagship = best paid model per release-year cohort (2024-2026; 2023 has 7 models). Matches = later cohort, cheaper, score >= X% of flagship's. Free ($0) models are separate, never used in "x cheaper".
- Only release YEAR exists (no dates; 161 models lack it). 138 models lack a price (mostly open-weight, lower scoring). Say what each view leaves out.

## Coordination rules
Every shared value has one writer. **Filter = remove + recompute; Link = highlight only**; every interaction says which in the UI.
