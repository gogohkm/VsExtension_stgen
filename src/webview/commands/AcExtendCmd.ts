/**
 * EXTEND Command - Extends objects to meet edges of other objects
 *
 * Usage:
 *   EXTEND
 *   Select boundary edges: (select objects, Enter when done)
 *   Select object to extend or shift-select to trim: (click near the end to extend)
 */

import { AcEdCommand, EditorContext } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { DxfEntity, DxfLine, DxfCircle, DxfArc } from '../dxfParser';
import * as THREE from 'three';

interface Point2D {
    x: number;
    y: number;
}

interface ExtendIntersection {
    point: Point2D;
    t: number; // Parameter along the extended line (can be < 0 or > 1)
    boundaryEdge: DxfEntity;
}

export class AcExtendCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'EXTEND';
        this.localName = 'EX';
        this.description = 'Extend objects to boundary edges';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;
        context.commandLine.print('EXTEND', 'command');

        // Step 1: Select boundary edges (or press Enter for all objects as boundaries)
        context.commandLine.print('Select boundary edges (or Enter to select all):', 'response');

        const boundaryResult = await editor.getSelection({
            message: 'Select boundary edges',
            allowNone: true
        });

        let boundaryEdges: THREE.Object3D[] = [];

        if (boundaryResult.status === PromptStatus.None) {
            // Use all visible entities as boundary edges
            boundaryEdges = context.renderer.getAllVisibleEntities();
            context.commandLine.print('All objects selected as boundary edges', 'response');
        } else if (boundaryResult.status === PromptStatus.OK) {
            boundaryEdges = context.renderer.getSelectedEntities();
            context.commandLine.print(`${boundaryEdges.length} boundary edge(s) selected`, 'response');
        } else if (boundaryResult.status === PromptStatus.Cancel) {
            context.commandLine.print('*Cancel*', 'error');
            return;
        }

        context.renderer.clearSelection();

        // Step 2: Select objects to extend
        let continueSelecting = true;
        let extendCount = 0;

        while (continueSelecting) {
            this.checkCancelled();

            const extendResult = await editor.getEntity({
                message: 'Select object to extend (Enter to exit)',
                allowNone: true
            });

            if (extendResult.status === PromptStatus.None || extendResult.status === PromptStatus.Cancel) {
                continueSelecting = false;
                continue;
            }

            if (extendResult.status === PromptStatus.OK && extendResult.value) {
                const { entity: threeObject, pickPoint } = extendResult.value;
                const entity = threeObject.userData.entity as DxfEntity;

                if (!entity) {
                    context.commandLine.print('Cannot extend this object', 'error');
                    continue;
                }

                // Only lines and arcs can be extended
                if (entity.type !== 'LINE' && entity.type !== 'ARC') {
                    context.commandLine.print(`Cannot extend ${entity.type}`, 'error');
                    continue;
                }

                // Find potential extension intersections with boundary edges
                const intersections = this.findExtensionIntersections(entity, boundaryEdges, pickPoint, context);

                if (intersections.length === 0) {
                    context.commandLine.print('No boundary to extend to', 'response');
                    continue;
                }

                // Perform extend
                const extended = this.performExtend(entity, threeObject, intersections, pickPoint, context);

                if (extended) {
                    extendCount++;
                    context.commandLine.print('Object extended', 'success');
                } else {
                    context.commandLine.print('Cannot extend at this location', 'response');
                }
            }
        }

        if (extendCount > 0) {
            context.commandLine.print(`${extendCount} object(s) extended`, 'success');
        }
    }

    private findExtensionIntersections(
        entity: DxfEntity,
        boundaryEdges: THREE.Object3D[],
        pickPoint: Point2D,
        context: EditorContext
    ): ExtendIntersection[] {
        const intersections: ExtendIntersection[] = [];

        for (const edge of boundaryEdges) {
            const edgeEntity = edge.userData.entity as DxfEntity;
            if (!edgeEntity || edgeEntity === entity) continue;

            const points = this.getExtendedIntersections(entity, edgeEntity, pickPoint);
            for (const { point, t } of points) {
                intersections.push({ point, t, boundaryEdge: edgeEntity });
            }
        }

        // Sort by absolute distance from entity endpoints
        return intersections;
    }

    private getExtendedIntersections(
        entity: DxfEntity,
        boundary: DxfEntity,
        pickPoint: Point2D
    ): { point: Point2D; t: number }[] {
        const results: { point: Point2D; t: number }[] = [];

        if (entity.type === 'LINE') {
            const line = entity as DxfLine;

            if (boundary.type === 'LINE') {
                const boundaryLine = boundary as DxfLine;
                const intersection = this.lineLineIntersectionExtended(
                    line.start, line.end,
                    boundaryLine.start, boundaryLine.end
                );
                if (intersection && this.isOnLineSegment(intersection.point, boundaryLine.start, boundaryLine.end)) {
                    results.push(intersection);
                }
            } else if (boundary.type === 'CIRCLE') {
                const circle = boundary as DxfCircle;
                const intersections = this.lineCircleIntersectionExtended(
                    line.start, line.end, circle.center, circle.radius
                );
                results.push(...intersections);
            } else if (boundary.type === 'ARC') {
                const arc = boundary as DxfArc;
                const intersections = this.lineCircleIntersectionExtended(
                    line.start, line.end, arc.center, arc.radius
                );
                // Filter to points on the arc
                for (const inter of intersections) {
                    if (this.isPointOnArc(inter.point, arc)) {
                        results.push(inter);
                    }
                }
            }
        } else if (entity.type === 'ARC') {
            const arc = entity as DxfArc;
            // Extend arc by extending its angular range
            // For simplicity, treat arc extension as line extension from endpoints
            const startPoint = this.getArcEndpoint(arc, true);
            const endPoint = this.getArcEndpoint(arc, false);

            if (boundary.type === 'LINE') {
                const boundaryLine = boundary as DxfLine;
                // Check extension from both ends
                const tangentStart = this.getArcTangent(arc, true);
                const tangentEnd = this.getArcTangent(arc, false);

                const interStart = this.lineLineIntersectionExtended(
                    startPoint,
                    { x: startPoint.x - tangentStart.x * 1000, y: startPoint.y - tangentStart.y * 1000 },
                    boundaryLine.start, boundaryLine.end
                );
                if (interStart && this.isOnLineSegment(interStart.point, boundaryLine.start, boundaryLine.end)) {
                    // Convert to arc parameter
                    const angle = Math.atan2(interStart.point.y - arc.center.y, interStart.point.x - arc.center.x) * 180 / Math.PI;
                    results.push({ point: interStart.point, t: -0.1 }); // Negative t means extend from start
                }

                const interEnd = this.lineLineIntersectionExtended(
                    endPoint,
                    { x: endPoint.x + tangentEnd.x * 1000, y: endPoint.y + tangentEnd.y * 1000 },
                    boundaryLine.start, boundaryLine.end
                );
                if (interEnd && this.isOnLineSegment(interEnd.point, boundaryLine.start, boundaryLine.end)) {
                    results.push({ point: interEnd.point, t: 1.1 }); // > 1 means extend from end
                }
            }
        }

        return results;
    }

    private lineLineIntersectionExtended(
        p1: Point2D, p2: Point2D,
        p3: Point2D, p4: Point2D
    ): { point: Point2D; t: number } | null {
        const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return null;

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

        return {
            point: {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            },
            t
        };
    }

    private lineCircleIntersectionExtended(
        p1: Point2D, p2: Point2D,
        center: Point2D, radius: number
    ): { point: Point2D; t: number }[] {
        const results: { point: Point2D; t: number }[] = [];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const fx = p1.x - center.x;
        const fy = p1.y - center.y;

        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - radius * radius;

        const discriminant = b * b - 4 * a * c;

        if (discriminant >= 0) {
            const sqrtDisc = Math.sqrt(discriminant);
            const t1 = (-b - sqrtDisc) / (2 * a);
            const t2 = (-b + sqrtDisc) / (2 * a);

            results.push({
                point: { x: p1.x + t1 * dx, y: p1.y + t1 * dy },
                t: t1
            });
            if (Math.abs(t2 - t1) > 1e-10) {
                results.push({
                    point: { x: p1.x + t2 * dx, y: p1.y + t2 * dy },
                    t: t2
                });
            }
        }

        return results;
    }

    private isOnLineSegment(point: Point2D, start: Point2D, end: Point2D): boolean {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-10) return false;

        const t = Math.abs(dx) > Math.abs(dy)
            ? (point.x - start.x) / dx
            : (point.y - start.y) / dy;

        return t >= -0.001 && t <= 1.001;
    }

    private isPointOnArc(point: Point2D, arc: DxfArc): boolean {
        const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x) * 180 / Math.PI;
        let normalizedAngle = angle < 0 ? angle + 360 : angle;
        let startAngle = arc.startAngle < 0 ? arc.startAngle + 360 : arc.startAngle;
        let endAngle = arc.endAngle < 0 ? arc.endAngle + 360 : arc.endAngle;

        if (startAngle <= endAngle) {
            return normalizedAngle >= startAngle - 0.1 && normalizedAngle <= endAngle + 0.1;
        } else {
            return normalizedAngle >= startAngle - 0.1 || normalizedAngle <= endAngle + 0.1;
        }
    }

    private getArcEndpoint(arc: DxfArc, isStart: boolean): Point2D {
        const angle = (isStart ? arc.startAngle : arc.endAngle) * Math.PI / 180;
        return {
            x: arc.center.x + arc.radius * Math.cos(angle),
            y: arc.center.y + arc.radius * Math.sin(angle)
        };
    }

    private getArcTangent(arc: DxfArc, isStart: boolean): Point2D {
        const angle = (isStart ? arc.startAngle : arc.endAngle) * Math.PI / 180;
        // Tangent is perpendicular to radius, direction depends on arc direction
        return {
            x: -Math.sin(angle),
            y: Math.cos(angle)
        };
    }

    private performExtend(
        entity: DxfEntity,
        threeObject: THREE.Object3D,
        intersections: ExtendIntersection[],
        pickPoint: Point2D,
        context: EditorContext
    ): boolean {
        if (entity.type === 'LINE') {
            return this.extendLine(entity as DxfLine, threeObject, intersections, pickPoint, context);
        } else if (entity.type === 'ARC') {
            return this.extendArc(entity as DxfArc, threeObject, intersections, pickPoint, context);
        }
        return false;
    }

    private extendLine(
        line: DxfLine,
        threeObject: THREE.Object3D,
        intersections: ExtendIntersection[],
        pickPoint: Point2D,
        context: EditorContext
    ): boolean {
        // Determine which end is closer to pick point
        const distToStart = Math.sqrt(
            Math.pow(pickPoint.x - line.start.x, 2) +
            Math.pow(pickPoint.y - line.start.y, 2)
        );
        const distToEnd = Math.sqrt(
            Math.pow(pickPoint.x - line.end.x, 2) +
            Math.pow(pickPoint.y - line.end.y, 2)
        );

        const extendFromStart = distToStart < distToEnd;

        // Find closest valid intersection
        let bestIntersection: ExtendIntersection | null = null;
        let bestDistance = Infinity;

        for (const inter of intersections) {
            if (extendFromStart) {
                // Look for t < 0 (extends before start)
                if (inter.t < 0) {
                    const dist = Math.abs(inter.t);
                    if (dist < bestDistance) {
                        bestDistance = dist;
                        bestIntersection = inter;
                    }
                }
            } else {
                // Look for t > 1 (extends after end)
                if (inter.t > 1) {
                    const dist = inter.t - 1;
                    if (dist < bestDistance) {
                        bestDistance = dist;
                        bestIntersection = inter;
                    }
                }
            }
        }

        if (!bestIntersection) return false;

        // Delete original and create extended line
        context.renderer.deleteEntity(threeObject);

        if (extendFromStart) {
            context.renderer.createLineFromPoints(bestIntersection.point, line.end);
        } else {
            context.renderer.createLineFromPoints(line.start, bestIntersection.point);
        }

        return true;
    }

    private extendArc(
        arc: DxfArc,
        threeObject: THREE.Object3D,
        intersections: ExtendIntersection[],
        pickPoint: Point2D,
        context: EditorContext
    ): boolean {
        // Determine which end is closer to pick point
        const startPoint = this.getArcEndpoint(arc, true);
        const endPoint = this.getArcEndpoint(arc, false);

        const distToStart = Math.sqrt(
            Math.pow(pickPoint.x - startPoint.x, 2) +
            Math.pow(pickPoint.y - startPoint.y, 2)
        );
        const distToEnd = Math.sqrt(
            Math.pow(pickPoint.x - endPoint.x, 2) +
            Math.pow(pickPoint.y - endPoint.y, 2)
        );

        const extendFromStart = distToStart < distToEnd;

        // Find best intersection
        let bestIntersection: ExtendIntersection | null = null;

        for (const inter of intersections) {
            if (extendFromStart && inter.t < 0) {
                bestIntersection = inter;
                break;
            } else if (!extendFromStart && inter.t > 1) {
                bestIntersection = inter;
                break;
            }
        }

        if (!bestIntersection) return false;

        // Calculate new angle
        const newAngle = Math.atan2(
            bestIntersection.point.y - arc.center.y,
            bestIntersection.point.x - arc.center.x
        ) * 180 / Math.PI;

        // Delete original and create extended arc
        context.renderer.deleteEntity(threeObject);

        if (extendFromStart) {
            context.renderer.createArcFromCenterRadiusAngles(
                arc.center, arc.radius, newAngle, arc.endAngle
            );
        } else {
            context.renderer.createArcFromCenterRadiusAngles(
                arc.center, arc.radius, arc.startAngle, newAngle
            );
        }

        return true;
    }
}
