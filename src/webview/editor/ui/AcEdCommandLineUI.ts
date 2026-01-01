/**
 * AcEdCommandLineUI - Thin UI wrapper for the command line interface
 *
 * This replaces the monolithic commandLine.ts with a clean separation:
 * - UI handling (this class)
 * - Command execution (AcEdCommandStack)
 * - Input handling (AcEditor)
 */

import { DxfRenderer } from '../../dxfRenderer';
import { AcEdCommandStack } from '../command/AcEdCommandStack';
import { AcEdCommand, EditorContext, CommandLineInterface } from '../command/AcEdCommand';
import { AcEditor } from '../AcEditor';

// History line types
type HistoryLineType = 'command' | 'response' | 'error' | 'success' | 'prompt';

/**
 * Simple command definition for utility commands
 */
export interface SimpleCommandDefinition {
    name: string;
    aliases: string[];
    description: string;
    execute: () => void | Promise<void>;
}

/**
 * Command Line UI that integrates with AcEditor and AcEdCommandStack
 */
export class AcEdCommandLineUI implements CommandLineInterface {
    private historyElement: HTMLElement;
    private inputElement: HTMLInputElement;
    private promptElement: HTMLElement;
    private commandHistory: string[] = [];
    private historyIndex: number = -1;

    private renderer: DxfRenderer | null = null;
    private editor: AcEditor | null = null;
    private activeCommand: AcEdCommand | null = null;

    // Simple utility commands (non-CAD commands)
    private simpleCommands: Map<string, SimpleCommandDefinition> = new Map();

    constructor() {
        this.historyElement = document.getElementById('command-history') as HTMLElement;
        this.inputElement = document.getElementById('command-input') as HTMLInputElement;
        this.promptElement = document.getElementById('command-prompt') as HTMLElement;

        this.setupEventListeners();
        this.print('DXF Viewer Command Line ready. Type HELP for available commands.', 'response');
    }

    /**
     * Sets the renderer instance
     */
    setRenderer(renderer: DxfRenderer): void {
        this.renderer = renderer;
    }

    /**
     * Gets the renderer instance
     */
    getRenderer(): DxfRenderer | null {
        return this.renderer;
    }

    private setupEventListeners(): void {
        this.inputElement.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Focus input when clicking on command panel
        document.getElementById('command-panel')?.addEventListener('click', () => {
            this.inputElement.focus();
        });
    }

    private handleKeyDown(e: KeyboardEvent): void {
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this.executeInput();
                break;
            case ' ': // Space bar acts like Enter (AutoCAD style)
                // In AutoCAD, spacebar works as Enter for:
                // 1. Empty input (repeat last command or confirm)
                // 2. Command names
                // 3. Coordinate input (including comma-separated and polar)
                // Only exception: when typing text that needs spaces
                e.preventDefault();
                this.executeInput();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateHistory(-1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateHistory(1);
                break;
            case 'Escape':
                e.preventDefault();
                this.cancelCommand();
                break;
            case 'Tab':
                e.preventDefault();
                this.autocomplete();
                break;
        }
    }

    private executeInput(): void {
        const input = this.inputElement.value.trim();

        // Empty input handling
        if (!input) {
            // If editor is waiting for input with allowNone, send empty
            if (this.editor?.isWaitingForInput()) {
                this.editor.handleTextInput('');
            }
            return;
        }

        // Add to history
        this.commandHistory.push(input);
        this.historyIndex = this.commandHistory.length;

        // Clear input
        this.inputElement.value = '';

        // Print the command
        this.print(input, 'command');

        // If editor is waiting for input, pass to it
        if (this.editor?.isWaitingForInput()) {
            this.editor.handleTextInput(input);
            return;
        }

        // Parse and execute command
        this.parseAndExecute(input);
    }

    private async parseAndExecute(input: string): Promise<void> {
        const parts = input.split(/\s+/);
        const cmdName = parts[0].toUpperCase();

        // First, check simple utility commands
        const simpleCmd = this.findSimpleCommand(cmdName);
        if (simpleCmd) {
            try {
                await simpleCmd.execute();
            } catch (error) {
                this.print(`Error: ${error}`, 'error');
            }
            return;
        }

        // Then, check AcEdCommandStack
        const commandStack = AcEdCommandStack.instance;
        const command = commandStack.lookupCmd(cmdName);

        if (command) {
            await this.executeAcEdCommand(command);
        } else {
            this.print(`Unknown command: ${cmdName}. Type HELP for available commands.`, 'error');
        }
    }

