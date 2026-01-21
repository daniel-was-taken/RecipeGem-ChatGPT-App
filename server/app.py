from __future__ import annotations

import json
from pathlib import Path
from typing import Literal, Optional

from fastmcp import FastMCP
from fastmcp.resources import ResourceResult, ResourceContent
from fastmcp.tools.tool import ToolResult
from mcp.types import TextContent

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "recipe.json"
WEB_DIST = ROOT / "web" / "dist"

WIDGET_URI = "ui://widget/recipe.html"

def load_recipe():
  return json.loads(DATA_PATH.read_text(encoding="utf-8"))

def find_built_asset(suffix: str) -> str:
  """
  Find the first asset in web/dist/assets that ends with suffix, return its text.
  """
  assets_dir = WEB_DIST / "assets"
  candidates = sorted(assets_dir.glob(f"*{suffix}"))
  if not candidates:
    raise FileNotFoundError(f"No built asset ending with {suffix} found in {assets_dir}. Did you run `npm run build`?")
  return candidates[-1].read_text(encoding="utf-8")

def build_widget_html() -> str:
  """
  Apps SDK expects HTML templates served as `text/html+skybridge` that can inline JS/CSS. :contentReference[oaicite:13]{index=13}
  """
  js = find_built_asset(".js")
  css = find_built_asset(".css")

  return f"""
<div id="root"></div>
<style>{css}</style>
<script type="module">
{js}
</script>
""".strip()


mcp = FastMCP(
  name="RecipeGem",
  instructions="""
This server powers a demo ChatGPT app widget.
Use explore_stays to browse recipe data.
All data is local mock JSON; no external calls.
""".strip(),
)

# --- UI template resource (ChatGPT loads this when outputTemplate points to it) ---
# Needs mime_type="text/html+skybridge" :contentReference[oaicite:14]{index=14}
@mcp.resource(
  uri=WIDGET_URI,
  name="RecipeGem Widget",
  description="UI bundle for the RecipeGem widget.",
  mime_type="text/html+skybridge",
  meta={"openai/widgetPrefersBorder": True},
)
def recipe_widget() -> ResourceResult:
  html = build_widget_html()
  return ResourceResult(
    contents=[
      ResourceContent(content=html, mime_type="text/html+skybridge"),
    ],
    meta={"openai/widgetPrefersBorder": True},
  )


# --- Tool ---
@mcp.tool(
  name="explore_recipe",
  description=(
    "Browse recipes from mock data by cuisine, title, optional complexity filter, sort, and optional selected_id.\n"
    "Use this when the user wants to explore recipes by cuisine and see an interactive list."
  ),
  annotations={
    "title": "Explore recipes",
    "readOnlyHint": True,
    "idempotentHint": True,
    "openWorldHint": False,
    "destructiveHint": False,
  },
  # Apps SDK requires tool metadata like outputTemplate and widgetAccessible. :contentReference[oaicite:15]{index=15}
  meta={
    "securitySchemes": [{"type": "noauth"}],
    "openai/outputTemplate": WIDGET_URI,
    "openai/widgetAccessible": True,
    "openai/toolInvocation/invoking": "Searching recipes…",
    "openai/toolInvocation/invoked": "Results ready",
  },
)
def explore_recipe(
  cuisine: list[str],
  min_duration: Optional[float] = None,
  sort: Literal["duration", "complexity"] = "duration",
  selected_id: Optional[str] = None,
) -> ToolResult:
  data = load_recipe()
  recipes = data.get("meals", [])

  # Normalize input: replace & with and for flexible matching
  cuisine_norm = [c.strip().lower().replace(" & ", " and ") for c in cuisine]
  print("Normalized cuisine:", cuisine_norm)
  # Check if cuisine is in the recipe's cuisine array, handling & vs and
  filtered = [r for r in recipes if any(c.strip().lower().replace(" & ", " and ") in cuisine_norm for c in r["cuisine"])]
  if min_duration is not None:
    filtered = [r for r in filtered if float(r.get("duration", 0)) >= float(min_duration)]
  reverse = True if sort == "duration" else False
  key = "complexity" if sort == "complexity" else "duration"
  filtered.sort(key=lambda s: s.get(key, 0), reverse=reverse)

  selected = None
  if selected_id:
    for s in filtered:
      if s["id"] == selected_id:
        selected = s
        break

  structured = {
    "cuisine": ', '.join(cuisine),
    "results": filtered,
    "selected": selected,
    "applied_filters": {"min_duration": min_duration, "sort": sort},
  }

  # Include the Apps SDK meta again at response time (some clients check response meta). :contentReference[oaicite:16]{index=16}
  return ToolResult(
    content=[TextContent(type="text", text=f"Found {len(filtered)} recipes in {', '.join(cuisine)}.")],
    structured_content=structured,
    meta={
      "openai/outputTemplate": WIDGET_URI,
      "openai/widgetAccessible": True,
    },
  )


if __name__ == "__main__":
  mcp.run(transport="http", host="127.0.0.1", port=8000)
