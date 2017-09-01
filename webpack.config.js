const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const MonacoEditorSrc = path.join(__dirname, 'node_modules', 'react-monaco-editor');
const VSMonacoEditorSrc = path.join(__dirname, 'node_modules', 'monaco-editor', 'min', 'vs');

let distDir = path.resolve(__dirname, 'dist');

module.exports = {
    entry: {
        jsx: './src/index.tsx',
        // html: './public/index.html',
        // vendor: ['react', 'react-dom']
    },
    output: {
        path: distDir,
        filename: 'index.js',
        publicPath: './',
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        alias: {'react-monaco-editor': MonacoEditorSrc}
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: [
                    'react-hot-loader',
                    'babel-loader?presets[]=env',
                    'ts-loader'
                ],
            },
        ],
    },
    devServer: {
        contentBase: distDir,
        publicPath: '/',
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'public/index.html'
        }),
        new CopyWebpackPlugin([
            { from: VSMonacoEditorSrc, to: 'vs', },
            { from: 'public/index.css', to: 'index.css', },
            { from: 'public/lean_logo.svg', to: 'lean_logo.svg', },
        ]),
    ],
    node: {
        child_process: 'empty',
        readline: 'empty',
    },
    externals: {
        // react: 'require("react")',
        // 'react-dom': 'require("react-dom")',
    },
}