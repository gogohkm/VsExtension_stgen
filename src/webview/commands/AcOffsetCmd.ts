/**
 * OFFSET Command - Creates parallel copies of objects at a specified distance
 *
 * Usage:
 *   OFFSET
 *   Specify offset distance or [Through/Erase/Layer]: (enter distance)
 *   Select object to offset: (click on object)
 *   Specify point on side to offset: (click to indicate side)
 */

import { AcEdCommand, EditorContext } from '../editor/command/AcEdCommand';
import { AcEdKeyword } from '../editor/input/prompt/AcEdPromptOptions';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { DxfEntity, DxfLine, DxfCircle, DxfArc, DxfPolyline } from '../dxfParser';
import * as THREE from 'three';

interface Point2D {
    x: number;
    y: number;
}

export class AcOffsetCmd extends AcEdCommand {
    private offsetDistance: number = 10;
    private throughMode: boolean = false;

    constructor() {
        super();
        this.globalName = 'OFFSET';
        this.localName = 'O';
        this.description = 'Create parallel copies at a distance';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;
        context.commandLine.print('OFFSET', 'command');

        // Step 1: Get offset distance or through point mode
        const keywords: AcEdKeyword[] = [
            { displayName: 'Through', globalName: 'THROUGH', localName: 'T' },
            { displayName: 'Erase', globalName: 'ERASE', localName: 'E' }
        ];

        const distResult = await editor.getDistance({
            message: `Specify offset distance <${this.offsetDistance.toFixed(4)}>`,
            keywords,
            allowNone: true
        });

        if (distResult.status === PromptStatus.Cancel) {
            context.commandLine.print('*Cancel*', 'error');
            return;
        }

        if (distResult.status === PromptStatus.Keyword) {
            if (distResult.keyword === 'THROUGH') {
                this.throughMode = true;
                context.commandLine.print('Through mode enabled', 'response');
            }
        } else if (distResult.status === PromptStatus.OK && distResult.value !== undefined) {
            this.offsetDistance = distResult.value;
            this.throughMode = false;
        }
        // If None, use previous distance

        // Step 2: Select object and side loop
        let continueOffsetting = true;
        let offsetCount = 0;

        while (continueOffsetting) {
            this.checkCancelled();

            // Select object to offset
            const selectResult = await editor.getEntity({
                message: 'Select object to offset (Enter to exit)',
                allowNone: true
            });

            if (selectResult.status === PromptStatus.None || selectResult.status === PromptStatus.Cancel) {
                continueOffsetting = false;
                continue;
            }

            if (selectResult.status !== PromptStatus.OK || !selectResult.value) {
                continue;
            }

            const { entity: threeObject } = selectResult.value;
            const entity = threeObject.userData.entity as DxfEntity;

            if (!entity) {
                context.commandLine.print('Cannot offset this object', 'error');
                continue;
            }

            // Check if entity is on a locked layer
            const layerName = threeObject.userData.layer || '0';
            if (context.renderer.isLayerLocked(layerName)) {
                context.commandLine.print(`Object is on locked layer "${layerName}"`, 'error');
                continue;
            }

            // Check if entity type is supported
            if (!['LINE', 'CIRCLE', 'ARC', 'POLYLINE', 'LWPOLYLINE'].includes(entity.type)) {
                context.commandLine.print(`Cannot offset ${entity.type}`, 'error');
                continue;
            }

            // Highlight selected object
            context.renderer.highlightEntities([threeObject]);

            // Get side point or through point
            let actualDistance = this.offsetDistance;
            let sidePoint: Point2D;

            if (this.throughMode) {
                const throughResult = await editor.getPoint({
                    message: 'Specify through point'
                });

                if (throughResult.status !== PromptStatus.OK || !throughResult.value) {
                    context.renderer.clearHighlight();
                    continue;
                }

                sidePoint = throughResult.value;
                // Calculate distance from entity to through point
                actualDistance = this.calculateDistanceToEntity(entity, sidePoint);
            } else {
                const sideResult = await editor.getPoint({
                    message: 'Specify point on side to offset'
                });

                if (sideResult.status !== PromptStatus.OK || !sideResult.value) {
                    context.renderer.clearHighlight();
                    continue;
                }

                sidePoint = sideResult.value;
            }

            // Clear highlight before creating offset
            context.renderer.clearHighlight();

            // Perform offset
            const success = this.performOffset(entity, actualDistance, sidePoint, context);

            if (success) {
                offsetCount++;
                context.commandLine.print('Offset created', 'success');
            } else {
                context.commandLine.print('Cannot create offset', 'error');
            }
        }

        // Ensure highlight is cleared when done
        context.renderer.clearHighlight();

        if (offsetCount > 0) {
            context.commandLine.print(`${offsetCount} offset(s) created`, 'success');
        }
    }

