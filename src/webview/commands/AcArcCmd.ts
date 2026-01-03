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
import { Arc3PointJig, ArcCenterJig } from '../editor/input/AcEdPreviewJig';
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
                ],
                allowNone: true
            });

            if (startResult.status === PromptStatus.Cancel || startResult.status === PromptStatus.None) {
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

        // Create jig for arc preview
        const jig = new Arc3PointJig(context.renderer, startPoint);

        // Get second point
        const secondResult = await editor.getPoint({
            message: 'Specify second point of arc',
            basePoint: startPoint,
            jig
        });

        if (secondResult.status !== PromptStatus.OK || !secondResult.value) {
            jig.clear();
            return;
        }

        const secondPoint = secondResult.value;
        context.renderer.addDrawingPoint(secondPoint.x, secondPoint.y);
        jig.setSecondPoint(secondPoint);

        // Get end point with arc preview
        const endResult = await editor.getPoint({
            message: 'Specify end point of arc',
            basePoint: secondPoint,
            jig
        });

        jig.clear();

        if (endResult.status !== PromptStatus.OK || !endResult.value) {
            return;
        }

        const endPoint = endResult.value;

        // Calculate arc from 3 points with correct direction
        const arc = this.calculateArcFrom3PointsWithDirection(startPoint, secondPoint, endPoint);

        if (!arc) {
            context.commandLine.print('Cannot create arc from collinear points', 'error');
            return;
        }

        const created = context.renderer.createArcFromCenterRadiusAngles(
            arc.center,
            arc.radius,
            arc.startAngle,
            arc.endAngle
        );
        if (created) {
            context.renderer.recordAddAction([created]);
        }
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

        // Create jig for arc preview
        const jig = new ArcCenterJig(context.renderer, center);

        // Get start point (defines radius)
        const startResult = await editor.getPoint({
            message: 'Specify start point of arc',
            basePoint: center,
            jig
        });

        if (startResult.status !== PromptStatus.OK || !startResult.value) {
            jig.clear();
            return;
        }

        const startPoint = startResult.value;
        const radius = distance(center, startPoint);
        const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);

        context.renderer.addDrawingPoint(startPoint.x, startPoint.y);
        jig.setStartPoint(startPoint);

        // Get end point (defines end angle) with arc preview
        const endResult = await editor.getPoint({
            message: 'Specify end point of arc',
            basePoint: center,
            jig
        });

        jig.clear();

        if (endResult.status !== PromptStatus.OK || !endResult.value) {
            return;
        }

        const endPoint = endResult.value;
        const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);

        // Convert to degrees
        const startDeg = startAngle * 180 / Math.PI;
        const endDeg = endAngle * 180 / Math.PI;

        const created = context.renderer.createArcFromCenterRadiusAngles(center, radius, startDeg, endDeg);
        if (created) {
            context.renderer.recordAddAction([created]);
        }
        context.commandLine.print(
            `Arc created: center (${center.x.toFixed(4)}, ${center.y.toFixed(4)}), radius ${radius.toFixed(4)}`,
            'success'
        );
    }

    /**
     * Calculates arc parameters from 3 points with correct direction
     * The arc will pass through all three points in order: p1 -> p2 -> p3
     */
    private calculateArcFrom3PointsWithDirection(
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

        // Calculate angles for all three points
        const angle1 = Math.atan2(ay - uy, ax - ux);
        const angle2 = Math.atan2(by - uy, bx - ux);
        const angle3 = Math.atan2(cy - uy, cx - ux);

        // Determine if we need to go counterclockwise or clockwise
        // Check if going from angle1 to angle3 counterclockwise passes through angle2
        const normalizeAngle = (a: number) => {
            while (a < 0) a += 2 * Math.PI;
            while (a >= 2 * Math.PI) a -= 2 * Math.PI;
            return a;
        };

        const a1 = normalizeAngle(angle1);
        const a2 = normalizeAngle(angle2);
        const a3 = normalizeAngle(angle3);

        // Check counterclockwise direction
        const ccwTo2 = normalizeAngle(a2 - a1);
        const ccwTo3 = normalizeAngle(a3 - a1);

        let startAngle: number;
        let endAngle: number;

        if (ccwTo2 < ccwTo3) {
            // Counterclockwise order: 1 -> 2 -> 3
            startAngle = angle1 * 180 / Math.PI;
            endAngle = angle3 * 180 / Math.PI;
        } else {
            // Clockwise order: need to swap or adjust
            // Go from p1 to p3 in clockwise direction (which is ccw from p3 to p1)
            startAngle = angle3 * 180 / Math.PI;
            endAngle = angle1 * 180 / Math.PI;
            // Swap start and end to maintain p1 as start
            startAngle = angle1 * 180 / Math.PI;
            endAngle = angle3 * 180 / Math.PI;
            // Need to indicate clockwise by making end < start
            if (endAngle > startAngle) {
                endAngle -= 360;
            }
        }

        return { center, radius, startAngle, endAngle };
    }
}
