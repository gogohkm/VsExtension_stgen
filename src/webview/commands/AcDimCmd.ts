/**
 * DIM Commands - Creates dimension annotations
 *
 * Available commands:
 *   DIM / DIMLINEAR (DLI) - Auto-detect horizontal/vertical based on cursor position
 *   DIMHOR (DH) - Horizontal dimension (measures X distance)
 *   DIMVER (DV) - Vertical dimension (measures Y distance)
 *   DIMALIGNED (DAL) - Aligned dimension (measures actual distance between points)
 *   DIMANGULAR (DAN) - Angular dimension (measures angle between two lines)
 *
 * Creates dimensions with:
 *   - Extension lines from measured points
 *   - Dimension line with arrows
 *   - Measurement text
 */

import { AcEdCommand, EditorContext } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { LineJig } from '../editor/input/AcEdPreviewJig';
import { Point2D, distance } from '../editor/input/handler/AcEdPointHandler';
import { DxfEntity } from '../dxfParser';

// Dimension settings - these are ratios relative to measurement size
const DIM_SCALE_FACTOR = 0.03;        // Base scale factor (3% of measurement)
const DIM_MIN_TEXT_HEIGHT = 1.5;      // Minimum text height to ensure readability
const DIM_MAX_TEXT_HEIGHT = 50;       // Maximum text height to prevent oversized text
const DIM_ARROW_RATIO = 1.0;          // Arrow size relative to text height
const DIM_TEXT_GAP_RATIO = 0.25;      // Gap relative to text height
const DIM_EXTENSION_OFFSET_RATIO = 0.25; // Extension offset relative to text height
const DIM_EXTENSION_BEYOND_RATIO = 0.5;  // Extension beyond relative to text height

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
    textHeight: number;
    arrowSize: number;
}

/**
 * Angular dimension geometry interface
 */
interface AngularDimensionGeometry {
    angle: number;  // Angle in degrees
    arcCenter: Point2D;
    arcRadius: number;
    arcStartAngle: number;
    arcEndAngle: number;
    textPosition: Point2D;
    textHeight: number;
    arrowSize: number;
    ext1Start: Point2D;
    ext1End: Point2D;
    ext2Start: Point2D;
    ext2End: Point2D;
}

/**
 * Calculate dimension settings based on measurement size
 */
function calculateDimSettings(measurement: number): {
    textHeight: number;
    arrowSize: number;
    textGap: number;
    extensionOffset: number;
    extensionBeyond: number;
} {
    let textHeight = measurement * DIM_SCALE_FACTOR;
    textHeight = Math.max(DIM_MIN_TEXT_HEIGHT, Math.min(DIM_MAX_TEXT_HEIGHT, textHeight));

    return {
        textHeight,
        arrowSize: textHeight * DIM_ARROW_RATIO,
        textGap: textHeight * DIM_TEXT_GAP_RATIO,
        extensionOffset: textHeight * DIM_EXTENSION_OFFSET_RATIO,
        extensionBeyond: textHeight * DIM_EXTENSION_BEYOND_RATIO
    };
}

/**
 * Create arrow head at the given position pointing toward target
 */
function createArrowHead(context: EditorContext, position: Point2D, target: Point2D, arrowSize: number): DxfEntity[] {
    const created: DxfEntity[] = [];

    const dx = target.x - position.x;
    const dy = target.y - position.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < 0.001) return created;

    const dirX = dx / len;
    const dirY = dy / len;

    const arrowLen = arrowSize;
    const arrowWidth = arrowSize * 0.3;

    const perpX = -dirY;
    const perpY = dirX;

    const tip = position;
    const left = {
        x: position.x + dirX * arrowLen - perpX * arrowWidth,
        y: position.y + dirY * arrowLen - perpY * arrowWidth
    };
    const right = {
        x: position.x + dirX * arrowLen + perpX * arrowWidth,
        y: position.y + dirY * arrowLen + perpY * arrowWidth
    };

    const leftLine = context.renderer.createLineFromPoints(tip, left);
    if (leftLine) created.push(leftLine);
    const rightLine = context.renderer.createLineFromPoints(tip, right);
    if (rightLine) created.push(rightLine);

    return created;
}

/**
 * Create dimension entities from geometry
 */