    private calculateDistanceToEntity(entity: DxfEntity, point: Point2D): number {
        if (entity.type === 'LINE') {
            const line = entity as DxfLine;
            return this.pointToLineDistance(point, line.start, line.end);
        } else if (entity.type === 'CIRCLE') {
            const circle = entity as DxfCircle;
            const dist = Math.sqrt(
                Math.pow(point.x - circle.center.x, 2) +
                Math.pow(point.y - circle.center.y, 2)
            );
            return Math.abs(dist - circle.radius);
        } else if (entity.type === 'ARC') {
            const arc = entity as DxfArc;
            const dist = Math.sqrt(
                Math.pow(point.x - arc.center.x, 2) +
                Math.pow(point.y - arc.center.y, 2)
            );
            return Math.abs(dist - arc.radius);
        }
        return this.offsetDistance;
    }

    private pointToLineDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 1e-10) {
            return Math.sqrt(
                Math.pow(point.x - lineStart.x, 2) +
                Math.pow(point.y - lineStart.y, 2)
            );
        }

        const t = Math.max(0, Math.min(1,
            ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (len * len)
        ));

        const projX = lineStart.x + t * dx;
        const projY = lineStart.y + t * dy;

        return Math.sqrt(
            Math.pow(point.x - projX, 2) +
            Math.pow(point.y - projY, 2)
        );
    }

    private performOffset(
        entity: DxfEntity,
        distance: number,
        sidePoint: Point2D,
        context: EditorContext
    ): boolean {
        switch (entity.type) {
            case 'LINE':
                return this.offsetLine(entity as DxfLine, distance, sidePoint, context);
            case 'CIRCLE':
                return this.offsetCircle(entity as DxfCircle, distance, sidePoint, context);
            case 'ARC':
                return this.offsetArc(entity as DxfArc, distance, sidePoint, context);
            case 'POLYLINE':
            case 'LWPOLYLINE':
                return this.offsetPolyline(entity as DxfPolyline, distance, sidePoint, context);
            default:
                return false;
        }
    }

    private offsetLine(line: DxfLine, distance: number, sidePoint: Point2D, context: EditorContext): boolean {
        const dx = line.end.x - line.start.x;
        const dy = line.end.y - line.start.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 1e-10) return false;

        // Normal vector (perpendicular to line)
        const nx = -dy / len;
        const ny = dx / len;

        // Determine side based on sidePoint
        const midX = (line.start.x + line.end.x) / 2;
        const midY = (line.start.y + line.end.y) / 2;

        const toSideX = sidePoint.x - midX;
        const toSideY = sidePoint.y - midY;

        const side = (toSideX * nx + toSideY * ny) > 0 ? 1 : -1;

        // Create offset line
        const newStart: Point2D = {
            x: line.start.x + side * distance * nx,
            y: line.start.y + side * distance * ny
        };
        const newEnd: Point2D = {
            x: line.end.x + side * distance * nx,
            y: line.end.y + side * distance * ny
        };

        context.renderer.createLineFromPoints(newStart, newEnd);
        return true;
    }

    private offsetCircle(circle: DxfCircle, distance: number, sidePoint: Point2D, context: EditorContext): boolean {
        // Determine if offset is inside or outside
        const distToCenter = Math.sqrt(
            Math.pow(sidePoint.x - circle.center.x, 2) +
            Math.pow(sidePoint.y - circle.center.y, 2)
        );

        const isOutside = distToCenter > circle.radius;
        const newRadius = isOutside ? circle.radius + distance : circle.radius - distance;

        if (newRadius <= 0) {
            return false; // Cannot create circle with zero or negative radius
        }

        context.renderer.createCircleFromCenterRadius(circle.center, newRadius);
        return true;
    }

    private offsetArc(arc: DxfArc, distance: number, sidePoint: Point2D, context: EditorContext): boolean {
        // Determine if offset is inside or outside
        const distToCenter = Math.sqrt(
            Math.pow(sidePoint.x - arc.center.x, 2) +
            Math.pow(sidePoint.y - arc.center.y, 2)
        );

        const isOutside = distToCenter > arc.radius;
        const newRadius = isOutside ? arc.radius + distance : arc.radius - distance;

        if (newRadius <= 0) {
            return false;
        }

        context.renderer.createArcFromCenterRadiusAngles(
            arc.center, newRadius, arc.startAngle, arc.endAngle
        );
        return true;
    }

    private offsetPolyline(polyline: DxfPolyline, distance: number, sidePoint: Point2D, context: EditorContext): boolean {
        if (polyline.vertices.length < 2) return false;

        // For now, offset each segment individually
        // A full implementation would handle corner treatments
        const vertices = polyline.vertices;
        const newVertices: Point2D[] = [];

        // Calculate offset direction based on side point
        // Use centroid to determine overall side
        let centroidX = 0, centroidY = 0;
        for (const v of vertices) {
            centroidX += v.x;
            centroidY += v.y;
        }
        centroidX /= vertices.length;
        centroidY /= vertices.length;

        // Determine overall offset direction
        const toSideX = sidePoint.x - centroidX;
        const toSideY = sidePoint.y - centroidY;

        for (let i = 0; i < vertices.length; i++) {
            const curr = vertices[i];
            const prev = vertices[(i - 1 + vertices.length) % vertices.length];
            const next = vertices[(i + 1) % vertices.length];

            // Calculate offset for this vertex
            let offsetX = 0, offsetY = 0;

            if (i === 0 && !polyline.closed) {
                // First vertex (open polyline)
                const dx = next.x - curr.x;
                const dy = next.y - curr.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 1e-10) {
                    offsetX = -dy / len;
                    offsetY = dx / len;
                }
            } else if (i === vertices.length - 1 && !polyline.closed) {
                // Last vertex (open polyline)
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 1e-10) {
                    offsetX = -dy / len;
                    offsetY = dx / len;
                }
            } else {
                // Middle vertex or closed polyline
                const dx1 = curr.x - prev.x;
                const dy1 = curr.y - prev.y;
                const dx2 = next.x - curr.x;
                const dy2 = next.y - curr.y;

                const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                if (len1 > 1e-10 && len2 > 1e-10) {
                    const n1x = -dy1 / len1;
                    const n1y = dx1 / len1;
                    const n2x = -dy2 / len2;
                    const n2y = dx2 / len2;

                    offsetX = (n1x + n2x) / 2;
                    offsetY = (n1y + n2y) / 2;

                    const offsetLen = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
                    if (offsetLen > 1e-10) {
                        offsetX /= offsetLen;
                        offsetY /= offsetLen;
                    }
                }
            }

            // Determine side
            const dot = toSideX * offsetX + toSideY * offsetY;
            const side = dot > 0 ? 1 : -1;

            newVertices.push({
                x: curr.x + side * distance * offsetX,
                y: curr.y + side * distance * offsetY
            });
        }

        // Create offset lines for each segment
        for (let i = 0; i < newVertices.length - 1; i++) {
            context.renderer.createLineFromPoints(newVertices[i], newVertices[i + 1]);
        }

        if (polyline.closed && newVertices.length > 0) {
            context.renderer.createLineFromPoints(
                newVertices[newVertices.length - 1],
                newVertices[0]
            );
        }

        return true;
    }
}
