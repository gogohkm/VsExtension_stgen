/**
 * ZOOM Command - Controls view magnification
 *
 * Usage:
 *   ZOOM
 *   [All/Extents/Window] <Extents>: (choose option)
 *
 * Options:
 *   A (All)     - Zoom to show all entities with padding
 *   E (Extents) - Zoom to fit all entities exactly
 *   W (Window)  - Zoom to a rectangular window defined by two points
 */

import { AcEdCommand, EditorContext } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { Point2D } from '../editor/input/handler/AcEdPointHandler';

export class AcZoomCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'ZOOM';
        this.localName = 'Z';
        this.description = 'Control view magnification';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('ZOOM', 'command');

        // Prompt for zoom option
        const result = await editor.getPoint({
            message: 'Specify corner of window, enter a scale factor, or',
            keywords: [
                { displayName: 'All', globalName: 'ALL', localName: 'A' },
                { displayName: 'Extents', globalName: 'EXTENTS', localName: 'E' },
                { displayName: 'Window', globalName: 'WINDOW', localName: 'W' }
            ],
            allowNone: true
        });

        if (result.status === PromptStatus.Cancel) {
            context.commandLine.print('*Cancel*', 'error');
            return;
        }

        if (result.status === PromptStatus.None) {
            // Default: Extents
            context.renderer.fitView();
            context.commandLine.print('Zoom extents', 'success');
            return;
        }

        if (result.status === PromptStatus.Keyword) {
            switch (result.keyword) {
                case 'ALL':
                    context.renderer.fitView(0.2); // 20% padding for "All"
                    context.commandLine.print('Zoom all', 'success');
                    break;

                case 'EXTENTS':
                    context.renderer.fitView();
                    context.commandLine.print('Zoom extents', 'success');
                    break;

                case 'WINDOW':
                    await this.zoomWindow(context);
                    break;
            }
            return;
        }

        // If user clicked a point, treat it as first corner of window
        if (result.status === PromptStatus.OK && result.value) {
            await this.zoomWindowFromPoint(context, result.value);
        }
    }

    /**
     * Zoom Window - prompts for two corner points
     */
    private async zoomWindow(context: EditorContext): Promise<void> {
        const editor = context.editor;

        // Get first corner
        const corner1Result = await editor.getPoint({
            message: 'Specify first corner'
        });

        if (corner1Result.status !== PromptStatus.OK || !corner1Result.value) {
            return;
        }

        await this.zoomWindowFromPoint(context, corner1Result.value);
    }

    /**
     * Zoom Window from a given first corner point
     */
    private async zoomWindowFromPoint(context: EditorContext, corner1: Point2D): Promise<void> {
        const editor = context.editor;

        // Show first corner marker
        context.renderer.addDrawingPoint(corner1.x, corner1.y);

        // Get second corner
        const corner2Result = await editor.getPoint({
            message: 'Specify opposite corner',
            basePoint: corner1
        });

        context.renderer.cancelDrawing();

        if (corner2Result.status !== PromptStatus.OK || !corner2Result.value) {
            return;
        }

        const corner2 = corner2Result.value;

        // Perform zoom
        context.renderer.zoomToWindow(corner1, corner2);
        context.commandLine.print(
            `Zoom window: (${corner1.x.toFixed(2)}, ${corner1.y.toFixed(2)}) to (${corner2.x.toFixed(2)}, ${corner2.y.toFixed(2)})`,
            'success'
        );
    }
}

/**
 * ZOOM WINDOW shortcut command (ZW)
 */
export class AcZoomWindowCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'ZOOMWINDOW';
        this.localName = 'ZW';
        this.description = 'Zoom to window';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('ZOOM Window', 'command');

        // Get first corner
        const corner1Result = await editor.getPoint({
            message: 'Specify first corner'
        });

        if (corner1Result.status !== PromptStatus.OK || !corner1Result.value) {
            if (corner1Result.status === PromptStatus.Cancel) {
                context.commandLine.print('*Cancel*', 'error');
            }
            return;
        }

        const corner1 = corner1Result.value;
        context.renderer.addDrawingPoint(corner1.x, corner1.y);

        // Get second corner
        const corner2Result = await editor.getPoint({
            message: 'Specify opposite corner',
            basePoint: corner1
        });

        context.renderer.cancelDrawing();

        if (corner2Result.status !== PromptStatus.OK || !corner2Result.value) {
            if (corner2Result.status === PromptStatus.Cancel) {
                context.commandLine.print('*Cancel*', 'error');
            }
            return;
        }

        const corner2 = corner2Result.value;

        // Perform zoom
        context.renderer.zoomToWindow(corner1, corner2);
        context.commandLine.print(
            `Zoom window: (${corner1.x.toFixed(2)}, ${corner1.y.toFixed(2)}) to (${corner2.x.toFixed(2)}, ${corner2.y.toFixed(2)})`,
            'success'
        );
    }
}

/**
 * ZOOM EXTENTS shortcut command (ZE)
 */
export class AcZoomExtentsCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'ZOOMEXTENTS';
        this.localName = 'ZE';
        this.description = 'Zoom to extents';
    }

    async execute(context: EditorContext): Promise<void> {
        context.commandLine.print('ZOOM Extents', 'command');
        context.renderer.fitView();
        context.commandLine.print('Zoom extents', 'success');
    }
}

/**
 * ZOOM ALL shortcut command (ZA)
 */
export class AcZoomAllCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'ZOOMALL';
        this.localName = 'ZA';
        this.description = 'Zoom to all';
    }

    async execute(context: EditorContext): Promise<void> {
        context.commandLine.print('ZOOM All', 'command');
        context.renderer.fitView(0.2); // 20% padding
        context.commandLine.print('Zoom all', 'success');
    }
}
