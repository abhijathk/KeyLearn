/* eslint-disable n/no-extraneous-import */

import { join } from "node:path";
import { intlTransformer } from "@keylearn/scripts/intl-transformer.js";
import { ENV } from "@keylearn/thirdparties/webpack-env.js";
import CompressionPlugin from "compression-webpack-plugin";
import CssMinimizerPlugin from "css-minimizer-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import TerserPlugin from "terser-webpack-plugin";
import webpack from "webpack";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import { ManifestPlugin } from "./webpack-manifest.js";

const mode = process.env.NODE_ENV || "production";

console.log("webpack build time environment", ENV);

const isVendor = (excludedVendors) => {
  const vendorsDir = join(import.meta.dirname, "node_modules");
  return ({ resource }) => {
    // A vendor package is anything in the root /node_modules/ dir
    // except for some explicitly excluded packages.
    // Packages in the nested /node_modules/ dirs are not vendors.
    return (
      resource != null &&
      resource.startsWith(vendorsDir) &&
      !excludedVendors.some((excluded) =>
        resource.startsWith(join(vendorsDir, excluded)),
      )
    );
  };
};

const dev = mode === "development";
const filename = dev ? "[name]" : "[contenthash:16]";
const chunkFilename = dev ? "[name]" : "[contenthash:16]";
const assetModuleFilename = dev ? "[name]" : "[contenthash:16]";
const localIdentName = dev
  ? "[name]__[local]__[hash:base64:10]"
  : "[hash:base64:10]";

const rule_ts = () => ({
  test: /\.(ts|tsx)$/,
  type: "javascript/auto",
  use: [
    {
      loader: "ts-loader",
      options: {
        transpileOnly: true,
        compilerOptions: {
          target: "es2024",
          module: "esnext",
          moduleResolution: "bundler",
          jsx: mode === "development" ? "react-jsxdev" : "react-jsx",
        },
        getCustomTransformers: () => ({
          before: [intlTransformer()],
        }),
      },
    },
  ],
});

const rule_js = () => ({
  test: /\.(js|jsx)$/,
  type: "javascript/auto",
  use: [
    {
      loader: "source-map-loader",
    },
  ],
});

const rule_less = (emit) => ({
  test: /\.less$/,
  use: [
    {
      loader: MiniCssExtractPlugin.loader,
      options: {
        emit,
      },
    },
    {
      loader: "css-loader",
      options: {
        modules: {
          auto: true,
          namedExport: true,
          exportGlobals: true,
          exportLocalsConvention: "dashesOnly",
          localIdentName,
        },
      },
    },
    {
      loader: "less-loader",
    },
  ],
});

export default [
  {
    name: "server",
    target: "node",
    mode,
    context: import.meta.dirname,
    entry: {
      index: "./packages/server/lib/main.ts",
      keylearn: "./packages/server-cli/lib/main.ts",
    },
    output: {
      path: join(import.meta.dirname, "root", "lib"),
      clean: false,
      filename: "[name].js",
      chunkFilename: "[name].js",
      assetModuleFilename: `[name][ext]`,
    },
    module: {
      rules: [
        rule_ts(),
        rule_js(),
        rule_less(false),
        {
          test: /\/assets\//,
          use: "null-loader",
        },
        {
          test: /\/knex\/lib\/dialects\//,
          exclude: /\/mysql|sqlite3|better-sqlite3\//,
          use: "null-loader",
        },
        {
          test: /\/knex\/lib\/migrations\//,
          use: "null-loader",
        },
      ],
    },
    externals: {
      // Native addons: required at runtime from node_modules rather than
      // bundled. sherpa-onnx carries a prebuilt binary per platform, which is
      // what lets one set of neural voices ship to mac, windows and linux
      // without anything being installed on the machine.
      "sherpa-onnx-node": "commonjs sherpa-onnx-node",
      "sqlite3": "commonjs sqlite3",
      "better-sqlite3": "commonjs better-sqlite3",
      "bufferutil": "commonjs bufferutil",
      "utf-8-validate": "commonjs utf-8-validate",
    },
    optimization: {
      minimize: false,
      moduleIds: "named",
      chunkIds: "named",
    },
    devtool: dev ? "source-map" : false,
    plugins: [
      new webpack.DefinePlugin({
        ...ENV,
        "typeof window": JSON.stringify("undefined"),
      }),
      new MiniCssExtractPlugin(),
    ],
  },
  {
    name: "browser",
    target: "web",
    mode,
    context: import.meta.dirname,
    entry: {
      browser: "./packages/keylearn-pages-browser/lib/entry.ts",
      server: "./packages/keylearn-pages-server/lib/entry.ts",
    },
    output: {
      path: join(import.meta.dirname, "root", "public", "assets"),
      clean: true,
      publicPath: "/assets/",
      filename: `${filename}.js`,
      chunkFilename: `${chunkFilename}.js`,
      assetModuleFilename: `${assetModuleFilename}[ext]`,
    },
    module: {
      rules: [
        rule_ts(),
        rule_js(),
        rule_less(true),
        {
          test: /\/assets\//,
          type: "asset/resource",
        },
      ],
    },
    optimization: {
      minimizer: [new TerserPlugin(), new CssMinimizerPlugin()],
      splitChunks: {
        cacheGroups: {
          vendor: {
            // `three` stays out of the shared vendor bundle deliberately: it
            // is only used by the kids page's dino world (already
            // route-lazy-loaded), and sweeping it into "shared-vendor" —
            // which every page loads up front — would ship it to every
            // adult practice session that never visits /kids.
            test: isVendor(["tslib", "@mdi", "three"]),
            chunks: "all",
            name: "shared-vendor",
          },
          widget: {
            test: /\/keylearn-widget\//,
            chunks: "all",
            name: "shared-widget",
          },
          keyboard: {
            test: /\/keylearn-keyboard\//,
            chunks: "all",
            name: "shared-keyboard",
          },
          styles: {
            type: "css/mini-extract",
            chunks: "all",
            name: "styles",
          },
        },
      },
    },
    devtool: dev ? "source-map" : false,
    plugins: [
      new webpack.DefinePlugin({
        ...ENV,
        "typeof window": JSON.stringify("object"),
      }),
      new MiniCssExtractPlugin({
        filename: `${filename}.css`,
        chunkFilename: `${chunkFilename}.css`,
        ignoreOrder: true,
      }),
      new ManifestPlugin(),
      ...(dev
        ? []
        : [
            new CompressionPlugin({
              test: /\.(js|css|svg|data)$/,
              filename: "[file].gz",
              algorithm: "gzip",
            }),
            new CompressionPlugin({
              test: /\.(js|css|svg|data)$/,
              filename: "[file].br",
              algorithm: "brotliCompress",
            }),
          ]),
      new BundleAnalyzerPlugin({
        analyzerMode: process.env.ANALYZE ? "static" : "disabled",
        openAnalyzer: false,
        reportFilename: join(import.meta.dirname, "bundle-report.html"),
        generateStatsFile: Boolean(process.env.ANALYZE),
        statsFilename: join(import.meta.dirname, "bundle-stats.json"),
      }),
    ],
    performance: {
      maxAssetSize: 1048576,
      maxEntrypointSize: 1048576,
    },
  },
];
