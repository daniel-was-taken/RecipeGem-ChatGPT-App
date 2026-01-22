import { useMemo } from "react";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Clock } from "@openai/apps-sdk-ui/components/Icon";
import { Markdown } from "@openai/apps-sdk-ui/components/Markdown"
import { useToolInput, useToolOutput, useWidgetState } from "./openai";
import { Image } from "@openai/apps-sdk-ui/components/Image";
import useEmblaCarousel from 'embla-carousel-react';
// import { ArrowLeft, ArrowRight } from "lucide-react";
// import RecipeCard from "./RecipeCard";

export type Recipe = {
  id: string;
  imageUrl: string;
  cuisine: string[];
  title: string;
  affordability: string;
  complexity: string;
  duration: number;
  ingredients: string[];
  steps: string[];
  dietaryLabels: string[];
}

type ToolOutput = {
  cuisine: string[];
  results: Recipe[];
  selected?: Recipe | null;
  applied_filters: { min_duration?: number; sort?: "duration" | "complexity" };
};


type WidgetState = {
  cuisine?: string;
  min_duration?: number;
  sort?: "duration" | "complexity";
  selected_id?: string | null;
};


export function Widget() {
  const toolInput = useToolInput() ?? {};
  const toolOutput = (useToolOutput() ?? {}) as Partial<ToolOutput>;

  const [state, setState] = useWidgetState<WidgetState>(() => ({
    cuisine: toolInput.cuisine,
    min_duration: toolInput.min_duration,
    sort: toolInput.sort,
    selected_id: null,
  }));

  const [emblaRef] = useEmblaCarousel({
    align: "center",
    loop: false,
    containScroll: "trimSnaps",
  })


  const results: Recipe[] = toolOutput.results ?? [];
  const selected: Recipe | null =
    (toolOutput.selected as Recipe | null | undefined) ??
    (state.selected_id ? results.find((s) => s.id === state.selected_id) ?? null : null);

  const canCallTool = typeof window.openai?.callTool === "function";

  const header = useMemo(() => {
    const cuisineArr = toolOutput.cuisine ?? [];
    return cuisineArr.length ? `Recipes in ${cuisineArr.join(", ")}` : "RecipeGem";
  }, [toolOutput.cuisine]);


  async function selectRecipe(id: string) {
    const cuisineList = toolOutput.cuisine ??
  (state.cuisine ? state.cuisine.split(",").map(s => s.trim()).filter(Boolean) : []);


    setState({ ...state, selected_id: id });

    if (canCallTool) {
      await window.openai.callTool!("explore_recipe", {
        cuisine: cuisineList,
        min_duration: state.min_duration,
        sort: state.sort,
        selected_id: id,
      });
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-secondary text-sm">ChatGPT App Widget</p>
          <h2 className="heading-lg">{header}</h2>
          <p className="text-secondary text-sm mt-1">
            Mock data • component-initiated tool calls
          </p>
        </div>
        <Badge color="info">{results.length} results</Badge>
      </div>

      {/* Results + Details */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-default bg-surface p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="heading-md">Results</h3>
            <div className="text-xs text-secondary">
              Sorted by {toolOutput.applied_filters?.sort ?? state.sort ?? "duration"}
            </div>
          </div>

          <div className="mt-3">
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex touch-pan-y touch-pinch-zoom -ml-3">
                {results.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="min-w-0 flex-[0_0_85%] sm:flex-[0_0_60%] lg:flex-[0_0_45%] pl-3"
                  >
                    <button
                      onClick={() => selectRecipe(recipe.id)}
                      className="w-full text-left rounded-2xl border border-subtle bg-default p-3 hover:shadow-sm transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="w-full">
                            <Image
                              src={recipe.imageUrl}
                              alt={recipe.title}
                              className="w-full aspect-square rounded-2xl object-cover ring ring-black/5 shadow-[0px_2px_6px_rgba(0,0,0,0.06)]"
                            />
                          </div>

                          <div className="font-medium mt-2 flex items-center justify-between">
                            {recipe.title}
                            <Badge color={recipe.duration >= 10 ? "success" : "info"}>
                              <Clock /> {recipe.duration} mins
                            </Badge>
                          </div>
                          <div className="text-sm text-secondary">
                            {recipe.cuisine.join(", ")} • {recipe.affordability} • {recipe.complexity}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {recipe.dietaryLabels.slice(0, 3).map((b) => (
                              <Badge key={b} color="info">{b}</Badge>
                            ))}
                          </div>
                        </div>


                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {results.length === 0 && (
              <div className="text-sm text-secondary py-6 text-center">
                No results. Try another recipe.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-3 shadow-sm">
          <h3 className="heading-lg">Details</h3>
          <div className="mt-3">
            {!selected ? (
              <div className="text-sm text-secondary">
                Select a recipe to view details.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-large">{selected.title}</div>
                    <div className="text-sm text-secondary">
                      {selected.cuisine.join(", ")} • {selected.affordability} • {selected.complexity}
                    </div>
                  </div>
                  <Badge color="success"><Clock /> {selected.duration} mins</Badge>
                </div>

                <div>
                  <Markdown>
                    {(() => {
                      const ingredientsList = selected.ingredients.map((item) => `- ${item}`).join("\n");
                      const stepsList = selected.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
                      return `#### Ingredients\n\n${ingredientsList}\n#### Steps\n\n${stepsList}`;
                    })()}
                  </Markdown>
                </div>

                <Button
                  variant="soft"
                  color="secondary"
                  onClick={() => window.openai?.sendFollowUpMessage?.({ prompt: `Compare "${selected.title}" to the other options in terms of ingredients, affordability, and complexity.` })}
                  disabled={!window.openai?.sendFollowUpMessage}
                  block
                >
                  Ask ChatGPT to compare
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
