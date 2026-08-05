import type { Configuration } from "webpack";
import { rules } from "./webpack.rules";

/** Webpack configuration for the Electron main process. */
export const mainConfig: Configuration = {
  entry: "./src/main/index.ts",
  module: {
    rules,
  },
  resolve: {
    extensions: [".js", ".ts"],
  },
};
