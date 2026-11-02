"""Inline d3, data, stats, shared code, story page and both designs into ONE page: docs/index.html.
Run: python3 dashboards/build.py"""
import pathlib
root = pathlib.Path(__file__).parent
docs = root.parent / "docs"
read = lambda p: (root / p).read_text()
stats = "const STATS=" + read("data/story_stats.json") + ";"
data = "const DATA=" + read("data/models.json") + ";"
out = (read("src/index.html").replace("/*CSS*/", read("src/common.css")).replace("/*D3*/", read("vendor/d3.min.js"))
       .replace("/*DATA*/", data).replace("/*STATS*/", stats).replace("/*STORY*/", read("src/story.js")).replace("/*INSIGHTS*/", read("src/insights.js")).replace("/*COMMON*/", read("src/common.js"))
       .replace("/*A*/", read("src/a.part.html")).replace("/*B*/", read("src/b.part.html"))
       .replace("/*APAGE*/", read("src/a.js")).replace("/*BPAGE*/", read("src/b.js")))
(docs / "index.html").write_text(out)
print("wrote", docs / "index.html", len(out) // 1024, "KB")
