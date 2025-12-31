/**
 * AutoCAD-style Command Line Interface
 * Handles command input, history, and execution
 */

import { DxfRenderer } from './dxfRenderer';

// Command definition interface
export interface CommandDefinition {
    name: string;
    aliases: string[];
    description: string;
    execute: (args: string[], commandLine: CommandLine) => void | Promise<void>;
}

// Line type for history display
type HistoryLineType = 'command' | 'response' | 'error' | 'success' | 'prompt';

export class CommandLine {
    private historyElement: HTMLElement;
    private inputElement: HTMLInputElement;
    private promptElement: HTMLElement;
    private commandHistory: string[] = [];
    private historyIndex: number = -1;
    private commands: Map<string, CommandDefinition> = new Map();
    private renderer: DxfRenderer | null = null;

    // State for multi-step commands
    private activeCommand: string | null = null;
    private commandState: Record<string, any> = {};
    private inputCallback: ((input: string) => void) | null = null;

    constructor() {
        this.historyElement = document.getElementById('command-history') as HTMLElement;
        this.inputElement = document.getElementById('command-input') as HTMLInputElement;
        this.promptElement = document.getElementById('command-prompt') as HTMLElement;

        this.setupEventListeners();
        this.registerBuiltInCommands();

        this.print('DXF Viewer Command Line ready. Type HELP for available commands.', 'response');
    }

    public setRenderer(renderer: DxfRenderer): void {
        this.renderer = renderer;
    }

