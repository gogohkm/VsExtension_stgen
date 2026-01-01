/**
 * DXF Viewer Webview Main Entry Point
 */

import './styles.css';
import { DxfParser, ParsedDxf, DxfEntity, DxfLine, DxfCircle, DxfArc, DxfPolyline, DxfText, DxfPoint_, DxfEllipse, DxfSpline, DxfHatch, DxfDimension } from './dxfParser';
import { DxfRenderer, SnapType, SnapPoint, DrawingMode } from './dxfRenderer';
import { AnnotationManager, AnnotationType } from './annotationManager';
import { AcEdCommandLineUI } from './editor/ui/AcEdCommandLineUI';
import { AcEdCommandStack } from './editor/command/AcEdCommandStack';
import { registerCadCommands } from './editor/AcEdCommandRegistry';

declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

class DxfViewerApp {
    private vscode = acquireVsCodeApi();
    private renderer: DxfRenderer | null = null;
    private annotationManager: AnnotationManager | null = null;
    private commandLine: AcEdCommandLineUI | null = null;
    private parsedDxf: ParsedDxf | null = null;
    private fileName: string = '';

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    private setup(): void {
        const container = document.getElementById('viewer-container');
        if (!container) {
            console.error('Viewer container not found');
            return;
        }

        // Initialize renderer
        this.renderer = new DxfRenderer(container);
        this.annotationManager = new AnnotationManager(
            this.renderer.getScene(),
            this.renderer.getAnnotationGroup(),
            () => this.renderer?.render(),
            () => this.renderer!.getCamera()
        );

        // Register CAD commands to the command stack
        registerCadCommands();

        // Initialize command line UI
        this.commandLine = new AcEdCommandLineUI();
        this.commandLine.setRenderer(this.renderer);

        // Register utility commands (non-CAD commands)
        this.registerUtilityCommands();

        // Setup UI event listeners
        this.setupToolbarEvents();
        this.setupLayerPanel();
        this.setupPropertiesPanel();

        // Setup message handler
        window.addEventListener('message', (event) => {
            this.handleMessage(event.data);
        });

        // Setup keyboard shortcuts
        this.setupKeyboardEvents();

        // Setup snap marker display on mousemove
        this.setupSnapMarkerEvents();

        // Notify extension that we're ready
        this.vscode.postMessage({ type: 'ready' });
        this.setStatus('Ready');
    }

    private setupKeyboardEvents(): void {
        window.addEventListener('keydown', (e) => {
            // Check if command input is focused - if so, don't intercept most keys
            const commandInput = document.getElementById('command-input');
            const isCommandInputFocused = document.activeElement === commandInput;

            // Always handle Escape to cancel operations
            if (e.key === 'Escape') {
                if (this.renderer?.isDrawing()) {
                    this.cancelDrawing();
                    this.commandLine?.completeCommand();
                } else if (this.annotationManager?.isAnnotationMode()) {
                    this.annotationManager.cancelAnnotation();
                    this.setAnnotationModeIndicator(false);
                } else if (this.renderer) {
                    this.renderer.clearSelection();
                }
                e.preventDefault();
                return;
            }

            // If command input is focused, let it handle most keys
            if (isCommandInputFocused) {
                return;
            }

            // Delete selected entities
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.renderer) {
                    const count = this.renderer.deleteSelectedEntities();
                    if (count > 0) {
                        this.setStatus(`Deleted ${count} ${count === 1 ? 'entity' : 'entities'}`);
                        this.commandLine?.print(`Deleted ${count} ${count === 1 ? 'entity' : 'entities'}`, 'success');
                        e.preventDefault();
                    }
                }
            }

            // Fit view
            if (e.key === 'f' || e.key === 'F') {
                if (!e.ctrlKey && !e.metaKey) {
                    this.renderer?.fitView();
                    this.commandLine?.print('View fitted to extents', 'success');
                    e.preventDefault();
                }
            }

            // Select all (Ctrl+A)
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                // Reserved for future select all functionality
            }

            // Toggle snap (S key)
            if (e.key === 's' || e.key === 'S') {
                if (!e.ctrlKey && !e.metaKey) {
                    this.toggleSnap();
                    e.preventDefault();
                }
            }

            // Line drawing tool (L key)
            if (e.key === 'l' || e.key === 'L') {
                if (!e.ctrlKey && !e.metaKey) {
                    this.startDrawingLine();
                    e.preventDefault();
                }
            }

            // Circle drawing tool (C key)
            if (e.key === 'c' || e.key === 'C') {
                if (!e.ctrlKey && !e.metaKey) {
                    this.startDrawingCircle();
                    e.preventDefault();
                }
            }

