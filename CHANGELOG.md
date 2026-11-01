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

Not done yet: interactive "Rising insights" charts, keyboard access for chart marks, merging A and B.
