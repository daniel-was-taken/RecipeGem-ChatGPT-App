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
Use explore_recipe to browse recipe data.
All data is local mock JSON; no external calls.
""".strip(),
)

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
    "Browse recipes from JSON by cuisine." 
    "Use this when the user wants to explore recipes by cuisine and see an interactive list."
  ),
  annotations={
    "title": "Explore recipes",
    "readOnlyHint": True,
    "idempotentHint": False,
    "openWorldHint": False,
    "destructiveHint": False,
  },
  
  meta={
    "securitySchemes": [{"type": "noauth"}],
    "openai/outputTemplate": WIDGET_URI,
    "openai/widgetAccessible": True,
    "openai/toolInvocation/invoking": "Searching recipes…",
    "openai/toolInvocation/invoked": "Results ready",
  },
  tags={"catalog", "search"},
)
def explore_recipe(
  cuisine: list[str],
  sort = "duration",
  selected_id: Optional[str] = None,
) -> ToolResult:
  data = load_recipe()
  
  recipes = data.get("meals", [])

  # Normalisation of input
  cuisine_norm = [c.strip().lower().replace(" & ", " and ") for c in cuisine if c.strip()]
  
  if cuisine_norm and all(c in ['any', 'all'] for c in cuisine_norm):
    cuisine_norm = []
        
  print("Cuisine filter:", cuisine)
  print("Normalized cuisine:", cuisine_norm)
  
  if cuisine_norm:
    filtered = [
      r for r in recipes if any(
        # c.strip().lower().replace(" & ", " and ") in cuisine_norm for c in r["cuisine"]
        c_norm in [rc.strip().lower().replace(" & ", " and ") for rc in r["cuisine"]] for c_norm in cuisine_norm
      )
    ]
  else:
    filtered = list(recipes)

  filtered.sort(key=lambda s: s.get("duration", 0), reverse=False)

  selected = None
  if selected_id:
    for s in filtered:
      if s["id"] == selected_id:
        selected = s
        break
      
  structured = {
    "cuisine": cuisine,
    "results": filtered,
    "selected": selected,
    "applied_filters": {"sort": sort},
  }
  

  cuisine_label = ", ".join(cuisine) if cuisine else "all cuisines"
  return ToolResult(
    content=[TextContent(type="text", text=f"Found {len(filtered)} recipes in {cuisine_label}.")],
    structured_content=structured,
    meta={
      "openai/outputTemplate": WIDGET_URI,
      "openai/widgetAccessible": True,
    },
  )


if __name__ == "__main__":
  mcp.run(transport="http", host="127.0.0.1", port=8000)

