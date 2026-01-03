/**
 * TRIM Command - Trims objects to meet edges of other objects
 *
 * Usage:
 *   TRIM
 *   Select cutting edges: (select objects, Enter when done)
 *   Select object to trim or shift-select to extend: (click near the part to remove)
 */

import { AcEdCommand, EditorContext } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { DxfEntity, DxfLine, DxfCircle, DxfArc } from '../dxfParser';
import * as THREE from 'three';

interface Point2D {
    x: number;
    y: number;
}

interface TrimIntersection {
    point: Point2D;
    t: number; // Parameter along the object being trimmed (0-1)
    cuttingEdge: DxfEntity;
}

export class AcTrimCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'TRIM';
        this.localName = 'TR';
        this.description = 'Trim objects to cutting edges';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;
        context.commandLine.print('TRIM', 'command');

        // Step 1: Select cutting edges (or press Enter for all objects as cutting edges)
        context.commandLine.print('Select cutting edges (or Enter to select all):', 'response');

        const cuttingResult = await editor.getSelection({
            message: 'Select cutting edges',
            allowNone: true
        });

        let cuttingEdges: THREE.Object3D[] = [];

        if (cuttingResult.status === PromptStatus.None) {
            // Use all visible entities as cutting edges
            cuttingEdges = context.renderer.getAllVisibleEntities();
            context.commandLine.print('All objects selected as cutting edges', 'response');
        } else if (cuttingResult.status === PromptStatus.OK) {
            cuttingEdges = context.renderer.getSelectedEntities();
            context.commandLine.print(`${cuttingEdges.length} cutting edge(s) selected`, 'response');
        } else if (cuttingResult.status === PromptStatus.Cancel) {
            context.commandLine.print('*Cancel*', 'error');
            return;
        }

        context.renderer.clearSelection();

        // Highlight cutting edges
        context.renderer.highlightEntities(cuttingEdges);

        // Step 2: Select objects to trim
        let continueSelecting = true;
        let trimCount = 0;

        while (continueSelecting) {
            this.checkCancelled();

            const trimResult = await editor.getEntity({
                message: 'Select object to trim (Enter to exit)',
                allowNone: true
            });

            if (trimResult.status === PromptStatus.None || trimResult.status === PromptStatus.Cancel) {
                continueSelecting = false;
                continue;
            }

            if (trimResult.status === PromptStatus.OK && trimResult.value) {
                const { entity: threeObject, pickPoint } = trimResult.value;
                const entity = threeObject.userData.entity as DxfEntity;

                if (!entity) {
                    context.commandLine.print('Cannot trim this object', 'error');
                    continue;
                }

                // Check if entity is on a locked layer
                const layerName = threeObject.userData.layer || '0';
                if (context.renderer.isLayerLocked(layerName)) {
                    context.commandLine.print(`Object is on locked layer "${layerName}"`, 'error');
                    continue;
                }

                // Find intersections with cutting edges
                const intersections = this.findIntersections(entity, cuttingEdges, context);

                if (intersections.length === 0) {
                    context.commandLine.print('No intersection with cutting edges', 'response');
                    continue;
                }

                // Perform trim based on pick point
                const trimmed = this.performTrim(entity, threeObject, intersections, pickPoint, context);

                if (trimmed) {
                    trimCount++;
                    context.commandLine.print('Object trimmed', 'success');
                } else {
                    context.commandLine.print('Cannot trim at this location', 'response');
                }
            }
        }

        // Clear highlight from cutting edges
        context.renderer.clearHighlight();

        if (trimCount > 0) {
            context.commandLine.print(`${trimCount} object(s) trimmed`, 'success');
        }
    }

    private findIntersections(
        entity: DxfEntity,
        cuttingEdges: THREE.Object3D[],
        context: EditorContext
    ): TrimIntersection[] {
        const intersections: TrimIntersection[] = [];

        for (const edge of cuttingEdges) {
            const edgeEntity = edge.userData.entity as DxfEntity;
            if (!edgeEntity || edgeEntity === entity) continue;

            const points = this.getEntityIntersections(entity, edgeEntity);
            for (const point of points) {
                const t = this.getParameterOnEntity(entity, point);
                if (t !== null && t > 0.0001 && t < 0.9999) {
                    intersections.push({ point, t, cuttingEdge: edgeEntity });
                }
            }
        }

        // Sort by parameter
        intersections.sort((a, b) => a.t - b.t);
        return intersections;
    }

    private getEntityIntersections(entity1: DxfEntity, entity2: DxfEntity): Point2D[] {
        const points: Point2D[] = [];

        if (entity1.type === 'LINE' && entity2.type === 'LINE') {
            const line1 = entity1 as DxfLine;
            const line2 = entity2 as DxfLine;
            const pt = this.lineLineIntersection(
                line1.start, line1.end,
                line2.start, line2.end
            );
            if (pt) points.push(pt);
        } else if (entity1.type === 'LINE' && entity2.type === 'CIRCLE') {
            const line = entity1 as DxfLine;
            const circle = entity2 as DxfCircle;
            points.push(...this.lineCircleIntersection(line.start, line.end, circle.center, circle.radius));
        } else if (entity1.type === 'CIRCLE' && entity2.type === 'LINE') {
            const circle = entity1 as DxfCircle;
            const line = entity2 as DxfLine;
            points.push(...this.lineCircleIntersection(line.start, line.end, circle.center, circle.radius));
        } else if (entity1.type === 'LINE' && entity2.type === 'ARC') {
            const line = entity1 as DxfLine;
            const arc = entity2 as DxfArc;
            const circlePts = this.lineCircleIntersection(line.start, line.end, arc.center, arc.radius);
            // Filter points that are actually on the arc
            for (const pt of circlePts) {
                if (this.isPointOnArc(pt, arc)) {
                    points.push(pt);
                }
            }
        } else if (entity1.type === 'ARC' && entity2.type === 'LINE') {
            const arc = entity1 as DxfArc;
            const line = entity2 as DxfLine;
            const circlePts = this.lineCircleIntersection(line.start, line.end, arc.center, arc.radius);
            for (const pt of circlePts) {
                if (this.isPointOnArc(pt, arc)) {
                    points.push(pt);
                }
            }
        }

        return points;
    }

    private lineLineIntersection(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): Point2D | null {
        const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return null;

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        // Check if intersection is within both line segments
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }
        return null;
    }

    private lineCircleIntersection(p1: Point2D, p2: Point2D, center: Point2D, radius: number): Point2D[] {
        const points: Point2D[] = [];

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

            if (t1 >= 0 && t1 <= 1) {
                points.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
            }
            if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-10) {
                points.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
            }
        }

        return points;
    }

    private isPointOnArc(point: Point2D, arc: DxfArc): boolean {
        const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x) * 180 / Math.PI;
        let normalizedAngle = angle < 0 ? angle + 360 : angle;
        let startAngle = arc.startAngle < 0 ? arc.startAngle + 360 : arc.startAngle;
        let endAngle = arc.endAngle < 0 ? arc.endAngle + 360 : arc.endAngle;

        if (startAngle <= endAngle) {
            return normalizedAngle >= startAngle && normalizedAngle <= endAngle;
        } else {
            return normalizedAngle >= startAngle || normalizedAngle <= endAngle;
        }
    }

    private getParameterOnEntity(entity: DxfEntity, point: Point2D): number | null {
        if (entity.type === 'LINE') {
            const line = entity as DxfLine;
            const dx = line.end.x - line.start.x;
            const dy = line.end.y - line.start.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1e-10) return null;

            const t = Math.abs(dx) > Math.abs(dy)
                ? (point.x - line.start.x) / dx
                : (point.y - line.start.y) / dy;
            return t;
        } else if (entity.type === 'ARC') {
            const arc = entity as DxfArc;
            const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x) * 180 / Math.PI;
            let normalizedAngle = angle < 0 ? angle + 360 : angle;
            let startAngle = arc.startAngle < 0 ? arc.startAngle + 360 : arc.startAngle;
            let endAngle = arc.endAngle < 0 ? arc.endAngle + 360 : arc.endAngle;

            if (startAngle > endAngle) endAngle += 360;
            if (normalizedAngle < startAngle) normalizedAngle += 360;

            return (normalizedAngle - startAngle) / (endAngle - startAngle);
        }
        return null;
    }

    private performTrim(
        entity: DxfEntity,
        threeObject: THREE.Object3D,
        intersections: TrimIntersection[],
        pickPoint: Point2D,
        context: EditorContext
    ): boolean {
        const pickT = this.getParameterOnEntity(entity, pickPoint);
        if (pickT === null) return false;

        if (entity.type === 'LINE') {
            return this.trimLine(entity as DxfLine, threeObject, intersections, pickT, context);
        } else if (entity.type === 'ARC') {
            return this.trimArc(entity as DxfArc, threeObject, intersections, pickT, context);
        }

        return false;
    }

    private trimLine(
        line: DxfLine,
        threeObject: THREE.Object3D,
        intersections: TrimIntersection[],
        pickT: number,
        context: EditorContext
    ): boolean {
        // Find which segment the pick point is in
        let segmentStart = 0;
        let segmentEnd = 1;

        for (const inter of intersections) {
            if (inter.t < pickT) {
                segmentStart = inter.t;
            } else {
                segmentEnd = inter.t;
                break;
            }
        }

        // Calculate new endpoints
        const dx = line.end.x - line.start.x;
        const dy = line.end.y - line.start.y;

        // Remove the original line
        context.renderer.deleteEntity(threeObject);

        // Create trimmed segments (keeping the parts outside the picked segment)
        if (segmentStart > 0.0001) {
            const newEnd = {
                x: line.start.x + segmentStart * dx,
                y: line.start.y + segmentStart * dy
            };
            context.renderer.createLineFromPoints(line.start, newEnd);
        }

        if (segmentEnd < 0.9999) {
            const newStart = {
                x: line.start.x + segmentEnd * dx,
                y: line.start.y + segmentEnd * dy
            };
            context.renderer.createLineFromPoints(newStart, line.end);
        }

        return true;
    }

    private trimArc(
        arc: DxfArc,
        threeObject: THREE.Object3D,
        intersections: TrimIntersection[],
        pickT: number,
        context: EditorContext
    ): boolean {
        let segmentStart = 0;
        let segmentEnd = 1;

        for (const inter of intersections) {
            if (inter.t < pickT) {
                segmentStart = inter.t;
            } else {
                segmentEnd = inter.t;
                break;
            }
        }

        const totalAngle = arc.endAngle - arc.startAngle;
        const newStartAngle1 = arc.startAngle;
        const newEndAngle1 = arc.startAngle + segmentStart * totalAngle;
        const newStartAngle2 = arc.startAngle + segmentEnd * totalAngle;
        const newEndAngle2 = arc.endAngle;

        // Remove the original arc
        context.renderer.deleteEntity(threeObject);

        // Create trimmed arc segments
        if (segmentStart > 0.0001) {
            context.renderer.createArcFromCenterRadiusAngles(
                arc.center, arc.radius, newStartAngle1, newEndAngle1
            );
        }

        if (segmentEnd < 0.9999) {
            context.renderer.createArcFromCenterRadiusAngles(
                arc.center, arc.radius, newStartAngle2, newEndAngle2
            );
        }

        return true;
    }
}
