/**
 * DIM Command - Creates linear dimension annotations
 *
 * Usage:
 *   DIM or DIMLINEAR
 *   Specify first extension line origin: (click or enter coordinates)
 *   Specify second extension line origin: (click or enter coordinates)
 *   Specify dimension line location: (click or enter coordinates)
 *
 * Creates a linear dimension with:
 *   - Two extension lines from measured points
 *   - Dimension line with arrows
 *   - Measurement text
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { LineJig } from '../editor/input/AcEdPreviewJig';
import { Point2D, distance } from '../editor/input/handler/AcEdPointHandler';
import { DxfEntity } from '../dxfParser';

// Dimension settings
const DIM_ARROW_SIZE = 2.5;  // Arrow head size
const DIM_TEXT_HEIGHT = 2.5; // Text height
const DIM_TEXT_GAP = 0.625;  // Gap between text and dimension line
const DIM_EXTENSION_OFFSET = 0.625; // Offset from origin to extension line start
const DIM_EXTENSION_BEYOND = 1.25;  // Extension beyond dimension line

export class AcDimCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'DIM';
        this.localName = 'DLI';
        this.description = 'Create linear dimension';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('DIM (Linear Dimension)', 'command');

        // Get first extension line origin
        const firstPointResult = await editor.getPoint({
            message: 'Specify first extension line origin'
        });

        if (firstPointResult.status !== PromptStatus.OK || !firstPointResult.value) {
            return;
        }

        const firstPoint = firstPointResult.value;
        context.renderer.addDrawingPoint(firstPoint.x, firstPoint.y);

        // Create jig for line preview
        const jig1 = new LineJig(context.renderer, firstPoint);

        // Get second extension line origin
        const secondPointResult = await editor.getPoint({
            message: 'Specify second extension line origin',
            basePoint: firstPoint,
            jig: jig1
        });

        jig1.clear();

        if (secondPointResult.status !== PromptStatus.OK || !secondPointResult.value) {
            context.renderer.cancelDrawing();
            return;
        }

        const secondPoint = secondPointResult.value;
        context.renderer.addDrawingPoint(secondPoint.x, secondPoint.y);

        // Get dimension line location
        const dimLineResult = await editor.getPoint({
            message: 'Specify dimension line location'
        });

        if (dimLineResult.status !== PromptStatus.OK || !dimLineResult.value) {
            context.renderer.cancelDrawing();
            return;
        }

        const dimLineLocation = dimLineResult.value;

        // Calculate dimension geometry
        const dimGeometry = this.calculateDimensionGeometry(firstPoint, secondPoint, dimLineLocation);

        // Create dimension entities
        const created = this.createDimensionEntities(context, dimGeometry);
        if (created.length > 0) {
            context.renderer.recordAddAction(created);
        }

        context.renderer.cancelDrawing();
        context.commandLine.print(`Dimension created: ${dimGeometry.measurement.toFixed(4)}`, 'success');
    }

    /**
     * Calculate dimension geometry based on measurement points and dimension line location
     */
    private calculateDimensionGeometry(
        p1: Point2D,
        p2: Point2D,
        dimLocation: Point2D
    ): DimensionGeometry {
        // Calculate the measurement (horizontal distance for now)
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        // Determine if this is a horizontal or vertical dimension
        // based on which axis has the larger delta to the dimension line location
        const isHorizontal = Math.abs(dimLocation.y - (p1.y + p2.y) / 2) > Math.abs(dimLocation.x - (p1.x + p2.x) / 2);

        let measurement: number;
        let dimLineStart: Point2D;
        let dimLineEnd: Point2D;
        let ext1Start: Point2D;
        let ext1End: Point2D;
        let ext2Start: Point2D;
        let ext2End: Point2D;
        let textPosition: Point2D;
        let textAngle: number;

        if (isHorizontal) {
            // Horizontal dimension (measures horizontal distance)
            measurement = Math.abs(dx);
            const dimY = dimLocation.y;

            // Dimension line endpoints
            dimLineStart = { x: p1.x, y: dimY };
            dimLineEnd = { x: p2.x, y: dimY };

            // Extension lines
            const ext1Dir = dimY > p1.y ? 1 : -1;
            ext1Start = { x: p1.x, y: p1.y + DIM_EXTENSION_OFFSET * ext1Dir };
            ext1End = { x: p1.x, y: dimY + DIM_EXTENSION_BEYOND * ext1Dir };

            const ext2Dir = dimY > p2.y ? 1 : -1;
            ext2Start = { x: p2.x, y: p2.y + DIM_EXTENSION_OFFSET * ext2Dir };
            ext2End = { x: p2.x, y: dimY + DIM_EXTENSION_BEYOND * ext2Dir };

            // Text position (centered on dimension line)
            textPosition = {
                x: (p1.x + p2.x) / 2,
                y: dimY + DIM_TEXT_GAP + DIM_TEXT_HEIGHT / 2
            };
            textAngle = 0;
        } else {
            // Vertical dimension (measures vertical distance)
            measurement = Math.abs(dy);
            const dimX = dimLocation.x;

            // Dimension line endpoints
            dimLineStart = { x: dimX, y: p1.y };
            dimLineEnd = { x: dimX, y: p2.y };

            // Extension lines
            const ext1Dir = dimX > p1.x ? 1 : -1;
            ext1Start = { x: p1.x + DIM_EXTENSION_OFFSET * ext1Dir, y: p1.y };
            ext1End = { x: dimX + DIM_EXTENSION_BEYOND * ext1Dir, y: p1.y };

            const ext2Dir = dimX > p2.x ? 1 : -1;
            ext2Start = { x: p2.x + DIM_EXTENSION_OFFSET * ext2Dir, y: p2.y };
            ext2End = { x: dimX + DIM_EXTENSION_BEYOND * ext2Dir, y: p2.y };

            // Text position (centered on dimension line, rotated 90 degrees)
            textPosition = {
                x: dimX + DIM_TEXT_GAP + DIM_TEXT_HEIGHT / 2,
                y: (p1.y + p2.y) / 2
            };
            textAngle = 90;
        }

        return {
            measurement,
            dimLineStart,
            dimLineEnd,
            ext1Start,
            ext1End,
            ext2Start,
            ext2End,
            textPosition,
            textAngle,
            arrow1: dimLineStart,
            arrow2: dimLineEnd
        };
    }

    /**
     * Create dimension entities and add them to the renderer
     */
    private createDimensionEntities(context: EditorContext, geom: DimensionGeometry): DxfEntity[] {
        const created: DxfEntity[] = [];

        // Create extension line 1
        const ext1 = context.renderer.createLineFromPoints(geom.ext1Start, geom.ext1End);
        if (ext1) created.push(ext1);

        // Create extension line 2
        const ext2 = context.renderer.createLineFromPoints(geom.ext2Start, geom.ext2End);
        if (ext2) created.push(ext2);

        // Create dimension line
        const dimLine = context.renderer.createLineFromPoints(geom.dimLineStart, geom.dimLineEnd);
        if (dimLine) created.push(dimLine);

        // Create arrow heads
        created.push(...this.createArrowHead(context, geom.dimLineStart, geom.dimLineEnd));
        created.push(...this.createArrowHead(context, geom.dimLineEnd, geom.dimLineStart));

        // Create dimension text
        const text = this.createDimensionText(context, geom);
        if (text) created.push(text);

        return created;
    }

    /**
     * Create arrow head at the given position pointing toward target
     */
    private createArrowHead(context: EditorContext, position: Point2D, target: Point2D): DxfEntity[] {
        const created: DxfEntity[] = [];

        // Calculate arrow direction
        const dx = target.x - position.x;
        const dy = target.y - position.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 0.001) return created;

        // Normalize direction
        const dirX = dx / len;
        const dirY = dy / len;

        // Arrow tip points
        const arrowLen = DIM_ARROW_SIZE;
        const arrowWidth = DIM_ARROW_SIZE * 0.3;

        // Calculate perpendicular
        const perpX = -dirY;
        const perpY = dirX;

        // Arrow head points (two lines forming an arrow)
        const tip = position;
        const left = {
            x: position.x + dirX * arrowLen - perpX * arrowWidth,
            y: position.y + dirY * arrowLen - perpY * arrowWidth
        };
        const right = {
            x: position.x + dirX * arrowLen + perpX * arrowWidth,
            y: position.y + dirY * arrowLen + perpY * arrowWidth
        };

        // Create arrow lines
        const leftLine = context.renderer.createLineFromPoints(tip, left);
        if (leftLine) created.push(leftLine);
        const rightLine = context.renderer.createLineFromPoints(tip, right);
        if (rightLine) created.push(rightLine);

        return created;
    }

    /**
     * Create dimension text
     */
    private createDimensionText(context: EditorContext, geom: DimensionGeometry): DxfEntity | null {
        // Format the measurement text
        const textContent = geom.measurement.toFixed(2);

        // Create text entity for dimension annotation
        return context.renderer.createTextEntity(
            geom.textPosition,
            textContent,
            DIM_TEXT_HEIGHT,
            geom.textAngle
        );
    }
}

/**
 * Dimension geometry interface
 */
interface DimensionGeometry {
    measurement: number;
    dimLineStart: Point2D;
    dimLineEnd: Point2D;
    ext1Start: Point2D;
    ext1End: Point2D;
    ext2Start: Point2D;
    ext2End: Point2D;
    textPosition: Point2D;
    textAngle: number;
    arrow1: Point2D;
    arrow2: Point2D;
}
