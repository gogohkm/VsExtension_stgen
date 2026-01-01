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

        // Empty input (Enter or Space with no text) - finish LINE command if active
        if (!input) {
            if (this.activeCommand === 'LINE') {
                const state = this.getState();
                const points = state.points || [];
                if (points.length >= 2) {
                    this.print('Line command completed', 'success');
                }
                this.completeCommand();
                if (this.renderer) {
                    this.renderer.cancelDrawing();
                }
                return;
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
        const upperInput = input.toUpperCase().trim();

        // If active command, handle special inputs first
        if (this.activeCommand) {
            // Check for coordinate input
            if (this.isCoordinateInput(input)) {
                this.handleCoordinateInput(input);
                return;
            }

            // Check for number input (for radius, diameter, etc.)
            if (this.isNumberInput(input)) {
                this.handleNumberInput(input);
                return;
            }

            // Check for command options (single letters or short options)
            if (this.handleCommandOption(upperInput)) {
                return;
            }
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

    private handleNumberInput(input: string): void {
        const value = parseFloat(input.trim());
        if (isNaN(value)) return;

        if (this.activeCommand === 'CIRCLE') {
            const state = this.getState();
            if (state.center) {
                const circleMode = state.circleMode || 'radius';
                let radius = value;

                // If in diameter mode, convert to radius
                if (circleMode === 'diameter') {
                    radius = value / 2;
                    this.print(`Diameter: ${value.toFixed(4)}`, 'response');
                } else {
                    this.print(`Radius: ${value.toFixed(4)}`, 'response');
                }

                const entity = this.renderer?.createCircleFromCenterRadius(state.center, radius);
                if (entity) {
                    // Ready for next circle
                    this.setState({ circleMode: 'radius', center: null, lastPoint: null });
                    this.print('CIRCLE Specify center point for circle or [3P/2P/Ttr]:', 'prompt');
                    this.setPrompt('Center:');
                }
            }
        }
    }

    private handleCommandOption(option: string): boolean {
        if (this.activeCommand === 'LINE') {
            switch (option) {
                case 'U':
                case 'UNDO':
                    // Undo last point in LINE
                    const lineState = this.getState();
                    const points = lineState.points || [];
                    if (points.length > 0) {
                        points.pop();
                        if (points.length > 0) {
                            this.setState({ points, lastPoint: points[points.length - 1] });
                        } else {
                            this.setState({ points: [], lastPoint: null });
                        }
                        this.print('Undo', 'response');
                        // TODO: Remove last line from renderer
                    }
                    return true;
                case 'C':
                case 'CLOSE':
                    // Close the polyline
                    const closeState = this.getState();
                    const closePoints = closeState.points || [];
                    if (closePoints.length >= 2) {
                        const firstPoint = closePoints[0];
                        const lastPoint = closePoints[closePoints.length - 1];
                        this.renderer?.createLineFromPoints(lastPoint, firstPoint);
                        this.print('Close', 'response');
                        this.completeCommand();
                    }
                    return true;
            }
        } else if (this.activeCommand === 'CIRCLE') {
            const state = this.getState();
            switch (option) {
                case 'D':
                case 'DIAMETER':
                    if (state.center) {
                        this.setState({ ...state, circleMode: 'diameter' });
                        this.print('Specify diameter:', 'prompt');
                        this.setPrompt('Diameter:');
                    }
                    return true;
                case '3P':
                    this.setState({ circleMode: '3p', points: [], center: null });
                    this.print('Specify first point on circle:', 'prompt');
                    this.setPrompt('First point:');
                    return true;
                case '2P':
                    this.setState({ circleMode: '2p', points: [], center: null });
                    this.print('Specify first end point of circle diameter:', 'prompt');
                    this.setPrompt('First point:');
                    return true;
            }
        }

        return false;
    }

    private isCoordinateInput(input: string): boolean {
        // Match patterns like: 100,200 or @50,30 or @100<45
        return /^@?-?\d+\.?\d*[,<]-?\d+\.?\d*$/.test(input.replace(/\s/g, ''));
    }

    private isNumberInput(input: string): boolean {
        // Match single number: 100 or 100.5 or -50
        return /^-?\d+\.?\d*$/.test(input.trim());
    }

    private handleCoordinateInput(input: string): void {
        const state = this.getState();
        const lastPoint = state.lastPoint || null;

        // Parse coordinate with last point for relative coordinates
        const coord = this.parseCoordinate(input, lastPoint);
        if (coord && this.renderer) {
            // Handle based on active command
            if (this.activeCommand === 'LINE') {
                this.handleLineCoordinateInput(coord);
            } else if (this.activeCommand === 'CIRCLE') {
                this.handleCircleCoordinateInput(coord, input);
            } else {
                this.print(`Point: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)}`, 'response');
            }
        }
    }

    private handleLineCoordinateInput(coord: { x: number; y: number }): void {
        if (!this.renderer) return;

        const state = this.getState();
        const points: { x: number; y: number }[] = state.points || [];

        if (points.length === 0) {
            // First point
            points.push(coord);
            this.setState({ points, lastPoint: coord });
            this.renderer.addDrawingPoint(coord.x, coord.y);
            this.print(`First point: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)}`, 'response');
            this.print('Specify next point or [Undo]:', 'prompt');
            this.setPrompt('Next point:');
        } else {
            // Next point - create line
            const startPoint = points[points.length - 1];
            const entity = this.renderer.createLineFromPoints(startPoint, coord);

            if (entity) {
                this.print(`To point: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)}`, 'response');
                points.push(coord);
                this.setState({ points, lastPoint: coord });
                this.print('Specify next point or [Close/Undo]:', 'prompt');
                this.setPrompt('Next point:');
            }
        }
    }

    private handleCircleCoordinateInput(coord: { x: number; y: number }, _input: string): void {
        if (!this.renderer) return;

        const state = this.getState();
        const circleMode = state.circleMode || 'radius';

        if (circleMode === '2p') {
            // 2-point circle mode
            const points: { x: number; y: number }[] = state.points || [];
            if (points.length === 0) {
                points.push(coord);
                this.setState({ ...state, points, lastPoint: coord });
                this.renderer.addDrawingPoint(coord.x, coord.y);
                this.print(`First point: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)}`, 'response');
                this.print('Specify second end point of circle diameter:', 'prompt');
                this.setPrompt('Second point:');
            } else {
                // Calculate center and radius from two diameter points
                const p1 = points[0];
                const center = { x: (p1.x + coord.x) / 2, y: (p1.y + coord.y) / 2 };
                const radius = Math.sqrt(Math.pow(coord.x - p1.x, 2) + Math.pow(coord.y - p1.y, 2)) / 2;

                const entity = this.renderer.createCircleFromCenterRadius(center, radius);
                if (entity) {
                    this.print(`Second point: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)}`, 'response');
                    this.setState({ circleMode: 'radius', center: null, points: [], lastPoint: null });
                    this.print('CIRCLE Specify center point for circle or [3P/2P/Ttr]:', 'prompt');
                    this.setPrompt('Center:');
                }
            }
        } else if (circleMode === '3p') {
            // 3-point circle mode
            const points: { x: number; y: number }[] = state.points || [];
            points.push(coord);
            this.renderer.addDrawingPoint(coord.x, coord.y);
            this.print(`Point ${points.length}: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)}`, 'response');

            if (points.length < 3) {
                this.setState({ ...state, points, lastPoint: coord });
                this.print(`Specify ${points.length === 1 ? 'second' : 'third'} point on circle:`, 'prompt');
                this.setPrompt(`Point ${points.length + 1}:`);
            } else {
                // Calculate circle from 3 points
                const circle = this.calculateCircleFrom3Points(points[0], points[1], points[2]);
                if (circle) {
                    const entity = this.renderer.createCircleFromCenterRadius(circle.center, circle.radius);
                    if (entity) {
                        this.setState({ circleMode: 'radius', center: null, points: [], lastPoint: null });
                        this.print('CIRCLE Specify center point for circle or [3P/2P/Ttr]:', 'prompt');
                        this.setPrompt('Center:');
                    }
                } else {
                    this.print('Cannot create circle from collinear points', 'error');
                    this.setState({ circleMode: 'radius', center: null, points: [], lastPoint: null });
                    this.setPrompt('Center:');
                }
            }
        } else {
            // Normal mode: center + radius point
            if (!state.center) {
                // First point - center
                this.setState({ ...state, center: coord, lastPoint: coord });
                this.renderer.addDrawingPoint(coord.x, coord.y);
                this.print(`Center point: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)}`, 'response');
                this.print('Specify radius or [Diameter]:', 'prompt');
                this.setPrompt('Radius:');
            } else {
                // Second point defines radius
                const center = state.center;
                const radius = Math.sqrt(
                    Math.pow(coord.x - center.x, 2) +
                    Math.pow(coord.y - center.y, 2)
                );
                const entity = this.renderer.createCircleFromCenterRadius(center, radius);
                if (entity) {
                    this.print(`Radius point: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)} (radius: ${radius.toFixed(4)})`, 'response');
                    this.setState({ circleMode: 'radius', center: null, lastPoint: null });
                    this.print('CIRCLE Specify center point for circle or [3P/2P/Ttr]:', 'prompt');
                    this.setPrompt('Center:');
                }
            }
        }
    }

    // Calculate circle from 3 points using circumcircle formula
    private calculateCircleFrom3Points(
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        p3: { x: number; y: number }
    ): { center: { x: number; y: number }; radius: number } | null {
        const ax = p1.x, ay = p1.y;
        const bx = p2.x, by = p2.y;
        const cx = p3.x, cy = p3.y;

        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(d) < 0.0001) {
            return null; // Points are collinear
        }

        const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
        const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

        const radius = Math.sqrt(Math.pow(ax - ux, 2) + Math.pow(ay - uy, 2));

        return { center: { x: ux, y: uy }, radius };
    }

    private parseCoordinate(input: string, lastPoint?: { x: number; y: number } | null): { x: number; y: number } | null {
        const clean = input.replace(/\s/g, '');

        // Relative polar: @distance<angle
        const polarMatch = clean.match(/^@(-?\d+\.?\d*)<(-?\d+\.?\d*)$/);
        if (polarMatch) {
            const distance = parseFloat(polarMatch[1]);
            const angle = parseFloat(polarMatch[2]) * Math.PI / 180;
            const baseX = lastPoint?.x || 0;
            const baseY = lastPoint?.y || 0;
            return {
                x: baseX + distance * Math.cos(angle),
                y: baseY + distance * Math.sin(angle)
            };
        }

        // Relative cartesian: @x,y
        const relativeMatch = clean.match(/^@(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
        if (relativeMatch) {
            const baseX = lastPoint?.x || 0;
            const baseY = lastPoint?.y || 0;
            return {
                x: baseX + parseFloat(relativeMatch[1]),
                y: baseY + parseFloat(relativeMatch[2])
            };
        }

        // Absolute cartesian: x,y
        const cartMatch = clean.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
        if (cartMatch) {
            return {
                x: parseFloat(cartMatch[1]),
                y: parseFloat(cartMatch[2])
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

        // LINE command (AutoCAD style)
        this.registerCommand({
            name: 'LINE',
            aliases: ['L'],
            description: 'Draw a line',
            execute: async (args) => {
                if (!this.renderer) return;

                this.renderer.startDrawingLine();
                this.setActiveCommand('LINE');
                this.setState({ points: [], lastPoint: null });

                // If first point provided as argument (e.g., "LINE 0,0")
                if (args.length > 0 && this.isCoordinateInput(args[0])) {
                    const coord = this.parseCoordinate(args[0], null);
                    if (coord) {
                        this.setState({ points: [coord], lastPoint: coord });
                        this.renderer.addDrawingPoint(coord.x, coord.y);
                        this.print(`First point: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)}`, 'response');
                        this.print('Specify next point or [Undo]:', 'prompt');
                        this.setPrompt('Next point:');
                        return;
                    }
                }

                this.print('LINE Specify first point:', 'prompt');
                this.setPrompt('First point:');
            }
        });

        // CIRCLE command (AutoCAD style)
        this.registerCommand({
            name: 'CIRCLE',
            aliases: ['C'],
            description: 'Draw a circle (3P/2P/Ttr)',
            execute: (args) => {
                if (!this.renderer) return;

                this.renderer.startDrawingCircle();
                this.setActiveCommand('CIRCLE');
                this.setState({ circleMode: 'radius', center: null, lastPoint: null });

                // Check for options: 3P, 2P, TTR
                if (args.length > 0) {
                    const option = args[0].toUpperCase();
                    if (option === '3P') {
                        this.setState({ circleMode: '3p', points: [] });
                        this.print('Specify first point on circle:', 'prompt');
                        this.setPrompt('First point:');
                        return;
                    } else if (option === '2P') {
                        this.setState({ circleMode: '2p', points: [] });
                        this.print('Specify first end point of circle diameter:', 'prompt');
                        this.setPrompt('First point:');
                        return;
                    } else if (option === 'TTR' || option === 'T') {
                        this.print('TTR mode not yet implemented', 'error');
                        this.cancelCommand();
                        return;
                    } else if (this.isCoordinateInput(args[0])) {
                        // Center point provided
                        const coord = this.parseCoordinate(args[0], null);
                        if (coord) {
                            this.setState({ circleMode: 'radius', center: coord, lastPoint: coord });
                            this.renderer.addDrawingPoint(coord.x, coord.y);
                            this.print(`Center point: ${coord.x.toFixed(4)}, ${coord.y.toFixed(4)}`, 'response');
                            this.print('Specify radius or [Diameter]:', 'prompt');
                            this.setPrompt('Radius:');
                            return;
                        }
                    }
                }

                this.print('CIRCLE Specify center point for circle or [3P/2P/Ttr]:', 'prompt');
                this.setPrompt('Center:');
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
