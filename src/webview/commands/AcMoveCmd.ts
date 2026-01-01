/**
 * MOVE Command - Moves selected entities by displacement
 *
 * Usage:
 *   MOVE
 *   Select objects: (select entities first)
 *   Specify base point: (click or enter coordinates)
 *   Specify second point: (click or enter coordinates)
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { LineJig } from '../editor/input/AcEdPreviewJig';
import { Point2D } from '../editor/input/handler/AcEdPointHandler';
import { DxfEntity, DxfLine, DxfCircle, DxfArc, DxfPoint_ } from '../dxfParser';

export class AcMoveCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'MOVE';
        this.localName = 'M';
        this.description = 'Move selected entities';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('MOVE', 'command');

        // Check if there are selected entities
        const selectedCount = context.renderer.getSelectedCount();
        if (selectedCount === 0) {
            context.commandLine.print('No objects selected. Select objects first.', 'error');
            return;
        }

        context.commandLine.print(`${selectedCount} object(s) selected`, 'response');

        // Get base point
        const basePointResult = await editor.getPoint({
            message: 'Specify base point'
        });

        if (basePointResult.status !== PromptStatus.OK || !basePointResult.value) {
            return;
        }

        const basePoint = basePointResult.value;
        context.renderer.addDrawingPoint(basePoint.x, basePoint.y);

        // Create jig for preview
        const jig = new LineJig(context.renderer, basePoint);

        // Get second point (displacement)
        const secondPointResult = await editor.getPoint({
            message: 'Specify second point or <displacement>',
            basePoint: basePoint,
            jig
        });

        jig.clear();

        if (secondPointResult.status !== PromptStatus.OK || !secondPointResult.value) {
            context.renderer.cancelDrawing();
            return;
        }

        const secondPoint = secondPointResult.value;

        // Calculate displacement
        const dx = secondPoint.x - basePoint.x;
        const dy = secondPoint.y - basePoint.y;

        // Apply move to selected entities
        const movedCount = this.moveSelectedEntities(context, dx, dy);

        context.renderer.cancelDrawing();
        context.commandLine.print(`${movedCount} object(s) moved`, 'success');
    }

    /**
     * Moves all selected entities by the given displacement
     * Fixed: Update both entity data AND Three.js object positions
     */
    private moveSelectedEntities(context: EditorContext, dx: number, dy: number): number {
        const selectedObjects = context.renderer.getSelectedEntities();
        let count = 0;

        for (const object of selectedObjects) {
            const entity = object.userData.entity as DxfEntity;
            if (!entity) continue;

            // 1. Update entity data (for persistence/export)
            this.applyDisplacement(entity, dx, dy);

            // 2. Update Three.js object position directly (for immediate visual update)
            object.position.x += dx;
            object.position.y += dy;

            count++;
        }

        // Clear selection and render (no need for full re-render)
        context.renderer.clearSelection();
        context.renderer.render();

        return count;
    }

    /**
     * Applies displacement to an entity based on its type
     */
    private applyDisplacement(entity: DxfEntity, dx: number, dy: number): void {
        switch (entity.type) {
            case 'LINE': {
                const line = entity as DxfLine;
                line.start.x += dx;
                line.start.y += dy;
                line.end.x += dx;
                line.end.y += dy;
                break;
            }
            case 'CIRCLE': {
                const circle = entity as DxfCircle;
                circle.center.x += dx;
                circle.center.y += dy;
                break;
            }
            case 'ARC': {
                const arc = entity as DxfArc;
                arc.center.x += dx;
                arc.center.y += dy;
                break;
            }
            case 'POINT': {
                const point = entity as DxfPoint_;
                point.position.x += dx;
                point.position.y += dy;
                break;
            }
            case 'LWPOLYLINE':
            case 'POLYLINE': {
                const polyline = entity as any;
                if (polyline.vertices) {
                    for (const vertex of polyline.vertices) {
                        vertex.x += dx;
                        vertex.y += dy;
                    }
                }
                break;
            }
            case 'TEXT':
            case 'MTEXT': {
                const text = entity as any;
                if (text.position) {
                    text.position.x += dx;
                    text.position.y += dy;
                }
                if (text.insertionPoint) {
                    text.insertionPoint.x += dx;
                    text.insertionPoint.y += dy;
                }
                break;
            }
            case 'ELLIPSE': {
                const ellipse = entity as any;
                if (ellipse.center) {
                    ellipse.center.x += dx;
                    ellipse.center.y += dy;
                }
                break;
            }
            case 'SPLINE': {
                const spline = entity as any;
                if (spline.controlPoints) {
                    for (const cp of spline.controlPoints) {
                        cp.x += dx;
                        cp.y += dy;
                    }
                }
                if (spline.fitPoints) {
                    for (const fp of spline.fitPoints) {
                        fp.x += dx;
                        fp.y += dy;
                    }
                }
                break;
            }
            case 'INSERT': {
                const insert = entity as any;
                if (insert.position) {
                    insert.position.x += dx;
                    insert.position.y += dy;
                }
                break;
            }
            case 'DIMENSION': {
                const dim = entity as any;
                if (dim.definitionPoint) {
                    dim.definitionPoint.x += dx;
                    dim.definitionPoint.y += dy;
                }
                if (dim.textMidpoint) {
                    dim.textMidpoint.x += dx;
                    dim.textMidpoint.y += dy;
                }
                break;
            }
            default:
                // For unknown types, try to move common properties
                const anyEntity = entity as any;
                if (anyEntity.position) {
                    anyEntity.position.x += dx;
                    anyEntity.position.y += dy;
                }
                if (anyEntity.center) {
                    anyEntity.center.x += dx;
                    anyEntity.center.y += dy;
                }
                break;
        }
    }
}
