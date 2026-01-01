/**
 * Preview Jig - Rubber band preview during command input
 */

import { DxfRenderer } from '../../dxfRenderer';

/**
 * Abstract base class for command previews (Jigs)
 *
 * Jigs provide real-time visual feedback while the user is
 * entering input for a command. For example, when drawing a line,
 * a jig shows the line from the first point to the current mouse position.
 *
 * @example
 * ```typescript
 * class LineJig extends AcEdPreviewJig {
 *   private startPoint: Point;
 *
 *   constructor(renderer: DxfRenderer, startPoint: Point) {
 *     super(renderer);
 *     this.startPoint = startPoint;
 *   }
 *
 *   update(point: Point) {
 *     this.renderer.updateLineRubberBand(this.startPoint, point);
 *   }
 *
 *   clear() {
 *     this.renderer.clearRubberBand();
 *   }
 * }
 * ```
 */
export abstract class AcEdPreviewJig {
    protected renderer: DxfRenderer;

    constructor(renderer: DxfRenderer) {
        this.renderer = renderer;
    }

    /**
     * Updates the preview based on current input
     * Called on mouse move or coordinate input
     */
    abstract update(value: { x: number; y: number } | number): void;

    /**
     * Clears the preview
     * Called when input is complete or cancelled
     */
    abstract clear(): void;
}

/**
 * Line preview jig - shows rubber band line
 */
export class LineJig extends AcEdPreviewJig {
    private startPoint: { x: number; y: number };

    constructor(renderer: DxfRenderer, startPoint: { x: number; y: number }) {
        super(renderer);
        this.startPoint = startPoint;
    }

    update(point: { x: number; y: number }): void {
        this.renderer.updateLineRubberBandFromPoints(this.startPoint, point);
    }

    clear(): void {
        this.renderer.clearRubberBand();
    }

    setStartPoint(point: { x: number; y: number }): void {
        this.startPoint = point;
    }
}

/**
 * Circle preview jig - shows rubber band circle
 */
export class CircleJig extends AcEdPreviewJig {
    private center: { x: number; y: number };

    constructor(renderer: DxfRenderer, center: { x: number; y: number }) {
        super(renderer);
        this.center = center;
    }

    update(value: { x: number; y: number } | number): void {
        let radius: number;
        if (typeof value === 'number') {
            radius = value;
        } else {
            // Calculate radius from point
            radius = Math.sqrt(
                Math.pow(value.x - this.center.x, 2) +
                Math.pow(value.y - this.center.y, 2)
            );
        }

        this.renderer.updateCircleRubberBandFromCenterRadius(this.center, radius);
    }

    clear(): void {
        this.renderer.clearRubberBand();
    }
}

/**
 * Rectangle preview jig - shows rubber band rectangle
 */
export class RectangleJig extends AcEdPreviewJig {
    private firstCorner: { x: number; y: number };

    constructor(renderer: DxfRenderer, firstCorner: { x: number; y: number }) {
        super(renderer);
        this.firstCorner = firstCorner;
    }

    update(point: { x: number; y: number }): void {
        this.renderer.updateRectangleRubberBand(this.firstCorner, point);
    }

    clear(): void {
        this.renderer.clearRubberBand();
    }
}
