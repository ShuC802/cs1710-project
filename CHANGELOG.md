# Refinement log

## Round 1 (after Prototype V1)
Rule we follow: the page states only what the data shows. A striking real number is fine; opinion is not.

| # | Problem | Change |
|---|---|---|
| 1 | Main message ("chasing the top score is rarely worth the price") was an opinion. | Now "Near-top scores can cost a fraction of the top price". The sentence names the two models and both bills, and the note says these are list prices that ignore extra reasoning tokens. |
| 2 | "Today" in the hook had no date, but the data is a 2026-03-31 snapshot. | Hero, hook and footer say "in the March 2026 snapshot"; the footer says prices may have changed since. |
| 3 | The hook sentence stayed on general reasoning when the task changed. | It is now built from the same data as the chart, so it follows the task buttons and the match slider. At the defaults it still reads o1 vs Qwen3.5 9B, 273x. |
| 4 | In Design A a brush ignored the good-enough slider without saying so. | The bill note now says the brush overrides the line, counts how many selected models score below it, and marks those rows with a triangle. |
| 5 | In Design B a pinned model could stay in the detail card after the controls excluded it. | The card now says "Excluded by current controls" with the reason (score, license, budget, speed, or no price). |
| 6 | Design A and B read as competing prototypes. | Named as two ways in: "Explore by performance (Design A)" and "Explore by budget (Design B)". Merging them into one tool is left for later. |
| 7 | Main-message cards were vague ("similar score"). | Cards give both scores and the models' names. |

## Round 2
| # | Problem | Change |
|---|---|---|
| 8 | The page title was hard to parse and did not say what the page does. | New title: "Language models that match 2024's best now cost up to 273x less", with a one-line eyebrow (453 models, data from 2026-03-31) and a short subtitle. The 273x comes from story_stats.json. |
| 9 | Rising insight 1 was a static draft image. | Now an interactive chart: price by score band. Task and license buttons filter and recompute medians; clicking a band shows its cheapest and most expensive model (link). The task is shared with the hook. The takeaway sentence is computed from the data. |

| 10 | The "4375x gap" in Draft 1 came from one model (o1-pro, $262.50 blended). | Checked: it is real (OpenAI API, 2025-03-20, $150 in / $600 out per 1M tokens; the dataset lists it as 2024). It is the only model above $100 and has no usage data in the file. The sentence now uses the middle half of each band, so one extreme model cannot drive it. The extremes still show when a band is clicked. |
| 11 | Rising insight 2 (top vs cheapest good-enough) is now interactive: usage buttons and a good-enough slider recompute all three tasks. | Colours are the ones used everywhere else on the page: dot = license (blue open, orange proprietary), dark/light bar = input/output cost. The earlier draft used blue for "cheapest", which clashed with open-weight blue, and grey for "top", which read as a judgment. Role is shown by label and position only. |
| 12 | Two models tie for the top general score (57.2): GPT-5.4 (xhigh) at $5.63 and Gemini 3.1 Pro Preview at $4.50. The pipeline took the first, the new chart took the cheaper, so the page showed two sets of numbers. | prep_data.py now takes the cheaper model when scores tie. Main message is now $52.50 vs $450.00 a month, 12% of the price (was 9% of $562.50). Coding and math have no tie. |

| 13 | Insight 2 was confusing: a blue/orange license legend clashed with the rest of the page, each model had a split input/output bar, and the cheapest math bar was very short. | Role is the colour: violet = top-scoring model, aqua = cheapest model that is good enough (palette slots 7 and 3, checked with the palette validator in light and dark; no blue/orange here), with a legend. One bar per model, one dollar axis shared by all tasks, the bill written at the end of each bar. A zoom window was tried and removed. License is in the hover tooltip. |

| 14 | Draft 3 (speed vs price) overlapped with Design B's speed filter, rested on 17 models, and did not support the main line; the "evolution over time" part of the story was the thinnest. A first replacement (three lines and a table) was too busy; a second (two dots per year at one score level) showed too little data. | Replaced by cost-to-reach curves, one line per release year (2024-2026): for any score on the x-axis, the line shows the price of the cheapest paid model from that year that scores at least that much. A line that stops means no model of that year scores higher. The good-enough slider adds a dashed vertical line with one dot per year at that score, plus one takeaway sentence. The three lines use one rose hue from light (2024, dashed) to dark (2026) so the order of years reads at a glance, and each dot carries its price label. Shows the whole score range at once instead of one cut. At the 50% level it reproduces the hook (o1 $26.25 vs Qwen3.5 9B $0.096, 273x). |
| 15 | Rising-insight cards had descriptive titles, so it was not clear what each one was for. | Titles are now the question each card answers: has the cost of a score fallen over the release years; what does each step up in score cost; how much does the top model cost next to the cheapest good-enough one. |

Not done yet: keyboard access for chart marks, merging Design A and B.
