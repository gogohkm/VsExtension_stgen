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
import { createEmptyDxf, generateDxfContent, calculateExtents } from './dxfWriter';

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
    private isNewDrawing: boolean = false;
    private hasUnsavedChanges: boolean = false;

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

        // Set up callback for when drawing is complete to update layer panel
        this.renderer.setOnDrawingComplete(() => {
            this.refreshLayerPanelIfVisible();
        });

        // Register CAD commands to the command stack
        registerCadCommands();

        // Initialize command line UI
        this.commandLine = new AcEdCommandLineUI();
        this.commandLine.setRenderer(this.renderer);

        // Set up text input callback for annotation manager (prompt() doesn't work in VS Code webview)
        this.annotationManager.setTextInputCallback((position, done) => {
            this.requestAnnotationText(position, done);
        });

        // Register utility commands (non-CAD commands)
        this.registerUtilityCommands();

        // Setup UI event listeners
        this.setupToolbarEvents();
        this.setupContextMenu();
        this.setupLayerPanel();
        this.setupLayerToolbar();
        this.setupPropertiesPanel();
        this.setupSnapPanel();
        this.setupCommandPanelResize();

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

            // Handle Enter/Space when editor is waiting for input (e.g., Selection mode)
            // This allows confirming selection without clicking on command line first
            if (e.key === 'Enter' || e.key === ' ') {
                const editor = this.commandLine?.getEditor();
                if (editor?.isWaitingForInput()) {
                    // Pass empty input to confirm selection or finish input
                    editor.handleTextInput('');
                    e.preventDefault();
                    return;
                }

                // If no active command, repeat last command (AutoCAD style)
                if (!this.commandLine?.isCommandActive()) {
                    if (this.commandLine?.repeatLastCommand()) {
                        e.preventDefault();
                        return;
                    }
                }
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
            name: 'ANNOTEXT',
            aliases: ['AT'],
            description: 'Add text annotation',
            execute: () => {
                this.startAnnotation('text');
                this.commandLine?.print('Click to place text annotation', 'prompt');
            }
        });

        this.commandLine.registerSimpleCommand({
            name: 'ANNOLINE',
            aliases: ['AL', 'ARROW', 'LEADER'],
            description: 'Add arrow/line annotation',
            execute: () => {
                this.startAnnotation('arrow');
                this.commandLine?.print('Click start point for arrow', 'prompt');
            }
        });

        this.commandLine.registerSimpleCommand({
            name: 'ANNORECT',
            aliases: ['AR'],
            description: 'Add rectangle annotation',
            execute: () => {
                this.startAnnotation('rectangle');
                this.commandLine?.print('Click first corner of rectangle', 'prompt');
            }
        });

        // LAYER command for adding new layers
        this.commandLine.registerSimpleCommand({
            name: 'NEWLAYER',
            aliases: ['NL', 'LAYNEW'],
            description: 'Create a new layer',
            execute: () => {
                this.startNewLayerInput();
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

        // DELETE command (simple utility version - AcEraseCmd is the full CAD command)
        this.commandLine.registerSimpleCommand({
            name: 'DELETE',
            aliases: ['DEL'],
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

        // ORTHO command
        this.commandLine.registerSimpleCommand({
            name: 'ORTHO',
            aliases: ['OR'],
            description: 'Toggle ortho mode',
            execute: () => {
                this.toggleOrtho();
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

        // LAYER command - toggles layer toolbar at top of screen
        this.commandLine.registerSimpleCommand({
            name: 'LAYER',
            aliases: ['LA'],
            description: 'Toggle layer toolbar',
            execute: () => {
                this.toggleLayerToolbar();
                const toolbar = document.getElementById('layer-toolbar');
                const isVisible = toolbar?.classList.contains('visible');
                this.commandLine?.print(isVisible ? 'Layer toolbar opened' : 'Layer toolbar closed', 'success');
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

        // SAVE command - saves the current drawing
        this.commandLine.registerSimpleCommand({
            name: 'SAVE',
            aliases: ['S', 'QSAVE'],
            description: 'Save drawing to file',
            execute: () => {
                this.saveDrawing();
            }
        });

        // SAVEAS command - saves to a new file
        this.commandLine.registerSimpleCommand({
            name: 'SAVEAS',
            aliases: ['SA'],
            description: 'Save drawing to a new file',
            execute: () => {
                this.saveDrawingAs();
            }
        });

        // NEW command - create new empty drawing
        this.commandLine.registerSimpleCommand({
            name: 'NEW',
            aliases: [],
            description: 'Create new drawing',
            execute: () => {
                this.newDrawing();
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
            // Apply ortho constraint if enabled and base point is set
            let worldPoint = this.renderer.screenToWorld(e.clientX, e.clientY);
            if (worldPoint) {
                // Apply ortho constraint for jig preview
                worldPoint = this.renderer.applyOrthoConstraint(worldPoint);
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

            // Get world coordinates - use snap point if available
            const snapPoint = this.renderer.getCurrentSnapPoint();
            let worldPoint = snapPoint
                ? snapPoint.position
                : this.renderer.screenToWorld(e.clientX, e.clientY);

            // Apply ortho constraint if enabled
            if (worldPoint) {
                worldPoint = this.renderer.applyOrthoConstraint(worldPoint);
            }

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

    private toggleOrtho(): void {
        if (!this.renderer) return;

        const enabled = this.renderer.toggleOrtho();

        const btn = document.getElementById('btn-ortho');
        btn?.classList.toggle('active', enabled);

        this.setStatus(enabled ? 'Ortho ON' : 'Ortho OFF');
        this.commandLine?.print(enabled ? 'Ortho ON' : 'Ortho OFF', 'success');
    }

    private updateSnapStatus(snapPoint: SnapPoint): void {
        const snapTypeNames: Record<SnapType, string> = {
            [SnapType.ENDPOINT]: 'Endpoint',
            [SnapType.MIDPOINT]: 'Midpoint',
            [SnapType.CENTER]: 'Center',
            [SnapType.QUADRANT]: 'Quadrant',
            [SnapType.INTERSECTION]: 'Intersection',
            [SnapType.PERPENDICULAR]: 'Perpendicular',
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

        // Hide indicator - drawing mode info is shown in command line instead
        if (indicator) {
            indicator.classList.remove('visible');
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
        document.getElementById('btn-anno-text')?.addEventListener('click', () => {
            this.startAnnotation('text');
        });

        document.getElementById('btn-anno-arrow')?.addEventListener('click', () => {
            this.startAnnotation('arrow');
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

        // Snap settings panel toggle
        document.getElementById('btn-snap-settings')?.addEventListener('click', () => {
            this.toggleSnapPanel();
        });

        // Ortho toggle
        document.getElementById('btn-ortho')?.addEventListener('click', () => {
            this.toggleOrtho();
        });

        // Drawing tools
        document.getElementById('btn-draw-line')?.addEventListener('click', () => {
            this.startDrawingLine();
        });

        document.getElementById('btn-draw-circle')?.addEventListener('click', () => {
            this.startDrawingCircle();
        });

        document.getElementById('btn-draw-rect')?.addEventListener('click', () => {
            this.commandLine?.executeCommand('RECTANGLE');
        });

        // Dimension tools
        document.getElementById('btn-dim')?.addEventListener('click', () => {
            this.commandLine?.executeCommand('DIM');
        });

        document.getElementById('btn-dim-hor')?.addEventListener('click', () => {
            this.commandLine?.executeCommand('DIMHOR');
        });

        document.getElementById('btn-dim-ver')?.addEventListener('click', () => {
            this.commandLine?.executeCommand('DIMVER');
        });

        document.getElementById('btn-dim-aligned')?.addEventListener('click', () => {
            this.commandLine?.executeCommand('DIMALIGNED');
        });

        document.getElementById('btn-dim-angular')?.addEventListener('click', () => {
            this.commandLine?.executeCommand('DIMANGULAR');
        });
    }

    private setupContextMenu(): void {
        const container = document.getElementById('viewer-container');
        const contextMenu = document.getElementById('context-menu');

        if (!container || !contextMenu) return;

        // Show context menu on right-click
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            // Position the menu at the cursor
            const x = e.clientX;
            const y = e.clientY;

            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Show the menu first to get its dimensions
            contextMenu.classList.add('visible');

            // Get menu dimensions
            const menuWidth = contextMenu.offsetWidth;
            const menuHeight = contextMenu.offsetHeight;

            // Adjust position to keep menu within viewport
            let menuX = x;
            let menuY = y;

            if (x + menuWidth > viewportWidth) {
                menuX = viewportWidth - menuWidth - 5;
            }

            if (y + menuHeight > viewportHeight - 80) { // Account for command panel and status bar
                menuY = y - menuHeight;
                if (menuY < 0) {
                    menuY = 5;
                }
            }

            contextMenu.style.left = `${menuX}px`;
            contextMenu.style.top = `${menuY}px`;
        });

        // Hide context menu on click outside
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (!contextMenu.contains(target)) {
                this.hideContextMenu();
            }
        });

        // Hide context menu on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });

        // Handle menu item clicks
        contextMenu.querySelectorAll('.context-menu-item').forEach((item) => {
            item.addEventListener('click', (e) => {
                const menuItem = e.currentTarget as HTMLElement;
                const command = menuItem.dataset.command;

                if (command) {
                    this.hideContextMenu();
                    this.commandLine?.executeCommand(command);
                }
            });
        });
    }

    private hideContextMenu(): void {
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu) {
            contextMenu.classList.remove('visible');
        }
    }

    private setupCommandPanelResize(): void {
        const resizeHandle = document.getElementById('command-panel-resize');
        const commandPanel = document.getElementById('command-panel');
        const viewerContainer = document.getElementById('viewer-container');

        if (!resizeHandle || !commandPanel || !viewerContainer) return;

        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        const onMouseDown = (e: MouseEvent) => {
            isDragging = true;
            startY = e.clientY;
            startHeight = commandPanel.offsetHeight;
            resizeHandle.classList.add('dragging');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const deltaY = startY - e.clientY;
            const newHeight = Math.min(300, Math.max(40, startHeight + deltaY));

            commandPanel.style.height = `${newHeight}px`;
            viewerContainer.style.bottom = `${newHeight + 25}px`; // +25 for status bar
        };

        const onMouseUp = () => {
            if (!isDragging) return;

            isDragging = false;
            resizeHandle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        resizeHandle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
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

        const threeObject = selected[0];
        const entity = threeObject.userData.entity;
        if (!entity) {
            content.innerHTML = '<div class="no-selection">No properties available</div>';
            return;
        }

        // Clear content and build interactive form
        content.innerHTML = '';

        // General properties section
        const generalSection = document.createElement('div');
        generalSection.className = 'property-group';

        const generalTitle = document.createElement('div');
        generalTitle.className = 'property-group-title';
        generalTitle.textContent = 'General';
        generalSection.appendChild(generalTitle);

        // Type (read-only)
        this.addPropertyRow(generalSection, 'Type', entity.type, null, true);

        // Layer (editable dropdown)
        const layers = this.renderer.getLayers();
        const layerSelect = document.createElement('select');
        layerSelect.className = 'property-input property-select';
        for (const layer of layers) {
            const option = document.createElement('option');
            option.value = layer.name;
            option.textContent = layer.name;
            if (layer.name === entity.layer) {
                option.selected = true;
            }
            layerSelect.appendChild(option);
        }
        layerSelect.addEventListener('change', () => {
            this.renderer?.changeEntityLayer(entity, layerSelect.value);
            this.refreshLayerPanelIfVisible();
            this.commandLine?.print(`Entity moved to layer: ${layerSelect.value}`, 'success');
        });
        this.addPropertyRowWithElement(generalSection, 'Layer', layerSelect);

        // Handle (read-only)
        if (entity.handle) {
            this.addPropertyRow(generalSection, 'Handle', entity.handle, null, true);
        }

        content.appendChild(generalSection);

        // Geometry properties section
        const geomSection = document.createElement('div');
        geomSection.className = 'property-group';

        const geomTitle = document.createElement('div');
        geomTitle.className = 'property-group-title';
        geomTitle.textContent = 'Geometry';
        geomSection.appendChild(geomTitle);

        this.addEditableEntityProperties(entity, geomSection);

        content.appendChild(geomSection);
    }

    /**
     * Adds a read-only property row
     */
    private addPropertyRow(container: HTMLElement, label: string, value: string | number, _property?: string | null, readOnly: boolean = false): void {
        const row = document.createElement('div');
        row.className = 'property-row';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'property-label';
        labelSpan.textContent = label;

        const valueSpan = document.createElement('span');
        valueSpan.className = readOnly ? 'property-value' : 'property-value-editable';
        valueSpan.textContent = typeof value === 'number' ? value.toFixed(4) : value;

        row.appendChild(labelSpan);
        row.appendChild(valueSpan);
        container.appendChild(row);
    }

    /**
     * Adds a property row with a custom element (like select or input)
     */
    private addPropertyRowWithElement(container: HTMLElement, label: string, element: HTMLElement): void {
        const row = document.createElement('div');
        row.className = 'property-row';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'property-label';
        labelSpan.textContent = label;

        row.appendChild(labelSpan);
        row.appendChild(element);
        container.appendChild(row);
    }

    /**
     * Adds an editable input field for a property
     */
    private addEditablePropertyInput(container: HTMLElement, label: string, value: number, entity: any, property: string): void {
        const row = document.createElement('div');
        row.className = 'property-row';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'property-label';
        labelSpan.textContent = label;

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'property-input';
        input.value = value.toFixed(4);
        input.step = '0.0001';

        input.addEventListener('change', () => {
            const newValue = parseFloat(input.value);
            if (!isNaN(newValue)) {
                this.renderer?.updateEntityProperty(entity, property, newValue);
                this.commandLine?.print(`${label} changed to ${newValue.toFixed(4)}`, 'success');
            }
        });

        row.appendChild(labelSpan);
        row.appendChild(input);
        container.appendChild(row);
    }

    /**
     * Adds editable geometry properties based on entity type
     */
    private addEditableEntityProperties(entity: any, container: HTMLElement): void {
        switch (entity.type) {
            case 'LINE':
                this.addEditablePropertyInput(container, 'Start X', entity.start.x, entity, 'start.x');
                this.addEditablePropertyInput(container, 'Start Y', entity.start.y, entity, 'start.y');
                this.addEditablePropertyInput(container, 'End X', entity.end.x, entity, 'end.x');
                this.addEditablePropertyInput(container, 'End Y', entity.end.y, entity, 'end.y');
                // Length (read-only, calculated)
                const lineLen = Math.sqrt(Math.pow(entity.end.x - entity.start.x, 2) + Math.pow(entity.end.y - entity.start.y, 2));
                this.addPropertyRow(container, 'Length', lineLen, null, true);
                break;

            case 'CIRCLE':
                this.addEditablePropertyInput(container, 'Center X', entity.center.x, entity, 'center.x');
                this.addEditablePropertyInput(container, 'Center Y', entity.center.y, entity, 'center.y');
                this.addEditablePropertyInput(container, 'Radius', entity.radius, entity, 'radius');
                // Diameter and circumference (read-only)
                this.addPropertyRow(container, 'Diameter', entity.radius * 2, null, true);
                this.addPropertyRow(container, 'Circumf.', entity.radius * 2 * Math.PI, null, true);
                break;

            case 'ARC':
                this.addEditablePropertyInput(container, 'Center X', entity.center.x, entity, 'center.x');
                this.addEditablePropertyInput(container, 'Center Y', entity.center.y, entity, 'center.y');
                this.addEditablePropertyInput(container, 'Radius', entity.radius, entity, 'radius');
                this.addEditablePropertyInput(container, 'Start Angle', entity.startAngle, entity, 'startAngle');
                this.addEditablePropertyInput(container, 'End Angle', entity.endAngle, entity, 'endAngle');
                break;

            case 'TEXT':
            case 'MTEXT':
                this.addEditablePropertyInput(container, 'Position X', entity.position.x, entity, 'position.x');
                this.addEditablePropertyInput(container, 'Position Y', entity.position.y, entity, 'position.y');
                this.addEditablePropertyInput(container, 'Height', entity.height, entity, 'height');
                // Text content (editable)
                this.addEditableTextProperty(container, 'Text', entity.text, entity, 'text');
                break;

            case 'POLYLINE':
            case 'LWPOLYLINE':
                this.addPropertyRow(container, 'Vertices', entity.vertices.length, null, true);
                this.addPropertyRow(container, 'Closed', entity.closed ? 'Yes' : 'No', null, true);
                break;

            case 'INSERT':
                this.addPropertyRow(container, 'Block Name', entity.blockName, null, true);
                this.addEditablePropertyInput(container, 'Position X', entity.position.x, entity, 'position.x');
                this.addEditablePropertyInput(container, 'Position Y', entity.position.y, entity, 'position.y');
                this.addEditablePropertyInput(container, 'Scale X', entity.scale.x, entity, 'scale.x');
                this.addEditablePropertyInput(container, 'Scale Y', entity.scale.y, entity, 'scale.y');
                this.addEditablePropertyInput(container, 'Rotation', entity.rotation, entity, 'rotation');
                break;

            case 'ELLIPSE':
                this.addEditablePropertyInput(container, 'Center X', entity.center.x, entity, 'center.x');
                this.addEditablePropertyInput(container, 'Center Y', entity.center.y, entity, 'center.y');
                this.addEditablePropertyInput(container, 'Ratio', entity.ratio, entity, 'ratio');
                break;

            default:
                this.addPropertyRow(container, '-', 'N/A', null, true);
        }
    }

    /**
     * Adds an editable text input for text entities
     */
    private addEditableTextProperty(container: HTMLElement, label: string, value: string, entity: any, property: string): void {
        const row = document.createElement('div');
        row.className = 'property-row';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'property-label';
        labelSpan.textContent = label;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'property-input property-text-input';
        input.value = value;

        input.addEventListener('change', () => {
            this.renderer?.updateEntityProperty(entity, property, input.value);
            this.commandLine?.print(`Text changed`, 'success');
        });

        row.appendChild(labelSpan);
        row.appendChild(input);
        container.appendChild(row);
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

        // Current layer dropdown change
        document.getElementById('layer-current-select')?.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            const layerName = select.value;
            if (this.renderer && layerName) {
                this.renderer.setDrawingLayer(layerName);
                this.commandLine?.print(`Current layer set to: ${layerName}`, 'success');
            }
        });

        // Add new layer button
        document.getElementById('btn-layer-add')?.addEventListener('click', () => {
            this.showAddLayerDialog();
        });
    }

    private startNewLayerInput(): void {
        // Use command line input instead of prompt() which doesn't work in VS Code webview
        this.commandLine?.print('Enter new layer name:', 'prompt');
        this.commandLine?.setPrompt('Layer name:');
        this.commandLine?.focus();

        // Set pending input handler
        this.commandLine?.setPendingInputHandler((name: string) => {
            this.createLayerFromInput(name);
        });
    }

    // Called from + button in layer panel
    private showAddLayerDialog(): void {
        this.startNewLayerInput();
    }

    private createLayerFromInput(name: string): void {
        if (!name.trim()) {
            this.commandLine?.print('Layer creation cancelled.', 'response');
            return;
        }

        const layerName = name.trim().toUpperCase();

        if (!this.renderer) {
            return;
        }

        // Add the layer
        const added = this.renderer.addLayer(layerName);
        if (added) {
            // Set as current layer
            this.renderer.setDrawingLayer(layerName);
            // Update UI - including layer toolbar
            this.updateLayerList();
            this.updateCurrentLayerDropdown();
            this.refreshLayerToolbarIfVisible();
            this.commandLine?.print(`Layer "${layerName}" created and set as current`, 'success');
        } else {
            // Layer already exists, just set as current
            this.renderer.setDrawingLayer(layerName);
            this.updateCurrentLayerDropdown();
            this.refreshLayerToolbarIfVisible();
            this.commandLine?.print(`Layer "${layerName}" already exists, set as current`, 'response');
        }
    }

    private requestAnnotationText(position: { x: number; y: number }, done: (text: string) => void): void {
        this.commandLine?.print('Enter annotation text:', 'prompt');
        this.commandLine?.setPrompt('Text:');
        this.commandLine?.focus();

        this.commandLine?.setPendingInputHandler((text: string) => {
            done(text);
            if (text) {
                this.commandLine?.print(`Text annotation created at (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`, 'success');
            } else {
                this.commandLine?.print('Text annotation cancelled.', 'response');
            }
        });
    }

    private updateCurrentLayerDropdown(): void {
        const select = document.getElementById('layer-current-select') as HTMLSelectElement;
        if (!select || !this.renderer) return;

        const layers = this.renderer.getLayers();
        const currentLayer = this.renderer.getCurrentDrawingLayer();

        // Clear and rebuild options
        select.innerHTML = '';

        for (const layer of layers) {
            const option = document.createElement('option');
            option.value = layer.name;
            option.textContent = layer.name;
            if (layer.name === currentLayer) {
                option.selected = true;
            }
            select.appendChild(option);
        }
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
            this.updateCurrentLayerDropdown();
        }
    }

    /**
     * Refresh layer panel if it's currently visible
     * Called when entities are added/removed
     */
    private refreshLayerPanelIfVisible(): void {
        const panel = document.getElementById('layer-panel');
        if (panel?.classList.contains('visible')) {
            this.updateLayerList();
            this.updateCurrentLayerDropdown();
        }
        // Also refresh toolbar if visible
        this.refreshLayerToolbarIfVisible();
    }

    // ========== Layer Toolbar (AutoCAD style) ==========

    private setupLayerToolbar(): void {
        // Close button
        document.getElementById('layer-toolbar-close')?.addEventListener('click', () => {
            this.toggleLayerToolbar(false);
        });

        // Layer select dropdown
        document.getElementById('layer-toolbar-select')?.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            const layerName = select.value;
            if (this.renderer && layerName) {
                this.renderer.setDrawingLayer(layerName);
                // Update color and lineweight display for selected layer
                this.updateLayerToolbar();
                this.commandLine?.print(`Current layer: ${layerName}`, 'success');
            }
        });

        // Layer On/Off button
        document.getElementById('layer-toolbar-on')?.addEventListener('click', () => {
            const select = document.getElementById('layer-toolbar-select') as HTMLSelectElement;
            const layerName = select?.value;
            if (this.renderer && layerName) {
                const layers = this.renderer.getLayers();
                const layer = layers.find(l => l.name === layerName);
                if (layer) {
                    this.renderer.setLayerVisibility(layerName, !layer.visible);
                    this.updateLayerToolbar();
                    this.commandLine?.print(`Layer ${layerName} ${layer.visible ? 'off' : 'on'}`, 'response');
                }
            }
        });

        // Freeze button (same as on/off for now)
        document.getElementById('layer-toolbar-freeze')?.addEventListener('click', () => {
            const select = document.getElementById('layer-toolbar-select') as HTMLSelectElement;
            const layerName = select?.value;
            if (this.renderer && layerName) {
                const layers = this.renderer.getLayers();
                const layer = layers.find(l => l.name === layerName);
                if (layer) {
                    this.renderer.setLayerVisibility(layerName, !layer.visible);
                    this.updateLayerToolbar();
                    this.commandLine?.print(`Layer ${layerName} ${layer.visible ? 'frozen' : 'thawed'}`, 'response');
                }
            }
        });

        // Lock button
        document.getElementById('layer-toolbar-lock')?.addEventListener('click', () => {
            const select = document.getElementById('layer-toolbar-select') as HTMLSelectElement;
            const layerName = select?.value;
            if (this.renderer && layerName) {
                const isLocked = this.renderer.isLayerLocked(layerName);
                this.renderer.setLayerLocked(layerName, !isLocked);
                this.updateLayerToolbar();
                this.commandLine?.print(`Layer ${layerName} ${isLocked ? 'unlocked' : 'locked'}`, 'response');
            }
        });

        // Color box click - show color picker
        document.getElementById('layer-toolbar-color')?.addEventListener('click', () => {
            this.showLayerColorPicker();
        });

        // Lineweight click - show lineweight options
        document.getElementById('layer-toolbar-lineweight')?.addEventListener('click', () => {
            this.showLayerLineweightPicker();
        });

        // Layer Manager button - opens layer panel
        document.getElementById('layer-toolbar-manager')?.addEventListener('click', () => {
            this.toggleLayerPanel(true);
        });

        // Add Layer button
        document.getElementById('layer-toolbar-add')?.addEventListener('click', () => {
            this.showAddLayerDialog();
        });

        // Delete Layer button
        document.getElementById('layer-toolbar-delete')?.addEventListener('click', () => {
            this.deleteCurrentLayer();
        });
    }

    private toggleLayerToolbar(visible?: boolean): void {
        const toolbar = document.getElementById('layer-toolbar');
        const viewerContainer = document.getElementById('viewer-container');

        if (!toolbar) return;

        if (visible === undefined) {
            toolbar.classList.toggle('visible');
        } else if (visible) {
            toolbar.classList.add('visible');
        } else {
            toolbar.classList.remove('visible');
        }

        const isVisible = toolbar.classList.contains('visible');

        // Adjust viewer container position
        if (isVisible) {
            viewerContainer?.classList.add('with-layer-toolbar');
            this.updateLayerToolbar();
        } else {
            viewerContainer?.classList.remove('with-layer-toolbar');
        }
    }

    private updateLayerToolbar(): void {
        const select = document.getElementById('layer-toolbar-select') as HTMLSelectElement;
        const countSpan = document.getElementById('layer-toolbar-count');
        const colorBox = document.getElementById('layer-toolbar-color');
        const lineweightSpan = document.getElementById('layer-toolbar-lineweight');

        if (!select || !this.renderer) return;

        const layers = this.renderer.getLayers();
        const currentLayer = this.renderer.getCurrentDrawingLayer();

        // Update dropdown
        select.innerHTML = '';
        for (const layer of layers) {
            const option = document.createElement('option');
            option.value = layer.name;
            // Show visibility status with icon
            const visIcon = layer.visible ? '◉' : '○';
            option.textContent = `${visIcon} ${layer.name}`;
            if (layer.name === currentLayer) {
                option.selected = true;
            }
            select.appendChild(option);
        }

        // Update count
        if (countSpan) {
            countSpan.textContent = `${layers.length} layer${layers.length !== 1 ? 's' : ''}`;
        }

        // Update button states and properties based on current layer
        const currentLayerData = layers.find(l => l.name === currentLayer);
        const onBtn = document.getElementById('layer-toolbar-on');
        const freezeBtn = document.getElementById('layer-toolbar-freeze');

        if (currentLayerData) {
            onBtn?.classList.toggle('active', !currentLayerData.visible);
            freezeBtn?.classList.toggle('active', !currentLayerData.visible);

            // Update color display - color is hex number (0xrrggbb)
            if (colorBox) {
                const hexColor = currentLayerData.color;
                // Convert number to CSS hex string
                const displayColor = '#' + hexColor.toString(16).padStart(6, '0');
                colorBox.style.backgroundColor = displayColor;
                // Store colorIndex for later use
                (colorBox as HTMLElement).dataset.colorIndex = currentLayerData.colorIndex.toString();
            }

            // Update lineweight display
            if (lineweightSpan) {
                const lw = currentLayerData.lineWeight ?? 0.25;
                lineweightSpan.textContent = lw.toFixed(2);
            }

            // Update lock button state
            const lockBtn = document.getElementById('layer-toolbar-lock');
            lockBtn?.classList.toggle('active', currentLayerData.locked);
        }
    }

    private refreshLayerToolbarIfVisible(): void {
        const toolbar = document.getElementById('layer-toolbar');
        if (toolbar?.classList.contains('visible')) {
            this.updateLayerToolbar();
        }
    }

    private deleteCurrentLayer(): void {
        if (!this.renderer) return;

        const select = document.getElementById('layer-toolbar-select') as HTMLSelectElement;
        const layerName = select?.value;

        if (!layerName) {
            this.commandLine?.print('No layer selected', 'error');
            return;
        }

        // Cannot delete layer 0
        if (layerName === '0') {
            this.commandLine?.print('Cannot delete layer 0', 'error');
            return;
        }

        const layers = this.renderer.getLayers();
        if (layers.length <= 1) {
            this.commandLine?.print('Cannot delete the last layer', 'error');
            return;
        }

        // Confirm deletion
        if (!confirm(`Delete layer "${layerName}"? Entities on this layer will be moved to layer 0.`)) {
            return;
        }

        // Delete the layer
        this.renderer.deleteLayer(layerName);

        // Switch to layer 0
        this.renderer.setDrawingLayer('0');

        this.commandLine?.print(`Layer "${layerName}" deleted`, 'success');

        // Refresh toolbar and panel
        this.refreshLayerToolbarIfVisible();
        this.updateLayerList();
    }

    private showLayerColorPicker(): void {
        const select = document.getElementById('layer-toolbar-select') as HTMLSelectElement;
        const layerName = select?.value;
        if (!this.renderer || !layerName) return;

        // ACI color options
        const aciColors: { index: number; name: string; hex: string }[] = [
            { index: 1, name: 'Red', hex: '#ff0000' },
            { index: 2, name: 'Yellow', hex: '#ffff00' },
            { index: 3, name: 'Green', hex: '#00ff00' },
            { index: 4, name: 'Cyan', hex: '#00ffff' },
            { index: 5, name: 'Blue', hex: '#0000ff' },
            { index: 6, name: 'Magenta', hex: '#ff00ff' },
            { index: 7, name: 'White', hex: '#ffffff' },
            { index: 8, name: 'Gray', hex: '#808080' },
            { index: 9, name: 'Light Gray', hex: '#c0c0c0' }
        ];

        // Create color picker popup
        const existingPopup = document.getElementById('layer-color-popup');
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement('div');
        popup.id = 'layer-color-popup';
        popup.className = 'layer-popup';
        popup.innerHTML = `
            <div class="layer-popup-title">Select Color</div>
            <div class="layer-color-grid">
                ${aciColors.map(c => `
                    <div class="layer-color-option" data-index="${c.index}" title="${c.name}"
                         style="background-color: ${c.hex}"></div>
                `).join('')}
            </div>
        `;

        // Position popup below color box
        const colorBox = document.getElementById('layer-toolbar-color');
        if (colorBox) {
            const rect = colorBox.getBoundingClientRect();
            popup.style.position = 'absolute';
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
        }

        document.body.appendChild(popup);

        // Handle color selection
        popup.querySelectorAll('.layer-color-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                const index = parseInt((e.target as HTMLElement).dataset.index || '7');
                this.renderer?.setLayerColor(layerName, index);
                this.updateLayerToolbar();
                this.updateLayerList();
                this.commandLine?.print(`Layer ${layerName} color changed`, 'response');
                popup.remove();
            });
        });

        // Close on click outside
        const closeHandler = (e: MouseEvent) => {
            if (!popup.contains(e.target as Node) && e.target !== colorBox) {
                popup.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    private showLayerLineweightPicker(): void {
        const select = document.getElementById('layer-toolbar-select') as HTMLSelectElement;
        const layerName = select?.value;
        if (!this.renderer || !layerName) return;

        // Standard lineweight options
        const lineweights = [0.00, 0.05, 0.09, 0.13, 0.15, 0.18, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.53, 0.60, 0.70, 0.80, 0.90, 1.00, 1.06, 1.20, 1.40, 1.58, 2.00, 2.11];

        // Create lineweight picker popup
        const existingPopup = document.getElementById('layer-lineweight-popup');
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement('div');
        popup.id = 'layer-lineweight-popup';
        popup.className = 'layer-popup';
        popup.innerHTML = `
            <div class="layer-popup-title">Select Line Weight (mm)</div>
            <div class="layer-lineweight-list">
                ${lineweights.map(lw => `
                    <div class="layer-lineweight-option" data-lw="${lw}">
                        <span class="lw-preview" style="height: ${Math.max(1, lw * 3)}px"></span>
                        <span class="lw-value">${lw.toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
        `;

        // Position popup below lineweight span
        const lwSpan = document.getElementById('layer-toolbar-lineweight');
        if (lwSpan) {
            const rect = lwSpan.getBoundingClientRect();
            popup.style.position = 'absolute';
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
        }

        document.body.appendChild(popup);

        // Handle lineweight selection
        popup.querySelectorAll('.layer-lineweight-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                const lw = parseFloat((e.currentTarget as HTMLElement).dataset.lw || '0.25');
                this.renderer?.setLayerLineWeight(layerName, lw);
                this.updateLayerToolbar();
                this.updateLayerList();
                this.commandLine?.print(`Layer ${layerName} lineweight changed to ${lw.toFixed(2)}`, 'response');
                popup.remove();
            });
        });

        // Close on click outside
        const closeHandler = (e: MouseEvent) => {
            if (!popup.contains(e.target as Node) && e.target !== lwSpan) {
                popup.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    private toggleSnapPanel(visible?: boolean): void {
        const panel = document.getElementById('snap-panel');
        const btn = document.getElementById('btn-snap-settings');

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
    }

    private setupSnapPanel(): void {
        // Close button
        document.getElementById('btn-snap-close')?.addEventListener('click', () => {
            this.toggleSnapPanel(false);
        });

        // Setup checkbox event listeners for each snap type
        const checkboxes = document.querySelectorAll('#snap-types-list input[type="checkbox"]');
        checkboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                this.updateActiveSnapTypes();
            });
        });
    }

    private updateActiveSnapTypes(): void {
        if (!this.renderer) return;

        const snapTypeMap: Record<string, SnapType> = {
            'endpoint': SnapType.ENDPOINT,
            'midpoint': SnapType.MIDPOINT,
            'center': SnapType.CENTER,
            'quadrant': SnapType.QUADRANT,
            'intersection': SnapType.INTERSECTION,
            'perpendicular': SnapType.PERPENDICULAR,
            'nearest': SnapType.NEAREST
        };

        const activeTypes: SnapType[] = [];
        const checkboxes = document.querySelectorAll('#snap-types-list input[type="checkbox"]:checked');

        checkboxes.forEach((checkbox) => {
            const snapName = (checkbox as HTMLInputElement).dataset.snap;
            if (snapName && snapTypeMap[snapName]) {
                activeTypes.push(snapTypeMap[snapName]);
            }
        });

        this.renderer.setActiveSnapTypes(activeTypes);

        const typeNames = activeTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1));
        this.commandLine?.print(`Snap types: ${typeNames.join(', ') || 'None'}`, 'response');
    }

    private updateLayerList(): void {
        const listContainer = document.getElementById('layer-list');
        if (!listContainer || !this.renderer) return;

        const layers = this.renderer.getLayers();
        const lineTypes = this.renderer.getAvailableLineTypes();
        listContainer.innerHTML = '';

        for (const layer of layers) {
            const item = document.createElement('div');
            item.className = 'layer-item';

            // Visibility checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = layer.visible;
            checkbox.title = 'Toggle visibility';
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.renderer?.toggleLayerVisibility(layer.name, checkbox.checked);
            });

            // Color picker
            const colorPicker = document.createElement('input');
            colorPicker.type = 'color';
            colorPicker.className = 'layer-color-picker';
            colorPicker.value = '#' + layer.color.toString(16).padStart(6, '0');
            colorPicker.title = 'Click to change layer color';
            colorPicker.addEventListener('change', (e) => {
                e.stopPropagation();
                const hexColor = colorPicker.value;
                // Convert hex to ACI (approximate - use closest ACI color)
                const aciColor = this.hexToAci(hexColor);
                this.renderer?.setLayerColor(layer.name, aciColor);
                this.commandLine?.print(`Layer "${layer.name}" color changed`, 'success');
            });
            colorPicker.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Layer name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            nameSpan.title = layer.name;

            // Linetype dropdown
            const lineTypeSelect = document.createElement('select');
            lineTypeSelect.className = 'layer-linetype-select';
            lineTypeSelect.title = 'Layer linetype';

            // Add standard linetypes if not in the list
            const standardLineTypes = [
                { name: 'CONTINUOUS', description: 'Solid line' },
                { name: 'DASHED', description: 'Dashed line' },
                { name: 'HIDDEN', description: 'Hidden line' },
                { name: 'CENTER', description: 'Center line' },
                { name: 'DASHDOT', description: 'Dash dot line' },
                { name: 'PHANTOM', description: 'Phantom line' },
                { name: 'DOT', description: 'Dotted line' }
            ];

            const allLineTypes = [...standardLineTypes];
            for (const lt of lineTypes) {
                if (!allLineTypes.find(t => t.name === lt.name)) {
                    allLineTypes.push(lt);
                }
            }

            for (const lt of allLineTypes) {
                const option = document.createElement('option');
                option.value = lt.name;
                option.textContent = lt.name;
                option.title = lt.description;
                if (lt.name === layer.lineType) {
                    option.selected = true;
                }
                lineTypeSelect.appendChild(option);
            }

            lineTypeSelect.addEventListener('change', (e) => {
                e.stopPropagation();
                this.renderer?.setLayerLineType(layer.name, lineTypeSelect.value);
                this.commandLine?.print(`Layer "${layer.name}" linetype set to ${lineTypeSelect.value}`, 'success');
            });
            lineTypeSelect.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Lineweight dropdown
            const lineWeightSelect = document.createElement('select');
            lineWeightSelect.className = 'layer-lineweight-select';
            lineWeightSelect.title = 'Layer line weight (mm)';

            // Standard AutoCAD line weights in mm
            const standardLineWeights = [
                { value: 0.00, label: '0.00 mm' },
                { value: 0.05, label: '0.05 mm' },
                { value: 0.09, label: '0.09 mm' },
                { value: 0.13, label: '0.13 mm' },
                { value: 0.15, label: '0.15 mm' },
                { value: 0.18, label: '0.18 mm' },
                { value: 0.20, label: '0.20 mm' },
                { value: 0.25, label: '0.25 mm' },
                { value: 0.30, label: '0.30 mm' },
                { value: 0.35, label: '0.35 mm' },
                { value: 0.40, label: '0.40 mm' },
                { value: 0.50, label: '0.50 mm' },
                { value: 0.53, label: '0.53 mm' },
                { value: 0.60, label: '0.60 mm' },
                { value: 0.70, label: '0.70 mm' },
                { value: 0.80, label: '0.80 mm' },
                { value: 0.90, label: '0.90 mm' },
                { value: 1.00, label: '1.00 mm' },
                { value: 1.06, label: '1.06 mm' },
                { value: 1.20, label: '1.20 mm' },
                { value: 1.40, label: '1.40 mm' },
                { value: 1.58, label: '1.58 mm' },
                { value: 2.00, label: '2.00 mm' },
                { value: 2.11, label: '2.11 mm' }
            ];

            for (const lw of standardLineWeights) {
                const option = document.createElement('option');
                option.value = lw.value.toString();
                option.textContent = lw.label;
                // Find closest match for selection
                if (Math.abs(lw.value - layer.lineWeight) < 0.01) {
                    option.selected = true;
                }
                lineWeightSelect.appendChild(option);
            }

            lineWeightSelect.addEventListener('change', (e) => {
                e.stopPropagation();
                const weight = parseFloat(lineWeightSelect.value);
                this.renderer?.setLayerLineWeight(layer.name, weight);
                this.commandLine?.print(`Layer "${layer.name}" line weight set to ${weight} mm`, 'success');
            });
            lineWeightSelect.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Entity count
            const countSpan = document.createElement('span');
            countSpan.className = 'layer-count';
            countSpan.textContent = `(${layer.entityCount})`;

            item.appendChild(checkbox);
            item.appendChild(colorPicker);
            item.appendChild(nameSpan);
            item.appendChild(lineTypeSelect);
            item.appendChild(lineWeightSelect);
            item.appendChild(countSpan);

            // Click on layer name sets it as current
            nameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderer?.setDrawingLayer(layer.name);
                this.updateCurrentLayerDropdown();
                this.commandLine?.print(`Current layer set to: ${layer.name}`, 'success');
            });

            listContainer.appendChild(item);
        }
    }

    /**
     * Convert hex color to closest ACI (AutoCAD Color Index) color
     */
    private hexToAci(hexColor: string): number {
        // Parse hex color
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // Standard ACI color palette (simplified - most common colors)
        const aciColors: Array<{ aci: number; r: number; g: number; b: number }> = [
            { aci: 1, r: 255, g: 0, b: 0 },       // Red
            { aci: 2, r: 255, g: 255, b: 0 },     // Yellow
            { aci: 3, r: 0, g: 255, b: 0 },       // Green
            { aci: 4, r: 0, g: 255, b: 255 },     // Cyan
            { aci: 5, r: 0, g: 0, b: 255 },       // Blue
            { aci: 6, r: 255, g: 0, b: 255 },     // Magenta
            { aci: 7, r: 255, g: 255, b: 255 },   // White
            { aci: 8, r: 128, g: 128, b: 128 },   // Gray
            { aci: 9, r: 192, g: 192, b: 192 },   // Light gray
            { aci: 10, r: 255, g: 0, b: 0 },      // Red (light)
            { aci: 30, r: 255, g: 127, b: 0 },    // Orange
            { aci: 40, r: 255, g: 191, b: 0 },    // Gold
            { aci: 50, r: 255, g: 255, b: 0 },    // Yellow
            { aci: 70, r: 127, g: 255, b: 0 },    // Lime
            { aci: 90, r: 0, g: 255, b: 0 },      // Green
            { aci: 110, r: 0, g: 255, b: 127 },   // Spring green
            { aci: 130, r: 0, g: 255, b: 255 },   // Cyan
            { aci: 150, r: 0, g: 127, b: 255 },   // Sky blue
            { aci: 170, r: 0, g: 0, b: 255 },     // Blue
            { aci: 190, r: 127, g: 0, b: 255 },   // Purple
            { aci: 210, r: 255, g: 0, b: 255 },   // Magenta
            { aci: 230, r: 255, g: 0, b: 127 },   // Rose
            { aci: 250, r: 51, g: 51, b: 51 },    // Dark gray
            { aci: 251, r: 80, g: 80, b: 80 },    // Gray
            { aci: 252, r: 105, g: 105, b: 105 }, // Gray
            { aci: 253, r: 130, g: 130, b: 130 }, // Gray
            { aci: 254, r: 190, g: 190, b: 190 }, // Light gray
            { aci: 255, r: 255, g: 255, b: 255 }, // White
        ];

        // Find closest ACI color
        let closestAci = 7;
        let minDistance = Infinity;

        for (const aciColor of aciColors) {
            const distance = Math.sqrt(
                Math.pow(r - aciColor.r, 2) +
                Math.pow(g - aciColor.g, 2) +
                Math.pow(b - aciColor.b, 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestAci = aciColor.aci;
            }
        }

        return closestAci;
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
            // Check if file is empty or contains only whitespace
            const trimmed = dxfString.trim();
            if (!trimmed || trimmed.length < 10) {
                // Create empty DXF structure for new/empty files
                console.log('[DXF Viewer] Empty or invalid file detected, creating new drawing');
                this.parsedDxf = createEmptyDxf();
                this.isNewDrawing = true;

                if (this.renderer) {
                    this.renderer.loadDxf(this.parsedDxf);
                    // Set a reasonable default view for empty drawing
                    this.renderer.setViewExtents(-50, -50, 150, 150);
                }

                this.updateLayerList();
                this.toggleLayerToolbar(true);
                this.setStatus(`New drawing: ${fileName}`);
                this.commandLine?.print('New drawing created. Use LINE, CIRCLE, etc. to draw.', 'success');

                this.vscode.postMessage({
                    type: 'info',
                    message: `Created new drawing: ${fileName}`
                });
            } else {
                // Try to parse the DXF content
                const parser = new DxfParser();
                this.parsedDxf = parser.parse(dxfString);
                this.isNewDrawing = false;

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

                // Show layer toolbar by default
                this.toggleLayerToolbar(true);

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
            }
        } catch (error) {
            console.error('Failed to parse DXF:', error);
            // If parsing fails, create an empty drawing instead of showing error
            console.log('[DXF Viewer] Parse failed, creating new drawing');
            this.parsedDxf = createEmptyDxf();
            this.isNewDrawing = true;

            if (this.renderer) {
                this.renderer.loadDxf(this.parsedDxf);
                this.renderer.setViewExtents(-50, -50, 150, 150);
            }

            this.updateLayerList();
            this.toggleLayerToolbar(true);
            this.setStatus(`New drawing: ${fileName} (parse error, started fresh)`);
            this.commandLine?.print('Could not parse file. Created new drawing.', 'response');

            this.vscode.postMessage({
                type: 'info',
                message: `Created new drawing (parse error): ${fileName}`
            });
        } finally {
            this.showLoading(false);
            // Focus command line so keyboard works immediately
            this.commandLine?.focus();
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

    /**
     * Saves the current drawing to the original file
     */
    private saveDrawing(): void {
        if (!this.parsedDxf) {
            this.commandLine?.print('No drawing to save', 'error');
            return;
        }

        // Get current entities from renderer
        const entities = this.renderer?.getAllEntities() || [];

        // Update parsedDxf with current entities
        this.parsedDxf.entities = entities;

        // Update extents
        const extents = calculateExtents(entities);
        this.parsedDxf.bounds = {
            minX: extents.min.x,
            minY: extents.min.y,
            maxX: extents.max.x,
            maxY: extents.max.y
        };

        // Generate DXF content
        const dxfContent = generateDxfContent(this.parsedDxf);

        // Send to extension for saving
        this.vscode.postMessage({
            type: 'saveDxf',
            data: dxfContent
        });

        this.hasUnsavedChanges = false;
        this.commandLine?.print('Drawing saved', 'success');
    }

    /**
     * Saves the current drawing to a new file
     */
    private saveDrawingAs(): void {
        if (!this.parsedDxf) {
            this.commandLine?.print('No drawing to save', 'error');
            return;
        }

        // Get current entities from renderer
        const entities = this.renderer?.getAllEntities() || [];

        // Update parsedDxf with current entities
        this.parsedDxf.entities = entities;

        // Update extents
        const extents = calculateExtents(entities);
        this.parsedDxf.bounds = {
            minX: extents.min.x,
            minY: extents.min.y,
            maxX: extents.max.x,
            maxY: extents.max.y
        };

        // Generate DXF content
        const dxfContent = generateDxfContent(this.parsedDxf);

        // Send to extension for Save As
        this.vscode.postMessage({
            type: 'saveDxfAs',
            data: dxfContent,
            fileName: this.fileName
        });

        this.commandLine?.print('Save As dialog opened', 'response');
    }

    /**
     * Creates a new empty drawing
     */
    private newDrawing(): void {
        this.parsedDxf = createEmptyDxf();
        this.isNewDrawing = true;
        this.hasUnsavedChanges = false;

        if (this.renderer) {
            this.renderer.loadDxf(this.parsedDxf);
            this.renderer.setViewExtents(-50, -50, 150, 150);
        }

        this.updateLayerList();
        this.toggleLayerToolbar(true);
        this.setStatus('New drawing');
        this.commandLine?.print('New drawing created', 'success');
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
        const buttons = ['btn-anno-text', 'btn-anno-arrow'];
        buttons.forEach(id => {
            document.getElementById(id)?.classList.remove('active');
        });

        if (visible && type) {
            const buttonMap: Record<AnnotationType, string> = {
                'text': 'btn-anno-text',
                'arrow': 'btn-anno-arrow',
                'rectangle': 'btn-anno-arrow',
                'circle': 'btn-anno-arrow',
                'line': 'btn-anno-arrow'
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
