/**
 * LINE Command - Draws continuous line segments
 *
 * Usage:
 *   LINE
 *   Specify first point: (click or enter coordinates)
 *   Specify next point [Undo]: (click or enter coordinates)
 *   Specify next point [Close/Undo]: (click, coordinates, or Enter to finish)
 */

import { AcEdCommand, EditorContext, AcEditorInterface } from '../editor/command/AcEdCommand';
import { AcEdKeyword } from '../editor/input/prompt/AcEdPromptOptions';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { LineJig } from '../editor/input/AcEdPreviewJig';
import { Point2D } from '../editor/input/handler/AcEdPointHandler';
import { DxfEntity } from '../dxfParser';
import * as THREE from 'three';

export class AcLineCmd extends AcEdCommand {
    private points: Point2D[] = [];
    private createdEntities: THREE.Object3D[] = [];  // Track created entities for undo

    constructor() {
        super();
        this.globalName = 'LINE';
        this.localName = 'L';
        this.description = 'Draw line segments';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;
        this.points = [];
        this.createdEntities = [];  // Reset tracking for new command execution

        context.commandLine.print('LINE', 'command');

        // Get first point
        const firstPointResult = await editor.getPoint({
            message: 'Specify first point'
        });

        if (firstPointResult.status !== PromptStatus.OK || !firstPointResult.value) {
            return;
        }

        this.points.push(firstPointResult.value);
        context.renderer.addDrawingPoint(firstPointResult.value.x, firstPointResult.value.y);

        // Continuous line drawing loop
        let continueDrawing = true;
        while (continueDrawing) {
            this.checkCancelled();

            const keywords: AcEdKeyword[] = this.points.length >= 2
                ? [
                    { displayName: 'Close', globalName: 'CLOSE', localName: 'C' },
                    { displayName: 'Undo', globalName: 'UNDO', localName: 'U' }
                ]
                : [
                    { displayName: 'Undo', globalName: 'UNDO', localName: 'U' }
                ];

            const lastPoint = this.points[this.points.length - 1];
            const jig = new LineJig(context.renderer, lastPoint);

            const nextPointResult = await editor.getPoint({
                message: 'Specify next point',
                keywords,
                basePoint: lastPoint,
                jig,
                allowNone: true
            });

            jig.clear();

            switch (nextPointResult.status) {
                case PromptStatus.OK:
                    if (nextPointResult.value) {
                        // Create line segment and track the Three.js object for undo
                        const result = context.renderer.createLineFromPointsWithObject(lastPoint, nextPointResult.value);
                        if (result) {
                            this.createdEntities.push(result.object);
                        }
                        this.points.push(nextPointResult.value);
                        context.commandLine.print(
                            `To point: ${nextPointResult.value.x.toFixed(4)}, ${nextPointResult.value.y.toFixed(4)}`,
                            'response'
                        );
                    }
                    break;

                case PromptStatus.Keyword:
                    switch (nextPointResult.keyword) {
                        case 'CLOSE':
                            if (this.points.length >= 2) {
                                const firstPoint = this.points[0];
                                const result = context.renderer.createLineFromPointsWithObject(lastPoint, firstPoint);
                                if (result) {
                                    this.createdEntities.push(result.object);
                                }
                                context.commandLine.print('Close', 'response');
                                continueDrawing = false;
                            }
                            break;

                        case 'UNDO':
                            if (this.points.length > 1) {
                                this.points.pop();
                                // Remove the specific line created by this command
                                const lastCreated = this.createdEntities.pop();
                                if (lastCreated) {
                                    context.renderer.deleteEntity(lastCreated);
                                }
                                context.commandLine.print('Undo', 'response');
                            } else if (this.points.length === 1) {
                                this.points.pop();
                                context.commandLine.print('Undo', 'response');
                                continueDrawing = false;
                            }
                            break;
                    }
                    break;

                case PromptStatus.None:
                    // Empty Enter - finish command
                    continueDrawing = false;
                    break;

                case PromptStatus.Cancel:
                    continueDrawing = false;
                    break;
            }
        }

        // Cleanup
        context.renderer.cancelDrawing();

        const created = this.createdEntities
            .map(object => object.userData.entity as DxfEntity | undefined)
            .filter((entity): entity is DxfEntity => !!entity);

        if (created.length > 0) {
            context.renderer.recordAddAction(created);
        }

        if (this.points.length >= 2) {
            context.commandLine.print('Line command completed', 'success');
        }
    }
}