function createDimensionEntities(context: EditorContext, geom: DimensionGeometry): DxfEntity[] {
    const created: DxfEntity[] = [];

    // Extension line 1
    const ext1 = context.renderer.createLineFromPoints(geom.ext1Start, geom.ext1End);
    if (ext1) created.push(ext1);

    // Extension line 2
    const ext2 = context.renderer.createLineFromPoints(geom.ext2Start, geom.ext2End);
    if (ext2) created.push(ext2);

    // Dimension line
    const dimLine = context.renderer.createLineFromPoints(geom.dimLineStart, geom.dimLineEnd);
    if (dimLine) created.push(dimLine);

    // Arrow heads
    created.push(...createArrowHead(context, geom.dimLineStart, geom.dimLineEnd, geom.arrowSize));
    created.push(...createArrowHead(context, geom.dimLineEnd, geom.dimLineStart, geom.arrowSize));

    // Dimension text
    const textContent = geom.measurement.toFixed(2);
    const text = context.renderer.createTextEntity(
        geom.textPosition,
        textContent,
        geom.textHeight,
        geom.textAngle
    );
    if (text) created.push(text);

    return created;
}

/**
 * Get two points from user for dimension
 */
async function getTwoPoints(context: EditorContext, commandName: string): Promise<{ p1: Point2D; p2: Point2D } | null> {
    const editor = context.editor;

    context.commandLine.print(commandName, 'command');

    // Get first point
    const firstPointResult = await editor.getPoint({
        message: 'Specify first extension line origin',
        allowNone: true
    });

    if (firstPointResult.status === PromptStatus.Cancel || firstPointResult.status === PromptStatus.None) {
        return null;
    }

    if (firstPointResult.status !== PromptStatus.OK || !firstPointResult.value) {
        return null;
    }

    const p1 = firstPointResult.value;
    context.renderer.addDrawingPoint(p1.x, p1.y);

    // Create jig for line preview
    const jig = new LineJig(context.renderer, p1);

    // Get second point
    const secondPointResult = await editor.getPoint({
        message: 'Specify second extension line origin',
        basePoint: p1,
        jig
    });

    jig.clear();

    if (secondPointResult.status !== PromptStatus.OK || !secondPointResult.value) {
        context.renderer.cancelDrawing();
        if (secondPointResult.status === PromptStatus.Cancel) {
            context.commandLine.print('*Cancel*', 'error');
        }
        return null;
    }

    const p2 = secondPointResult.value;
    context.renderer.addDrawingPoint(p2.x, p2.y);

    return { p1, p2 };
}

// ============================================================================
// DIM Command (Auto-detect horizontal/vertical)
// ============================================================================

export class AcDimCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'DIM';
        this.localName = 'DLI';
        this.description = 'Create linear dimension (auto-detect H/V)';
    }

    async execute(context: EditorContext): Promise<void> {
        const points = await getTwoPoints(context, 'DIM (Linear Dimension)');
        if (!points) return;

        const { p1, p2 } = points;

        // Get dimension line location
        const dimLineResult = await context.editor.getPoint({
            message: 'Specify dimension line location'
        });

        if (dimLineResult.status !== PromptStatus.OK || !dimLineResult.value) {
            context.renderer.cancelDrawing();
            return;
        }

        const dimLocation = dimLineResult.value;
        const geom = this.calculateAutoGeometry(p1, p2, dimLocation);

        const created = createDimensionEntities(context, geom);
        if (created.length > 0) {
            context.renderer.recordAddAction(created);
        }

        context.renderer.cancelDrawing();
        context.commandLine.print(`Dimension created: ${geom.measurement.toFixed(4)}`, 'success');
    }

    private calculateAutoGeometry(p1: Point2D, p2: Point2D, dimLocation: Point2D): DimensionGeometry {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        // Auto-detect based on cursor position relative to midpoint
        const isHorizontal = Math.abs(dimLocation.y - (p1.y + p2.y) / 2) > Math.abs(dimLocation.x - (p1.x + p2.x) / 2);

        if (isHorizontal) {
            return calculateHorizontalGeometry(p1, p2, dimLocation.y);
        } else {
            return calculateVerticalGeometry(p1, p2, dimLocation.x);
        }
    }
}

// ============================================================================
// DIMHOR Command (Horizontal Dimension)
// ============================================================================

