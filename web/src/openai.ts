import { useSyncExternalStore } from "react";

const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

type OpenAiGlobals = {
  toolInput?: any;
  toolOutput?: any;
  toolResponseMetadata?: any;
  widgetState?: any;
  theme?: "light" | "dark";
  displayMode?: "inline" | "pip" | "fullscreen";
  setWidgetState?: (state: any) => void;
  callTool?: (name: string, args: any) => Promise<any>;
  sendFollowUpMessage: (args: { prompt: string }) => Promise<void>;  
};

declare global {
  interface Window {
    openai: OpenAiGlobals;
  }
}

/**
 * Reactively read a single window.openai global.
 * The Apps SDK docs recommend listening to `openai:set_globals`. :contentReference[oaicite:7]{index=7}
 */
export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(key: K): OpenAiGlobals[K] {
  return useSyncExternalStore(
    (onChange) => {
      const handler = (event: any) => {
        if (event?.detail?.globals?.[key] !== undefined) onChange();
      };
      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handler, { passive: true });
      return () => window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handler);
    },
    () => window.openai?.[key]
  );
}

export function useToolInput() {
  return useOpenAiGlobal("toolInput");
}
export function useToolOutput() {
  return useOpenAiGlobal("toolOutput");
}
export function useWidgetState<T>(init: () => T): [T, (next: T) => void] {
  const widgetState = (useOpenAiGlobal("widgetState") as T | undefined) ?? init();
  const setWidgetState = window.openai?.setWidgetState;

  const set = (next: T) => {
    setWidgetState?.(next);
  };
  return [widgetState, set];
}