    private setupEventListeners(): void {
        this.inputElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.inputElement.addEventListener('input', () => this.handleInput());

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
                // Only if input is a command (not coordinates with spaces)
                const input = this.inputElement.value.trim();
                if (input && !input.includes(',') && !input.includes('<')) {
                    e.preventDefault();
                    this.executeInput();
                }
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

    private handleInput(): void {
        // Future: show autocomplete suggestions
    }

    private executeInput(): void {
        const input = this.inputElement.value.trim();
        if (!input) return;

        // Add to history
        this.commandHistory.push(input);
        this.historyIndex = this.commandHistory.length;

        // Clear input
        this.inputElement.value = '';

        // Print the command
        this.print(input, 'command');

        // If waiting for input callback (multi-step command)
        if (this.inputCallback) {
            const callback = this.inputCallback;
            this.inputCallback = null;
            callback(input);
            return;
        }

        // Parse and execute command
        this.parseAndExecute(input);
    }

    private parseAndExecute(input: string): void {
        // Check if it's a coordinate input (for active drawing commands)
        if (this.activeCommand && this.isCoordinateInput(input)) {
            this.handleCoordinateInput(input);
            return;
        }

        // Parse command and arguments
        const parts = input.split(/\s+/);
        const cmdName = parts[0].toUpperCase();
        const args = parts.slice(1);

        // Find command
        const command = this.findCommand(cmdName);
        if (command) {
            try {
                command.execute(args, this);
            } catch (error) {
                this.print(`Error: ${error}`, 'error');
            }
        } else {
            this.print(`Unknown command: ${cmdName}. Type HELP for available commands.`, 'error');
        }
    }

    private isCoordinateInput(input: string): boolean {
        // Match patterns like: 100,200 or @50,30 or @100<45
        return /^@?-?\d+\.?\d*[,<]-?\d+\.?\d*$/.test(input.replace(/\s/g, ''));
    }

    private handleCoordinateInput(input: string): void {
        // Parse coordinate
        const coord = this.parseCoordinate(input);
        if (coord) {
            // Emit coordinate event or handle based on active command
            if (this.renderer) {
                // This will be handled by the drawing mode
                this.print(`Point: ${coord.x.toFixed(2)}, ${coord.y.toFixed(2)}`, 'response');
            }
        }
    }

    private parseCoordinate(input: string): { x: number; y: number } | null {
        const clean = input.replace(/\s/g, '');

        // Relative polar: @distance<angle
        const polarMatch = clean.match(/^@(-?\d+\.?\d*)<(-?\d+\.?\d*)$/);
        if (polarMatch) {
            const distance = parseFloat(polarMatch[1]);
            const angle = parseFloat(polarMatch[2]) * Math.PI / 180;
            return {
                x: distance * Math.cos(angle),
                y: distance * Math.sin(angle)
            };
        }

        // Absolute or relative cartesian: x,y or @x,y
        const cartMatch = clean.match(/^(@)?(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
        if (cartMatch) {
            return {
                x: parseFloat(cartMatch[2]),
                y: parseFloat(cartMatch[3])
            };
        }

        return null;
    }

    private findCommand(name: string): CommandDefinition | undefined {
        // Direct match
        if (this.commands.has(name)) {
            return this.commands.get(name);
        }

        // Search by alias
        for (const cmd of this.commands.values()) {
            if (cmd.aliases.includes(name)) {
                return cmd;
            }
        }

        return undefined;
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

    private cancelCommand(): void {
        if (this.activeCommand) {
            this.print('*Cancel*', 'error');
            this.activeCommand = null;
            this.commandState = {};
            this.inputCallback = null;
            this.setPrompt('Command:');

            // Cancel any active drawing mode
            if (this.renderer) {
                this.renderer.cancelDrawing();
            }
        }
        this.inputElement.value = '';
    }

    private autocomplete(): void {
        const input = this.inputElement.value.toUpperCase();
        if (!input) return;

        const matches: CommandDefinition[] = [];
        for (const cmd of this.commands.values()) {
            if (cmd.name.startsWith(input)) {
                matches.push(cmd);
            }
            for (const alias of cmd.aliases) {
                if (alias.startsWith(input)) {
                    matches.push(cmd);
                    break;
                }
            }
        }

        if (matches.length === 1) {
            this.inputElement.value = matches[0].name;
        } else if (matches.length > 1) {
            this.print('Matching commands: ' + matches.map(m => m.name).join(', '), 'response');
        }
    }

    public print(text: string, type: HistoryLineType = 'response'): void {
        const line = document.createElement('div');
        line.className = `history-line ${type}`;
        line.textContent = type === 'command' ? `> ${text}` : text;
        this.historyElement.appendChild(line);
        this.historyElement.scrollTop = this.historyElement.scrollHeight;
    }

    public setPrompt(prompt: string): void {
        this.promptElement.textContent = prompt;
    }

    public setActiveCommand(name: string | null): void {
        this.activeCommand = name;
    }

    public getState(): Record<string, any> {
        return this.commandState;
    }

    public setState(state: Record<string, any>): void {
        this.commandState = state;
    }

    public requestInput(prompt: string): Promise<string> {
        return new Promise((resolve) => {
            this.setPrompt(prompt);
            this.inputCallback = resolve;
        });
    }

    public focus(): void {
        this.inputElement.focus();
    }

    // Register a command
    public registerCommand(command: CommandDefinition): void {
        this.commands.set(command.name, command);
    }

    private registerBuiltInCommands(): void {
        // HELP command
        this.registerCommand({
            name: 'HELP',
            aliases: ['?', 'H'],
            description: 'Show available commands',
            execute: () => {
                this.print('Available commands:', 'response');
                const sortedCommands = Array.from(this.commands.values())
                    .sort((a, b) => a.name.localeCompare(b.name));
                for (const cmd of sortedCommands) {
                    const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
                    this.print(`  ${cmd.name}${aliases} - ${cmd.description}`, 'response');
                }
            }
        });

        // LINE command
        this.registerCommand({
            name: 'LINE',
            aliases: ['L'],
            description: 'Draw a line',
            execute: () => {
                if (this.renderer) {
                    this.renderer.startDrawingLine();
                    this.setActiveCommand('LINE');
                    this.print('Specify first point:', 'prompt');
                    this.setPrompt('First point:');
                }
            }
        });

        // CIRCLE command
        this.registerCommand({
            name: 'CIRCLE',
            aliases: ['C'],
            description: 'Draw a circle',
            execute: () => {
                if (this.renderer) {
                    this.renderer.startDrawingCircle();
                    this.setActiveCommand('CIRCLE');
                    this.print('Specify center point:', 'prompt');
                    this.setPrompt('Center:');
                }
            }
        });

        // ZOOM commands
        this.registerCommand({
            name: 'ZOOM',
            aliases: ['Z'],
            description: 'Zoom view (E=Extents, A=All)',
            execute: (args) => {
                if (!this.renderer) return;

                const option = args[0]?.toUpperCase() || 'E';
                switch (option) {
                    case 'E':
                    case 'EXTENTS':
                        this.renderer.fitView();
                        this.print('Zoom extents', 'success');
                        break;
                    case 'A':
                    case 'ALL':
                        this.renderer.fitView();
                        this.print('Zoom all', 'success');
                        break;
                    default:
                        this.print('Options: E(xtents), A(ll)', 'response');
                }
            }
        });

        // FIT command
        this.registerCommand({
            name: 'FIT',
            aliases: ['F', 'ZE'],
            description: 'Fit view to show all entities',
            execute: () => {
                if (this.renderer) {
                    this.renderer.fitView();
                    this.print('View fitted to extents', 'success');
                }
            }
        });

        // REGEN command
        this.registerCommand({
            name: 'REGEN',
            aliases: ['RE'],
            description: 'Regenerate drawing',
            execute: () => {
                if (this.renderer) {
                    this.renderer.render();
                    this.print('Drawing regenerated', 'success');
                }
            }
        });

        // SNAP command
        this.registerCommand({
            name: 'SNAP',
            aliases: ['SN'],
            description: 'Toggle snap mode',
            execute: () => {
                if (this.renderer) {
                    const enabled = this.renderer.toggleSnap();
                    this.print(`Snap ${enabled ? 'ON' : 'OFF'}`, 'success');
                }
            }
        });

        // ESC / CANCEL command
        this.registerCommand({
            name: 'CANCEL',
            aliases: ['ESC'],
            description: 'Cancel current command',
            execute: () => {
                this.cancelCommand();
            }
        });

        // UNDO command
        this.registerCommand({
            name: 'UNDO',
            aliases: ['U'],
            description: 'Undo last action',
            execute: () => {
                if (this.renderer) {
                    this.renderer.undo();
                    this.print('Undo', 'success');
                }
            }
        });

        // REDO command
        this.registerCommand({
            name: 'REDO',
            aliases: [],
            description: 'Redo last undone action',
            execute: () => {
                if (this.renderer) {
                    this.renderer.redo();
                    this.print('Redo', 'success');
                }
            }
        });

        // DIM command
        this.registerCommand({
            name: 'DIM',
            aliases: ['DIMLINEAR', 'DLI'],
            description: 'Add linear dimension',
            execute: () => {
                this.print('Click first point for dimension...', 'prompt');
                this.setPrompt('First point:');
                this.setActiveCommand('DIM');
                // Dimension mode will be handled by existing dimension logic
            }
        });

        // CLEAR command
        this.registerCommand({
            name: 'CLEAR',
            aliases: ['CLS'],
            description: 'Clear command history',
            execute: () => {
                this.historyElement.innerHTML = '';
                this.print('Command history cleared', 'success');
            }
        });

        // LAYER command
        this.registerCommand({
            name: 'LAYER',
            aliases: ['LA'],
            description: 'Open layer panel',
            execute: () => {
                const layerPanel = document.getElementById('layer-panel');
                if (layerPanel) {
                    layerPanel.classList.toggle('visible');
                    this.print('Layer panel toggled', 'success');
                }
            }
        });

        // PROPERTIES command
        this.registerCommand({
            name: 'PROPERTIES',
            aliases: ['PR', 'PROPS'],
            description: 'Open properties panel',
            execute: () => {
                const propsPanel = document.getElementById('properties-panel');
                if (propsPanel) {
                    propsPanel.classList.toggle('visible');
                    this.print('Properties panel toggled', 'success');
                }
            }
        });
    }

    // Method to handle click from renderer (for coordinate input)
    public handlePointClick(x: number, y: number): void {
        if (this.activeCommand) {
            this.print(`Point: ${x.toFixed(4)}, ${y.toFixed(4)}`, 'response');

            // If waiting for input, provide the coordinate
            if (this.inputCallback) {
                this.inputCallback(`${x},${y}`);
            }
        }
    }

    // Complete the current command
    public completeCommand(): void {
        this.activeCommand = null;
        this.commandState = {};
        this.inputCallback = null;
        this.setPrompt('Command:');
    }
}
