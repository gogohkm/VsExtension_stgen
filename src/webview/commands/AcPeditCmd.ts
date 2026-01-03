/**
 * PEDIT Command - Polyline Edit
 *
 * Usage:
 *   PEDIT
 *   Select polyline or [Multiple]:
 *   Enter an option [Close/Open/Join/Width/Edit vertex/Fit/Spline/Decurve/Ltype gen/Reverse/Undo]:
 */

import { AcEdCommand, EditorContext } from '../editor/command/AcEdCommand';
import { AcEdKeyword } from '../editor/input/prompt/AcEdPromptOptions';
import { PromptStatus } from '../editor/input/prompt/AcEdPromptResult';
import { DxfEntity, DxfPolyline, DxfLine } from '../dxfParser';
import { Point2D } from '../editor/input/handler/AcEdPointHandler';
import * as THREE from 'three';

export class AcPeditCmd extends AcEdCommand {
    constructor() {
        super();
        this.globalName = 'PEDIT';
        this.localName = 'PE';
        this.description = 'Edit polyline';
    }

    async execute(context: EditorContext): Promise<void> {
        const editor = context.editor;
        context.commandLine.print('PEDIT', 'command');

        // Select polyline
        const selectResult = await editor.getEntity({
            message: 'Select polyline',
            allowNone: true
        });

        if (selectResult.status === PromptStatus.Cancel || selectResult.status === PromptStatus.None) {
            return;
        }

        if (selectResult.status !== PromptStatus.OK || !selectResult.value) {
            return;
        }

        const { entity: threeObject } = selectResult.value;
        const entity = threeObject.userData.entity as DxfEntity;

        if (!entity) {
            context.commandLine.print('No entity found', 'error');
            return;
        }

        // Check if entity is on a locked layer
        const layerName = threeObject.userData.layer || '0';
        if (context.renderer.isLayerLocked(layerName)) {
            context.commandLine.print(`Object is on locked layer "${layerName}"`, 'error');
            return;
        }

        // Check if it's a polyline or convert line to polyline
        let polyline: DxfPolyline | null = null;
        if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
            polyline = entity as DxfPolyline;
        } else if (entity.type === 'LINE') {
            // Offer to convert LINE to POLYLINE
            context.commandLine.print('Object selected is not a polyline.', 'response');

            const keywords: AcEdKeyword[] = [
                { displayName: 'Yes', globalName: 'YES', localName: 'Y' },
                { displayName: 'No', globalName: 'NO', localName: 'N' }
            ];

            const convertResult = await editor.getPoint({
                message: 'Do you want to turn it into one? [Yes/No]',
                keywords,
                allowNone: true
            });

            if (convertResult.status === PromptStatus.Keyword && convertResult.keyword === 'YES') {
                // Convert LINE to POLYLINE
                const converted = this.convertLineToPolyline(entity as DxfLine, threeObject, context);
                if (!converted) {
                    context.commandLine.print('Failed to convert line to polyline', 'error');
                    return;
                }
                polyline = converted.polyline;
                context.commandLine.print('Line converted to polyline', 'response');
                // Update threeObject reference to the new polyline object
                // The original is deleted and new one created
            } else {
                return;
            }
        } else {
            context.commandLine.print(`Cannot edit ${entity.type} with PEDIT`, 'error');
            return;
        }

        if (!polyline) {
            return;
        }

        // Find the current three object for the polyline (may have changed after conversion)
        let currentThreeObject = this.findThreeObjectForPolyline(polyline, context);
        if (!currentThreeObject) {
            context.commandLine.print('Cannot find polyline object', 'error');
            return;
        }

        // Highlight the selected polyline
        context.renderer.highlightEntities([currentThreeObject]);

