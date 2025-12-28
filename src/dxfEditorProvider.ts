import * as vscode from 'vscode';
import * as path from 'path';

export class DxfEditorProvider implements vscode.CustomReadonlyEditorProvider {

    public static readonly viewType = 'stgen.dxfViewer';

    private static activeWebview: vscode.WebviewPanel | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new DxfEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(
            DxfEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        );
    }

    public static getActiveWebview(): vscode.WebviewPanel | undefined {
        return this.activeWebview;
    }

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => {} };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        DxfEditorProvider.activeWebview = webviewPanel;

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.joinPath(this.context.extensionUri, 'out')
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(
            message => this.handleMessage(message, webviewPanel, document.uri),
            undefined,
            this.context.subscriptions
        );

        // When the panel becomes active
        webviewPanel.onDidChangeViewState(
            () => {
                if (webviewPanel.active) {
                    DxfEditorProvider.activeWebview = webviewPanel;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Load DXF file when webview is ready
        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                if (message.type === 'ready') {
                    await this.loadDxfFile(document.uri, webviewPanel);
                }
            },
            undefined,
            this.context.subscriptions
        );

        webviewPanel.onDidDispose(() => {
            if (DxfEditorProvider.activeWebview === webviewPanel) {
                DxfEditorProvider.activeWebview = undefined;
            }
        });
    }

    private async loadDxfFile(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const fileData = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder('utf-8').decode(fileData);

            webviewPanel.webview.postMessage({
                type: 'loadDxf',
                data: text,
                fileName: path.basename(uri.fsPath)
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load DXF file: ${error}`);
        }
    }

    private handleMessage(
        message: any,
        webviewPanel: vscode.WebviewPanel,
        _documentUri: vscode.Uri
    ): void {
        switch (message.type) {
            case 'captured':
                this.handleCapturedImage(message.data);
                break;
            case 'entitiesExtracted':
                this.handleExtractedEntities(message.data);
                break;
            case 'error':
                vscode.window.showErrorMessage(`DXF Viewer Error: ${message.message}`);
                break;
            case 'info':
                vscode.window.showInformationMessage(message.message);
                break;
        }
    }

    private async handleCapturedImage(dataUrl: string): Promise<void> {
        const options = await vscode.window.showQuickPick([
            { label: 'Save to File', value: 'save' },
            { label: 'Copy Path to Clipboard', value: 'clipboard' }
        ], { placeHolder: 'What do you want to do with the capture?' });

        if (!options) {
            return;
        }

        if (options.value === 'save') {
            const uri = await vscode.window.showSaveDialog({
                filters: { 'PNG Images': ['png'] },
                defaultUri: vscode.Uri.file('dxf-capture.png')
            });

            if (uri) {
                const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                await vscode.workspace.fs.writeFile(uri, buffer);
                vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
            }
        } else {
            // Save to temp file and copy path
            const os = require('os');
            const tempPath = path.join(os.tmpdir(), `dxf-capture-${Date.now()}.png`);
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const fs = require('fs');
            fs.writeFileSync(tempPath, buffer);

            await vscode.env.clipboard.writeText(tempPath);
            vscode.window.showInformationMessage(
                `Image saved to ${tempPath} (path copied to clipboard). Share this with Claude Code.`
            );
        }
    }

    private async handleExtractedEntities(data: string): Promise<void> {
        await vscode.env.clipboard.writeText(data);
        vscode.window.showInformationMessage(
            'Entity data copied to clipboard. You can paste it in Claude Code chat.'
        );
    }

    public static requestCapture(): void {
        if (this.activeWebview) {
            this.activeWebview.webview.postMessage({ type: 'requestCapture' });
        } else {
            vscode.window.showErrorMessage('No active DXF viewer');
        }
    }

    public static requestExtractEntities(): void {
        if (this.activeWebview) {
            this.activeWebview.webview.postMessage({ type: 'requestEntities' });
        } else {
            vscode.window.showErrorMessage('No active DXF viewer');
        }
    }

    public static requestFitView(): void {
        if (this.activeWebview) {
            this.activeWebview.webview.postMessage({ type: 'fitView' });
        } else {
            vscode.window.showErrorMessage('No active DXF viewer');
        }
    }

    public static requestAddAnnotation(): void {
        if (this.activeWebview) {
            this.activeWebview.webview.postMessage({ type: 'startAnnotation' });
        } else {
            vscode.window.showErrorMessage('No active DXF viewer');
        }
    }

    public static requestClearAnnotations(): void {
        if (this.activeWebview) {
            this.activeWebview.webview.postMessage({ type: 'clearAnnotations' });
        } else {
            vscode.window.showErrorMessage('No active DXF viewer');
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.css')
        );

        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src 'nonce-${nonce}';
        img-src ${webview.cspSource} data: blob:;
        font-src ${webview.cspSource};
    ">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>DXF Viewer</title>
</head>
<body>
    <div id="viewer-container"></div>
    <div id="toolbar">
        <button id="btn-zoom-fit" title="Fit View">Fit</button>
        <button id="btn-zoom-in" title="Zoom In">+</button>
        <button id="btn-zoom-out" title="Zoom Out">-</button>
        <span class="separator">|</span>
        <button id="btn-capture" title="Capture View">Capture</button>
        <button id="btn-extract" title="Extract Entities">Extract</button>
        <span class="separator">|</span>
        <button id="btn-annotate-text" title="Add Text Annotation">T</button>
        <button id="btn-annotate-arrow" title="Add Arrow">→</button>
        <button id="btn-annotate-rect" title="Add Rectangle">□</button>
        <button id="btn-clear-annotations" title="Clear Annotations">Clear</button>
    </div>
    <div id="status-bar">
        <span id="status-text">Ready</span>
        <span id="coords"></span>
    </div>
    <div id="loading" style="display: none;">
        <div class="spinner"></div>
        <span>Loading DXF...</span>
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
