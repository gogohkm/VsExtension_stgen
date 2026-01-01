/**
 * AcEditor - High-level API for CAD editing operations
 *
 * Provides AutoCAD-style input methods like getPoint(), getDistance(), etc.
 */

import { DxfRenderer } from '../dxfRenderer';
import { CommandLineInterface } from './command/AcEdCommand';
import { AcEdPromptPointOptions, AcEdPromptDistanceOptions, AcEdPromptSelectionOptions, formatKeywords, matchKeyword } from './input/prompt/AcEdPromptOptions';
import { AcEdPromptPointResult, AcEdPromptDistanceResult, AcEdPromptSelectionResult, PromptStatus } from './input/prompt/AcEdPromptResult';
import { parseCoordinate, isCoordinateInput, isNumberInput, parseNumber, formatPoint, Point2D, distance } from './input/handler/AcEdPointHandler';

/**
 * Input mode for the editor
 */
enum InputMode {
    None,
    Point,
    Distance,
    String,
    Selection
}

/**
 * High-level editor API for CAD commands
 */
export class AcEditor {
    private renderer: DxfRenderer;
    private commandLine: CommandLineInterface;

    private inputMode: InputMode = InputMode.None;
    private inputResolve: ((value: any) => void) | null = null;
    private inputReject: ((reason: any) => void) | null = null;
    private currentOptions: any = null;
    private basePoint: Point2D | null = null;

    // Callbacks from UI
    private onMouseClick: ((point: Point2D) => void) | null = null;
    private onMouseMove: ((point: Point2D) => void) | null = null;
    private onKeyPress: ((key: string) => void) | null = null;

    constructor(renderer: DxfRenderer, commandLine: CommandLineInterface) {
        this.renderer = renderer;
        this.commandLine = commandLine;
    }

    /**
     * Gets a point from user input (mouse click or keyboard)
     */
    async getPoint(options: AcEdPromptPointOptions): Promise<AcEdPromptPointResult> {
        return new Promise((resolve, reject) => {
            this.inputMode = InputMode.Point;
            this.inputResolve = resolve;
            this.inputReject = reject;
            this.currentOptions = options;
            this.basePoint = options.basePoint || null;

            // Show prompt
            const keywords = formatKeywords(options.keywords);
            const message = keywords ? `${options.message} ${keywords}:` : `${options.message}:`;
            this.commandLine.setPrompt(message);
            this.commandLine.focus();

            // Setup jig if provided
            if (options.jig) {
                this.setupMouseMoveHandler(options);
            }
        });
    }

    /**
     * Gets entity selection from user
     * Allows user to click on entities to select them
     * Returns when user presses Enter (empty input) to confirm selection
     */
    async getSelection(options: AcEdPromptSelectionOptions = {}): Promise<AcEdPromptSelectionResult> {
        return new Promise((resolve, reject) => {
            this.inputMode = InputMode.Selection;
            this.inputResolve = resolve;
            this.inputReject = reject;
            this.currentOptions = options;

            // Show prompt
            const message = options.message || 'Select objects';
            this.commandLine.setPrompt(`${message}:`);
            this.commandLine.focus();

            // Store initial selection count
            const initialCount = this.renderer.getSelectedCount();
            this.commandLine.print(`${initialCount} object(s) currently selected`, 'response');
        });
    }

    /**
     * Gets a distance from user input
     */
    async getDistance(options: AcEdPromptDistanceOptions): Promise<AcEdPromptDistanceResult> {
        return new Promise((resolve, reject) => {
            this.inputMode = InputMode.Distance;
            this.inputResolve = resolve;
            this.inputReject = reject;
            this.currentOptions = options;
            this.basePoint = options.basePoint || null;

            // Show prompt
            const keywords = formatKeywords(options.keywords);
            const message = keywords ? `${options.message} ${keywords}:` : `${options.message}:`;
            this.commandLine.setPrompt(message);
            this.commandLine.focus();

            // Setup jig if provided
            if (options.jig) {
                this.setupMouseMoveHandler(options);
            }
        });
    }

    /**
     * Handles text input from command line
     */
    handleTextInput(input: string): void {
        if (!this.inputResolve) return;

        const trimmed = input.trim();

        // Check for empty input
        if (!trimmed) {
            if (this.inputMode === InputMode.Selection) {
                // In selection mode, empty input confirms selection
                const selectedEntities = this.renderer.getSelectedEntities();
                this.resolveInput({
                    status: PromptStatus.OK,
                    value: selectedEntities
                });
                return;
            }
            if (this.currentOptions?.allowNone) {
                this.resolveInput({ status: PromptStatus.None });
            }
            return;
        }

        // Check for keyword
        const keyword = matchKeyword(trimmed, this.currentOptions?.keywords);
        if (keyword) {
            this.resolveInput({
                status: PromptStatus.Keyword,
                keyword: keyword.globalName
            });
            return;
        }

        // Handle based on input mode
        switch (this.inputMode) {
            case InputMode.Point:
                this.handlePointInput(trimmed);
                break;
            case InputMode.Distance:
                this.handleDistanceInput(trimmed);
                break;
            case InputMode.Selection:
                // In selection mode, any non-keyword input should not happen
                // as users only click to select. But if they type, ignore it.
                this.commandLine.print('Click to select objects, press Enter when done', 'response');
                break;
        }
    }

