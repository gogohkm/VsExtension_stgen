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
import { DxfEntity } from '../dxfParser';

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

        // Check if there are selected entities, if not prompt for selection
        let selectedCount = context.renderer.getSelectedCount();
        if (selectedCount === 0) {
            const result = await editor.getSelection({
                message: 'Select objects'
            });

            if (result.status === PromptStatus.Cancel) {
                context.commandLine.print('*Cancel*', 'error');
                return;
            }

            selectedCount = context.renderer.getSelectedCount();
            if (selectedCount === 0) {
                context.commandLine.print('No objects selected', 'response');
                return;
            }
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
        const entities = selectedObjects
            .map(object => object.userData.entity as DxfEntity | undefined)
            .filter((entity): entity is DxfEntity => !!entity);

        context.renderer.moveEntities(entities, dx, dy);
        context.renderer.clearSelection();
        context.renderer.recordMoveAction(entities, dx, dy);

        return entities.length;
    }
}
