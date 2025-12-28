const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/webview/main.ts',
    output: {
        path: path.resolve(__dirname, 'media'),
        filename: 'webview.js'
    },
    resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            'three': path.resolve(__dirname, 'node_modules/three')
        }
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            configFile: 'tsconfig.webview.json'
                        }
                    }
                ],
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: 'src/webview/styles.css',
                    to: 'webview.css'
                }
            ]
        })
    ],
    performance: {
        hints: false
    },
    devtool: 'source-map',
    mode: 'development'
};
