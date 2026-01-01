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
        const editor = context.editor;

        const result = await editor.getSelection({
            message: 'Select objects (Enter when done)'
        });

        if (result.status === PromptStatus.OK || result.status === PromptStatus.None) {
            const count = context.renderer.deleteSelectedEntities();
            if (count > 0) {
                context.commandLine.print(
                    `${count} ${count === 1 ? 'object' : 'objects'} erased`,
                    'success'
                );
            } else {
                context.commandLine.print('No objects selected', 'response');
            }
        } else if (result.status === PromptStatus.Cancel) {
            context.commandLine.print('*Cancel*', 'error');
        }
    }
}
