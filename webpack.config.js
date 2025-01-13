"use strict";
//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require("path");
const terserPlugin = require("terser-webpack-plugin");

/** @type WebpackConfig */
const config = {
	target: "node",
	entry: "./src/extension.ts",
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2",
		devtoolModuleFilenameTemplate: "../[resource-path]",
	},
	devtool: "source-map",
	externals: {
		vscode: "commonjs vscode",
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: "ts-loader",
					},
				],
			},
		],
	},
	optimization: {
		//MO DEV
		// minimize: true,
		minimizer: [new terserPlugin()],
	},
};

module.exports = [config];
