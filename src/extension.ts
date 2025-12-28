import * as vscode from 'vscode';
import { DxfEditorProvider } from './dxfEditorProvider';
import { McpBridgeServer } from './mcp/bridge';

let mcpBridgeServer: McpBridgeServer | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('Stgen DXF Viewer extension is now active!');

    // Start MCP Bridge Server
    const config = vscode.workspace.getConfiguration('stgen');
    const mcpPort = config.get<number>('mcpServerPort', 52789);

    mcpBridgeServer = new McpBridgeServer(
        () => DxfEditorProvider.getActiveWebview(),
        mcpPort
    );

    // Store bridge server reference in DxfEditorProvider
    DxfEditorProvider.setMcpBridge(mcpBridgeServer);

    mcpBridgeServer.start().then(() => {
        console.log(`MCP Bridge Server started on port ${mcpBridgeServer!.getPort()}`);
        vscode.window.showInformationMessage(
            `Stgen MCP Bridge running on port ${mcpBridgeServer!.getPort()}`
        );
    }).catch((error) => {
        console.error('Failed to start MCP Bridge Server:', error);
    });

    // Register the custom editor provider for DXF files
    context.subscriptions.push(DxfEditorProvider.register(context));

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('stgen.captureView', () => {
            DxfEditorProvider.requestCapture();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('stgen.extractEntities', () => {
            DxfEditorProvider.requestExtractEntities();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('stgen.fitView', () => {
            DxfEditorProvider.requestFitView();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('stgen.addAnnotation', () => {
            DxfEditorProvider.requestAddAnnotation();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('stgen.clearAnnotations', () => {
            DxfEditorProvider.requestClearAnnotations();
        })
    );
}

export function deactivate() {
    if (mcpBridgeServer) {
        mcpBridgeServer.stop();
        mcpBridgeServer = null;
    }
}
