/**
 * ARC Command - Draws arcs with various input methods
 *
 * Usage:
 *   ARC
 *   Specify start point of arc or [Center]: (click or enter coordinates)
 *   Specify second point of arc or [Center/End]: (click or enter coordinates)
 *   Specify end point of arc: (click or enter coordinates)
 *
 * Options:
 *   Center - Start with center point
 *   3-Point (default) - Three points on arc
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { Point2D, distance } from '../editor/input/handler/AcEdPointHandler';

export class AcArcCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'ARC';
        this.localName = 'A';
        this.description = 'Draw an arc';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('ARC', 'command');

        // Main command loop
        let continueDrawing = true;
        while (continueDrawing) {
            this.checkCancelled();

            // Get start point with options
            const startResult = await editor.getPoint({
                message: 'Specify start point of arc',
                keywords: [
                    { displayName: 'Center', globalName: 'CENTER', localName: 'CE' }
                ]
            });

            if (startResult.status === PromptStatus.Cancel) {
                break;
            }

            if (startResult.status === PromptStatus.Keyword && startResult.keyword === 'CENTER') {
                await this.drawCenterStartEndArc(context, editor);
                continue;
            }

            if (startResult.status !== PromptStatus.OK || !startResult.value) {
                break;
            }

            // Default: 3-point arc
            await this.draw3PointArc(context, editor, startResult.value);
        }

        context.renderer.cancelDrawing();
    }

    /**
     * Draws arc through 3 points
     */
    private async draw3PointArc(context: EditorContext, editor: AcEditorInterface, startPoint: Point2D): Promise<void> {
        context.renderer.addDrawingPoint(startPoint.x, startPoint.y);

        // Get second point
        const secondResult = await editor.getPoint({
            message: 'Specify second point of arc',
            basePoint: startPoint
        });

        if (secondResult.status !== PromptStatus.OK || !secondResult.value) {
            return;
        }

        const secondPoint = secondResult.value;
        context.renderer.addDrawingPoint(secondPoint.x, secondPoint.y);

        // Get end point
        const endResult = await editor.getPoint({
            message: 'Specify end point of arc',
            basePoint: secondPoint
        });

        if (endResult.status !== PromptStatus.OK || !endResult.value) {
            return;
        }

        const endPoint = endResult.value;

        // Calculate arc from 3 points
        const arc = this.calculateArcFrom3Points(startPoint, secondPoint, endPoint);

        if (!arc) {
            context.commandLine.print('Cannot create arc from collinear points', 'error');
            return;
        }

        context.renderer.createArcFromCenterRadiusAngles(arc.center, arc.radius, arc.startAngle, arc.endAngle);
        context.commandLine.print(
            `Arc created: center (${arc.center.x.toFixed(4)}, ${arc.center.y.toFixed(4)}), radius ${arc.radius.toFixed(4)}`,
            'success'
        );
    }

    /**
     * Draws arc by center, start, end
     */
    private async drawCenterStartEndArc(context: EditorContext, editor: AcEditorInterface): Promise<void> {
        context.commandLine.print('Center', 'response');

        // Get center point
        const centerResult = await editor.getPoint({
            message: 'Specify center point of arc'
        });

        if (centerResult.status !== PromptStatus.OK || !centerResult.value) {
            return;
        }

        const center = centerResult.value;
        context.renderer.addDrawingPoint(center.x, center.y);

        // Get start point (defines radius)
        const startResult = await editor.getPoint({
            message: 'Specify start point of arc',
            basePoint: center
        });

        if (startResult.status !== PromptStatus.OK || !startResult.value) {
            return;
        }

        const startPoint = startResult.value;
        const radius = distance(center, startPoint);
        const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);

        context.renderer.addDrawingPoint(startPoint.x, startPoint.y);

        // Get end point (defines end angle)
        const endResult = await editor.getPoint({
            message: 'Specify end point of arc',
            basePoint: center
        });

        if (endResult.status !== PromptStatus.OK || !endResult.value) {
            return;
        }

        const endPoint = endResult.value;
        const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);

        // Convert to degrees
        const startDeg = startAngle * 180 / Math.PI;
        const endDeg = endAngle * 180 / Math.PI;

        context.renderer.createArcFromCenterRadiusAngles(center, radius, startDeg, endDeg);
        context.commandLine.print(
            `Arc created: center (${center.x.toFixed(4)}, ${center.y.toFixed(4)}), radius ${radius.toFixed(4)}`,
            'success'
        );
    }

    /**
     * Calculates arc parameters from 3 points
     */
    private calculateArcFrom3Points(
        p1: Point2D,
        p2: Point2D,
        p3: Point2D
    ): { center: Point2D; radius: number; startAngle: number; endAngle: number } | null {
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

        const center = { x: ux, y: uy };
        const radius = Math.sqrt(Math.pow(ax - ux, 2) + Math.pow(ay - uy, 2));

        // Calculate angles
        const startAngle = Math.atan2(ay - uy, ax - ux) * 180 / Math.PI;
        const endAngle = Math.atan2(cy - uy, cx - ux) * 180 / Math.PI;

        return { center, radius, startAngle, endAngle };
    }
}
