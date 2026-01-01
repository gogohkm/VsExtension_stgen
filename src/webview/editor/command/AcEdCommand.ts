/**
 * AutoCAD-style Command System
 * Adapted from cad-viewer-main/cad-simple-viewer
 */

import { DxfRenderer } from '../../dxfRenderer';

/**
 * Simple event manager for command lifecycle events
 */
export class EventManager<T> {
    private listeners: ((args: T) => void)[] = [];

    addEventListener(listener: (args: T) => void): void {
        this.listeners.push(listener);
    }

    removeEventListener(listener: (args: T) => void): void {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
            this.listeners.splice(index, 1);
        }
    }

    dispatch(args: T): void {
        for (const listener of this.listeners) {
            listener(args);
        }
    }
}

/**
 * Event arguments for command lifecycle events
 */
export interface AcEdCommandEventArgs {
    command: AcEdCommand;
}

/**
 * Context passed to command execution
 */
export interface EditorContext {
    renderer: DxfRenderer;
    commandLine: CommandLineInterface;
}

/**
 * Interface for command line interaction
 */
export interface CommandLineInterface {
    print(text: string, type?: 'command' | 'response' | 'error' | 'success' | 'prompt'): void;
    setPrompt(prompt: string): void;
    requestInput(prompt: string): Promise<string>;
    focus(): void;
}

/**
 * Abstract base class for all CAD commands.
 *
 * Commands are the primary way users interact with the CAD system.
 * Each command represents a specific operation like drawing lines,
 * selecting objects, zooming, etc.
 *
 * ## Command Lifecycle
 * 1. Command is triggered via `trigger()` method
 * 2. `commandWillStart` event is fired
 * 3. `execute()` method is called with current context
 * 4. `commandEnded` event is fired
 *
 * @example
 * ```typescript
 * class AcLineCmd extends AcEdCommand {
 *   constructor() {
 *     super();
 *     this.globalName = 'LINE';
 *     this.localName = 'L';
 *   }
 *
 *   async execute(context: EditorContext) {
 *     // Implement drawing logic
 *   }
 * }
 * ```
 */
export abstract class AcEdCommand {
    private _globalName: string = '';
    private _localName: string = '';
    private _description: string = '';

    /** Events fired during command execution lifecycle */
    public readonly events = {
        commandWillStart: new EventManager<AcEdCommandEventArgs>(),
        commandEnded: new EventManager<AcEdCommandEventArgs>()
    };

    /** Current execution context */
    protected context: EditorContext | null = null;

    /** Flag to indicate if command should be cancelled */
    protected cancelled: boolean = false;

    get globalName(): string {
        return this._globalName;
    }

    set globalName(value: string) {
        this._globalName = value;
    }

    get localName(): string {
        return this._localName;
    }

    set localName(value: string) {
        this._localName = value;
    }

    get description(): string {
        return this._description;
    }

    set description(value: string) {
        this._description = value;
    }

    /**
     * Triggers the command execution with proper event handling.
     *
     * @param context - The editor context containing renderer and command line
     */
    async trigger(context: EditorContext): Promise<void> {
        this.context = context;
        this.cancelled = false;

        this.events.commandWillStart.dispatch({ command: this });

        try {
            await this.execute(context);
        } catch (error) {
            if (error instanceof CommandCancelledError) {
                context.commandLine.print('*Cancel*', 'error');
            } else {
                context.commandLine.print(`Error: ${error}`, 'error');
            }
        } finally {
            this.context = null;
            this.events.commandEnded.dispatch({ command: this });
        }
    }

    /**
     * Cancels the current command execution
     */
    cancel(): void {
        this.cancelled = true;
    }

    /**
     * Checks if the command has been cancelled
     */
    protected checkCancelled(): void {
        if (this.cancelled) {
            throw new CommandCancelledError();
        }
    }

    /**
     * Abstract method to be implemented by subclasses.
     * Contains the main command logic.
     *
     * @param context - The editor context
     */
    abstract execute(context: EditorContext): Promise<void>;
}

/**
 * Error thrown when a command is cancelled
 */
export class CommandCancelledError extends Error {
    constructor() {
        super('Command cancelled');
        this.name = 'CommandCancelledError';
    }
}