    /**
     * Handles point input
     */
    private handlePointInput(input: string): void {
        if (isCoordinateInput(input)) {
            const result = parseCoordinate(input, this.basePoint);
            if (result.success && result.point) {
                this.commandLine.print(`Point: ${formatPoint(result.point)}`, 'response');
                this.resolveInput({
                    status: PromptStatus.OK,
                    value: result.point
                });
            } else {
                this.commandLine.print(result.error || 'Invalid coordinate', 'error');
            }
        } else {
            this.commandLine.print('Invalid point. Use x,y or @x,y or @dist<angle', 'error');
        }
    }

    /**
     * Handles distance input
     */
    private handleDistanceInput(input: string): void {
        if (isNumberInput(input)) {
            const value = parseNumber(input);
            if (value !== null) {
                this.commandLine.print(`Distance: ${value.toFixed(4)}`, 'response');
                this.resolveInput({
                    status: PromptStatus.OK,
                    value: value
                });
            }
        } else if (isCoordinateInput(input)) {
            // User can specify distance by clicking a point
            const result = parseCoordinate(input, this.basePoint);
            if (result.success && result.point && this.basePoint) {
                const dist = distance(this.basePoint, result.point);
                this.commandLine.print(`Distance: ${dist.toFixed(4)}`, 'response');
                this.resolveInput({
                    status: PromptStatus.OK,
                    value: dist
                });
            }
        } else {
            this.commandLine.print('Invalid distance. Enter a number or click a point.', 'error');
        }
    }

    /**
     * Handles mouse click from renderer
     */
    handleMouseClick(worldPoint: Point2D): void {
        if (!this.inputResolve) return;

        switch (this.inputMode) {
            case InputMode.Point:
                this.commandLine.print(`Point: ${formatPoint(worldPoint)}`, 'response');
                this.resolveInput({
                    status: PromptStatus.OK,
                    value: worldPoint
                });
                break;

            case InputMode.Distance:
                if (this.basePoint) {
                    const dist = distance(this.basePoint, worldPoint);
                    this.commandLine.print(`Distance: ${dist.toFixed(4)}`, 'response');
                    this.resolveInput({
                        status: PromptStatus.OK,
                        value: dist
                    });
                }
                break;

            case InputMode.Selection:
                // In selection mode, clicks are handled by renderer for selection
                // Just update the count display
                const count = this.renderer.getSelectedCount();
                this.commandLine.print(`${count} object(s) selected`, 'response');
                break;
        }
    }

    /**
     * Handles mouse move from renderer (for jig updates)
     */
    handleMouseMove(worldPoint: Point2D): void {
        if (this.currentOptions?.jig) {
            if (this.inputMode === InputMode.Point) {
                this.currentOptions.jig.update(worldPoint);
            } else if (this.inputMode === InputMode.Distance && this.basePoint) {
                const dist = distance(this.basePoint, worldPoint);
                this.currentOptions.jig.update(dist);
            }
        }
    }

    /**
     * Handles escape key (cancel)
     */
    handleCancel(): void {
        if (this.inputResolve) {
            this.resolveInput({ status: PromptStatus.Cancel });
        }
    }

    /**
     * Resolves current input and cleans up
     */
    private resolveInput(result: any): void {
        // Clear jig
        if (this.currentOptions?.jig) {
            this.currentOptions.jig.clear();
        }

        // Reset state
        const resolve = this.inputResolve;
        this.inputMode = InputMode.None;
        this.inputResolve = null;
        this.inputReject = null;
        this.currentOptions = null;
        this.basePoint = null;

        // Resolve promise
        if (resolve) {
            resolve(result);
        }
    }

    /**
     * Sets up mouse move handler for jig
     * Note: Mouse move events are connected externally via main.ts:
     * main.ts mousemove -> AcEdCommandLineUI.handleMouseMove() -> AcEditor.handleMouseMove()
     * The jig update happens in handleMouseMove() method above
     */
    private setupMouseMoveHandler(_options: any): void {
        // No setup needed - mouse events flow from main.ts through AcEdCommandLineUI
        // to this.handleMouseMove() which updates the jig
    }

    /**
     * Checks if editor is waiting for input
     */
    isWaitingForInput(): boolean {
        return this.inputMode !== InputMode.None;
    }

    /**
     * Gets the renderer instance
     */
    getRenderer(): DxfRenderer {
        return this.renderer;
    }
}
