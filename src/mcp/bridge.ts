import * as http from 'http';
import * as vscode from 'vscode';
import { URL } from 'url';

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
}

/**
 * HTTP Bridge Server that runs inside the VS Code extension.
 * Receives requests from the MCP server and communicates with the WebView.
 */
export class McpBridgeServer {
    private server: http.Server | null = null;
    private port: number;
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private requestIdCounter = 0;

    // Callback to get the active webview
    private getActiveWebview: () => vscode.WebviewPanel | undefined;

    // Current DXF state
    private currentState: {
        fileName: string | null;
        filePath: string | null;
        dxfData: string | null;
        parsedData: any | null;
    } = {
        fileName: null,
        filePath: null,
        dxfData: null,
        parsedData: null
    };

    constructor(
        getActiveWebview: () => vscode.WebviewPanel | undefined,
        port: number = 52789
    ) {
        this.getActiveWebview = getActiveWebview;
        this.port = port;
    }

    /**
     * Updates the current DXF state (called when a DXF file is loaded)
     */
    public updateState(fileName: string, filePath: string, dxfData: string): void {
        this.currentState = {
            fileName,
            filePath,
            dxfData,
            parsedData: null // Will be set when entities are extracted
        };
    }

    /**
     * Updates parsed data from WebView
     */
    public updateParsedData(data: any): void {
        this.currentState.parsedData = data;
    }

    /**
     * Handles a response from the WebView for a pending request
     */
    public handleWebviewResponse(requestId: string, data: any): void {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve(data);
            this.pendingRequests.delete(requestId);
        }
    }

    /**
     * Sends a request to the WebView and waits for a response
     */
    private async sendToWebview(type: string, options: any = {}): Promise<any> {
        const webview = this.getActiveWebview();
        if (!webview) {
            throw new Error('No active DXF viewer');
        }

        const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('WebView request timed out'));
            }, 30000);

            this.pendingRequests.set(requestId, { resolve, reject, timeout });

            webview.webview.postMessage({
                type: `mcp_${type}`,
                requestId,
                options
            });
        });
    }

    /**
     * Starts the HTTP server
     */
    public async start(): Promise<void> {
        if (this.server) {
            return;
        }

        this.server = http.createServer(async (req, res) => {
            // Set CORS headers for local development
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');

            try {
                const url = new URL(req.url || '/', `http://localhost:${this.port}`);
                const path = url.pathname;

                let response: any;

                switch (path) {
                    case '/status':
                        response = await this.handleStatus();
                        break;
                    case '/capture':
                        response = await this.handleCapture();
                        break;
                    case '/entities':
                        response = await this.handleEntities(url.searchParams);
                        break;
                    case '/layers':
                        response = await this.handleLayers();
                        break;
                    case '/summary':
                        response = await this.handleSummary();
                        break;
                    default:
                        res.statusCode = 404;
                        response = { success: false, error: 'Not found' };
                }

                res.end(JSON.stringify(response));
            } catch (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error'
                }));
            }
        });

        return new Promise((resolve, reject) => {
            this.server!.listen(this.port, '127.0.0.1', () => {
                console.log(`MCP Bridge Server listening on port ${this.port}`);
                resolve();
            });

            this.server!.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code === 'EADDRINUSE') {
                    console.log(`Port ${this.port} in use, trying next port...`);
                    this.port++;
                    this.server!.listen(this.port, '127.0.0.1');
                } else {
                    reject(error);
                }
            });
        });
    }

    /**
     * Stops the HTTP server
     */
    public stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
        }

        // Clean up pending requests
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Server stopped'));
        }
        this.pendingRequests.clear();
    }

    /**
     * Gets the current port
     */
    public getPort(): number {
        return this.port;
    }

    // --- Request Handlers ---

    private async handleStatus(): Promise<any> {
        const webview = this.getActiveWebview();
        return {
            success: true,
            data: {
                active: !!webview,
                fileName: this.currentState.fileName,
                filePath: this.currentState.filePath
            }
        };
    }

    private async handleCapture(): Promise<any> {
        try {
            const result = await this.sendToWebview('capture');
            return {
                success: true,
                data: {
                    imageData: result.imageData,
                    width: result.width,
                    height: result.height
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to capture'
            };
        }
    }

    private async handleEntities(params: URLSearchParams): Promise<any> {
        try {
            const format = params.get('format') || 'markdown';
            const limit = parseInt(params.get('limit') || '100');
            const layers = params.get('layers')?.split(',').filter(Boolean);
            const types = params.get('types')?.split(',').filter(Boolean);

            const result = await this.sendToWebview('entities', {
                format,
                limit,
                layers,
                types
            });

            return {
                success: true,
                data: result.data
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to extract entities'
            };
        }
    }

    private async handleLayers(): Promise<any> {
        try {
            const result = await this.sendToWebview('layers');
            return {
                success: true,
                data: result.layers
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get layers'
            };
        }
    }

    private async handleSummary(): Promise<any> {
        try {
            const result = await this.sendToWebview('summary');
            return {
                success: true,
                data: {
                    fileName: this.currentState.fileName,
                    filePath: this.currentState.filePath,
                    ...result
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get summary'
            };
        }
    }
}