function calculateHorizontalGeometry(p1: Point2D, p2: Point2D, dimY: number): DimensionGeometry {
    const measurement = Math.abs(p2.x - p1.x);
    const dimSettings = calculateDimSettings(measurement);
    const { textHeight, textGap, extensionOffset, extensionBeyond, arrowSize } = dimSettings;

    const dimLineStart: Point2D = { x: p1.x, y: dimY };
    const dimLineEnd: Point2D = { x: p2.x, y: dimY };

    const ext1Dir = dimY > p1.y ? 1 : -1;
    const ext1Start: Point2D = { x: p1.x, y: p1.y + extensionOffset * ext1Dir };
    const ext1End: Point2D = { x: p1.x, y: dimY + extensionBeyond * ext1Dir };

    const ext2Dir = dimY > p2.y ? 1 : -1;
    const ext2Start: Point2D = { x: p2.x, y: p2.y + extensionOffset * ext2Dir };
    const ext2End: Point2D = { x: p2.x, y: dimY + extensionBeyond * ext2Dir };

    const textPosition: Point2D = {
        x: (p1.x + p2.x) / 2,
        y: dimY + textGap + textHeight / 2
    };

    return {
        measurement,
        dimLineStart,
        dimLineEnd,
        ext1Start,
        ext1End,
        ext2Start,
        ext2End,
        textPosition,
        textAngle: 0,
        textHeight,
        arrowSize
    };
}

export class AcDimHorCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'DIMHOR';
        this.localName = 'DH';
        this.description = 'Create horizontal dimension';
    }

    async execute(context: EditorContext): Promise<void> {
        const points = await getTwoPoints(context, 'DIMHOR (Horizontal Dimension)');
        if (!points) return;

        const { p1, p2 } = points;

        // Get dimension line Y position
        const dimLineResult = await context.editor.getPoint({
            message: 'Specify dimension line location'
        });

        if (dimLineResult.status !== PromptStatus.OK || !dimLineResult.value) {
            context.renderer.cancelDrawing();
            return;
        }

        const geom = calculateHorizontalGeometry(p1, p2, dimLineResult.value.y);

        const created = createDimensionEntities(context, geom);
        if (created.length > 0) {
            context.renderer.recordAddAction(created);
        }

        context.renderer.cancelDrawing();
        context.commandLine.print(`Horizontal dimension: ${geom.measurement.toFixed(4)}`, 'success');
    }
}

// ============================================================================
// DIMVER Command (Vertical Dimension)
// ============================================================================

function calculateVerticalGeometry(p1: Point2D, p2: Point2D, dimX: number): DimensionGeometry {
    const measurement = Math.abs(p2.y - p1.y);
    const dimSettings = calculateDimSettings(measurement);
    const { textHeight, textGap, extensionOffset, extensionBeyond, arrowSize } = dimSettings;

    const dimLineStart: Point2D = { x: dimX, y: p1.y };
    const dimLineEnd: Point2D = { x: dimX, y: p2.y };

    const ext1Dir = dimX > p1.x ? 1 : -1;
    const ext1Start: Point2D = { x: p1.x + extensionOffset * ext1Dir, y: p1.y };
    const ext1End: Point2D = { x: dimX + extensionBeyond * ext1Dir, y: p1.y };

    const ext2Dir = dimX > p2.x ? 1 : -1;
    const ext2Start: Point2D = { x: p2.x + extensionOffset * ext2Dir, y: p2.y };
    const ext2End: Point2D = { x: dimX + extensionBeyond * ext2Dir, y: p2.y };

    const textPosition: Point2D = {
        x: dimX + textGap + textHeight / 2,
        y: (p1.y + p2.y) / 2
    };

    return {
        measurement,
        dimLineStart,
        dimLineEnd,
        ext1Start,
        ext1End,
        ext2Start,
        ext2End,
        textPosition,
        textAngle: 90,
        textHeight,
        arrowSize
    };
}

