/** Minimal manager state used to choose content for a recreated window. */
export interface WindowManagerState {
  ownership?: { url: string };
  status: "failed" | "idle" | "running" | "starting" | "stopping";
}

/** Content selected for a desktop window. */
export type WindowTarget =
  | { kind: "error" }
  | { kind: "preparation" }
  | { kind: "zatto"; url: string };

/** Operations for the preparation-to-zatto startup sequence. */
export interface WindowStartupOperations<Generation> {
  createGeneration: () => Generation;
  loadError: (generation: Generation) => Promise<unknown>;
  loadPreparation: (generation: Generation) => Promise<"closed" | "loaded">;
  loadZatto: (
    generation: Generation,
    url: string,
  ) => Promise<"closed" | "loaded">;
  startServer: () => Promise<{ url: string }>;
}

/**
 * Chooses content that represents the observable server manager state.
 *
 * @param state - Current server manager state
 * @returns Preparation, zatto, or error target
 */
export function resolveWindowTarget(state: WindowManagerState): WindowTarget {
  if (state.status === "failed") return { kind: "error" };
  if (state.status === "running") {
    return state.ownership === undefined
      ? { kind: "error" }
      : { kind: "zatto", url: state.ownership.url };
  }
  return { kind: "preparation" };
}

/**
 * Loads preparation before server startup and converts failures to an error UI.
 *
 * @param operations - Screen loaders and validated server startup
 * @returns Final visible startup state
 */
export async function runWindowStartup<Generation>(
  operations: WindowStartupOperations<Generation>,
): Promise<"closed" | "failed" | "running"> {
  const generation = operations.createGeneration();
  try {
    const preparation = await operations.loadPreparation(generation);
    const ownership = await operations.startServer();
    if (preparation === "closed") return "closed";
    if ((await operations.loadZatto(generation, ownership.url)) === "closed") {
      return "closed";
    }
    return "running";
  } catch {
    try {
      await operations.loadError(generation);
    } catch {
      return "failed";
    }
    return "failed";
  }
}
