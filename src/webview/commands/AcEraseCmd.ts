/**
 * ERASE Command - Deletes selected entities
 *
 * Usage:
 *   ERASE
 *   Select objects: (click to select, Enter when done)
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';

export class AcEraseCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'ERASE';
        this.localName = 'E';
        this.description = 'Delete selected entities';
    }

    async execute(context: EditorContext): Promise<void> {
        context.commandLine.print('ERASE', 'command');

        // Check if there are already selected entities
        const selectedCount = context.renderer.getSelectedCount();

        if (selectedCount > 0) {
            // Check for locked layers before deleting
            const selectedEntities = context.renderer.getSelectedEntities();
            const lockedCount = selectedEntities.filter(obj => {
                const layerName = obj.userData.layer || '0';
                return context.renderer.isLayerLocked(layerName);
            }).length;

            // Delete already selected entities (locked ones will be skipped by renderer)
            const deletedCount = context.renderer.deleteSelectedEntities();

            if (lockedCount > 0) {
                context.commandLine.print(
                    `${lockedCount} object(s) on locked layer(s) - skipped`,
                    'response'
                );
            }

            if (deletedCount > 0) {
                context.commandLine.print(
                    `${deletedCount} ${deletedCount === 1 ? 'object' : 'objects'} erased`,
                    'success'
                );
            } else if (lockedCount === 0) {
                context.commandLine.print('No objects erased', 'response');
            }
            return;
        }

        // No pre-selection, prompt for selection
        const editor = context.editor;

        const result = await editor.getSelection({
            message: 'Select objects (Enter when done)'
        });

        if (result.status === PromptStatus.OK || result.status === PromptStatus.None) {
            // Check for locked layers before deleting
            const selectedEntities = context.renderer.getSelectedEntities();
            const lockedCount = selectedEntities.filter(obj => {
                const layerName = obj.userData.layer || '0';
                return context.renderer.isLayerLocked(layerName);
            }).length;

            const count = context.renderer.deleteSelectedEntities();

            if (lockedCount > 0) {
                context.commandLine.print(
                    `${lockedCount} object(s) on locked layer(s) - skipped`,
                    'response'
                );
            }

            if (count > 0) {
                context.commandLine.print(
                    `${count} ${count === 1 ? 'object' : 'objects'} erased`,
                    'success'
                );
            } else if (lockedCount === 0) {
                context.commandLine.print('No objects selected', 'response');
            }
        } else if (result.status === PromptStatus.Cancel) {
            context.commandLine.print('*Cancel*', 'error');
        }
    }
}