export class AcDimVerCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'DIMVER';
        this.localName = 'DV';
        this.description = 'Create vertical dimension';
    }

    async execute(context: EditorContext): Promise<void> {
        const points = await getTwoPoints(context, 'DIMVER (Vertical Dimension)');
        if (!points) return;

        const { p1, p2 } = points;

        // Get dimension line X position
        const dimLineResult = await context.editor.getPoint({
            message: 'Specify dimension line location'
        });

        if (dimLineResult.status !== PromptStatus.OK || !dimLineResult.value) {
            context.renderer.cancelDrawing();
            return;
        }

        const geom = calculateVerticalGeometry(p1, p2, dimLineResult.value.x);

        const created = createDimensionEntities(context, geom);
        if (created.length > 0) {
            context.renderer.recordAddAction(created);
        }

        context.renderer.cancelDrawing();
        context.commandLine.print(`Vertical dimension: ${geom.measurement.toFixed(4)}`, 'success');
    }
}

// ============================================================================
// DIMALIGNED Command (Aligned Dimension - actual distance between points)
// ============================================================================

function calculateAlignedGeometry(p1: Point2D, p2: Point2D, offset: number): DimensionGeometry {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const measurement = Math.sqrt(dx * dx + dy * dy);

    if (measurement < 0.001) {
        // Return minimal geometry for zero-length dimension
        const dimSettings = calculateDimSettings(1);
        return {
            measurement: 0,
            dimLineStart: p1,
            dimLineEnd: p1,
            ext1Start: p1,
            ext1End: p1,
            ext2Start: p1,
            ext2End: p1,
            textPosition: p1,
            textAngle: 0,
            textHeight: dimSettings.textHeight,
            arrowSize: dimSettings.arrowSize
        };
    }

    const dimSettings = calculateDimSettings(measurement);
    const { textHeight, textGap, extensionOffset, extensionBeyond, arrowSize } = dimSettings;

    // Calculate perpendicular direction for offset
    const perpX = -dy / measurement;
    const perpY = dx / measurement;

    // Apply offset in perpendicular direction
    const offsetX = perpX * offset;
    const offsetY = perpY * offset;

    const dimLineStart: Point2D = { x: p1.x + offsetX, y: p1.y + offsetY };
    const dimLineEnd: Point2D = { x: p2.x + offsetX, y: p2.y + offsetY };

    // Extension lines - from points toward dimension line
    const extDir = offset > 0 ? 1 : -1;
    const ext1Start: Point2D = {
        x: p1.x + perpX * extensionOffset * extDir,
        y: p1.y + perpY * extensionOffset * extDir
    };
    const ext1End: Point2D = {
        x: p1.x + offsetX + perpX * extensionBeyond * extDir,
        y: p1.y + offsetY + perpY * extensionBeyond * extDir
    };

    const ext2Start: Point2D = {
        x: p2.x + perpX * extensionOffset * extDir,
        y: p2.y + perpY * extensionOffset * extDir
    };
    const ext2End: Point2D = {
        x: p2.x + offsetX + perpX * extensionBeyond * extDir,
        y: p2.y + offsetY + perpY * extensionBeyond * extDir
    };

    // Text position - centered on dimension line, offset perpendicular
    const midX = (dimLineStart.x + dimLineEnd.x) / 2;
    const midY = (dimLineStart.y + dimLineEnd.y) / 2;
    const textOffset = textGap + textHeight / 2;
    const textPosition: Point2D = {
        x: midX + perpX * textOffset * extDir,
        y: midY + perpY * textOffset * extDir
    };

    // Text angle - aligned with dimension line
    const textAngle = Math.atan2(dy, dx) * 180 / Math.PI;

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
        textHeight,
        arrowSize
    };
}

export class AcDimAlignedCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'DIMALIGNED';
        this.localName = 'DAL';
        this.description = 'Create aligned dimension';
    }

    async execute(context: EditorContext): Promise<void> {
        const points = await getTwoPoints(context, 'DIMALIGNED (Aligned Dimension)');
        if (!points) return;

        const { p1, p2 } = points;

        // Get dimension line offset position
        const dimLineResult = await context.editor.getPoint({
            message: 'Specify dimension line location'
        });

        if (dimLineResult.status !== PromptStatus.OK || !dimLineResult.value) {
            context.renderer.cancelDrawing();
            return;
        }

        // Calculate offset distance from line p1-p2 to clicked point
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 0.001) {
            context.renderer.cancelDrawing();
            context.commandLine.print('Points are too close', 'error');
            return;
        }

        // Calculate perpendicular distance from clicked point to line
        const perpX = -dy / len;
        const perpY = dx / len;
        const clickPoint = dimLineResult.value;
        const offset = (clickPoint.x - p1.x) * perpX + (clickPoint.y - p1.y) * perpY;

        const geom = calculateAlignedGeometry(p1, p2, offset);

        const created = createDimensionEntities(context, geom);
        if (created.length > 0) {
            context.renderer.recordAddAction(created);
        }

        context.renderer.cancelDrawing();
        context.commandLine.print(`Aligned dimension: ${geom.measurement.toFixed(4)}`, 'success');
    }
}