            // Focus command line with any letter key
            if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                // Focus command input and pass the key
                commandInput?.focus();
            }
        });
    }

    private registerUtilityCommands(): void {
        if (!this.commandLine) return;

        // HELP command
        this.commandLine.registerSimpleCommand({
            name: 'HELP',
            aliases: ['?', 'H'],
            description: 'Show available commands',
            execute: () => {
                this.commandLine?.print('Available commands:', 'response');

                // Get CAD commands from command stack
                const stack = AcEdCommandStack.instance;
                const cadCommands = stack.getAllCommands();

                for (const item of cadCommands) {
                    const cmd = item.command;
                    const alias = cmd.localName !== cmd.globalName ? ` (${cmd.localName})` : '';
                    this.commandLine?.print(`  ${cmd.globalName}${alias} - ${cmd.description}`, 'response');
                }

                this.commandLine?.print('', 'response');
                this.commandLine?.print('Utility commands:', 'response');
                this.commandLine?.print('  HELP (?, H) - Show this help', 'response');
                this.commandLine?.print('  CAPTURE (CAP) - Capture current view', 'response');
                this.commandLine?.print('  EXTRACT (EXT) - Extract entity data', 'response');
                this.commandLine?.print('  ZOOM (Z) - Zoom view (E=Extents)', 'response');
                this.commandLine?.print('  FIT (F) - Fit view to extents', 'response');
                this.commandLine?.print('  DELETE (DEL, ERASE) - Delete selected', 'response');
                this.commandLine?.print('  UNDO (U) - Undo last action', 'response');
                this.commandLine?.print('  REDO - Redo last action', 'response');
            }
        });

        // CAPTURE command
        this.commandLine.registerSimpleCommand({
            name: 'CAPTURE',
            aliases: ['CAP', 'SCREENSHOT'],
            description: 'Capture current view as image',
            execute: () => {
                this.captureView();
                this.commandLine?.print('View captured', 'success');
            }
        });

        // EXTRACT command
        this.commandLine.registerSimpleCommand({
            name: 'EXTRACT',
            aliases: ['EXT'],
            description: 'Extract entity data',
            execute: () => {
                this.extractEntities();
                this.commandLine?.print('Entities extracted', 'success');
            }
        });

        // ANNOTATE commands
        this.commandLine.registerSimpleCommand({
            name: 'TEXT',
            aliases: ['T', 'DTEXT'],
            description: 'Add text annotation',
            execute: () => {
                this.startAnnotation('text');
                this.commandLine?.print('Click to place text annotation', 'prompt');
            }
        });

        this.commandLine.registerSimpleCommand({
            name: 'ARROW',
            aliases: ['LEADER', 'LE'],
            description: 'Add arrow annotation',
            execute: () => {
                this.startAnnotation('arrow');
                this.commandLine?.print('Click start point for arrow', 'prompt');
            }
        });

        this.commandLine.registerSimpleCommand({
            name: 'RECTANGLE',
            aliases: ['REC', 'RECT'],
            description: 'Add rectangle annotation',
            execute: () => {
                this.startAnnotation('rectangle');
                this.commandLine?.print('Click first corner of rectangle', 'prompt');
            }
        });

        // CLEARANNO command
        this.commandLine.registerSimpleCommand({
            name: 'CLEARANNO',
            aliases: ['CA'],
            description: 'Clear all annotations',
            execute: () => {
                this.annotationManager?.clearAll();
                this.renderer?.render();
                this.commandLine?.print('All annotations cleared', 'success');
            }
        });

        // DELETE command
        this.commandLine.registerSimpleCommand({
            name: 'DELETE',
            aliases: ['DEL', 'ERASE', 'E'],
            description: 'Delete selected entities',
            execute: () => {
                if (this.renderer) {
                    const count = this.renderer.deleteSelectedEntities();
                    if (count > 0) {
                        this.commandLine?.print(`Deleted ${count} ${count === 1 ? 'entity' : 'entities'}`, 'success');
                    } else {
                        this.commandLine?.print('No entities selected', 'error');
                    }
                }
            }
        });

        // ZOOM commands
        this.commandLine.registerSimpleCommand({
            name: 'ZOOM',
            aliases: ['Z'],
            description: 'Zoom view',
            execute: () => {
                this.renderer?.fitView();
                this.commandLine?.print('Zoom extents', 'success');
            }
        });

        // FIT command
        this.commandLine.registerSimpleCommand({
            name: 'FIT',
            aliases: ['F', 'ZE'],
            description: 'Fit view to extents',
            execute: () => {
                this.renderer?.fitView();
                this.commandLine?.print('View fitted to extents', 'success');
            }
        });

        // REGEN command
        this.commandLine.registerSimpleCommand({
            name: 'REGEN',
            aliases: ['RE'],
            description: 'Regenerate drawing',
            execute: () => {
                this.renderer?.render();
                this.commandLine?.print('Drawing regenerated', 'success');
            }
        });

        // SNAP command
        this.commandLine.registerSimpleCommand({
            name: 'SNAP',
            aliases: ['SN'],
            description: 'Toggle snap mode',
            execute: () => {
                if (this.renderer) {
                    const enabled = this.renderer.toggleSnap();
                    this.commandLine?.print(`Snap ${enabled ? 'ON' : 'OFF'}`, 'success');
                }
            }
        });

        // UNDO command
        this.commandLine.registerSimpleCommand({
            name: 'UNDO',
            aliases: ['U'],
            description: 'Undo last action',
            execute: () => {
                if (this.renderer) {
                    this.renderer.undo();
                    this.commandLine?.print('Undo', 'success');
                }
            }
        });

        // REDO command
        this.commandLine.registerSimpleCommand({
            name: 'REDO',
            aliases: [],
            description: 'Redo last action',
            execute: () => {
                if (this.renderer) {
                    this.renderer.redo();
                    this.commandLine?.print('Redo', 'success');
                }
            }
        });

        // LAYER command
        this.commandLine.registerSimpleCommand({
            name: 'LAYER',
            aliases: ['LA'],
            description: 'Open layer panel',
            execute: () => {
                const layerPanel = document.getElementById('layer-panel');
                if (layerPanel) {
                    layerPanel.classList.toggle('visible');
                    this.commandLine?.print('Layer panel toggled', 'success');
                }
            }
        });

        // PROPERTIES command
        this.commandLine.registerSimpleCommand({
            name: 'PROPERTIES',
            aliases: ['PR', 'PROPS'],
            description: 'Open properties panel',
            execute: () => {
                const propsPanel = document.getElementById('properties-panel');
                if (propsPanel) {
                    propsPanel.classList.toggle('visible');
                    this.commandLine?.print('Properties panel toggled', 'success');
                }
            }
        });

        // CLEAR command
        this.commandLine.registerSimpleCommand({
            name: 'CLEAR',
            aliases: ['CLS'],
            description: 'Clear command history',
            execute: () => {
                this.commandLine?.clearHistory();
                this.commandLine?.print('Command history cleared', 'success');
            }
        });
    }

    private setupSnapMarkerEvents(): void {
        const container = document.getElementById('viewer-container');
        if (!container || !this.renderer) return;

        container.addEventListener('mousemove', (e) => {
            if (!this.renderer) return;

            // Update snap marker based on cursor position
            const snapPoint = this.renderer.updateSnapMarker(e.clientX, e.clientY);

            // Update status bar with snap info
            if (snapPoint) {
                this.updateSnapStatus(snapPoint);
            }

            // Update rubber band if in drawing mode
            if (this.renderer.isDrawing()) {
                this.renderer.updateRubberBand(e.clientX, e.clientY);
            }

            // Pass mouse move to command line for jig updates
            const worldPoint = this.renderer.screenToWorld(e.clientX, e.clientY);
            if (worldPoint) {
                this.commandLine?.handleMouseMove(worldPoint.x, worldPoint.y);
            }
        });

        container.addEventListener('mouseleave', () => {
            if (this.renderer) {
                this.renderer.clearSnapMarker();
            }
        });

        // Handle clicks for drawing mode and command input
        container.addEventListener('click', (e) => {
            if (!this.renderer) return;

            // Get world coordinates
            const worldPoint = this.renderer.screenToWorld(e.clientX, e.clientY);

            // Pass click to command line for AcEditor handling
            if (worldPoint) {
                this.commandLine?.handleMouseClick(worldPoint.x, worldPoint.y);
            }

            // Legacy drawing mode handling (for non-command drawing)
            if (this.renderer.isDrawing()) {
                const mode = this.renderer.getDrawingMode();
                const entity = this.renderer.handleDrawingClick(e.clientX, e.clientY);

                if (entity) {
                    this.setStatus(`Created ${entity.type} on layer "${entity.layer}"`);

                    // Update prompt for continuous drawing (AutoCAD style)
                    this.updateDrawingPrompt(mode);
                } else {
                    // First point was set, show next point prompt
                    this.updateDrawingPrompt(mode, true);
                }

                this.updateDrawingModeIndicator();
                e.stopPropagation();
            }
        });
    }

    private toggleSnap(): void {
        if (!this.renderer) return;

        const enabled = !this.renderer.isSnapEnabled();
        this.renderer.setSnapEnabled(enabled);

        const btn = document.getElementById('btn-snap');
        btn?.classList.toggle('active', enabled);

        this.setStatus(enabled ? 'Snap enabled' : 'Snap disabled');
    }

    private updateSnapStatus(snapPoint: SnapPoint): void {
        const snapTypeNames: Record<SnapType, string> = {
            [SnapType.ENDPOINT]: 'Endpoint',
            [SnapType.MIDPOINT]: 'Midpoint',
            [SnapType.CENTER]: 'Center',
            [SnapType.QUADRANT]: 'Quadrant',
            [SnapType.INTERSECTION]: 'Intersection',
            [SnapType.NEAREST]: 'Nearest'
        };

        const coordsEl = document.getElementById('coords');
        if (coordsEl) {
            coordsEl.textContent = `SNAP: ${snapTypeNames[snapPoint.type]} (${snapPoint.position.x.toFixed(2)}, ${snapPoint.position.y.toFixed(2)})`;
        }
    }

    private startDrawingLine(): void {
        if (!this.renderer) return;

        // Cancel any annotation mode
        if (this.annotationManager?.isAnnotationMode()) {
            this.annotationManager.cancelAnnotation();
            this.setAnnotationModeIndicator(false);
        }

        this.renderer.startDrawingLine();
        this.updateDrawingModeIndicator();
        this.setStatus('Line: Click first point');
    }

    private startDrawingCircle(): void {
        if (!this.renderer) return;

        // Cancel any annotation mode
        if (this.annotationManager?.isAnnotationMode()) {
            this.annotationManager.cancelAnnotation();
            this.setAnnotationModeIndicator(false);
        }

        this.renderer.startDrawingCircle();
        this.updateDrawingModeIndicator();
        this.setStatus('Circle: Click center point');
    }

    private cancelDrawing(): void {
        if (!this.renderer) return;
        this.renderer.cancelDrawing();
        this.updateDrawingModeIndicator();
        this.setStatus('Drawing cancelled');
    }

    private updateDrawingModeIndicator(): void {
        const indicator = document.getElementById('drawing-mode-indicator');
        const btnLine = document.getElementById('btn-draw-line');
        const btnCircle = document.getElementById('btn-draw-circle');

        if (!this.renderer) {
            indicator?.classList.remove('visible');
            btnLine?.classList.remove('active');
            btnCircle?.classList.remove('active');
            return;
        }

        const mode = this.renderer.getDrawingMode();

        btnLine?.classList.toggle('active', mode === DrawingMode.LINE);
        btnCircle?.classList.toggle('active', mode === DrawingMode.CIRCLE);

        if (indicator) {
            if (mode !== DrawingMode.NONE) {
                const modeNames: Record<DrawingMode, string> = {
                    [DrawingMode.NONE]: '',
                    [DrawingMode.LINE]: 'Drawing Line - Click to set points (Esc to cancel)',
                    [DrawingMode.CIRCLE]: 'Drawing Circle - Click center, then radius (Esc to cancel)',
                    [DrawingMode.POLYLINE]: 'Drawing Polyline (Esc to cancel)'
                };
                indicator.textContent = modeNames[mode];
                indicator.classList.add('visible');
            } else {
                indicator.classList.remove('visible');
            }
        }
    }

    private updateDrawingPrompt(mode: DrawingMode, firstPointSet: boolean = false): void {
        if (!this.commandLine) return;

        switch (mode) {
            case DrawingMode.LINE:
                if (firstPointSet) {
                    // After first point is set, prompt for next point
                    this.commandLine.print('Specify next point:', 'prompt');
                    this.commandLine.setPrompt('Next point:');
                } else {
                    // After line is created, prompt for next point (continuous)
                    this.commandLine.print('Specify next point or [Esc] to finish:', 'prompt');
                    this.commandLine.setPrompt('Next point:');
                }
                break;
            case DrawingMode.CIRCLE:
                if (firstPointSet) {
                    // After center is set, prompt for radius
                    this.commandLine.print('Specify radius:', 'prompt');
                    this.commandLine.setPrompt('Radius:');
                } else {
                    // After circle is created, prompt for new center (continuous)
                    this.commandLine.print('Specify center point:', 'prompt');
                    this.commandLine.setPrompt('Center:');
                }
                break;
        }
    }

    private setupToolbarEvents(): void {
        // Zoom controls
        document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
            this.renderer?.fitView();
        });

        document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
            this.renderer?.zoomIn();
        });

        document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
            this.renderer?.zoomOut();
        });

        // Capture and extract
        document.getElementById('btn-capture')?.addEventListener('click', () => {
            this.captureView();
        });

        document.getElementById('btn-extract')?.addEventListener('click', () => {
            this.extractEntities();
        });

        // Annotation tools
        document.getElementById('btn-annotate-text')?.addEventListener('click', () => {
            this.startAnnotation('text');
        });

        document.getElementById('btn-annotate-arrow')?.addEventListener('click', () => {
            this.startAnnotation('arrow');
        });

        document.getElementById('btn-annotate-rect')?.addEventListener('click', () => {
            this.startAnnotation('rectangle');
        });

        document.getElementById('btn-clear-annotations')?.addEventListener('click', () => {
            this.annotationManager?.clearAll();
            this.renderer?.render();
        });

        // Annotation save/load
        document.getElementById('btn-save-annotations')?.addEventListener('click', () => {
            this.saveAnnotations();
        });

        document.getElementById('btn-load-annotations')?.addEventListener('click', () => {
            this.requestLoadAnnotations();
        });

        // Layer panel toggle
        document.getElementById('btn-layers')?.addEventListener('click', () => {
            this.toggleLayerPanel();
        });

        // Properties panel toggle
        document.getElementById('btn-properties')?.addEventListener('click', () => {
            this.togglePropertiesPanel();
        });

        // Snap toggle
        document.getElementById('btn-snap')?.addEventListener('click', () => {
            this.toggleSnap();
        });

        // Drawing tools
        document.getElementById('btn-draw-line')?.addEventListener('click', () => {
            this.startDrawingLine();
        });

        document.getElementById('btn-draw-circle')?.addEventListener('click', () => {
            this.startDrawingCircle();
        });
    }

    private setupPropertiesPanel(): void {
        // Close button
        document.getElementById('btn-properties-close')?.addEventListener('click', () => {
            this.togglePropertiesPanel(false);
        });
    }

    private togglePropertiesPanel(visible?: boolean): void {
        const panel = document.getElementById('properties-panel');
        const btn = document.getElementById('btn-properties');

        if (!panel) return;

        if (visible === undefined) {
            panel.classList.toggle('visible');
        } else if (visible) {
            panel.classList.add('visible');
        } else {
            panel.classList.remove('visible');
        }

        const isVisible = panel.classList.contains('visible');
        btn?.classList.toggle('active', isVisible);

        if (isVisible) {
            this.updatePropertiesPanel();
        }
    }

    updatePropertiesPanel(): void {
        const content = document.getElementById('properties-content');
        if (!content || !this.renderer) return;

        const selected = this.renderer.getSelectedEntities();

        if (selected.length === 0) {
            content.innerHTML = '<div class="no-selection">No entity selected</div>';
            return;
        }

        if (selected.length > 1) {
            content.innerHTML = `<div class="no-selection">${selected.length} entities selected</div>`;
            return;
        }

        const entity = selected[0].userData.entity;
        if (!entity) {
            content.innerHTML = '<div class="no-selection">No properties available</div>';
            return;
        }

        const html: string[] = [];

        // General properties
        html.push('<div class="property-group">');
        html.push('<div class="property-group-title">General</div>');
        html.push(`<div class="property-row"><span class="property-label">Type</span><span class="property-value">${entity.type}</span></div>`);
        html.push(`<div class="property-row"><span class="property-label">Layer</span><span class="property-value">${entity.layer}</span></div>`);
        if (entity.handle) {
            html.push(`<div class="property-row"><span class="property-label">Handle</span><span class="property-value">${entity.handle}</span></div>`);
        }
        if (entity.lineType) {
            html.push(`<div class="property-row"><span class="property-label">Linetype</span><span class="property-value">${entity.lineType}</span></div>`);
        }
        html.push('</div>');

        // Type-specific properties
        html.push('<div class="property-group">');
        html.push('<div class="property-group-title">Geometry</div>');
        this.addEntityProperties(entity, html);
        html.push('</div>');

        content.innerHTML = html.join('');
    }

    private addEntityProperties(entity: any, html: string[]): void {
        switch (entity.type) {
            case 'LINE':
                html.push(`<div class="property-row"><span class="property-label">Start X</span><span class="property-value">${entity.start.x.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Start Y</span><span class="property-value">${entity.start.y.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">End X</span><span class="property-value">${entity.end.x.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">End Y</span><span class="property-value">${entity.end.y.toFixed(4)}</span></div>`);
                const lineLen = Math.sqrt(Math.pow(entity.end.x - entity.start.x, 2) + Math.pow(entity.end.y - entity.start.y, 2));
                html.push(`<div class="property-row"><span class="property-label">Length</span><span class="property-value">${lineLen.toFixed(4)}</span></div>`);
                break;
            case 'CIRCLE':
                html.push(`<div class="property-row"><span class="property-label">Center X</span><span class="property-value">${entity.center.x.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Center Y</span><span class="property-value">${entity.center.y.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Radius</span><span class="property-value">${entity.radius.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Diameter</span><span class="property-value">${(entity.radius * 2).toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Circumf.</span><span class="property-value">${(entity.radius * 2 * Math.PI).toFixed(4)}</span></div>`);
                break;
            case 'ARC':
                html.push(`<div class="property-row"><span class="property-label">Center X</span><span class="property-value">${entity.center.x.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Center Y</span><span class="property-value">${entity.center.y.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Radius</span><span class="property-value">${entity.radius.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Start Angle</span><span class="property-value">${entity.startAngle.toFixed(2)}°</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">End Angle</span><span class="property-value">${entity.endAngle.toFixed(2)}°</span></div>`);
                break;
            case 'TEXT':
            case 'MTEXT':
                html.push(`<div class="property-row"><span class="property-label">Position X</span><span class="property-value">${entity.position.x.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Position Y</span><span class="property-value">${entity.position.y.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Height</span><span class="property-value">${entity.height.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Text</span><span class="property-value" title="${entity.text}">${entity.text.substring(0, 15)}${entity.text.length > 15 ? '...' : ''}</span></div>`);
                break;
            case 'POLYLINE':
            case 'LWPOLYLINE':
                html.push(`<div class="property-row"><span class="property-label">Vertices</span><span class="property-value">${entity.vertices.length}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Closed</span><span class="property-value">${entity.closed ? 'Yes' : 'No'}</span></div>`);
                break;
            case 'INSERT':
                html.push(`<div class="property-row"><span class="property-label">Block Name</span><span class="property-value">${entity.blockName}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Position X</span><span class="property-value">${entity.position.x.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Position Y</span><span class="property-value">${entity.position.y.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Scale X</span><span class="property-value">${entity.scale.x.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Scale Y</span><span class="property-value">${entity.scale.y.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Rotation</span><span class="property-value">${entity.rotation.toFixed(2)}°</span></div>`);
                break;
            case 'ELLIPSE':
                html.push(`<div class="property-row"><span class="property-label">Center X</span><span class="property-value">${entity.center.x.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Center Y</span><span class="property-value">${entity.center.y.toFixed(4)}</span></div>`);
                html.push(`<div class="property-row"><span class="property-label">Ratio</span><span class="property-value">${entity.ratio.toFixed(4)}</span></div>`);
                break;
            default:
                html.push(`<div class="property-row"><span class="property-label">-</span><span class="property-value">N/A</span></div>`);
        }
    }

    private setupLayerPanel(): void {
        // Close button
        document.getElementById('btn-layers-close')?.addEventListener('click', () => {
            this.toggleLayerPanel(false);
        });

        // Show all layers
        document.getElementById('btn-layers-all')?.addEventListener('click', () => {
            this.renderer?.toggleAllLayers(true);
            this.updateLayerList();
        });

        // Hide all layers
        document.getElementById('btn-layers-none')?.addEventListener('click', () => {
            this.renderer?.toggleAllLayers(false);
            this.updateLayerList();
        });
    }

    private toggleLayerPanel(visible?: boolean): void {
        const panel = document.getElementById('layer-panel');
        const btn = document.getElementById('btn-layers');

        if (!panel) return;

        if (visible === undefined) {
            panel.classList.toggle('visible');
        } else if (visible) {
            panel.classList.add('visible');
        } else {
            panel.classList.remove('visible');
        }

        const isVisible = panel.classList.contains('visible');
        btn?.classList.toggle('active', isVisible);

        if (isVisible) {
            this.updateLayerList();
        }
    }

    private updateLayerList(): void {
        const listContainer = document.getElementById('layer-list');
        if (!listContainer || !this.renderer) return;

        const layers = this.renderer.getLayers();
        listContainer.innerHTML = '';

        for (const layer of layers) {
            const item = document.createElement('div');
            item.className = 'layer-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = layer.visible;
            checkbox.addEventListener('change', () => {
                this.renderer?.toggleLayerVisibility(layer.name, checkbox.checked);
            });

            const colorBox = document.createElement('div');
            colorBox.className = 'layer-color';
            colorBox.style.backgroundColor = '#' + layer.color.toString(16).padStart(6, '0');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            nameSpan.title = layer.name;

            const countSpan = document.createElement('span');
            countSpan.className = 'layer-count';
            countSpan.textContent = `(${layer.entityCount})`;

            item.appendChild(checkbox);
            item.appendChild(colorBox);
            item.appendChild(nameSpan);
            item.appendChild(countSpan);

            // Click on layer item toggles visibility
            item.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.renderer?.toggleLayerVisibility(layer.name, checkbox.checked);
                }
            });

            listContainer.appendChild(item);
        }
    }

    private handleMessage(message: any): void {
        switch (message.type) {
            case 'loadDxf':
                this.loadDxf(message.data, message.fileName);
                break;
            case 'requestCapture':
                this.captureView();
                break;
            case 'requestEntities':
                this.extractEntities();
                break;
            case 'fitView':
                this.renderer?.fitView();
                break;
            case 'startAnnotation':
                this.startAnnotation('text');
                break;
            case 'clearAnnotations':
                this.annotationManager?.clearAll();
                this.renderer?.render();
                break;
            case 'loadAnnotations':
                this.loadAnnotations(message.data);
                break;
            // MCP Bridge requests
            case 'mcp_capture':
                this.handleMcpCapture(message.requestId);
                break;
            case 'mcp_entities':
                this.handleMcpEntities(message.requestId, message.options);
                break;
            case 'mcp_layers':
                this.handleMcpLayers(message.requestId);
                break;
            case 'mcp_summary':
                this.handleMcpSummary(message.requestId);
                break;
        }
    }

    private loadDxf(dxfString: string, fileName: string): void {
        this.showLoading(true);
        this.fileName = fileName;

        try {
            const parser = new DxfParser();
            this.parsedDxf = parser.parse(dxfString);

            // Debug: Log block information
            console.log(`Parsed ${this.parsedDxf.blocks.size} blocks:`);
            for (const [name, block] of this.parsedDxf.blocks) {
                console.log(`  Block "${name}": ${block.entities.length} entities, base=(${block.basePoint.x}, ${block.basePoint.y})`);
            }

            // Debug: Count INSERT entities
            const insertCount = this.parsedDxf.entities.filter(e => e.type === 'INSERT').length;
            console.log(`Found ${insertCount} INSERT entities in ENTITIES section`);

            if (this.renderer) {
                this.renderer.loadDxf(this.parsedDxf);
            }

            // Update layer panel if visible
            this.updateLayerList();

            const entityCount = this.parsedDxf.entities.length;
            const layerCount = this.parsedDxf.layers.size;
            const blockCount = this.parsedDxf.blocks.size;
            this.setStatus(`Loaded: ${fileName} (${entityCount} entities, ${layerCount} layers, ${blockCount} blocks)`);

            this.vscode.postMessage({
                type: 'info',
                message: `Loaded ${fileName}: ${entityCount} entities, ${blockCount} blocks, ${insertCount} inserts`
            });

            // Auto-load annotations if they exist
            this.requestLoadAnnotations();

        } catch (error) {
            console.error('Failed to parse DXF:', error);
            this.setStatus('Error loading DXF file');
            this.vscode.postMessage({
                type: 'error',
                message: `Failed to parse DXF: ${error}`
            });
        } finally {
            this.showLoading(false);
        }
    }

    private captureView(): void {
        if (!this.renderer) {
            return;
        }

        const dataUrl = this.renderer.captureImage();
        this.vscode.postMessage({
            type: 'captured',
            data: dataUrl
        });
    }

    private extractEntities(): void {
        if (!this.parsedDxf) {
            this.vscode.postMessage({
                type: 'error',
                message: 'No DXF file loaded'
            });
            return;
        }

        const summary = this.formatEntitiesForAI(this.parsedDxf);
        this.vscode.postMessage({
            type: 'entitiesExtracted',
            data: summary
        });
    }

    private formatEntitiesForAI(dxf: ParsedDxf): string {
        const lines: string[] = [];

        lines.push(`# DXF File Analysis: ${this.fileName}`);
        lines.push('');

        // Summary
        lines.push('## Summary');
        lines.push(`- Total Entities: ${dxf.entities.length}`);
        lines.push(`- Layers: ${dxf.layers.size}`);
        lines.push(`- Blocks: ${dxf.blocks.size}`);
        lines.push('');

        // Bounds
        lines.push('## Drawing Bounds');
        lines.push(`- Min: (${dxf.bounds.minX.toFixed(2)}, ${dxf.bounds.minY.toFixed(2)})`);
        lines.push(`- Max: (${dxf.bounds.maxX.toFixed(2)}, ${dxf.bounds.maxY.toFixed(2)})`);
        lines.push(`- Size: ${(dxf.bounds.maxX - dxf.bounds.minX).toFixed(2)} x ${(dxf.bounds.maxY - dxf.bounds.minY).toFixed(2)}`);
        lines.push('');

        // Entity type counts
        const typeCounts = new Map<string, number>();
        for (const entity of dxf.entities) {
            typeCounts.set(entity.type, (typeCounts.get(entity.type) || 0) + 1);
        }

        lines.push('## Entity Types');
        for (const [type, count] of typeCounts) {
            lines.push(`- ${type}: ${count}`);
        }
        lines.push('');

        // Layer info
        if (dxf.layers.size > 0) {
            lines.push('## Layers');
            for (const [name, layer] of dxf.layers) {
                const status = layer.frozen ? ' (frozen)' : layer.off ? ' (off)' : '';
                lines.push(`- ${name}: color=${layer.color}${status}`);
            }
            lines.push('');
        }

        // Entity details (limited to first 50 for performance)
        lines.push('## Entity Details (first 50)');
        const entities = dxf.entities.slice(0, 50);
        for (const entity of entities) {
            lines.push(this.formatEntityDetail(entity));
        }

        if (dxf.entities.length > 50) {
            lines.push(`... and ${dxf.entities.length - 50} more entities`);
        }

        return lines.join('\n');
    }

    private formatEntityDetail(entity: DxfEntity): string {
        const handle = entity.handle ? ` [${entity.handle}]` : '';
        const layer = entity.layer !== '0' ? ` layer=${entity.layer}` : '';

        switch (entity.type) {
            case 'LINE': {
                const line = entity as DxfLine;
                return `- LINE${handle}${layer}: (${line.start.x.toFixed(2)}, ${line.start.y.toFixed(2)}) → (${line.end.x.toFixed(2)}, ${line.end.y.toFixed(2)})`;
            }
            case 'CIRCLE': {
                const circle = entity as DxfCircle;
                return `- CIRCLE${handle}${layer}: center=(${circle.center.x.toFixed(2)}, ${circle.center.y.toFixed(2)}) r=${circle.radius.toFixed(2)}`;
            }
            case 'ARC': {
                const arc = entity as DxfArc;
                return `- ARC${handle}${layer}: center=(${arc.center.x.toFixed(2)}, ${arc.center.y.toFixed(2)}) r=${arc.radius.toFixed(2)} ${arc.startAngle.toFixed(1)}°→${arc.endAngle.toFixed(1)}°`;
            }
            case 'POLYLINE':
            case 'LWPOLYLINE': {
                const polyline = entity as DxfPolyline;
                const closed = polyline.closed ? ' (closed)' : '';
                return `- ${entity.type}${handle}${layer}: ${polyline.vertices.length} vertices${closed}`;
            }
            case 'TEXT':
            case 'MTEXT': {
                const text = entity as DxfText;
                const textContent = text.text.length > 30 ? text.text.substring(0, 30) + '...' : text.text;
                return `- ${entity.type}${handle}${layer}: "${textContent}" at (${text.position.x.toFixed(2)}, ${text.position.y.toFixed(2)}) h=${text.height.toFixed(2)}`;
            }
            case 'POINT': {
                const point = entity as DxfPoint_;
                return `- POINT${handle}${layer}: (${point.position.x.toFixed(2)}, ${point.position.y.toFixed(2)})`;
            }
            case 'ELLIPSE': {
                const ellipse = entity as DxfEllipse;
                const majorLen = Math.sqrt(ellipse.majorAxisEndpoint.x ** 2 + ellipse.majorAxisEndpoint.y ** 2);
                return `- ELLIPSE${handle}${layer}: center=(${ellipse.center.x.toFixed(2)}, ${ellipse.center.y.toFixed(2)}) major=${majorLen.toFixed(2)} ratio=${ellipse.ratio.toFixed(2)}`;
            }
            case 'SPLINE': {
                const spline = entity as DxfSpline;
                const closed = spline.closed ? ' (closed)' : '';
                return `- SPLINE${handle}${layer}: degree=${spline.degree} ${spline.controlPoints.length} control points${closed}`;
            }
            case 'HATCH': {
                const hatch = entity as DxfHatch;
                const solid = hatch.solid ? 'solid' : hatch.patternName;
                return `- HATCH${handle}${layer}: ${solid} ${hatch.boundaryPaths.length} boundaries`;
            }
            case 'DIMENSION': {
                const dimension = entity as DxfDimension;
                const text = dimension.text ? ` "${dimension.text}"` : '';
                return `- DIMENSION${handle}${layer}:${text} at (${dimension.middlePoint.x.toFixed(2)}, ${dimension.middlePoint.y.toFixed(2)})`;
            }
            default:
                return `- ${entity.type}${handle}${layer}`;
        }
    }

    private startAnnotation(type: AnnotationType): void {
        if (!this.annotationManager) {
            return;
        }

        // Toggle annotation mode
        const isActive = this.annotationManager.isAnnotationMode();
        if (isActive) {
            this.annotationManager.cancelAnnotation();
            this.setAnnotationModeIndicator(false);
        } else {
            this.annotationManager.startAnnotation(type);
            this.setAnnotationModeIndicator(true, type);
        }
    }

    private setAnnotationModeIndicator(visible: boolean, type?: AnnotationType): void {
        const buttons = ['btn-annotate-text', 'btn-annotate-arrow', 'btn-annotate-rect'];
        buttons.forEach(id => {
            document.getElementById(id)?.classList.remove('active');
        });

        if (visible && type) {
            const buttonMap: Record<AnnotationType, string> = {
                'text': 'btn-annotate-text',
                'arrow': 'btn-annotate-arrow',
                'rectangle': 'btn-annotate-rect',
                'circle': 'btn-annotate-rect',
                'line': 'btn-annotate-arrow'
            };
            document.getElementById(buttonMap[type])?.classList.add('active');
        }
    }

    private saveAnnotations(): void {
        if (!this.annotationManager) {
            return;
        }

        const data = this.annotationManager.serialize();
        this.vscode.postMessage({
            type: 'saveAnnotations',
            data: data
        });
    }

    private requestLoadAnnotations(): void {
        this.vscode.postMessage({
            type: 'loadAnnotations'
        });
    }

    private loadAnnotations(data: string): void {
        if (!this.annotationManager) {
            return;
        }

        this.annotationManager.deserialize(data);
        this.renderer?.render();
        this.setStatus('Annotations loaded');
    }

    private showLoading(visible: boolean): void {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = visible ? 'flex' : 'none';
        }
    }

    private setStatus(text: string): void {
        const status = document.getElementById('status-text');
        if (status) {
            status.textContent = text;
        }
    }

    // --- MCP Bridge Handlers ---

    private handleMcpCapture(requestId: string): void {
        if (!this.renderer) {
            this.sendMcpResponse(requestId, { error: 'Renderer not initialized' });
            return;
        }

        const dataUrl = this.renderer.captureImage();
        // Extract base64 data from data URL
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

        this.sendMcpResponse(requestId, {
            imageData: base64Data,
            width: this.renderer.getWidth(),
            height: this.renderer.getHeight()
        });
    }

    private handleMcpEntities(requestId: string, options: { format?: string; limit?: number; layers?: string[]; types?: string[] }): void {
        if (!this.parsedDxf) {
            this.sendMcpResponse(requestId, { error: 'No DXF file loaded' });
            return;
        }

        const format = options?.format || 'markdown';
        const limit = options?.limit || 100;
        const layers = options?.layers;
        const types = options?.types;

        // Filter entities
        let entities = this.parsedDxf.entities;

        if (layers && layers.length > 0) {
            entities = entities.filter(e => layers.includes(e.layer));
        }

        if (types && types.length > 0) {
            entities = entities.filter(e => types.includes(e.type));
        }

        // Apply limit
        const limitedEntities = entities.slice(0, limit);

        let data: string;

        if (format === 'json') {
            data = JSON.stringify({
                fileName: this.fileName,
                totalCount: entities.length,
                returnedCount: limitedEntities.length,
                entities: limitedEntities.map(e => this.entityToJson(e))
            }, null, 2);
        } else if (format === 'summary') {
            data = this.formatEntitiesSummary(entities);
        } else {
            // markdown format
            data = this.formatEntitiesMarkdown(limitedEntities, entities.length);
        }

        this.sendMcpResponse(requestId, { data });
    }

    private handleMcpLayers(requestId: string): void {
        if (!this.renderer) {
            this.sendMcpResponse(requestId, { error: 'Renderer not initialized' });
            return;
        }

        const layers = this.renderer.getLayers();
        this.sendMcpResponse(requestId, {
            layers: layers.map(l => ({
                name: l.name,
                visible: l.visible,
                color: '#' + l.color.toString(16).padStart(6, '0'),
                entityCount: l.entityCount
            }))
        });
    }

    private handleMcpSummary(requestId: string): void {
        if (!this.parsedDxf) {
            this.sendMcpResponse(requestId, { error: 'No DXF file loaded' });
            return;
        }

        // Count entities by type
        const typeCounts: Record<string, number> = {};
        for (const entity of this.parsedDxf.entities) {
            typeCounts[entity.type] = (typeCounts[entity.type] || 0) + 1;
        }

        // Get layer names
        const layerNames = Array.from(this.parsedDxf.layers.keys());

        // Get block names
        const blockNames = Array.from(this.parsedDxf.blocks.keys());

        this.sendMcpResponse(requestId, {
            entityCount: this.parsedDxf.entities.length,
            layerCount: this.parsedDxf.layers.size,
            blockCount: this.parsedDxf.blocks.size,
            bounds: {
                minX: this.parsedDxf.bounds.minX,
                minY: this.parsedDxf.bounds.minY,
                maxX: this.parsedDxf.bounds.maxX,
                maxY: this.parsedDxf.bounds.maxY,
                width: this.parsedDxf.bounds.maxX - this.parsedDxf.bounds.minX,
                height: this.parsedDxf.bounds.maxY - this.parsedDxf.bounds.minY
            },
            entityTypes: typeCounts,
            layers: layerNames,
            blocks: blockNames
        });
    }

    private sendMcpResponse(requestId: string, data: any): void {
        this.vscode.postMessage({
            type: 'mcp_response',
            requestId: requestId,
            data: data
        });
    }

    private entityToJson(entity: DxfEntity): any {
        const base = {
            type: entity.type,
            layer: entity.layer,
            handle: entity.handle,
            lineType: entity.lineType
        };

        switch (entity.type) {
            case 'LINE': {
                const line = entity as DxfLine;
                return { ...base, start: line.start, end: line.end };
            }
            case 'CIRCLE': {
                const circle = entity as DxfCircle;
                return { ...base, center: circle.center, radius: circle.radius };
            }
            case 'ARC': {
                const arc = entity as DxfArc;
                return { ...base, center: arc.center, radius: arc.radius, startAngle: arc.startAngle, endAngle: arc.endAngle };
            }
            case 'POLYLINE':
            case 'LWPOLYLINE': {
                const poly = entity as DxfPolyline;
                return { ...base, vertices: poly.vertices, closed: poly.closed };
            }
            case 'TEXT':
            case 'MTEXT': {
                const text = entity as DxfText;
                return { ...base, position: text.position, text: text.text, height: text.height, rotation: text.rotation };
            }
            default:
                return base;
        }
    }

    private formatEntitiesSummary(entities: DxfEntity[]): string {
        const lines: string[] = [];

        lines.push(`# DXF Summary: ${this.fileName}`);
        lines.push('');
        lines.push(`Total entities: ${entities.length}`);
        lines.push('');

        // Count by type
        const typeCounts = new Map<string, number>();
        for (const entity of entities) {
            typeCounts.set(entity.type, (typeCounts.get(entity.type) || 0) + 1);
        }

        lines.push('## Entity counts by type:');
        for (const [type, count] of Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])) {
            lines.push(`- ${type}: ${count}`);
        }

        // Count by layer
        const layerCounts = new Map<string, number>();
        for (const entity of entities) {
            layerCounts.set(entity.layer, (layerCounts.get(entity.layer) || 0) + 1);
        }

        lines.push('');
        lines.push('## Entity counts by layer:');
        for (const [layer, count] of Array.from(layerCounts.entries()).sort((a, b) => b[1] - a[1])) {
            lines.push(`- ${layer}: ${count}`);
        }

        return lines.join('\n');
    }

    private formatEntitiesMarkdown(entities: DxfEntity[], totalCount: number): string {
        const lines: string[] = [];

        lines.push(`# DXF Entities: ${this.fileName}`);
        lines.push('');
        lines.push(`Showing ${entities.length} of ${totalCount} entities`);
        lines.push('');

        for (const entity of entities) {
            lines.push(this.formatEntityDetail(entity));
        }

        if (entities.length < totalCount) {
            lines.push('');
            lines.push(`... and ${totalCount - entities.length} more entities`);
        }

        return lines.join('\n');
    }
}

// Initialize app
new DxfViewerApp();
