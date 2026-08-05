import type { RuleSetRule } from "webpack";

/** Webpack loaders shared by the main and renderer processes. */
export const rules: RuleSetRule[] = [
  {
    exclude: /(node_modules|\.webpack)/,
    test: /\.tsx?$/,
    use: {
      loader: "esbuild-loader",
      options: {
        target: "es2022",
      },
    },
  },
];
