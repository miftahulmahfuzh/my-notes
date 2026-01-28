const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

// Provide process polyfill
const { ProvidePlugin } = webpack;

// Load environment variables from .env files
// Priority: .env.{mode}.local > .env.{mode} > .env.local > .env
const loadEnv = (mode) => {
  const envFiles = [
    `.env.${mode}.local`,
    `.env.${mode}`,
    '.env.local',
    '.env'
  ];

  const envVars = {};
  envFiles.forEach(file => {
    try {
      const filePath = path.resolve(__dirname, file);
      const result = dotenv.config({ path: filePath });
      if (result.parsed) {
        dotenvExpand({ parsed: result.parsed });
        Object.assign(envVars, result.parsed);
      }
    } catch (e) {
      // File doesn't exist, skip
    }
  });

  return envVars;
};

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const mode = env && env.mode ? env.mode : (isProduction ? 'production' : 'development');
  const envVars = loadEnv(mode);

  return {
    entry: {
      popup: './src/popup/index.tsx',
      background: './src/background/index.ts',
      content: './src/content/index.ts',
      options: './src/options/index.tsx'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      fallback: {
        'process': require.resolve('process/browser'),
      }
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.browser': JSON.stringify(true),
        __CONFIG__: JSON.stringify({
          NODE_ENV: mode,
          API_BASE_URL: envVars.VITE_API_BASE_URL || 'http://localhost:8080',
        }),
      }),
      new HtmlWebpackPlugin({
        template: './src/popup/popup.html',
        filename: 'popup.html',
        chunks: ['popup']
      }),
      new HtmlWebpackPlugin({
        template: './src/options/options.html',
        filename: 'options.html',
        chunks: ['options']
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'src/popup/popup.css', to: 'popup.css' },
          { from: 'src/options/options.css', to: 'options.css' },
          { from: 'assets/*.png', to: '[name][ext]', noErrorOnMissing: true }
        ]
      }),
    ],
    devtool: isProduction ? false : 'source-map',
    watch: !isProduction,
    watchOptions: {
      ignored: /node_modules/
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            priority: 20
          },
          markdown: {
            test: /[\\/]node_modules[\\/](react-markdown|react-syntax-highlighter|remark-gfm|refractor|hastscript|mdast-util-)[\\/]/,
            name: 'markdown',
            priority: 15,
            enforce: true
          }
        }
      },
      usedExports: true,
      sideEffects: false
    },
    performance: {
      maxEntrypointSize: 244000,
      maxAssetSize: 244000,
      hints: 'warning'
    }
  };
};