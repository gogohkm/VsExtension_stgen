/**
 * COPY Command - Copies selected entities by displacement
 *
 * Usage:
 *   COPY
 *   Select objects: (select entities first)
 *   Specify base point: (click or enter coordinates)
 *   Specify second point or <displacement>: (click or enter coordinates)
 *   Specify second point or [Exit] <Exit>: (continue copying or press Enter to exit)
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { LineJig } from '../editor/input/AcEdPreviewJig';
import { DxfEntity } from '../dxfParser';

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
                    : 'Specify second point or [Exit] <Exit>',
                basePoint: basePoint,
                jig,
                keywords: [
                    { displayName: 'Exit', globalName: 'EXIT', localName: 'X' }
                ],
                allowNone: true
            });

            jig.clear();

            if (secondPointResult.status === PromptStatus.Cancel) {
                break;
            }

            if (secondPointResult.status === PromptStatus.None) {
                // User pressed Enter without input - exit copy mode
                break;
            }

            if (secondPointResult.status === PromptStatus.Keyword && secondPointResult.keyword === 'EXIT') {
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
            copyCount += copied.length;

            if (copied.length > 0) {
                context.renderer.recordAddAction(copied);
            }

            context.commandLine.print(`${copied.length} object(s) copied`, 'response');
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
     * Fixed: Apply displacement BEFORE rendering to show copy at correct position
     * Optimized: Batch rendering to improve performance
     */
    private copySelectedEntities(context: EditorContext, dx: number, dy: number): DxfEntity[] {
        const selectedObjects = context.renderer.getSelectedEntities();
        const createdEntities: DxfEntity[] = [];

        // Filter out entities on locked layers
        const copyableObjects = selectedObjects.filter(object => {
            const layerName = object.userData.layer || '0';
            return !context.renderer.isLayerLocked(layerName);
        });

        const lockedCount = selectedObjects.length - copyableObjects.length;
        if (lockedCount > 0) {
            context.commandLine.print(`${lockedCount} object(s) on locked layer(s) - skipped`, 'response');
        }

        for (const object of copyableObjects) {
            const entity = object.userData.entity as DxfEntity;
            if (!entity) continue;

            // 1. Deep clone the entity data
            const cloned = context.renderer.cloneEntity(entity);
            if (!cloned) continue;

            // 2. Generate new handle
            cloned.handle = context.renderer.generateHandle();

            // 3. Apply displacement BEFORE adding to scene
            context.renderer.applyDisplacementToEntity(cloned, dx, dy);

            // 4. Add to DXF and render at the displaced position (skip individual render)
            const newObject = context.renderer.addEntity(cloned, { render: false });
            if (newObject) {
                createdEntities.push(cloned);
            }
        }

        // 5. Single render call after all entities are added
        context.renderer.render();

        return createdEntities;
    }
}
