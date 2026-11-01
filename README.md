# The Evolution of LLM Value (CS1710 Prototype V1)

Team: Shu Chen, Kuanhao Xia. Question: for my task, how good does a model need to be, which cheaper models are good enough, and what will each cost me per month?

Live site: https://shuc802.github.io/cs1710-project/

## Open the site
Open `docs/index.html` in a browser. It is one self-contained file (D3 v7.9.0, data and code are inlined), so no server and no internet are needed. `#a` and `#b` in the URL open Design A or B in section 4.

## Data pipeline
`dashboards/data/llm_price_performance_tracker_2026-03-31.csv` (Kaggle, 453 models x 34 columns)
-> `python3 dashboards/prep_data.py` (needs pandas)
-> `dashboards/data/models.json` (12 kept fields, nulls stay null), `story_stats.json` (every number the story quotes), `cleaning_log.txt` (what was kept, dropped, missing)
-> `python3 dashboards/build.py` inlines everything into `docs/index.html`.

To redraw the three draft images: `python3 dashboards/make_drafts.py` (needs matplotlib).

## Code map
- `dashboards/src/index.html` story page: 1 Hook, 2 Rising insights, 3 Main message, 4 Solution (Design A / B tabs)
- `dashboards/src/story.js` hook view (flagship dumbbell linked to a scatter) and main-message cards
- `dashboards/src/common.js|css` shared definitions and chart components
- `dashboards/src/a.*`, `b.*` Design A (performance first) and Design B (budget first)

## Shared definitions
- Good enough = score >= X% of the best score in that task (slider, default 80%).
- Monthly bill = tokens x list price at 75% input / 25% output. Light / medium / heavy = 10M / 100M / 1B tokens.
- Flagship = best paid model of a release-year cohort (2024-2026). Match = later cohort, cheaper, score >= X% of the flagship's. Free models are counted, never priced.
- Filter = remove and recompute. Link = highlight only. Each view says which it does.

## Status
Functional: hook view (dumbbell + scatter), Explore by performance (Design A), Explore by budget (Design B). All numbers are from the 2026-03-31 snapshot. See CHANGELOG.md. Drafts only (static images in `docs/img/`): price by score band, top vs cheapest good-enough model, speed vs price.
