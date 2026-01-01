/**
 * CIRCLE Command - Draws circles with various input methods
 *
 * Usage:
 *   CIRCLE
 *   Specify center point for circle or [3P/2P/Ttr]: (click or enter coordinates)
 *   Specify radius or [Diameter]: (click, number, or D for diameter)
 *
 * Options:
 *   3P - Three points on circle
 *   2P - Two points defining diameter
 *   Ttr - Tangent, tangent, radius (not implemented)
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { CircleJig } from '../editor/input/AcEdPreviewJig';
import { Point2D, distance } from '../editor/input/handler/AcEdPointHandler';

type CircleMode = 'center-radius' | '2p' | '3p';

export class AcCircleCmd extends AcEdCommand {
    private mode: CircleMode = 'center-radius';

    constructor() {
        super();
        this.globalName = 'CIRCLE';
        this.localName = 'C';
        this.description = 'Draw a circle';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('CIRCLE', 'command');

        // Main command loop for multiple circles
        let continueDrawing = true;
        while (continueDrawing) {
            this.checkCancelled();

            // Get center point with mode options
            const centerResult = await editor.getPoint({
                message: 'Specify center point for circle',
                keywords: [
                    { displayName: '3P', globalName: '3P' },
                    { displayName: '2P', globalName: '2P' },
                    { displayName: 'Ttr', globalName: 'TTR', localName: 'T' }
                ]
            });

            if (centerResult.status === PromptStatus.Cancel) {
                break;
            }

            if (centerResult.status === PromptStatus.Keyword) {
                switch (centerResult.keyword) {
                    case '3P':
                        await this.draw3PointCircle(context, editor);
                        continue;
                    case '2P':
                        await this.draw2PointCircle(context, editor);
                        continue;
                    case 'TTR':
                        context.commandLine.print('TTR mode not yet implemented', 'error');
                        continue;
                }
            }

            if (centerResult.status !== PromptStatus.OK || !centerResult.value) {
                break;
            }

            // Draw center-radius circle
            await this.drawCenterRadiusCircle(context, editor, centerResult.value);
        }

        context.renderer.cancelDrawing();
    }

    /**
     * Draws circle by center point and radius
     */
    private async drawCenterRadiusCircle(context: EditorContext, editor: AcEditorInterface, center: Point2D): Promise<void> {
        context.renderer.addDrawingPoint(center.x, center.y);
        const jig = new CircleJig(context.renderer, center);

        const radiusResult = await editor.getDistance({
            message: 'Specify radius',
            basePoint: center,
            jig,
            keywords: [
                { displayName: 'Diameter', globalName: 'DIAMETER', localName: 'D' }
            ]
        });

        jig.clear();

        if (radiusResult.status === PromptStatus.Keyword && radiusResult.keyword === 'DIAMETER') {
            // Switch to diameter mode
            const diameterResult = await editor.getDistance({
                message: 'Specify diameter',
                basePoint: center
            });

            if (diameterResult.status === PromptStatus.OK && diameterResult.value) {
                const radius = diameterResult.value / 2;
                const created = context.renderer.createCircleFromCenterRadius(center, radius);
                if (created) {
                    context.renderer.recordAddAction([created]);
                }
                context.commandLine.print(`Diameter: ${diameterResult.value.toFixed(4)}`, 'response');
            }
        } else if (radiusResult.status === PromptStatus.OK && radiusResult.value) {
            const created = context.renderer.createCircleFromCenterRadius(center, radiusResult.value);
            if (created) {
                context.renderer.recordAddAction([created]);
            }
            context.commandLine.print(`Radius: ${radiusResult.value.toFixed(4)}`, 'response');
        }
    }

    /**
     * Draws circle through 2 points (diameter endpoints)
     */
    private async draw2PointCircle(context: EditorContext, editor: AcEditorInterface): Promise<void> {
        context.commandLine.print('2P', 'response');

        // First point
        const p1Result = await editor.getPoint({
            message: 'Specify first end point of circle\'s diameter'
        });

        if (p1Result.status !== PromptStatus.OK || !p1Result.value) {
            return;
        }

        const p1 = p1Result.value;
        context.renderer.addDrawingPoint(p1.x, p1.y);

        // Second point
        const p2Result = await editor.getPoint({
            message: 'Specify second end point of circle\'s diameter',
            basePoint: p1
        });

        if (p2Result.status !== PromptStatus.OK || !p2Result.value) {
            return;
        }

        const p2 = p2Result.value;

        // Calculate center and radius
        const center = {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
        const radius = distance(p1, p2) / 2;

        const created = context.renderer.createCircleFromCenterRadius(center, radius);
        if (created) {
            context.renderer.recordAddAction([created]);
        }
        context.commandLine.print(
            `Circle created: center (${center.x.toFixed(4)}, ${center.y.toFixed(4)}), radius ${radius.toFixed(4)}`,
            'success'
        );
    }

    /**
     * Draws circle through 3 points
     */
    private async draw3PointCircle(context: EditorContext, editor: AcEditorInterface): Promise<void> {
        context.commandLine.print('3P', 'response');

        // First point
        const p1Result = await editor.getPoint({
            message: 'Specify first point on circle'
        });

        if (p1Result.status !== PromptStatus.OK || !p1Result.value) {
            return;
        }

        const p1 = p1Result.value;
        context.renderer.addDrawingPoint(p1.x, p1.y);

        // Second point
        const p2Result = await editor.getPoint({
            message: 'Specify second point on circle',
            basePoint: p1
        });

        if (p2Result.status !== PromptStatus.OK || !p2Result.value) {
            return;
        }

        const p2 = p2Result.value;
        context.renderer.addDrawingPoint(p2.x, p2.y);

        // Third point
        const p3Result = await editor.getPoint({
            message: 'Specify third point on circle',
            basePoint: p2
        });

        if (p3Result.status !== PromptStatus.OK || !p3Result.value) {
            return;
        }

        const p3 = p3Result.value;

        // Calculate circumcircle
        const circle = this.calculateCircleFrom3Points(p1, p2, p3);

        if (!circle) {
            context.commandLine.print('Cannot create circle from collinear points', 'error');
            return;
        }

        const created = context.renderer.createCircleFromCenterRadius(circle.center, circle.radius);
        if (created) {
            context.renderer.recordAddAction([created]);
        }
        context.commandLine.print(
            `Circle created: center (${circle.center.x.toFixed(4)}, ${circle.center.y.toFixed(4)}), radius ${circle.radius.toFixed(4)}`,
            'success'
        );
    }

    /**
     * Calculates circumcircle from 3 points
     */
    private calculateCircleFrom3Points(
        p1: Point2D,
        p2: Point2D,
        p3: Point2D
    ): { center: Point2D; radius: number } | null {
        const ax = p1.x, ay = p1.y;
        const bx = p2.x, by = p2.y;
        const cx = p3.x, cy = p3.y;

        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

        if (Math.abs(d) < 0.0001) {
            return null; // Points are collinear
        }

        const ux = ((ax * ax + ay * ay) * (by - cy) +
            (bx * bx + by * by) * (cy - ay) +
            (cx * cx + cy * cy) * (ay - by)) / d;

        const uy = ((ax * ax + ay * ay) * (cx - bx) +
            (bx * bx + by * by) * (ax - cx) +
            (cx * cx + cy * cy) * (bx - ax)) / d;

        const radius = Math.sqrt(Math.pow(ax - ux, 2) + Math.pow(ay - uy, 2));

        return { center: { x: ux, y: uy }, radius };
    }
}
