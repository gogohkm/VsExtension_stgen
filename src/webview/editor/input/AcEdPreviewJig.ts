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

/**
 * Arc preview jig - shows rubber band arc through 3 points
 */
export class Arc3PointJig extends AcEdPreviewJig {
    private startPoint: { x: number; y: number };
    private secondPoint: { x: number; y: number } | null = null;

    constructor(renderer: DxfRenderer, startPoint: { x: number; y: number }) {
        super(renderer);
        this.startPoint = startPoint;
    }

    setSecondPoint(point: { x: number; y: number }): void {
        this.secondPoint = point;
    }

    update(point: { x: number; y: number }): void {
        if (!this.secondPoint) {
            // Show line from start to current point
            this.renderer.updateLineRubberBandFromPoints(this.startPoint, point);
        } else {
            // Show arc through 3 points
            this.renderer.updateArc3PointRubberBand(this.startPoint, this.secondPoint, point);
        }
    }

    clear(): void {
        this.renderer.clearRubberBand();
    }
}

/**
 * Arc preview jig for center-start-end method
 */
export class ArcCenterJig extends AcEdPreviewJig {
    private center: { x: number; y: number };
    private startPoint: { x: number; y: number } | null = null;
    private radius: number = 0;
    private startAngle: number = 0;

    constructor(renderer: DxfRenderer, center: { x: number; y: number }) {
        super(renderer);
        this.center = center;
    }

    setStartPoint(point: { x: number; y: number }): void {
        this.startPoint = point;
        this.radius = Math.sqrt(
            Math.pow(point.x - this.center.x, 2) +
            Math.pow(point.y - this.center.y, 2)
        );
        this.startAngle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
    }

    update(point: { x: number; y: number }): void {
        if (!this.startPoint) {
            // Show line from center to current point (defining radius)
            this.renderer.updateLineRubberBandFromPoints(this.center, point);
        } else {
            // Show arc from start to current end angle
            const endAngle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
            const startDeg = this.startAngle * 180 / Math.PI;
            const endDeg = endAngle * 180 / Math.PI;
            this.renderer.updateArcRubberBand(this.center, this.radius, startDeg, endDeg);
        }
    }

    clear(): void {
        this.renderer.clearRubberBand();
    }
}

/**
 * Dimension preview jig - shows dimension line preview
 */
export class DimensionJig extends AcEdPreviewJig {
    private p1: { x: number; y: number };
    private p2: { x: number; y: number };
    private dimType: 'horizontal' | 'vertical' | 'aligned' | 'auto';

    constructor(
        renderer: DxfRenderer,
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        dimType: 'horizontal' | 'vertical' | 'aligned' | 'auto' = 'auto'
    ) {
        super(renderer);
        this.p1 = p1;
        this.p2 = p2;
        this.dimType = dimType;
    }

    update(point: { x: number; y: number }): void {
        this.renderer.updateDimensionRubberBand(this.p1, this.p2, point, this.dimType);
    }

    clear(): void {
        this.renderer.clearRubberBand();
    }
}

/**
 * Polyline preview jig - shows all segments plus rubber band to current point
 */
export class PolylineJig extends AcEdPreviewJig {
    private points: { x: number; y: number }[];

    constructor(renderer: DxfRenderer, points: { x: number; y: number }[]) {
        super(renderer);
        this.points = [...points];
    }

    setPoints(points: { x: number; y: number }[]): void {
        this.points = [...points];
    }

    update(point: { x: number; y: number }): void {
        // Show all existing segments plus rubber band to current point
        const allPoints = [...this.points, point];
        this.renderer.updatePolylineRubberBand(allPoints);
    }

    clear(): void {
        this.renderer.clearRubberBand();
    }
}
