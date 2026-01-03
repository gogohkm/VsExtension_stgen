/**
 * POLYLINE Command - Draws continuous polyline as a single LWPOLYLINE entity
 *
 * Usage:
 *   POLYLINE (or PLINE)
 *   Specify start point: (click or enter coordinates)
 *   Specify next point [Close/Undo]: (click or enter coordinates)
 *   ...
 *   Press Enter to finish
 */

import { AcEdCommand, EditorContext } from '../editor/command/AcEdCommand';
import { AcEdKeyword } from '../editor/input/prompt/AcEdPromptOptions';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { PolylineJig } from '../editor/input/AcEdPreviewJig';
import { Point2D } from '../editor/input/handler/AcEdPointHandler';
import { DxfPolyline } from '../dxfParser';

export class AcPolylineCmd extends AcEdCommand {
    private points: Point2D[] = [];

    constructor() {
        super();
        this.globalName = 'PLINE';
        this.localName = 'PL';
        this.description = 'Draw a polyline';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;
        this.points = [];

        context.commandLine.print('PLINE', 'command');

        // Get first point
        const firstPointResult = await editor.getPoint({
            message: 'Specify start point',
            allowNone: true
        });

        if (firstPointResult.status === PromptStatus.Cancel || firstPointResult.status === PromptStatus.None) {
            return;
        }

        if (firstPointResult.status !== PromptStatus.OK || !firstPointResult.value) {
            return;
        }

        this.points.push(firstPointResult.value);
        context.renderer.addDrawingPoint(firstPointResult.value.x, firstPointResult.value.y);

        // Track if polyline should be closed
        let isClosed = false;

        // Continuous polyline drawing loop
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
            const jig = new PolylineJig(context.renderer, this.points);

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
                        this.points.push(nextPointResult.value);
                        context.renderer.addDrawingPoint(nextPointResult.value.x, nextPointResult.value.y);
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
                                isClosed = true;
                                context.commandLine.print('Close', 'response');
                                continueDrawing = false;
                            }
                            break;

                        case 'UNDO':
                            if (this.points.length > 1) {
                                this.points.pop();
                                context.renderer.cancelDrawing();
                                // Re-draw remaining points
                                for (const pt of this.points) {
                                    context.renderer.addDrawingPoint(pt.x, pt.y);
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

        // Cleanup preview
        context.renderer.cancelDrawing();

        // Create single LWPOLYLINE entity if we have at least 2 points
        if (this.points.length >= 2) {
            const polyline: DxfPolyline = {
                type: 'LWPOLYLINE',
                handle: context.renderer.generateHandle(),
                layer: context.renderer.getCurrentDrawingLayer(),
                vertices: this.points.map(p => ({ x: p.x, y: p.y })),
                closed: isClosed
            };

            const object = context.renderer.addEntity(polyline);
            if (object) {
                context.renderer.recordAddAction([polyline]);
            }

            context.commandLine.print(`Polyline created with ${this.points.length} vertices`, 'success');
        }
    }
}
