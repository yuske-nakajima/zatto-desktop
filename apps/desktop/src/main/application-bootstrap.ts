/** Operations that register Electron's desktop application lifecycle. */
export interface DesktopApplicationBootstrapDependencies {
  isServerProbe: boolean;
  isSquirrelStartup: boolean;
  registerBeforeQuit: () => void;
  registerWindowAllClosed: () => void;
  startWhenReady: () => void;
}

/**
 * Registers application startup unless Squirrel.Windows owns the process.
 *
 * @param dependencies - Runtime mode and Electron lifecycle registration operations
 * @returns Nothing
 */
export function bootstrapDesktopApplication(
  dependencies: DesktopApplicationBootstrapDependencies,
): void {
  if (dependencies.isSquirrelStartup) return;
  if (!dependencies.isServerProbe) dependencies.registerBeforeQuit();
  dependencies.registerWindowAllClosed();
  dependencies.startWhenReady();
}