        // Main edit loop
        let continueEditing = true;
        while (continueEditing) {
            this.checkCancelled();

            const isClosed = polyline.closed ?? false;
            const keywords: AcEdKeyword[] = [
                { displayName: isClosed ? 'Open' : 'Close', globalName: isClosed ? 'OPEN' : 'CLOSE', localName: isClosed ? 'O' : 'C' },
                { displayName: 'Join', globalName: 'JOIN', localName: 'J' },
                { displayName: 'Edit vertex', globalName: 'EDIT', localName: 'E' },
                { displayName: 'Reverse', globalName: 'REVERSE', localName: 'R' }
            ];

            const optionResult = await editor.getPoint({
                message: `Enter an option [${keywords.map(k => k.displayName).join('/')}]`,
                keywords,
                allowNone: true
            });

            if (optionResult.status === PromptStatus.Cancel || optionResult.status === PromptStatus.None) {
                continueEditing = false;
                continue;
            }

            if (optionResult.status === PromptStatus.Keyword) {
                switch (optionResult.keyword) {
                    case 'CLOSE':
                        polyline.closed = true;
                        currentThreeObject = this.updatePolylineDisplay(polyline, currentThreeObject, context);
                        context.commandLine.print('Polyline closed', 'success');
                        break;

                    case 'OPEN':
                        polyline.closed = false;
                        currentThreeObject = this.updatePolylineDisplay(polyline, currentThreeObject, context);
                        context.commandLine.print('Polyline opened', 'success');
                        break;

                    case 'JOIN':
                        currentThreeObject = await this.joinPolylines(polyline, currentThreeObject, context);
                        break;

                    case 'EDIT':
                        currentThreeObject = await this.editVertices(polyline, currentThreeObject, context);
                        break;

                    case 'REVERSE':
                        this.reversePolyline(polyline);
                        currentThreeObject = this.updatePolylineDisplay(polyline, currentThreeObject, context);
                        context.commandLine.print('Polyline reversed', 'success');
                        break;
                }

                // Re-highlight after any changes
                if (currentThreeObject) {
                    context.renderer.highlightEntities([currentThreeObject]);
                }
            }
        }

