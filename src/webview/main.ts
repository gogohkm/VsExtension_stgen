/**
 * DXF Viewer Webview Main Entry Point
 */

import './styles.css';
import { DxfParser, ParsedDxf, DxfEntity, DxfLine, DxfCircle, DxfArc, DxfPolyline, DxfText, DxfPoint_, DxfEllipse, DxfSpline, DxfHatch, DxfDimension } from './dxfParser';
import { DxfRenderer } from './dxfRenderer';
import { AnnotationManager, AnnotationType } from './annotationManager';

declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

class DxfViewerApp {
    private vscode = acquireVsCodeApi();
    private renderer: DxfRenderer | null = null;
    private annotationManager: AnnotationManager | null = null;
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
            () => this.renderer?.render()
        );

        // Setup UI event listeners
        this.setupToolbarEvents();
        this.setupLayerPanel();

        // Setup message handler
        window.addEventListener('message', (event) => {
            this.handleMessage(event.data);
        });

        // Notify extension that we're ready
        this.vscode.postMessage({ type: 'ready' });
        this.setStatus('Ready');
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
        }
    }

    private loadDxf(dxfString: string, fileName: string): void {
        this.showLoading(true);
        this.fileName = fileName;

        try {
            const parser = new DxfParser();
            this.parsedDxf = parser.parse(dxfString);

            if (this.renderer) {
                this.renderer.loadDxf(this.parsedDxf);
            }

            // Update layer panel if visible
            this.updateLayerList();

            const entityCount = this.parsedDxf.entities.length;
            const layerCount = this.parsedDxf.layers.size;
            this.setStatus(`Loaded: ${fileName} (${entityCount} entities, ${layerCount} layers)`);

            this.vscode.postMessage({
                type: 'info',
                message: `Loaded ${fileName}: ${entityCount} entities`
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
}

// Initialize app
new DxfViewerApp();
