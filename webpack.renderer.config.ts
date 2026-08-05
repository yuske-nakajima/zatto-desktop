import { rules } from './webpack.rules';

import type { Configuration } from 'webpack';

/** Webpack configuration for the static renderer. */
export const rendererConfig: Configuration = {
  devtool: 'source-map',
  module: {
    rules: [
      ...rules,
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.ts', '.css'],
  },
};
