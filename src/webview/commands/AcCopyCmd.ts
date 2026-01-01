/**
 * COPY Command - Copies selected entities by displacement
 *
 * Usage:
 *   COPY
 *   Select objects: (select entities first)
 *   Specify base point: (click or enter coordinates)
 *   Specify second point or <displacement>: (click or enter coordinates)
 *   Specify second point or [Exit/Undo] <Exit>: (continue copying or press Enter to exit)
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { LineJig } from '../editor/input/AcEdPreviewJig';
import { Point2D } from '../editor/input/handler/AcEdPointHandler';
import { DxfEntity, DxfLine, DxfCircle, DxfArc, DxfPoint_ } from '../dxfParser';

export class AcCopyCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'COPY';
        this.localName = 'CO';
        this.description = 'Copy selected entities';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;

        context.commandLine.print('COPY', 'command');

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

        // Copy loop - allow multiple copies
        let continueLoop = true;
        let copyCount = 0;

        while (continueLoop) {
            this.checkCancelled();

            // Create jig for preview
            const jig = new LineJig(context.renderer, basePoint);

            // Get second point (displacement)
            const secondPointResult = await editor.getPoint({
                message: copyCount === 0
                    ? 'Specify second point or <displacement>'
                    : 'Specify second point or [Exit/Undo] <Exit>',
                basePoint: basePoint,
                jig
            });

            jig.clear();

            if (secondPointResult.status === PromptStatus.Cancel) {
                break;
            }

            if (secondPointResult.status === PromptStatus.None) {
                // User pressed Enter without input - exit copy mode
                break;
            }

            if (secondPointResult.status !== PromptStatus.OK || !secondPointResult.value) {
                break;
            }

            const secondPoint = secondPointResult.value;

            // Calculate displacement
            const dx = secondPoint.x - basePoint.x;
            const dy = secondPoint.y - basePoint.y;

            // Apply copy to selected entities
            const copied = this.copySelectedEntities(context, dx, dy);
            copyCount += copied;

            context.commandLine.print(`${copied} object(s) copied`, 'response');
        }

        context.renderer.cancelDrawing();
        context.renderer.clearSelection();

        if (copyCount > 0) {
            context.commandLine.print(`Total: ${copyCount} object(s) copied`, 'success');
        } else {
            context.commandLine.print('Copy cancelled', 'response');
        }
    }

    /**
     * Copies all selected entities by the given displacement
     */
    private copySelectedEntities(context: EditorContext, dx: number, dy: number): number {
        const selectedObjects = context.renderer.getSelectedEntities();
        let count = 0;

        for (const object of selectedObjects) {
            const entity = object.userData.entity as DxfEntity;
            if (!entity) continue;

            // Clone the entity
            const cloned = context.renderer.cloneEntity(entity);
            if (cloned) {
                // Apply displacement to the cloned entity
                this.applyDisplacement(cloned, dx, dy);
                count++;
            }
        }

        // Re-render to show the new copies
        context.renderer.reRenderEntities();

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
