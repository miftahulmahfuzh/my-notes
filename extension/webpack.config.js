const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

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
      extensions: ['.tsx', '.ts', '.js']
    },
    plugins: [
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
          { from: 'assets', to: 'assets', noErrorOnMissing: true }
        ]
      })
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