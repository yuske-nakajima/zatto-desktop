import { rules } from './webpack.rules';

import type { Configuration } from 'webpack';

/** Webpack configuration for the Electron main process. */
export const mainConfig: Configuration = {
  entry: './src/main/index.ts',
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.ts'],
  },
};
