/**
 * RECTANGLE Command - Draws rectangles from two corner points
 *
 * Usage:
 *   RECTANGLE
 *   Specify first corner point: (click or enter coordinates)
 *   Specify other corner point: (click or enter coordinates)
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { RectangleJig } from '../editor/input/AcEdPreviewJig';
import { Point2D } from '../editor/input/handler/AcEdPointHandler';

export class AcRectangleCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'RECTANGLE';
        this.localName = 'REC';
        this.description = 'Draw a rectangle';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('RECTANGLE', 'command');

        // Main command loop
        let continueDrawing = true;
        while (continueDrawing) {
            this.checkCancelled();

            // Get first corner point
            const firstCornerResult = await editor.getPoint({
                message: 'Specify first corner point'
            });

            if (firstCornerResult.status === PromptStatus.Cancel) {
                break;
            }

            if (firstCornerResult.status !== PromptStatus.OK || !firstCornerResult.value) {
                break;
            }

            const firstCorner = firstCornerResult.value;
            context.renderer.addDrawingPoint(firstCorner.x, firstCorner.y);

            // Create jig for rectangle preview
            const jig = new RectangleJig(context.renderer, firstCorner);

            // Get second corner point
            const secondCornerResult = await editor.getPoint({
                message: 'Specify other corner point',
                basePoint: firstCorner,
                jig
            });

            jig.clear();

            if (secondCornerResult.status === PromptStatus.Cancel) {
                break;
            }

            if (secondCornerResult.status !== PromptStatus.OK || !secondCornerResult.value) {
                continue;
            }

            const secondCorner = secondCornerResult.value;

            // Create rectangle as 4 lines (closed polyline)
            this.createRectangle(context, firstCorner, secondCorner);

            context.commandLine.print(
                `Rectangle created: (${firstCorner.x.toFixed(4)}, ${firstCorner.y.toFixed(4)}) to (${secondCorner.x.toFixed(4)}, ${secondCorner.y.toFixed(4)})`,
                'success'
            );
        }

        context.renderer.cancelDrawing();
    }

    /**
     * Creates a rectangle from two corner points
     */
    private createRectangle(context: EditorContext, p1: Point2D, p2: Point2D): void {
        // Calculate all 4 corners
        const corners: Point2D[] = [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p1.y },
            { x: p2.x, y: p2.y },
            { x: p1.x, y: p2.y }
        ];

        // Create 4 lines
        for (let i = 0; i < 4; i++) {
            const start = corners[i];
            const end = corners[(i + 1) % 4];
            context.renderer.createLineFromPoints(start, end);
        }
    }
}
