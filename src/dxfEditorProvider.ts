import * as vscode from 'vscode';
import * as path from 'path';
import type { McpBridgeServer } from './mcp/bridge';

export class DxfEditorProvider implements vscode.CustomReadonlyEditorProvider {

    public static readonly viewType = 'stgen.dxfViewer';

    private static activeWebview: vscode.WebviewPanel | undefined;
    private static mcpBridge: McpBridgeServer | null = null;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public static setMcpBridge(bridge: McpBridgeServer): void {
        this.mcpBridge = bridge;
    }

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
            const text = this.decodeWithAutoDetect(fileData);
            const fileName = path.basename(uri.fsPath);

            webviewPanel.webview.postMessage({
                type: 'loadDxf',
                data: text,
                fileName: fileName
            });

            // Notify MCP bridge about the loaded file
            if (DxfEditorProvider.mcpBridge) {
                DxfEditorProvider.mcpBridge.updateState(fileName, uri.fsPath, text);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load DXF file: ${error}`);
        }
    }

    private decodeWithAutoDetect(data: Uint8Array): string {
        // First, try to detect encoding from $DWGCODEPAGE in the DXF header
        const asciiPreview = new TextDecoder('ascii', { fatal: false }).decode(data.slice(0, 5000));

        // Check for $DWGCODEPAGE setting
        // DXF format: $DWGCODEPAGE on one line, then "  3" (group code), then the codepage value
        // Note: Use DWGCODEPAGE without $ to avoid regex escaping issues
        const codepageMatch = asciiPreview.match(/DWGCODEPAGE\n\s*3\n([^\n\r]+)/i);
        if (codepageMatch) {
            const codepage = codepageMatch[1].trim().toUpperCase();
            console.log(`[DXF Viewer] Detected codepage: ${codepage}`);

            // Map AutoCAD codepages to JavaScript TextDecoder encodings
            const encodingMap: Record<string, string> = {
                'ANSI_949': 'euc-kr',      // Korean
                'ANSI_936': 'gb2312',      // Simplified Chinese
                'ANSI_950': 'big5',        // Traditional Chinese
                'ANSI_932': 'shift-jis',   // Japanese
                'ANSI_1252': 'windows-1252', // Western European
                'ANSI_1251': 'windows-1251', // Cyrillic
                'UTF-8': 'utf-8',
                'UTF8': 'utf-8'
            };

            const encoding = encodingMap[codepage];
            if (encoding) {
                console.log(`[DXF Viewer] Using encoding: ${encoding}`);
                try {
                    return new TextDecoder(encoding).decode(data);
                } catch (e) {
                    console.error(`[DXF Viewer] Failed to decode with ${encoding}:`, e);
                    // Fall through to auto-detection
                }
            } else {
                console.log(`[DXF Viewer] Unknown codepage: ${codepage}, falling back to auto-detection`);
            }
        } else {
            console.log('[DXF Viewer] No $DWGCODEPAGE found, using auto-detection');
        }

        // Try UTF-8 first
        const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(data);

        // Check if UTF-8 decode produced replacement characters or high-byte sequences
        // that indicate wrong encoding
        const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;

        // Also check for broken Korean patterns (EUC-KR bytes decoded as UTF-8)
        // EUC-KR Korean characters are in range 0xB0-0xC8 for first byte
        const hasBrokenKorean = this.detectBrokenKoreanEncoding(data);

        // If there are replacement characters OR broken Korean patterns, try EUC-KR
        if (replacementCount > 0 || hasBrokenKorean) {
            try {
                const eucKrText = new TextDecoder('euc-kr').decode(data);
                // Check if EUC-KR produces valid Korean text
                const hasKorean = /[\uAC00-\uD7AF]/.test(eucKrText);
                const eucKrReplacements = (eucKrText.match(/\uFFFD/g) || []).length;

                // Prefer EUC-KR if it has Korean characters and fewer/equal replacements
                if (hasKorean && eucKrReplacements <= replacementCount) {
                    return eucKrText;
                }
            } catch (e) {
                // Fall through
            }
        }

        // Default to UTF-8
        return utf8Text;
    }

    private detectBrokenKoreanEncoding(data: Uint8Array): boolean {
        // Check for EUC-KR byte patterns that indicate Korean text
        // EUC-KR Korean characters: first byte 0xB0-0xC8, second byte 0xA1-0xFE
        let consecutiveHighBytes = 0;
        for (let i = 0; i < Math.min(data.length, 10000); i++) {
            const byte = data[i];
            if (byte >= 0xB0 && byte <= 0xC8) {
                if (i + 1 < data.length) {
                    const nextByte = data[i + 1];
                    if (nextByte >= 0xA1 && nextByte <= 0xFE) {
                        consecutiveHighBytes++;
                        if (consecutiveHighBytes >= 3) {
                            return true; // Likely EUC-KR encoded Korean text
                        }
                    }
                }
            }
        }
        return false;
    }

    private handleMessage(
        message: any,
        webviewPanel: vscode.WebviewPanel,
        documentUri: vscode.Uri
    ): void {
        switch (message.type) {
            case 'captured':
                this.handleCapturedImage(message.data);
                break;
            case 'entitiesExtracted':
                this.handleExtractedEntities(message.data);
                break;
            case 'saveAnnotations':
                this.saveAnnotations(documentUri, message.data);
                break;
            case 'loadAnnotations':
                this.loadAnnotations(documentUri, webviewPanel);
                break;
            case 'error':
                vscode.window.showErrorMessage(`DXF Viewer Error: ${message.message}`);
                break;
            case 'info':
                vscode.window.showInformationMessage(message.message);
                break;
            case 'saveDxf':
                this.saveDxfFile(documentUri, message.data);
                break;
            case 'saveDxfAs':
                this.saveDxfFileAs(message.data, message.fileName);
                break;
            // MCP Bridge responses
            case 'mcp_response':
                if (DxfEditorProvider.mcpBridge && message.requestId) {
                    DxfEditorProvider.mcpBridge.handleWebviewResponse(
                        message.requestId,
                        message.data
                    );
                }
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

    private getAnnotationsFilePath(documentUri: vscode.Uri): vscode.Uri {
        return vscode.Uri.file(documentUri.fsPath + '.annotations.json');
    }

    private async saveAnnotations(documentUri: vscode.Uri, data: string): Promise<void> {
        try {
            const annotationsUri = this.getAnnotationsFilePath(documentUri);
            const buffer = Buffer.from(data, 'utf-8');
            await vscode.workspace.fs.writeFile(annotationsUri, buffer);
            vscode.window.showInformationMessage('Annotations saved successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save annotations: ${error}`);
        }
    }

    private async loadAnnotations(documentUri: vscode.Uri, webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const annotationsUri = this.getAnnotationsFilePath(documentUri);
            const data = await vscode.workspace.fs.readFile(annotationsUri);
            const text = new TextDecoder('utf-8').decode(data);
            webviewPanel.webview.postMessage({
                type: 'loadAnnotations',
                data: text
            });
        } catch (error) {
            // Silently ignore if annotations file doesn't exist
            webviewPanel.webview.postMessage({
                type: 'loadAnnotations',
                data: '[]'
            });
        }
    }

    /**
     * Saves DXF content to the original file
     */
    private async saveDxfFile(documentUri: vscode.Uri, dxfContent: string): Promise<void> {
        try {
            const buffer = Buffer.from(dxfContent, 'utf-8');
            await vscode.workspace.fs.writeFile(documentUri, buffer);
            vscode.window.showInformationMessage(`Saved: ${path.basename(documentUri.fsPath)}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save DXF file: ${error}`);
        }
    }

    /**
     * Saves DXF content to a new file (Save As)
     */
    private async saveDxfFileAs(dxfContent: string, suggestedFileName: string): Promise<void> {
        try {
            const uri = await vscode.window.showSaveDialog({
                filters: { 'DXF Files': ['dxf'] },
                defaultUri: vscode.Uri.file(suggestedFileName)
            });

            if (uri) {
                const buffer = Buffer.from(dxfContent, 'utf-8');
                await vscode.workspace.fs.writeFile(uri, buffer);
                vscode.window.showInformationMessage(`Saved: ${uri.fsPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save DXF file: ${error}`);
        }
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
    <div id="layer-toolbar">
        <span id="layer-toolbar-label">Layer:</span>
        <select id="layer-toolbar-select" title="Current Layer"></select>
        <div class="layer-toolbar-separator"></div>
        <div class="layer-toolbar-props">
            <span class="layer-toolbar-prop-label">Color:</span>
            <div id="layer-toolbar-color" class="layer-toolbar-color-box" title="Layer Color"></div>
            <span class="layer-toolbar-prop-label">LW:</span>
            <span id="layer-toolbar-lineweight" class="layer-toolbar-lineweight" title="Line Weight">0.25</span>
        </div>
        <div class="layer-toolbar-separator"></div>
        <button class="layer-toolbar-btn" id="layer-toolbar-on" title="Layer On/Off">
            <span>💡</span>
        </button>
        <button class="layer-toolbar-btn" id="layer-toolbar-freeze" title="Freeze/Thaw">
            <span>❄</span>
        </button>
        <button class="layer-toolbar-btn" id="layer-toolbar-lock" title="Lock/Unlock">
            <span>🔒</span>
        </button>
        <div class="layer-toolbar-separator"></div>
        <button class="layer-toolbar-btn" id="layer-toolbar-manager" title="Layer Manager">
            <span>⚙</span>
        </button>
        <div class="layer-toolbar-info">
            <span id="layer-toolbar-count">0 layers</span>
        </div>
        <button class="layer-toolbar-close" id="layer-toolbar-close" title="Close">&times;</button>
    </div>
    <div id="viewer-container"></div>
    <div id="drawing-mode-indicator" class="drawing-mode-indicator"></div>
    <div id="layer-panel">
        <div class="layer-panel-header">
            <h4>Layers</h4>
            <div class="layer-panel-actions">
                <button id="btn-layers-all" title="Show All">All</button>
                <button id="btn-layers-none" title="Hide All">None</button>
                <button id="btn-layers-close" title="Close">&times;</button>
            </div>
        </div>
        <div class="layer-current-row">
            <span class="layer-current-label">Current:</span>
            <select id="layer-current-select" title="Set Current Drawing Layer"></select>
            <button id="btn-layer-add" title="Add New Layer">+</button>
        </div>
        <div id="layer-list"></div>
    </div>
    <div id="properties-panel">
        <div class="properties-panel-header">
            <h4>Properties</h4>
            <button id="btn-properties-close" title="Close">&times;</button>
        </div>
        <div id="properties-content">
            <div class="no-selection">No entity selected</div>
        </div>
    </div>
    <div id="snap-panel">
        <div class="snap-panel-header">
            <h4>Snap Settings</h4>
            <button id="btn-snap-close" title="Close">&times;</button>
        </div>
        <div id="snap-types-list">
            <label class="snap-type-item"><input type="checkbox" data-snap="endpoint" checked> Endpoint</label>
            <label class="snap-type-item"><input type="checkbox" data-snap="midpoint" checked> Midpoint</label>
            <label class="snap-type-item"><input type="checkbox" data-snap="center" checked> Center</label>
            <label class="snap-type-item"><input type="checkbox" data-snap="quadrant"> Quadrant</label>
            <label class="snap-type-item"><input type="checkbox" data-snap="intersection"> Intersection</label>
            <label class="snap-type-item"><input type="checkbox" data-snap="perpendicular"> Perpendicular</label>
            <label class="snap-type-item"><input type="checkbox" data-snap="nearest"> Nearest</label>
        </div>
    </div>
    <div id="toolbar">
        <div class="toolbar-group">
            <span class="toolbar-label">View</span>
            <div class="button-row">
                <button id="btn-zoom-fit" title="Fit View (F)">Fit</button>
                <button id="btn-layers" title="Layer Manager">Layers</button>
                <button id="btn-properties" title="Toggle Properties Panel">Props</button>
            </div>
        </div>
        <span class="separator"></span>
        <div class="toolbar-group">
            <span class="toolbar-label">Settings</span>
            <div class="button-row">
                <button id="btn-snap" class="active" title="Toggle Snap (S)">Snap</button>
                <button id="btn-snap-settings" title="Snap Settings">⚙</button>
                <button id="btn-ortho" title="Toggle Ortho Mode">Ortho</button>
            </div>
        </div>
        <span class="separator"></span>
        <div class="toolbar-group">
            <span class="toolbar-label">Draw</span>
            <div class="button-row">
                <button id="btn-draw-line" title="Draw Line (L)">Line</button>
                <button id="btn-draw-circle" title="Draw Circle (C)">Circle</button>
                <button id="btn-draw-rect" title="Draw Rectangle (REC)">Rect</button>
            </div>
        </div>
        <span class="separator"></span>
        <div class="toolbar-group">
            <span class="toolbar-label">Dimension</span>
            <div class="button-row">
                <button id="btn-dim" title="Dimension (DLI)">Dim</button>
                <button id="btn-dim-hor" title="Horizontal Dimension (DH)">DimH</button>
                <button id="btn-dim-ver" title="Vertical Dimension (DV)">DimV</button>
                <button id="btn-dim-aligned" title="Aligned Dimension (DAL)">DimA</button>
                <button id="btn-dim-angular" title="Angular Dimension (DAN)">Dim∠</button>
            </div>
        </div>
        <span class="separator"></span>
        <div class="toolbar-group">
            <span class="toolbar-label">Export</span>
            <div class="button-row">
                <button id="btn-capture" title="Capture View as PNG">Capture</button>
                <button id="btn-extract" title="Extract Entities as Text">Extract</button>
            </div>
        </div>
        <span class="separator"></span>
        <div class="toolbar-group">
            <span class="toolbar-label">Annotation</span>
            <div class="button-row">
                <button id="btn-anno-text" title="Add Text Annotation">Text</button>
                <button id="btn-anno-arrow" title="Add Arrow/Leader">Arrow</button>
                <button id="btn-clear-annotations" title="Clear All Annotations">Clear</button>
                <button id="btn-save-annotations" title="Save Annotations">Save</button>
                <button id="btn-load-annotations" title="Load Annotations">Load</button>
            </div>
        </div>
    </div>
    <div id="command-panel">
        <div id="command-panel-resize"></div>
        <div id="command-history"></div>
        <div id="command-input-line">
            <span id="command-prompt">Command:</span>
            <input type="text" id="command-input" autocomplete="off" spellcheck="false" placeholder="Enter command or coordinates...">
        </div>
    </div>
    <div id="status-bar">
        <span id="status-text">Ready</span>
        <span id="coords"></span>
    </div>
    <div id="context-menu" class="context-menu">
        <div class="context-menu-section">
            <div class="context-menu-label">Draw</div>
            <div class="context-menu-item" data-command="LINE"><span class="menu-text">Line</span><span class="menu-shortcut">L</span></div>
            <div class="context-menu-item" data-command="CIRCLE"><span class="menu-text">Circle</span><span class="menu-shortcut">C</span></div>
            <div class="context-menu-item" data-command="RECTANGLE"><span class="menu-text">Rectangle</span><span class="menu-shortcut">REC</span></div>
            <div class="context-menu-item" data-command="ARC"><span class="menu-text">Arc</span><span class="menu-shortcut">A</span></div>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-section">
            <div class="context-menu-label">Dimension</div>
            <div class="context-menu-item" data-command="DIM"><span class="menu-text">Linear</span><span class="menu-shortcut">DLI</span></div>
            <div class="context-menu-item" data-command="DIMHOR"><span class="menu-text">Horizontal</span><span class="menu-shortcut">DH</span></div>
            <div class="context-menu-item" data-command="DIMVER"><span class="menu-text">Vertical</span><span class="menu-shortcut">DV</span></div>
            <div class="context-menu-item" data-command="DIMALIGNED"><span class="menu-text">Aligned</span><span class="menu-shortcut">DAL</span></div>
            <div class="context-menu-item" data-command="DIMANGULAR"><span class="menu-text">Angular</span><span class="menu-shortcut">DAN</span></div>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-section">
            <div class="context-menu-label">Modify</div>
            <div class="context-menu-item" data-command="ERASE"><span class="menu-text">Erase</span><span class="menu-shortcut">E</span></div>
            <div class="context-menu-item" data-command="MOVE"><span class="menu-text">Move</span><span class="menu-shortcut">M</span></div>
            <div class="context-menu-item" data-command="COPY"><span class="menu-text">Copy</span><span class="menu-shortcut">CO</span></div>
            <div class="context-menu-item" data-command="TRIM"><span class="menu-text">Trim</span><span class="menu-shortcut">TR</span></div>
            <div class="context-menu-item" data-command="EXTEND"><span class="menu-text">Extend</span><span class="menu-shortcut">EX</span></div>
            <div class="context-menu-item" data-command="OFFSET"><span class="menu-text">Offset</span><span class="menu-shortcut">O</span></div>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-section">
            <div class="context-menu-label">View</div>
            <div class="context-menu-item" data-command="FIT"><span class="menu-text">Zoom Fit</span><span class="menu-shortcut">F</span></div>
            <div class="context-menu-item" data-command="LAYER"><span class="menu-text">Layers</span><span class="menu-shortcut">LA</span></div>
            <div class="context-menu-item" data-command="PROPERTIES"><span class="menu-text">Properties</span><span class="menu-shortcut">PR</span></div>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-section">
            <div class="context-menu-label">Settings</div>
            <div class="context-menu-item" data-command="SNAP"><span class="menu-text">Snap On/Off</span><span class="menu-shortcut">S</span></div>
            <div class="context-menu-item" data-command="ORTHO"><span class="menu-text">Ortho On/Off</span><span class="menu-shortcut">OR</span></div>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-section">
            <div class="context-menu-label">Export</div>
            <div class="context-menu-item" data-command="CAPTURE"><span class="menu-text">Capture View</span><span class="menu-shortcut">CAP</span></div>
            <div class="context-menu-item" data-command="EXTRACT"><span class="menu-text">Extract Entities</span><span class="menu-shortcut">EXT</span></div>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-section">
            <div class="context-menu-label">File</div>
            <div class="context-menu-item" data-command="SAVE"><span class="menu-text">Save</span><span class="menu-shortcut">S</span></div>
            <div class="context-menu-item" data-command="SAVEAS"><span class="menu-text">Save As</span><span class="menu-shortcut">SA</span></div>
        </div>
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