    private async executeAcEdCommand(command: AcEdCommand): Promise<void> {
        if (!this.renderer) {
            this.print('Renderer not initialized', 'error');
            return;
        }

        // Create editor instance for this command
        this.editor = new AcEditor(this.renderer, this);
        this.activeCommand = command;

        // Create editor context with the editor instance
        const context: EditorContext = {
            renderer: this.renderer,
            commandLine: this,
            editor: this.editor
        };

        try {
            // Fire command start event
            command.events.commandWillStart.dispatch({
                command
            });

            // Execute command
            await command.execute(context);

            // Fire command end event
            command.events.commandEnded.dispatch({
                command
            });

        } catch (error) {
            if (error instanceof Error && error.message === 'Command cancelled') {
                this.print('*Cancel*', 'error');
            } else {
                this.print(`Error: ${error}`, 'error');
            }
        } finally {
            this.activeCommand = null;
            this.editor = null;
            this.setPrompt('Command:');
        }
    }

    /**
     * Handles mouse click from renderer
     */
    handleMouseClick(worldX: number, worldY: number): void {
        if (this.editor?.isWaitingForInput()) {
            this.editor.handleMouseClick({ x: worldX, y: worldY });
        }
    }

    /**
     * Handles mouse move from renderer
     */
    handleMouseMove(worldX: number, worldY: number): void {
        if (this.editor?.isWaitingForInput()) {
            this.editor.handleMouseMove({ x: worldX, y: worldY });
        }
    }

    private cancelCommand(): void {
        if (this.activeCommand) {
            // Cancel the active command
            this.activeCommand.cancel();
        }
        if (this.editor) {
            this.editor.handleCancel();
        }
        this.inputElement.value = '';
    }

    private navigateHistory(direction: number): void {
        const newIndex = this.historyIndex + direction;
        if (newIndex >= 0 && newIndex < this.commandHistory.length) {
            this.historyIndex = newIndex;
            this.inputElement.value = this.commandHistory[newIndex];
        } else if (newIndex >= this.commandHistory.length) {
            this.historyIndex = this.commandHistory.length;
            this.inputElement.value = '';
        }
    }

    private autocomplete(): void {
        const input = this.inputElement.value.toUpperCase();
        if (!input) return;

        const commandStack = AcEdCommandStack.instance;
        const matches = commandStack.searchCommandsByPrefix(input);

        // Also search simple commands
        for (const cmd of this.simpleCommands.values()) {
            if (cmd.name.startsWith(input)) {
                matches.push({ groupName: 'UTIL', command: { globalName: cmd.name } as any });
            }
        }

        if (matches.length === 1) {
            this.inputElement.value = matches[0].command.globalName;
        } else if (matches.length > 1) {
            this.print('Matching commands: ' + matches.map(m => m.command.globalName).join(', '), 'response');
        }
    }

    private findSimpleCommand(name: string): SimpleCommandDefinition | undefined {
        name = name.toUpperCase();

        // Direct match
        if (this.simpleCommands.has(name)) {
            return this.simpleCommands.get(name);
        }

        // Search by alias
        for (const cmd of this.simpleCommands.values()) {
            if (cmd.aliases.map(a => a.toUpperCase()).includes(name)) {
                return cmd;
            }
        }

        return undefined;
    }

    // CommandLineInterface implementation

    print(text: string, type: HistoryLineType = 'response'): void {
        const line = document.createElement('div');
        line.className = `history-line ${type}`;
        line.textContent = type === 'command' ? `> ${text}` : text;
        this.historyElement.appendChild(line);
        this.historyElement.scrollTop = this.historyElement.scrollHeight;
    }

    setPrompt(prompt: string): void {
        this.promptElement.textContent = prompt;
    }

    focus(): void {
        this.inputElement.focus();
    }

    /**
     * Requests input from user - required by CommandLineInterface
     */
    requestInput(prompt: string): Promise<string> {
        return new Promise((resolve) => {
            this.setPrompt(prompt);
            // This will be handled through the editor's input system
            // For legacy compatibility, return empty string
            resolve('');
        });
    }

    /**
     * Completes the current command (resets state)
     */
    completeCommand(): void {
        this.activeCommand = null;
        this.editor = null;
        this.setPrompt('Command:');
        if (this.renderer) {
            this.renderer.cancelDrawing();
        }
    }

    /**
     * Registers a simple utility command
     */
    registerSimpleCommand(command: SimpleCommandDefinition): void {
        this.simpleCommands.set(command.name.toUpperCase(), command);
    }

    /**
     * Clears command history display
     */
    clearHistory(): void {
        this.historyElement.innerHTML = '';
    }

    /**
     * Gets the current editor (if active)
     */
    getEditor(): AcEditor | null {
        return this.editor;
    }
}
