/**
 * DISTANCE Command - Measures distance between two points
 *
 * Usage:
 *   DIST
 *   Specify first point: (click or enter coordinates)
 *   Specify second point: (click or enter coordinates)
 *   Result displays: Distance, Angle, Delta X, Delta Y
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { LineJig } from '../editor/input/AcEdPreviewJig';
import { Point2D, distance } from '../editor/input/handler/AcEdPointHandler';

export class AcDistanceCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'DIST';
        this.localName = 'DI';
        this.description = 'Measure distance between points';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('DIST', 'command');

        // Main command loop
        let continueCommand = true;
        while (continueCommand) {
            this.checkCancelled();

            // Get first point
            const firstPointResult = await editor.getPoint({
                message: 'Specify first point'
            });

            if (firstPointResult.status === PromptStatus.Cancel) {
                break;
            }

            if (firstPointResult.status !== PromptStatus.OK || !firstPointResult.value) {
                break;
            }

            const firstPoint = firstPointResult.value;
            context.renderer.addDrawingPoint(firstPoint.x, firstPoint.y);

            // Create jig for line preview
            const jig = new LineJig(context.renderer, firstPoint);

            // Get second point
            const secondPointResult = await editor.getPoint({
                message: 'Specify second point',
                basePoint: firstPoint,
                jig
            });

            jig.clear();

            if (secondPointResult.status === PromptStatus.Cancel) {
                break;
            }

            if (secondPointResult.status !== PromptStatus.OK || !secondPointResult.value) {
                continue;
            }

            const secondPoint = secondPointResult.value;

            // Calculate and display results
            this.displayMeasurement(context, firstPoint, secondPoint);

            // Continue for more measurements
        }

        context.renderer.cancelDrawing();
    }

    /**
     * Displays measurement results
     */
    private displayMeasurement(context: EditorContext, p1: Point2D, p2: Point2D): void {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = distance(p1, p2);
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = angleRad * 180 / Math.PI;

        context.commandLine.print('', 'response');
        context.commandLine.print(`Distance = ${dist.toFixed(4)}`, 'success');
        context.commandLine.print(`Angle in XY Plane = ${angleDeg.toFixed(2)}°`, 'response');
        context.commandLine.print(`Delta X = ${dx.toFixed(4)}, Delta Y = ${dy.toFixed(4)}`, 'response');
    }
}