        // Clear highlight
        context.renderer.clearHighlight();
    }

    private findThreeObjectForPolyline(polyline: DxfPolyline, context: EditorContext): THREE.Object3D | null {
        const allEntities = context.renderer.getAllVisibleEntities();
        for (const obj of allEntities) {
            if (obj.userData.entity === polyline) {
                return obj;
            }
        }
        return null;
    }

    private convertLineToPolyline(
        line: DxfLine,
        threeObject: THREE.Object3D,
        context: EditorContext
    ): { polyline: DxfPolyline; object: THREE.Object3D } | null {
        const polyline: DxfPolyline = {
            type: 'LWPOLYLINE',
            handle: context.renderer.generateHandle(),
            layer: line.layer || '0',
            vertices: [
                { x: line.start.x, y: line.start.y },
                { x: line.end.x, y: line.end.y }
            ],
            closed: false
        };

        // Remove the original line
        context.renderer.deleteEntity(threeObject);

        // Add the new polyline
        context.renderer.addEntity(polyline);

        // Find the newly created object
        const newObject = this.findThreeObjectForPolyline(polyline, context);
        if (!newObject) {
            return null;
        }

        return { polyline, object: newObject };
    }

    private updatePolylineDisplay(
        polyline: DxfPolyline,
        threeObject: THREE.Object3D,
        context: EditorContext
    ): THREE.Object3D {
        // Remove the old display object
        context.renderer.deleteEntity(threeObject);

        // Create new display for the updated polyline
        context.renderer.addEntity(polyline);

        // Find and return the new object
        const newObject = this.findThreeObjectForPolyline(polyline, context);
        return newObject || threeObject;
    }

    private reversePolyline(polyline: DxfPolyline): void {
        polyline.vertices.reverse();
    }

    private async joinPolylines(
        polyline: DxfPolyline,
        threeObject: THREE.Object3D,
        context: EditorContext
    ): Promise<THREE.Object3D> {
        const editor = context.editor;

        context.commandLine.print('Select objects to join:', 'response');

        // Allow selection of objects to join
        const selectResult = await editor.getSelection({
            message: 'Select objects to join'
        });

        if (selectResult.status !== PromptStatus.OK) {
            return threeObject;
        }

        const selectedObjects = context.renderer.getSelectedEntities();
        let joinCount = 0;

        for (const obj of selectedObjects) {
            const entity = obj.userData.entity as DxfEntity;
            if (!entity || entity === polyline) continue;

            // Try to join LINE or POLYLINE
            if (entity.type === 'LINE') {
                const line = entity as DxfLine;
                if (this.tryJoinLine(polyline, line)) {
                    context.renderer.deleteEntity(obj);
                    joinCount++;
                }
            } else if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
                const otherPolyline = entity as DxfPolyline;
                if (this.tryJoinPolyline(polyline, otherPolyline)) {
                    context.renderer.deleteEntity(obj);
                    joinCount++;
                }
            }
        }

        context.renderer.clearSelection();

        let currentThreeObject = threeObject;
        if (joinCount > 0) {
            currentThreeObject = this.updatePolylineDisplay(polyline, threeObject, context);
            context.commandLine.print(`${joinCount} object(s) joined`, 'success');
        } else {
            context.commandLine.print('No objects could be joined', 'response');
        }

        return currentThreeObject;
    }

    private tryJoinLine(polyline: DxfPolyline, line: DxfLine): boolean {
        const tolerance = 0.001;
        const vertices = polyline.vertices;
        const firstVertex = vertices[0];
        const lastVertex = vertices[vertices.length - 1];

        // Check if line start connects to polyline end
        if (this.pointsClose(lastVertex, line.start, tolerance)) {
            vertices.push({ x: line.end.x, y: line.end.y });
            return true;
        }

        // Check if line end connects to polyline end
        if (this.pointsClose(lastVertex, line.end, tolerance)) {
            vertices.push({ x: line.start.x, y: line.start.y });
            return true;
        }

        // Check if line start connects to polyline start
        if (this.pointsClose(firstVertex, line.start, tolerance)) {
            vertices.unshift({ x: line.end.x, y: line.end.y });
            return true;
        }

        // Check if line end connects to polyline start
        if (this.pointsClose(firstVertex, line.end, tolerance)) {
            vertices.unshift({ x: line.start.x, y: line.start.y });
            return true;
        }

        return false;
    }

    private tryJoinPolyline(polyline: DxfPolyline, other: DxfPolyline): boolean {
        const tolerance = 0.001;
        const vertices = polyline.vertices;
        const otherVertices = other.vertices;

        const firstVertex = vertices[0];
        const lastVertex = vertices[vertices.length - 1];
        const otherFirst = otherVertices[0];
        const otherLast = otherVertices[otherVertices.length - 1];

        // Try joining at different connection points
        if (this.pointsClose(lastVertex, otherFirst, tolerance)) {
            // Connect end to start of other
            vertices.push(...otherVertices.slice(1).map(v => ({ x: v.x, y: v.y })));
            return true;
        }

        if (this.pointsClose(lastVertex, otherLast, tolerance)) {
            // Connect end to end of other (reverse other)
            const reversed = [...otherVertices].reverse();
            vertices.push(...reversed.slice(1).map(v => ({ x: v.x, y: v.y })));
            return true;
        }

        if (this.pointsClose(firstVertex, otherLast, tolerance)) {
            // Connect start to end of other
            const newVerts = otherVertices.slice(0, -1).map(v => ({ x: v.x, y: v.y }));
            vertices.unshift(...newVerts);
            return true;
        }

        if (this.pointsClose(firstVertex, otherFirst, tolerance)) {
            // Connect start to start of other (reverse other)
            const reversed = [...otherVertices].reverse();
            const newVerts = reversed.slice(0, -1).map(v => ({ x: v.x, y: v.y }));
            vertices.unshift(...newVerts);
            return true;
        }

        return false;
    }

    private pointsClose(p1: Point2D, p2: Point2D, tolerance: number): boolean {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy) < tolerance;
    }

    private async editVertices(
        polyline: DxfPolyline,
        threeObject: THREE.Object3D,
        context: EditorContext
    ): Promise<THREE.Object3D> {
        const editor = context.editor;
        let currentVertexIndex = 0;
        let currentThreeObject = threeObject;

        // Show current vertex marker
        this.showVertexMarker(polyline, currentVertexIndex, context);

        let continueEditing = true;
        while (continueEditing) {
            this.checkCancelled();

            const keywords: AcEdKeyword[] = [
                { displayName: 'Next', globalName: 'NEXT', localName: 'N' },
                { displayName: 'Previous', globalName: 'PREVIOUS', localName: 'P' },
                { displayName: 'Break', globalName: 'BREAK', localName: 'B' },
                { displayName: 'Insert', globalName: 'INSERT', localName: 'I' },
                { displayName: 'Move', globalName: 'MOVE', localName: 'M' },
                { displayName: 'eXit', globalName: 'EXIT', localName: 'X' }
            ];

            const optionResult = await editor.getPoint({
                message: `[${keywords.map(k => k.displayName).join('/')}] <N>`,
                keywords,
                allowNone: true
            });

            if (optionResult.status === PromptStatus.Cancel) {
                continueEditing = false;
                continue;
            }

            if (optionResult.status === PromptStatus.None) {
                // Default to NEXT
                currentVertexIndex = (currentVertexIndex + 1) % polyline.vertices.length;
                this.showVertexMarker(polyline, currentVertexIndex, context);
                continue;
            }

            if (optionResult.status === PromptStatus.Keyword) {
                switch (optionResult.keyword) {
                    case 'NEXT':
                        currentVertexIndex = (currentVertexIndex + 1) % polyline.vertices.length;
                        this.showVertexMarker(polyline, currentVertexIndex, context);
                        break;

                    case 'PREVIOUS':
                        currentVertexIndex = (currentVertexIndex - 1 + polyline.vertices.length) % polyline.vertices.length;
                        this.showVertexMarker(polyline, currentVertexIndex, context);
                        break;

                    case 'INSERT':
                        const insertResult = await editor.getPoint({
                            message: 'Specify location for new vertex'
                        });

                        if (insertResult.status === PromptStatus.OK && insertResult.value) {
                            polyline.vertices.splice(currentVertexIndex + 1, 0, {
                                x: insertResult.value.x,
                                y: insertResult.value.y
                            });
                            currentVertexIndex++;
                            currentThreeObject = this.updatePolylineDisplay(polyline, currentThreeObject, context);
                            this.showVertexMarker(polyline, currentVertexIndex, context);
                            context.commandLine.print('Vertex inserted', 'success');
                        }
                        break;

                    case 'MOVE':
                        const moveResult = await editor.getPoint({
                            message: 'Specify new location for vertex',
                            basePoint: polyline.vertices[currentVertexIndex]
                        });

                        if (moveResult.status === PromptStatus.OK && moveResult.value) {
                            polyline.vertices[currentVertexIndex] = {
                                x: moveResult.value.x,
                                y: moveResult.value.y
                            };
                            currentThreeObject = this.updatePolylineDisplay(polyline, currentThreeObject, context);
                            this.showVertexMarker(polyline, currentVertexIndex, context);
                            context.commandLine.print('Vertex moved', 'success');
                        }
                        break;

                    case 'BREAK':
                        if (polyline.vertices.length > 2) {
                            polyline.vertices.splice(currentVertexIndex, 1);
                            if (currentVertexIndex >= polyline.vertices.length) {
                                currentVertexIndex = polyline.vertices.length - 1;
                            }
                            currentThreeObject = this.updatePolylineDisplay(polyline, currentThreeObject, context);
                            this.showVertexMarker(polyline, currentVertexIndex, context);
                            context.commandLine.print('Vertex deleted', 'success');
                        } else {
                            context.commandLine.print('Cannot delete - polyline needs at least 2 vertices', 'error');
                        }
                        break;

                    case 'EXIT':
                        continueEditing = false;
                        break;
                }
            }
        }

        // Clear vertex marker
        context.renderer.cancelDrawing();

        return currentThreeObject;
    }

    private showVertexMarker(polyline: DxfPolyline, index: number, context: EditorContext): void {
        const vertex = polyline.vertices[index];
        context.renderer.cancelDrawing();
        context.renderer.addDrawingPoint(vertex.x, vertex.y);
        context.commandLine.print(`Vertex ${index + 1} of ${polyline.vertices.length}: (${vertex.x.toFixed(4)}, ${vertex.y.toFixed(4)})`, 'response');
    }
}
