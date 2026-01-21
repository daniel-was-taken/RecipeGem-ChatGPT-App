import React from "react";
import { useMemo } from "react";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Clock } from "@openai/apps-sdk-ui/components/Icon";
import { Markdown } from "@openai/apps-sdk-ui/components/Markdown"
import { useToolInput, useToolOutput, useWidgetState } from "./openai";
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowLeft, ArrowRight } from "lucide-react";
import RecipeCard from "./RecipeCard";

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
  cuisine: string;
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

const [emblaRef, emblaApi] = useEmblaCarousel({
  align: "center",
  loop: false,
  containScroll: "trimSnaps",
  slidesToScroll: "auto",
  dragFree: false,
});
const [canPrev, setCanPrev] = React.useState(false);
const [canNext, setCanNext] = React.useState(false);

React.useEffect(() => {
  if (!emblaApi) return;
  const updateButtons = () => {
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  };
  updateButtons();
  emblaApi.on("select", updateButtons);
  emblaApi.on("reInit", updateButtons);
  return () => {
    emblaApi.off("select", updateButtons);
    emblaApi.off("reInit", updateButtons);
  };
}, [emblaApi]);

export function Widget() {
  const toolInput = useToolInput() ?? {};
  const toolOutput = (useToolOutput() ?? {}) as Partial<ToolOutput>;

  const [state, setState] = useWidgetState<WidgetState>(() => ({
    cuisine: toolInput.cuisine,
    min_duration: toolInput.min_duration,
    sort: toolInput.sort,
    selected_id: null,
  }));


  const results: Recipe[] = toolOutput.results ?? [];
  const selected: Recipe | null =
    (toolOutput.selected as Recipe | null | undefined) ??
    (state.selected_id ? results.find((s) => s.id === state.selected_id) ?? null : null);

  const canCallTool = typeof window.openai?.callTool === "function";

  const header = useMemo(() => {
    const cuisine = toolOutput.cuisine ?? state.cuisine ?? "";
    return cuisine ? `Recipes in ${cuisine}` : "RecipeGem";
  }, [toolOutput.cuisine, state.cuisine]);


  async function selectRecipe(id: string) {
    const cuisine = (toolOutput.cuisine ?? state.cuisine ?? "").trim();
    const min_duration = state.min_duration;
    const sort = state.sort;

    setState({ ...state, selected_id: id });

    if (canCallTool) {
      await window.openai.callTool!("explore_recipe", { cuisine, min_duration, sort, selected_id: id });
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

          <div className="mt-3 flex flex-col gap-2">
            {results.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => selectRecipe(recipe.id)}
                className="text-left rounded-2xl border border-subtle bg-default p-3 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{recipe.title}</div>
                    <div className="text-sm text-secondary">
                      {recipe.cuisine.join(", ")} • {recipe.affordability} • {recipe.complexity}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {recipe.dietaryLabels.slice(0, 3).map((b) => (
                        <Badge key={b} color="info">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Badge color={recipe.duration >= 10 ? "success" : "info"}>
                    <Clock /> {recipe.duration} mins
                  </Badge>
                </div>
              </button>



            ))}


            {results.length === 0 && (
              <div className="text-sm text-secondary py-6 text-center">
                No results. Try another recipe.
              </div>
            )}
          </div>
        </div>

        <div className="antialiased relative w-full text-black py-5 bg-white">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4 max-sm:mx-5 items-stretch">
              {results.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </div>
          {/* Edge gradients */}
          <div
            aria-hidden
            className={
              "pointer-events-none absolute inset-y-0 left-0 w-3 z-[5] transition-opacity duration-200 " +
              (canPrev ? "opacity-100" : "opacity-0")
            }
          >
            <div
              className="h-full w-full border-l border-black/15 bg-gradient-to-r from-black/10 to-transparent"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
              }}
            />
          </div>
          <div
            aria-hidden
            className={
              "pointer-events-none absolute inset-y-0 right-0 w-3 z-[5] transition-opacity duration-200 " +
              (canNext ? "opacity-100" : "opacity-0")
            }
          >
            <div
              className="h-full w-full border-r border-black/15 bg-gradient-to-l from-black/10 to-transparent"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
              }}
            />
          </div>
          {canPrev && (
            <Button
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 shadow-lg"
              color="secondary"
              size="sm"
              variant="soft"
              uniform
              onClick={() => emblaApi && emblaApi.scrollPrev()}
              type="button"
            >
              <ArrowLeft
                strokeWidth={1.5}
                className="h-4.5 w-4.5"
                aria-hidden="true"
              />
            </Button>
          )}
          {canNext && (
            <Button
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 shadow-lg"
              color="secondary"
              size="sm"
              variant="soft"
              uniform
              onClick={() => emblaApi && emblaApi.scrollNext()}
              type="button"
            >
              <ArrowRight
                strokeWidth={1.5}
                className="h-4.5 w-4.5"
                aria-hidden="true"
              />
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-default bg-surface p-3 shadow-sm">
          <h3 className="heading-md">Details</h3>
          <div className="mt-3">
            {!selected ? (
              <div className="text-sm text-secondary">
                Select a recipe to view details.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{selected.title}</div>
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
                      return `### Ingredients\n\n${ingredientsList}\n### Steps\n\n${stepsList}`;
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
