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
            // Delete already selected entities
            const deletedCount = context.renderer.deleteSelectedEntities();
            context.commandLine.print(
                `${deletedCount} ${deletedCount === 1 ? 'object' : 'objects'} erased`,
                'success'
            );
            return;
        }

        // No pre-selection, prompt for selection
        context.commandLine.print('Select objects to erase:', 'prompt');
        context.commandLine.print('Click on objects to select, then press Enter', 'response');

        // Wait for user to press Enter (this is a simplified version)
        // In a full implementation, we would track selection state
        const editor = context.editor;

        const result = await editor.getPoint({
            message: 'Select objects (Enter when done)',
            allowNone: true
        });

        if (result.status === PromptStatus.None || result.status === PromptStatus.Cancel) {
            const count = context.renderer.deleteSelectedEntities();
            if (count > 0) {
                context.commandLine.print(
                    `${count} ${count === 1 ? 'object' : 'objects'} erased`,
                    'success'
                );
            } else {
                context.commandLine.print('No objects selected', 'response');
            }
        }
    }
}
