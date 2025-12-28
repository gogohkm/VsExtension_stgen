import * as vscode from 'vscode';
import { DxfEditorProvider } from './dxfEditorProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Stgen DXF Viewer extension is now active!');

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

export function deactivate() {}