// ============================================================================
// DIMANGULAR Command (Angular Dimension)
// ============================================================================

export class AcDimAngularCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'DIMANGULAR';
        this.localName = 'DAN';
        this.description = 'Create angular dimension';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('DIMANGULAR (Angular Dimension)', 'command');

        // Get vertex point (center of angle)
        const vertexResult = await editor.getPoint({
            message: 'Specify angle vertex'
        });

        if (vertexResult.status !== PromptStatus.OK || !vertexResult.value) {
            if (vertexResult.status === PromptStatus.Cancel) {
                context.commandLine.print('*Cancel*', 'error');
            }
            return;
        }

        const vertex = vertexResult.value;
        context.renderer.addDrawingPoint(vertex.x, vertex.y);

        // Get first angle point
        const jig1 = new LineJig(context.renderer, vertex);
        const firstPointResult = await editor.getPoint({
            message: 'Specify first angle endpoint',
            basePoint: vertex,
            jig: jig1
        });

        jig1.clear();

        if (firstPointResult.status !== PromptStatus.OK || !firstPointResult.value) {
            context.renderer.cancelDrawing();
            if (firstPointResult.status === PromptStatus.Cancel) {
                context.commandLine.print('*Cancel*', 'error');
            }
            return;
        }

        const p1 = firstPointResult.value;
        context.renderer.addDrawingPoint(p1.x, p1.y);

        // Get second angle point
        const jig2 = new LineJig(context.renderer, vertex);
        const secondPointResult = await editor.getPoint({
            message: 'Specify second angle endpoint',
            basePoint: vertex,
            jig: jig2
        });

        jig2.clear();

        if (secondPointResult.status !== PromptStatus.OK || !secondPointResult.value) {
            context.renderer.cancelDrawing();
            if (secondPointResult.status === PromptStatus.Cancel) {
                context.commandLine.print('*Cancel*', 'error');
            }
            return;
        }

        const p2 = secondPointResult.value;
        context.renderer.addDrawingPoint(p2.x, p2.y);

        // Get arc location (determines radius)
        const arcResult = await editor.getPoint({
            message: 'Specify dimension arc line location'
        });

        if (arcResult.status !== PromptStatus.OK || !arcResult.value) {
            context.renderer.cancelDrawing();
            return;
        }

        const arcLocation = arcResult.value;
        const geom = this.calculateAngularGeometry(vertex, p1, p2, arcLocation);

        const created = this.createAngularDimensionEntities(context, geom);
        if (created.length > 0) {
            context.renderer.recordAddAction(created);
        }

        context.renderer.cancelDrawing();
        context.commandLine.print(`Angular dimension: ${geom.angle.toFixed(2)}°`, 'success');
    }

    private calculateAngularGeometry(
        vertex: Point2D,
        p1: Point2D,
        p2: Point2D,
        arcLocation: Point2D
    ): AngularDimensionGeometry {
        // Calculate angles from vertex to each point
        const angle1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
        const angle2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);

        // Calculate arc radius from vertex to clicked location
        const arcRadius = Math.sqrt(
            Math.pow(arcLocation.x - vertex.x, 2) +
            Math.pow(arcLocation.y - vertex.y, 2)
        );

        // Normalize angles to 0-2π
        let startAngle = angle1;
        let endAngle = angle2;

        // Ensure we measure the smaller angle
        let angleDiff = endAngle - startAngle;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

        const angleDegrees = Math.abs(angleDiff) * 180 / Math.PI;

        // Calculate dimension settings based on arc length
        const arcLength = arcRadius * Math.abs(angleDiff);
        const dimSettings = calculateDimSettings(arcLength > 0 ? arcLength : arcRadius);
        const { textHeight, extensionOffset, extensionBeyond, arrowSize } = dimSettings;

        // Extension lines
        const dist1 = Math.sqrt(Math.pow(p1.x - vertex.x, 2) + Math.pow(p1.y - vertex.y, 2));
        const dist2 = Math.sqrt(Math.pow(p2.x - vertex.x, 2) + Math.pow(p2.y - vertex.y, 2));

        const dir1X = (p1.x - vertex.x) / dist1;
        const dir1Y = (p1.y - vertex.y) / dist1;
        const dir2X = (p2.x - vertex.x) / dist2;
        const dir2Y = (p2.y - vertex.y) / dist2;

        const ext1Start: Point2D = {
            x: vertex.x + dir1X * (arcRadius - extensionBeyond),
            y: vertex.y + dir1Y * (arcRadius - extensionBeyond)
        };
        const ext1End: Point2D = {
            x: vertex.x + dir1X * (arcRadius + extensionBeyond),
            y: vertex.y + dir1Y * (arcRadius + extensionBeyond)
        };

        const ext2Start: Point2D = {
            x: vertex.x + dir2X * (arcRadius - extensionBeyond),
            y: vertex.y + dir2Y * (arcRadius - extensionBeyond)
        };
        const ext2End: Point2D = {
            x: vertex.x + dir2X * (arcRadius + extensionBeyond),
            y: vertex.y + dir2Y * (arcRadius + extensionBeyond)
        };

        // Text position - at middle of arc
        const midAngle = startAngle + angleDiff / 2;
        const textRadius = arcRadius + textHeight;
        const textPosition: Point2D = {
            x: vertex.x + Math.cos(midAngle) * textRadius,
            y: vertex.y + Math.sin(midAngle) * textRadius
        };

        return {
            angle: angleDegrees,
            arcCenter: vertex,
            arcRadius,
            arcStartAngle: startAngle * 180 / Math.PI,
            arcEndAngle: (startAngle + angleDiff) * 180 / Math.PI,
            textPosition,
            textHeight,
            arrowSize,
            ext1Start,
            ext1End,
            ext2Start,
            ext2End
        };
    }

    private createAngularDimensionEntities(context: EditorContext, geom: AngularDimensionGeometry): DxfEntity[] {
        const created: DxfEntity[] = [];

        // Extension lines
        const ext1 = context.renderer.createLineFromPoints(geom.ext1Start, geom.ext1End);
        if (ext1) created.push(ext1);

        const ext2 = context.renderer.createLineFromPoints(geom.ext2Start, geom.ext2End);
        if (ext2) created.push(ext2);

        // Create arc for dimension line
        const arc = context.renderer.createArcFromCenterRadiusAngles(
            geom.arcCenter,
            geom.arcRadius,
            geom.arcStartAngle,
            geom.arcEndAngle
        );
        if (arc) created.push(arc);

        // Create arrow heads at arc endpoints
        const startRad = geom.arcStartAngle * Math.PI / 180;
        const endRad = geom.arcEndAngle * Math.PI / 180;

        const arcStart: Point2D = {
            x: geom.arcCenter.x + Math.cos(startRad) * geom.arcRadius,
            y: geom.arcCenter.y + Math.sin(startRad) * geom.arcRadius
        };
        const arcEnd: Point2D = {
            x: geom.arcCenter.x + Math.cos(endRad) * geom.arcRadius,
            y: geom.arcCenter.y + Math.sin(endRad) * geom.arcRadius
        };

        // Arrow directions are tangent to arc
        const startTangent: Point2D = {
            x: arcStart.x - Math.sin(startRad) * geom.arrowSize,
            y: arcStart.y + Math.cos(startRad) * geom.arrowSize
        };
        const endTangent: Point2D = {
            x: arcEnd.x + Math.sin(endRad) * geom.arrowSize,
            y: arcEnd.y - Math.cos(endRad) * geom.arrowSize
        };

        created.push(...createArrowHead(context, arcStart, startTangent, geom.arrowSize));
        created.push(...createArrowHead(context, arcEnd, endTangent, geom.arrowSize));

        // Dimension text
        const textContent = `${geom.angle.toFixed(1)}°`;
        const text = context.renderer.createTextEntity(
            geom.textPosition,
            textContent,
            geom.textHeight,
            0
        );
        if (text) created.push(text);

        return created;
    }
}
