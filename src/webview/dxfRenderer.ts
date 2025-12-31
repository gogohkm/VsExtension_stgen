/**
 * DXF Renderer using Three.js
 * Renders parsed DXF entities to a WebGL canvas
 */

import * as THREE from 'three';
import {
    ParsedDxf,
    DxfEntity,
    DxfLine,
    DxfCircle,
    DxfArc,
    DxfPolyline,
    DxfText,
    DxfPoint_,
    DxfInsert,
    DxfEllipse,
    DxfSpline,
    DxfHatch,
    DxfDimension,
    DxfSolid,
    DxfAttrib,
    DxfLeader,
    DxfWipeout,
    DxfLineType
} from './dxfParser';

// AutoCAD Color Index (ACI) to RGB - Full 256 color palette
const ACI_COLORS: number[] = [
    0x000000, // 0 - ByBlock
    0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff, 0xffffff, 0x808080, 0xc0c0c0, // 1-9
    0xff0000, 0xff7f7f, 0xcc0000, 0xcc6666, 0x990000, 0x994c4c, 0x7f0000, 0x7f3f3f, 0x4c0000, 0x4c2626, // 10-19
    0xff3f00, 0xff9f7f, 0xcc3300, 0xcc7f66, 0x992600, 0x995f4c, 0x7f1f00, 0x7f4f3f, 0x4c1300, 0x4c2f26, // 20-29
    0xff7f00, 0xffbf7f, 0xcc6600, 0xcc9966, 0x994c00, 0x99724c, 0x7f3f00, 0x7f5f3f, 0x4c2600, 0x4c3926, // 30-39
    0xffbf00, 0xffdf7f, 0xcc9900, 0xccb266, 0x997300, 0x99864c, 0x7f5f00, 0x7f6f3f, 0x4c3900, 0x4c4226, // 40-49
    0xffff00, 0xffff7f, 0xcccc00, 0xcccc66, 0x999900, 0x99994c, 0x7f7f00, 0x7f7f3f, 0x4c4c00, 0x4c4c26, // 50-59
    0xbfff00, 0xdfff7f, 0x99cc00, 0xb2cc66, 0x739900, 0x86994c, 0x5f7f00, 0x6f7f3f, 0x394c00, 0x424c26, // 60-69
    0x7fff00, 0xbfff7f, 0x66cc00, 0x99cc66, 0x4c9900, 0x72994c, 0x3f7f00, 0x5f7f3f, 0x264c00, 0x394c26, // 70-79
    0x3fff00, 0x9fff7f, 0x33cc00, 0x7fcc66, 0x269900, 0x5f994c, 0x1f7f00, 0x4f7f3f, 0x134c00, 0x2f4c26, // 80-89
    0x00ff00, 0x7fff7f, 0x00cc00, 0x66cc66, 0x009900, 0x4c994c, 0x007f00, 0x3f7f3f, 0x004c00, 0x264c26, // 90-99
    0x00ff3f, 0x7fff9f, 0x00cc33, 0x66cc7f, 0x009926, 0x4c995f, 0x007f1f, 0x3f7f4f, 0x004c13, 0x264c2f, // 100-109
    0x00ff7f, 0x7fffbf, 0x00cc66, 0x66cc99, 0x00994c, 0x4c9972, 0x007f3f, 0x3f7f5f, 0x004c26, 0x264c39, // 110-119
    0x00ffbf, 0x7fffdf, 0x00cc99, 0x66ccb2, 0x009973, 0x4c9986, 0x007f5f, 0x3f7f6f, 0x004c39, 0x264c42, // 120-129
    0x00ffff, 0x7fffff, 0x00cccc, 0x66cccc, 0x009999, 0x4c9999, 0x007f7f, 0x3f7f7f, 0x004c4c, 0x264c4c, // 130-139
    0x00bfff, 0x7fdfff, 0x0099cc, 0x66b2cc, 0x007399, 0x4c8699, 0x005f7f, 0x3f6f7f, 0x00394c, 0x26424c, // 140-149
    0x007fff, 0x7fbfff, 0x0066cc, 0x6699cc, 0x004c99, 0x4c7299, 0x003f7f, 0x3f5f7f, 0x00264c, 0x26394c, // 150-159
    0x003fff, 0x7f9fff, 0x0033cc, 0x667fcc, 0x002699, 0x4c5f99, 0x001f7f, 0x3f4f7f, 0x00134c, 0x262f4c, // 160-169
    0x0000ff, 0x7f7fff, 0x0000cc, 0x6666cc, 0x000099, 0x4c4c99, 0x00007f, 0x3f3f7f, 0x00004c, 0x26264c, // 170-179
    0x3f00ff, 0x9f7fff, 0x3300cc, 0x7f66cc, 0x260099, 0x5f4c99, 0x1f007f, 0x4f3f7f, 0x13004c, 0x2f264c, // 180-189
    0x7f00ff, 0xbf7fff, 0x6600cc, 0x9966cc, 0x4c0099, 0x724c99, 0x3f007f, 0x5f3f7f, 0x26004c, 0x39264c, // 190-199
    0xbf00ff, 0xdf7fff, 0x9900cc, 0xb266cc, 0x730099, 0x864c99, 0x5f007f, 0x6f3f7f, 0x39004c, 0x42264c, // 200-209
    0xff00ff, 0xff7fff, 0xcc00cc, 0xcc66cc, 0x990099, 0x994c99, 0x7f007f, 0x7f3f7f, 0x4c004c, 0x4c264c, // 210-219
    0xff00bf, 0xff7fdf, 0xcc0099, 0xcc66b2, 0x990073, 0x994c86, 0x7f005f, 0x7f3f6f, 0x4c0039, 0x4c2642, // 220-229
    0xff007f, 0xff7fbf, 0xcc0066, 0xcc6699, 0x99004c, 0x994c72, 0x7f003f, 0x7f3f5f, 0x4c0026, 0x4c2639, // 230-239
    0xff003f, 0xff7f9f, 0xcc0033, 0xcc667f, 0x990026, 0x994c5f, 0x7f001f, 0x7f3f4f, 0x4c0013, 0x4c262f, // 240-249
    0x333333, 0x5b5b5b, 0x848484, 0xadadad, 0xd6d6d6, 0xffffff  // 250-255 grayscale
];

// Special color values
const COLOR_BYLAYER = 256;
const COLOR_BYBLOCK = 0;

// Snap point types
export enum SnapType {
    ENDPOINT = 'endpoint',
    MIDPOINT = 'midpoint',
    CENTER = 'center',
    QUADRANT = 'quadrant',
    INTERSECTION = 'intersection',
    NEAREST = 'nearest'
}

// Drawing modes
export enum DrawingMode {
    NONE = 'none',
    LINE = 'line',
    CIRCLE = 'circle',
    POLYLINE = 'polyline'
}

// Snap point interface
export interface SnapPoint {
    type: SnapType;
    position: { x: number; y: number };
    entity: THREE.Object3D;
}

// Snap marker colors
const SNAP_COLORS: Record<SnapType, number> = {
    [SnapType.ENDPOINT]: 0x00ff00,    // Green
    [SnapType.MIDPOINT]: 0x00ffff,    // Cyan
    [SnapType.CENTER]: 0xff00ff,      // Magenta
    [SnapType.QUADRANT]: 0xffff00,    // Yellow
    [SnapType.INTERSECTION]: 0xff0000, // Red
    [SnapType.NEAREST]: 0xffa500      // Orange
};

// Material cache for performance optimization
class MaterialCache {
    private lineBasicMaterials: Map<number, THREE.LineBasicMaterial> = new Map();
    private lineDashedMaterials: Map<string, THREE.LineDashedMaterial> = new Map();
    private meshMaterials: Map<string, THREE.MeshBasicMaterial> = new Map();
    private pointMaterials: Map<string, THREE.PointsMaterial> = new Map();

    getLineBasicMaterial(color: number): THREE.LineBasicMaterial {
        let material = this.lineBasicMaterials.get(color);
        if (!material) {
            material = new THREE.LineBasicMaterial({ color });
            this.lineBasicMaterials.set(color, material);
        }
        return material;
    }

    getLineDashedMaterial(color: number, dashSize: number, gapSize: number): THREE.LineDashedMaterial {
        const key = `${color}-${dashSize}-${gapSize}`;
        let material = this.lineDashedMaterials.get(key);
        if (!material) {
            material = new THREE.LineDashedMaterial({ color, dashSize, gapSize, scale: 1 });
            this.lineDashedMaterials.set(key, material);
        }
        return material;
    }

    getMeshMaterial(color: number, opacity: number = 1, transparent: boolean = false): THREE.MeshBasicMaterial {
        const key = `${color}-${opacity}-${transparent}`;
        let material = this.meshMaterials.get(key);
        if (!material) {
            material = new THREE.MeshBasicMaterial({
                color,
                transparent,
                opacity,
                side: THREE.DoubleSide
            });
            this.meshMaterials.set(key, material);
        }
        return material;
    }

    getPointMaterial(color: number, size: number): THREE.PointsMaterial {
        const key = `${color}-${size}`;
        let material = this.pointMaterials.get(key);
        if (!material) {
            material = new THREE.PointsMaterial({ color, size, sizeAttenuation: false });
            this.pointMaterials.set(key, material);
        }
        return material;
    }

    clear(): void {
        this.lineBasicMaterials.forEach(m => m.dispose());
        this.lineDashedMaterials.forEach(m => m.dispose());
        this.meshMaterials.forEach(m => m.dispose());
        this.pointMaterials.forEach(m => m.dispose());

        this.lineBasicMaterials.clear();
        this.lineDashedMaterials.clear();
        this.meshMaterials.clear();
        this.pointMaterials.clear();
    }
}

function aciToColor(aci: number): number {
    if (aci === COLOR_BYLAYER || aci === COLOR_BYBLOCK) {
        return 0xffffff; // Will be resolved by layer
    }
    if (aci < 0) {
        return 0xffffff;
    }
    if (aci >= ACI_COLORS.length) {
        return 0xffffff;
    }
    return ACI_COLORS[aci];
}

export class DxfRenderer {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private container: HTMLElement;
    private entityGroup: THREE.Group;
    private annotationGroup: THREE.Group;
    private gridGroup: THREE.Group;
    private parsedDxf: ParsedDxf | null = null;
    private layerVisibility: Map<string, boolean> = new Map();

    // Pan/zoom state
    private isDragging = false;
    private lastMousePos = { x: 0, y: 0 };
    private viewCenter = { x: 0, y: 0 };
    private viewWidth = 100;

    // Box zoom state
    private isBoxZooming = false;
    private boxZoomStart = { x: 0, y: 0 };
    private boxZoomEnd = { x: 0, y: 0 };
    private selectionBox: HTMLDivElement | null = null;

    // Selection and hover state
    private raycaster: THREE.Raycaster;
    private selectedEntities: Set<THREE.Object3D> = new Set();
    private hoveredEntity: THREE.Object3D | null = null;
    private originalMaterials: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();

    // Material cache for performance
    private materialCache: MaterialCache = new MaterialCache();

    // Snap markers
    private snapGroup: THREE.Group;
    private snapEnabled: boolean = true;
    private activeSnapTypes: Set<SnapType> = new Set([
        SnapType.ENDPOINT,
        SnapType.MIDPOINT,
        SnapType.CENTER
    ]);
    private snapRadius: number = 15; // pixels
    private currentSnapPoint: SnapPoint | null = null;
    private snapMarker: THREE.Group | null = null;

    // Drawing mode
    private drawingGroup: THREE.Group;
    private drawingMode: DrawingMode = DrawingMode.NONE;
    private drawingPoints: { x: number; y: number }[] = [];
    private rubberBandLine: THREE.Line | null = null;
    private rubberBandCircle: THREE.Line | null = null;
    private currentDrawingLayer: string = '0';
    private currentDrawingColor: number = 0xffffff;
    private onDrawingComplete: ((entity: DxfEntity) => void) | null = null;

    constructor(container: HTMLElement) {
        this.container = container;

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1e1e1e);

        // Create camera (orthographic for 2D CAD viewing)
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        this.camera.position.z = 10;

        // Create renderer with preserveDrawingBuffer for screen capture
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: false
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        // Create groups
        this.gridGroup = new THREE.Group();
        this.gridGroup.name = 'grid';
        this.scene.add(this.gridGroup);

        this.entityGroup = new THREE.Group();
        this.entityGroup.name = 'entities';
        this.scene.add(this.entityGroup);

        this.annotationGroup = new THREE.Group();
        this.annotationGroup.name = 'annotations';
        this.scene.add(this.annotationGroup);

        this.snapGroup = new THREE.Group();
        this.snapGroup.name = 'snap-markers';
        this.scene.add(this.snapGroup);

        this.drawingGroup = new THREE.Group();
        this.drawingGroup.name = 'drawing-preview';
        this.scene.add(this.drawingGroup);

        // Initialize raycaster for selection
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line = { threshold: 5 };  // Increase line picking threshold
        this.raycaster.params.Points = { threshold: 5 };

        // Create selection box element for box zoom
        this.createSelectionBox();

        // Setup event listeners
        this.setupEventListeners();

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            this.handleResize();
        });
        resizeObserver.observe(container);

        // Initial render
        this.render();
    }

    private createSelectionBox(): void {
        this.selectionBox = document.createElement('div');
        this.selectionBox.id = 'selection-box';
        this.container.appendChild(this.selectionBox);
    }

    private updateSelectionBox(): void {
        if (!this.selectionBox) return;

        const rect = this.container.getBoundingClientRect();
        const left = Math.min(this.boxZoomStart.x, this.boxZoomEnd.x) - rect.left;
        const top = Math.min(this.boxZoomStart.y, this.boxZoomEnd.y) - rect.top;
        const width = Math.abs(this.boxZoomEnd.x - this.boxZoomStart.x);
        const height = Math.abs(this.boxZoomEnd.y - this.boxZoomStart.y);

        this.selectionBox.style.left = `${left}px`;
        this.selectionBox.style.top = `${top}px`;
        this.selectionBox.style.width = `${width}px`;
        this.selectionBox.style.height = `${height}px`;
        this.selectionBox.classList.add('visible');
    }

    private hideSelectionBox(): void {
        if (this.selectionBox) {
            this.selectionBox.classList.remove('visible');
        }
    }

    private setupEventListeners(): void {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
            this.viewWidth *= zoomFactor;
            this.updateCamera();
            this.render();
        });

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                // Left button: Shift+drag = box zoom, otherwise no pan (selection only)
                if (e.shiftKey) {
                    this.isBoxZooming = true;
                    this.boxZoomStart = { x: e.clientX, y: e.clientY };
                    this.boxZoomEnd = { x: e.clientX, y: e.clientY };
                    this.container.classList.add('selecting');
                    this.updateSelectionBox();
                }
                // Left button without shift: no pan, just allow click selection
            } else if (e.button === 1) {
                // Middle button (wheel) = pan
                this.isDragging = true;
                this.lastMousePos = { x: e.clientX, y: e.clientY };
                this.container.classList.add('panning');
                e.preventDefault(); // Prevent default middle-click behavior
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (this.isBoxZooming) {
                // Update box zoom selection
                this.boxZoomEnd = { x: e.clientX, y: e.clientY };
                this.updateSelectionBox();
            } else if (this.isDragging) {
                const dx = e.clientX - this.lastMousePos.x;
                const dy = e.clientY - this.lastMousePos.y;

                // Convert screen pixels to world units
                const scale = this.viewWidth / this.container.clientWidth;
                this.viewCenter.x -= dx * scale;
                this.viewCenter.y += dy * scale;

                this.lastMousePos = { x: e.clientX, y: e.clientY };
                this.updateCamera();
                this.render();
            } else {
                // Hover detection
                this.handleHover(e);
            }

            // Update coordinates display
            this.updateCoordinates(e);
        });

        canvas.addEventListener('mouseup', (e) => {
            if (this.isBoxZooming) {
                this.isBoxZooming = false;
                this.container.classList.remove('selecting');
                this.hideSelectionBox();

                // Perform box zoom if selection is large enough
                const dx = Math.abs(this.boxZoomEnd.x - this.boxZoomStart.x);
                const dy = Math.abs(this.boxZoomEnd.y - this.boxZoomStart.y);
                if (dx > 10 && dy > 10) {
                    this.zoomToBox();
                }
            } else if (!this.isDragging) {
                // Handle click for selection
                this.handleClick(e);
            }
            this.isDragging = false;
            this.container.classList.remove('panning');
        });

        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.container.classList.remove('panning');
            if (this.isBoxZooming) {
                this.isBoxZooming = false;
                this.container.classList.remove('selecting');
                this.hideSelectionBox();
            }
            // Clear hover state
            this.clearHover();
        });
    }

    private updateCoordinates(e: MouseEvent): void {
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert to world coordinates
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const worldX = this.viewCenter.x + (x / this.container.clientWidth - 0.5) * this.viewWidth;
        const worldY = this.viewCenter.y + (0.5 - y / this.container.clientHeight) * this.viewWidth / aspect;

        const coordsElement = document.getElementById('coords');
        if (coordsElement) {
            coordsElement.textContent = `X: ${worldX.toFixed(2)}, Y: ${worldY.toFixed(2)}`;
        }
    }

    private handleResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.renderer.setSize(width, height);
        this.updateCamera();
        this.render();
    }

    private updateCamera(): void {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const halfWidth = this.viewWidth / 2;
        const halfHeight = halfWidth / aspect;

        this.camera.left = this.viewCenter.x - halfWidth;
        this.camera.right = this.viewCenter.x + halfWidth;
        this.camera.top = this.viewCenter.y + halfHeight;
        this.camera.bottom = this.viewCenter.y - halfHeight;
        this.camera.updateProjectionMatrix();
    }

    render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    loadDxf(dxf: ParsedDxf): void {
        this.parsedDxf = dxf;

        // Clear existing entities
        while (this.entityGroup.children.length > 0) {
            this.entityGroup.remove(this.entityGroup.children[0]);
        }

        // Initialize layer visibility
        this.layerVisibility.clear();
        for (const [layerName, layer] of dxf.layers) {
            this.layerVisibility.set(layerName, !layer.frozen && !layer.off);
        }
        this.layerVisibility.set('0', true); // Default layer always visible

        // Render entities
        for (const entity of dxf.entities) {
            const object = this.renderEntity(entity, dxf);
            if (object) {
                object.userData.entity = entity;
                object.userData.layer = entity.layer;
                this.entityGroup.add(object);
            }
        }

        // Fit view to content
        this.fitView();
    }

    private renderEntity(entity: DxfEntity, dxf: ParsedDxf): THREE.Object3D | null {
        // Skip invisible entities
        if (entity.visible === false) {
            return null;
        }

        // Resolve color: use entity color if valid, otherwise use layer color
        let color: number;
        if (entity.color !== undefined && entity.color !== COLOR_BYLAYER && entity.color !== COLOR_BYBLOCK) {
            color = aciToColor(entity.color);
        } else {
            color = this.getLayerColor(entity.layer, dxf);
        }

        // Resolve linetype
        const lineType = this.resolveLineType(entity, dxf);

        switch (entity.type) {
            case 'LINE':
                return this.renderLine(entity as DxfLine, color, lineType);
            case 'CIRCLE':
                return this.renderCircle(entity as DxfCircle, color, lineType);
            case 'ARC':
                return this.renderArc(entity as DxfArc, color, lineType);
            case 'POLYLINE':
            case 'LWPOLYLINE':
                return this.renderPolyline(entity as DxfPolyline, color, lineType);
            case 'TEXT':
            case 'MTEXT':
                return this.renderText(entity as DxfText, color);
            case 'POINT':
                return this.renderPoint(entity as DxfPoint_, color);
            case 'INSERT':
                return this.renderInsert(entity as DxfInsert, color, dxf);
            case 'ELLIPSE':
                return this.renderEllipse(entity as DxfEllipse, color, lineType);
            case 'SPLINE':
                return this.renderSpline(entity as DxfSpline, color, lineType);
            case 'HATCH':
                return this.renderHatch(entity as DxfHatch, color);
            case 'DIMENSION':
                return this.renderDimension(entity as DxfDimension, color, dxf);
            case 'SOLID':
            case '3DFACE':
                return this.renderSolid(entity as DxfSolid, color);
            case 'ATTRIB':
            case 'ATTDEF':
                return this.renderAttrib(entity as DxfAttrib, color);
            case 'LEADER':
                return this.renderLeader(entity as DxfLeader, color);
            case 'WIPEOUT':
                return this.renderWipeout(entity as DxfWipeout);
            default:
                return null;
        }
    }

    private getLayerColor(layerName: string, dxf: ParsedDxf): number {
        const layer = dxf.layers.get(layerName);
        if (layer && layer.color) {
            return aciToColor(layer.color);
        }
        return 0xffffff;
    }

    private resolveLineType(entity: DxfEntity, dxf: ParsedDxf): DxfLineType | null {
        // Use entity linetype if specified
        let lineTypeName = entity.lineType?.toUpperCase();

        // If BYLAYER or not specified, get from layer
        if (!lineTypeName || lineTypeName === 'BYLAYER') {
            const layer = dxf.layers.get(entity.layer);
            if (layer?.lineType) {
                lineTypeName = layer.lineType.toUpperCase();
            }
        }

        // If still not found or CONTINUOUS, return null (solid line)
        if (!lineTypeName || lineTypeName === 'CONTINUOUS' || lineTypeName === 'BYBLOCK') {
            return null;
        }

        return dxf.lineTypes.get(lineTypeName) || null;
    }

    private createLineMaterial(color: number, lineType: DxfLineType | null): THREE.Material {
        if (!lineType || lineType.pattern.length === 0) {
            return this.materialCache.getLineBasicMaterial(color);
        }

        // Calculate dash and gap sizes from pattern
        // Pattern elements: positive=dash, negative=gap, 0=dot
        const dashSize = lineType.pattern.find(p => p > 0) || 1;
        const gapSize = Math.abs(lineType.pattern.find(p => p < 0) || 0) || dashSize * 0.5;

        return this.materialCache.getLineDashedMaterial(color, Math.abs(dashSize), Math.abs(gapSize));
    }

    private renderLine(line: DxfLine, color: number, lineType: DxfLineType | null): THREE.Line {
        const geometry = new THREE.BufferGeometry();
        const points = [
            new THREE.Vector3(line.start.x, line.start.y, 0),
            new THREE.Vector3(line.end.x, line.end.y, 0)
        ];
        geometry.setFromPoints(points);

        const material = this.createLineMaterial(color, lineType);
        const lineObj = new THREE.Line(geometry, material);

        // Compute line distances for dashed lines
        if (material instanceof THREE.LineDashedMaterial) {
            lineObj.computeLineDistances();
        }

        return lineObj;
    }

    private renderCircle(circle: DxfCircle, color: number, lineType: DxfLineType | null): THREE.Line {
        const segments = 64;
        const geometry = new THREE.BufferGeometry();
        const points: THREE.Vector3[] = [];

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                circle.center.x + Math.cos(angle) * circle.radius,
                circle.center.y + Math.sin(angle) * circle.radius,
                0
            ));
        }

        geometry.setFromPoints(points);
        const material = this.createLineMaterial(color, lineType);
        const lineObj = new THREE.Line(geometry, material);

        if (material instanceof THREE.LineDashedMaterial) {
            lineObj.computeLineDistances();
        }

        return lineObj;
    }

    private renderArc(arc: DxfArc, color: number, lineType: DxfLineType | null): THREE.Line {
        const segments = 64;
        const geometry = new THREE.BufferGeometry();
        const points: THREE.Vector3[] = [];

        // Convert degrees to radians
        let startAngle = arc.startAngle * Math.PI / 180;
        let endAngle = arc.endAngle * Math.PI / 180;

        // Handle arc direction
        if (endAngle < startAngle) {
            endAngle += Math.PI * 2;
        }

        const arcAngle = endAngle - startAngle;
        const segmentCount = Math.max(8, Math.ceil(segments * arcAngle / (Math.PI * 2)));

        for (let i = 0; i <= segmentCount; i++) {
            const angle = startAngle + (i / segmentCount) * arcAngle;
            points.push(new THREE.Vector3(
                arc.center.x + Math.cos(angle) * arc.radius,
                arc.center.y + Math.sin(angle) * arc.radius,
                0
            ));
        }

        geometry.setFromPoints(points);
        const material = this.createLineMaterial(color, lineType);
        const lineObj = new THREE.Line(geometry, material);

        if (material instanceof THREE.LineDashedMaterial) {
            lineObj.computeLineDistances();
        }

        return lineObj;
    }

    private renderPolyline(polyline: DxfPolyline, color: number, lineType: DxfLineType | null): THREE.Line {
        if (polyline.vertices.length < 2) {
            return new THREE.Line();
        }

        const geometry = new THREE.BufferGeometry();
        const points = polyline.vertices.map(v => new THREE.Vector3(v.x, v.y, 0));

        if (polyline.closed && points.length > 0) {
            points.push(points[0].clone());
        }

        geometry.setFromPoints(points);
        const material = this.createLineMaterial(color, lineType);
        const lineObj = new THREE.Line(geometry, material);

        if (material instanceof THREE.LineDashedMaterial) {
            lineObj.computeLineDistances();
        }

        return lineObj;
    }

    // Font stack that supports Korean, Japanese, Chinese and Western characters
    private static readonly FONT_FAMILY = '"Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans KR", "NanumGothic", "나눔고딕", "Dotum", "돋움", "Gulim", "굴림", "Microsoft YaHei", "SimSun", "Meiryo", "MS Gothic", Arial, sans-serif';

    private renderText(text: DxfText, color: number): THREE.Sprite {
        // Create text sprite using canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;

        const fontSize = 64;
        const fontFamily = DxfRenderer.FONT_FAMILY;
        context.font = `${fontSize}px ${fontFamily}`;
        const metrics = context.measureText(text.text);

        // Ensure minimum width for empty or very short text
        canvas.width = Math.max(Math.ceil(metrics.width) + 20, 40);
        canvas.height = fontSize + 20;

        // Clear with transparent background
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw text with Korean-supporting font
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.font = `${fontSize}px ${fontFamily}`;
        context.textBaseline = 'top';
        context.fillText(text.text, 10, 10);

        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);

        // Scale sprite to match DXF text height
        const scale = text.height / fontSize * canvas.height;
        const spriteWidth = scale * canvas.width / canvas.height;
        const spriteHeight = scale;
        sprite.scale.set(spriteWidth, spriteHeight, 1);

        // Calculate position with alignment offset
        let posX = text.position.x;
        let posY = text.position.y;

        if (text.type === 'MTEXT' && text.attachmentPoint) {
            // MTEXT attachment points: 1=TL, 2=TC, 3=TR, 4=ML, 5=MC, 6=MR, 7=BL, 8=BC, 9=BR
            const ap = text.attachmentPoint;

            // Horizontal offset
            if (ap === 1 || ap === 4 || ap === 7) {
                // Left - offset to center (sprite center is at position)
                posX += spriteWidth / 2;
            } else if (ap === 3 || ap === 6 || ap === 9) {
                // Right
                posX -= spriteWidth / 2;
            }
            // Center (2, 5, 8) - no horizontal offset needed

            // Vertical offset
            if (ap === 1 || ap === 2 || ap === 3) {
                // Top
                posY -= spriteHeight / 2;
            } else if (ap === 7 || ap === 8 || ap === 9) {
                // Bottom
                posY += spriteHeight / 2;
            }
            // Middle (4, 5, 6) - no vertical offset needed
        } else if (text.type === 'TEXT') {
            // TEXT alignment
            const hAlign = text.horizontalAlignment || 0;
            const vAlign = text.verticalAlignment || 0;

            // Horizontal alignment: 0=Left, 1=Center, 2=Right, 3=Aligned, 4=Middle, 5=Fit
            if (hAlign === 0) {
                // Left - sprite center should be offset right
                posX += spriteWidth / 2;
            } else if (hAlign === 2) {
                // Right
                posX -= spriteWidth / 2;
            }
            // Center (1), Middle (4) - no horizontal offset

            // Vertical alignment: 0=Baseline, 1=Bottom, 2=Middle, 3=Top
            if (vAlign === 0) {
                // Baseline - approximately 20% up from bottom
                posY += spriteHeight * 0.3;
            } else if (vAlign === 1) {
                // Bottom
                posY += spriteHeight / 2;
            } else if (vAlign === 3) {
                // Top
                posY -= spriteHeight / 2;
            }
            // Middle (2) - no vertical offset
        }

        sprite.position.set(posX, posY, 0);

        // Apply rotation if specified
        if (text.rotation) {
            sprite.material.rotation = text.rotation * Math.PI / 180;
        }

        return sprite;
    }

    private renderPoint(point: DxfPoint_, color: number): THREE.Points {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([point.position.x, point.position.y, 0], 3));

        const material = this.materialCache.getPointMaterial(color, 5);
        return new THREE.Points(geometry, material);
    }

    private renderInsert(insert: DxfInsert, _color: number, dxf: ParsedDxf): THREE.Group | null {
        const block = dxf.blocks.get(insert.blockName);
        if (!block) {
            return null;
        }

        const group = new THREE.Group();

        for (const entity of block.entities) {
            const object = this.renderEntity(entity, dxf);
            if (object) {
                group.add(object);
            }
        }

        // Apply transformation
        group.position.set(
            insert.position.x - block.basePoint.x * insert.scale.x,
            insert.position.y - block.basePoint.y * insert.scale.y,
            0
        );
        group.scale.set(insert.scale.x, insert.scale.y, 1);
        group.rotation.z = insert.rotation * Math.PI / 180;

        return group;
    }

    private renderEllipse(ellipse: DxfEllipse, color: number, lineType: DxfLineType | null): THREE.Line {
        const segments = 64;
        const geometry = new THREE.BufferGeometry();
        const points: THREE.Vector3[] = [];

        // Calculate major and minor axes
        const majorLength = Math.sqrt(
            ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorLength = majorLength * ellipse.ratio;
        const rotation = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);

        // Generate ellipse points
        let startAngle = ellipse.startAngle;
        let endAngle = ellipse.endAngle;
        if (endAngle < startAngle) {
            endAngle += Math.PI * 2;
        }

        const angleRange = endAngle - startAngle;
        const segmentCount = Math.max(8, Math.ceil(segments * angleRange / (Math.PI * 2)));

        for (let i = 0; i <= segmentCount; i++) {
            const t = startAngle + (i / segmentCount) * angleRange;
            // Parametric ellipse
            const x = majorLength * Math.cos(t);
            const y = minorLength * Math.sin(t);
            // Rotate to match major axis orientation
            const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
            const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);
            points.push(new THREE.Vector3(
                ellipse.center.x + rotatedX,
                ellipse.center.y + rotatedY,
                0
            ));
        }

        geometry.setFromPoints(points);
        const material = this.createLineMaterial(color, lineType);
        const lineObj = new THREE.Line(geometry, material);

        if (material instanceof THREE.LineDashedMaterial) {
            lineObj.computeLineDistances();
        }

        return lineObj;
    }

    private renderSpline(spline: DxfSpline, color: number, lineType: DxfLineType | null): THREE.Line {
        const geometry = new THREE.BufferGeometry();
        const points: THREE.Vector3[] = [];

        // Use control points or fit points depending on what's available
        const sourcePoints = spline.controlPoints.length > 0 ? spline.controlPoints : spline.fitPoints;

        if (sourcePoints.length < 2) {
            return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }));
        }

        if (spline.degree >= 2 && sourcePoints.length >= 3) {
            // Approximate spline using Catmull-Rom-like interpolation
            const segments = Math.max(sourcePoints.length * 10, 50);
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const point = this.interpolateSpline(sourcePoints, t, spline.closed);
                points.push(new THREE.Vector3(point.x, point.y, 0));
            }
        } else {
            // Fall back to polyline for simple cases
            for (const p of sourcePoints) {
                points.push(new THREE.Vector3(p.x, p.y, 0));
            }
            if (spline.closed && sourcePoints.length > 0) {
                points.push(new THREE.Vector3(sourcePoints[0].x, sourcePoints[0].y, 0));
            }
        }

        geometry.setFromPoints(points);
        const material = this.createLineMaterial(color, lineType);
        const lineObj = new THREE.Line(geometry, material);

        if (material instanceof THREE.LineDashedMaterial) {
            lineObj.computeLineDistances();
        }

        return lineObj;
    }

    private interpolateSpline(points: { x: number; y: number }[], t: number, closed: boolean): { x: number; y: number } {
        const n = points.length;
        if (n === 0) return { x: 0, y: 0 };
        if (n === 1) return { x: points[0].x, y: points[0].y };

        // Catmull-Rom spline interpolation
        const totalT = t * (closed ? n : n - 1);
        const i = Math.floor(totalT);
        const localT = totalT - i;

        const getPoint = (index: number) => {
            if (closed) {
                return points[((index % n) + n) % n];
            }
            return points[Math.max(0, Math.min(n - 1, index))];
        };

        const p0 = getPoint(i - 1);
        const p1 = getPoint(i);
        const p2 = getPoint(i + 1);
        const p3 = getPoint(i + 2);

        // Catmull-Rom formula
        const t2 = localT * localT;
        const t3 = t2 * localT;

        const x = 0.5 * (
            (2 * p1.x) +
            (-p0.x + p2.x) * localT +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        const y = 0.5 * (
            (2 * p1.y) +
            (-p0.y + p2.y) * localT +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        return { x, y };
    }

    private renderHatch(hatch: DxfHatch, color: number): THREE.Group {
        const group = new THREE.Group();

        // Render each boundary path as a closed polyline
        const lineMaterial = this.materialCache.getLineBasicMaterial(color);
        for (const path of hatch.boundaryPaths) {
            if (path.length < 2) continue;

            const points = path.map(p => new THREE.Vector3(p.x, p.y, 0));
            points.push(points[0].clone()); // Close the path

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            group.add(new THREE.Line(geometry, lineMaterial));
        }

        // For solid hatches, fill with a mesh
        if (hatch.solid && hatch.boundaryPaths.length > 0) {
            const fillMaterial = this.materialCache.getMeshMaterial(color, 0.3, true);
            for (const path of hatch.boundaryPaths) {
                if (path.length >= 3) {
                    try {
                        const shape = new THREE.Shape();
                        shape.moveTo(path[0].x, path[0].y);
                        for (let i = 1; i < path.length; i++) {
                            shape.lineTo(path[i].x, path[i].y);
                        }
                        shape.closePath();

                        const shapeGeometry = new THREE.ShapeGeometry(shape);
                        const mesh = new THREE.Mesh(shapeGeometry, fillMaterial);
                        mesh.position.z = -0.01; // Slightly behind lines
                        group.add(mesh);
                    } catch (e) {
                        // Ignore fill errors for complex shapes
                    }
                }
            }
        } else if (!hatch.solid && hatch.patternName) {
            // Non-solid hatches: draw pattern lines
            this.renderHatchPattern(hatch, color, group);
        }

        return group;
    }

    private renderHatchPattern(hatch: DxfHatch, color: number, group: THREE.Group): void {
        // Get bounding box for the hatch
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const path of hatch.boundaryPaths) {
            for (const p of path) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
        }

        if (!isFinite(minX)) return;

        const width = maxX - minX;
        const height = maxY - minY;
        const size = Math.max(width, height);
        if (size < 0.001) return;

        // Determine pattern spacing based on pattern name
        const spacing = this.getHatchPatternSpacing(hatch.patternName, size);
        const angle = this.getHatchPatternAngle(hatch.patternName);

        // Create pattern lines
        const lineMaterial = this.materialCache.getLineBasicMaterial(color);

        // Generate lines at the specified angle
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const diagonal = Math.sqrt(width * width + height * height) * 1.5;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const numLines = Math.ceil(diagonal / spacing);

        // Generate and clip lines for each boundary path
        for (const boundaryPath of hatch.boundaryPaths) {
            if (boundaryPath.length < 3) continue;

            for (let i = -numLines; i <= numLines; i++) {
                const offset = i * spacing;

                // Line perpendicular to angle direction
                const perpX = -sin * offset;
                const perpY = cos * offset;

                const startX = centerX + perpX - cos * diagonal;
                const startY = centerY + perpY - sin * diagonal;
                const endX = centerX + perpX + cos * diagonal;
                const endY = centerY + perpY + sin * diagonal;

                // Clip line to boundary polygon
                const clippedSegments = this.clipLineToPolygon(
                    { x: startX, y: startY },
                    { x: endX, y: endY },
                    boundaryPath
                );

                // Add clipped line segments
                for (const segment of clippedSegments) {
                    const points = [
                        new THREE.Vector3(segment.start.x, segment.start.y, -0.005),
                        new THREE.Vector3(segment.end.x, segment.end.y, -0.005)
                    ];
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    group.add(new THREE.Line(geometry, lineMaterial));
                }
            }

            // Add cross-hatching for certain patterns
            if (this.isCrossHatchPattern(hatch.patternName)) {
                const crossAngle = angle + Math.PI / 2;
                const crossCos = Math.cos(crossAngle);
                const crossSin = Math.sin(crossAngle);

                for (let i = -numLines; i <= numLines; i++) {
                    const offset = i * spacing;

                    const perpX = -crossSin * offset;
                    const perpY = crossCos * offset;

                    const startX = centerX + perpX - crossCos * diagonal;
                    const startY = centerY + perpY - crossSin * diagonal;
                    const endX = centerX + perpX + crossCos * diagonal;
                    const endY = centerY + perpY + crossSin * diagonal;

                    // Clip line to boundary polygon
                    const clippedSegments = this.clipLineToPolygon(
                        { x: startX, y: startY },
                        { x: endX, y: endY },
                        boundaryPath
                    );

                    // Add clipped line segments
                    for (const segment of clippedSegments) {
                        const points = [
                            new THREE.Vector3(segment.start.x, segment.start.y, -0.005),
                            new THREE.Vector3(segment.end.x, segment.end.y, -0.005)
                        ];
                        const geometry = new THREE.BufferGeometry().setFromPoints(points);
                        group.add(new THREE.Line(geometry, lineMaterial));
                    }
                }
            }
        }
    }

    // Clip a line segment to a polygon boundary
    private clipLineToPolygon(
        lineStart: { x: number; y: number },
        lineEnd: { x: number; y: number },
        polygon: { x: number; y: number }[]
    ): Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> {
        const result: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> = [];

        // Find all intersection points with polygon edges
        const intersections: { t: number; point: { x: number; y: number } }[] = [];

        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;

        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];

            const intersection = this.lineSegmentIntersection(
                lineStart, lineEnd, p1, p2
            );

            if (intersection) {
                // Calculate parameter t along the line
                const t = Math.abs(dx) > Math.abs(dy)
                    ? (intersection.x - lineStart.x) / dx
                    : (intersection.y - lineStart.y) / dy;

                if (t >= 0 && t <= 1) {
                    intersections.push({ t, point: intersection });
                }
            }
        }

        // Sort intersections by parameter t
        intersections.sort((a, b) => a.t - b.t);

        // Check if start point is inside polygon
        const startInside = this.isPointInPolygon(lineStart, polygon);

        // Build segments that are inside the polygon
        let inside = startInside;
        let currentStart = lineStart;

        for (const intersection of intersections) {
            if (inside) {
                // We're inside, so add segment from currentStart to intersection
                result.push({
                    start: { ...currentStart },
                    end: { ...intersection.point }
                });
            }
            // Toggle inside/outside state
            inside = !inside;
            currentStart = intersection.point;
        }

        // If we end inside the polygon, add final segment
        if (inside) {
            result.push({
                start: { ...currentStart },
                end: { ...lineEnd }
            });
        }

        return result;
    }

    // Calculate intersection point of two line segments
    private lineSegmentIntersection(
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        p3: { x: number; y: number },
        p4: { x: number; y: number }
    ): { x: number; y: number } | null {
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x;
        const d2y = p4.y - p3.y;

        const cross = d1x * d2y - d1y * d2x;

        // Lines are parallel
        if (Math.abs(cross) < 1e-10) {
            return null;
        }

        const dx = p3.x - p1.x;
        const dy = p3.y - p1.y;

        const t = (dx * d2y - dy * d2x) / cross;
        const u = (dx * d1y - dy * d1x) / cross;

        // Check if intersection is within both segments
        if (u >= 0 && u <= 1) {
            return {
                x: p1.x + t * d1x,
                y: p1.y + t * d1y
            };
        }

        return null;
    }

    // Check if a point is inside a polygon using ray casting
    private isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
        let inside = false;
        const n = polygon.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    private getHatchPatternSpacing(patternName: string, size: number): number {
        // Base spacing relative to bounding box size
        const baseSpacing = size / 20;

        const name = patternName.toUpperCase();
        switch (name) {
            case 'ANSI31':
            case 'ANSI32':
            case 'ANSI33':
            case 'ANSI34':
            case 'ANSI35':
            case 'ANSI36':
            case 'ANSI37':
            case 'ANSI38':
                return baseSpacing;
            case 'BRICK':
            case 'STONE':
                return baseSpacing * 2;
            case 'GRASS':
            case 'SAND':
                return baseSpacing * 0.5;
            default:
                return baseSpacing;
        }
    }

    private getHatchPatternAngle(patternName: string): number {
        const name = patternName.toUpperCase();
        switch (name) {
            case 'ANSI31':  // 45 degrees
            case 'ANSI34':
            case 'ANSI37':
                return Math.PI / 4;
            case 'ANSI32':  // 45 degrees (cross-hatch)
            case 'ANSI35':
            case 'ANSI38':
                return Math.PI / 4;
            case 'ANSI33':  // Horizontal
            case 'ANSI36':
                return 0;
            default:
                return Math.PI / 4;  // Default 45 degrees
        }
    }

    private isCrossHatchPattern(patternName: string): boolean {
        const name = patternName.toUpperCase();
        return ['ANSI32', 'ANSI35', 'ANSI38', 'CROSS', 'HATCH', 'BRICK'].includes(name);
    }

    private renderDimension(dimension: DxfDimension, color: number, dxf: ParsedDxf): THREE.Group {
        const group = new THREE.Group();

        // Try to render from the dimension's block reference (e.g., *D3)
        // This is the proper way as AutoCAD stores dimension graphics in blocks
        if (dimension.blockName) {
            const block = dxf.blocks.get(dimension.blockName);
            if (block && block.entities.length > 0) {
                for (const entity of block.entities) {
                    const object = this.renderEntity(entity, dxf);
                    if (object) {
                        group.add(object);
                    }
                }
                // Block entities are already in world coordinates, no transformation needed
                return group;
            }
        }

        // Fallback: Draw simple dimension representation if block not found
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(dimension.definitionPoint.x, dimension.definitionPoint.y, 0),
            new THREE.Vector3(dimension.middlePoint.x, dimension.middlePoint.y, 0)
        ]);
        group.add(new THREE.Line(lineGeometry, this.materialCache.getLineBasicMaterial(color)));

        // Draw dimension text if present
        if (dimension.text) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;

            const fontSize = 32;
            const fontFamily = DxfRenderer.FONT_FAMILY;
            context.font = `${fontSize}px ${fontFamily}`;
            const metrics = context.measureText(dimension.text);

            canvas.width = Math.max(Math.ceil(metrics.width) + 10, 30);
            canvas.height = fontSize + 10;

            context.clearRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#' + color.toString(16).padStart(6, '0');
            context.font = `${fontSize}px ${fontFamily}`;
            context.textBaseline = 'top';
            context.fillText(dimension.text, 5, 5);

            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(material);

            // Calculate a reasonable scale based on distance
            const dist = Math.sqrt(
                Math.pow(dimension.middlePoint.x - dimension.definitionPoint.x, 2) +
                Math.pow(dimension.middlePoint.y - dimension.definitionPoint.y, 2)
            );
            const scale = Math.max(dist * 0.1, 2);
            sprite.scale.set(scale * canvas.width / canvas.height, scale, 1);
            sprite.position.set(dimension.middlePoint.x, dimension.middlePoint.y, 0);
            group.add(sprite);
        }

        return group;
    }

    private renderSolid(solid: DxfSolid, color: number): THREE.Mesh | THREE.Group {
        const group = new THREE.Group();

        // SOLID has a special vertex order: 0, 1, 3, 2 (not 0, 1, 2, 3)
        // This is a quirk of the DXF format
        const p0 = solid.points[0];
        const p1 = solid.points[1];
        const p2 = solid.points[2];
        const p3 = solid.points[3];

        // Check if it's a triangle (p2 and p3 are the same) or quadrilateral
        const isTriangle = (p2.x === p3.x && p2.y === p3.y);

        try {
            const shape = new THREE.Shape();
            shape.moveTo(p0.x, p0.y);
            shape.lineTo(p1.x, p1.y);
            if (isTriangle) {
                shape.lineTo(p2.x, p2.y);
            } else {
                // Quadrilateral: use order 0, 1, 3, 2
                shape.lineTo(p3.x, p3.y);
                shape.lineTo(p2.x, p2.y);
            }
            shape.closePath();

            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshBasicMaterial({
                color,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);

            // Also draw outline
            const outlinePoints = isTriangle
                ? [
                    new THREE.Vector3(p0.x, p0.y, 0.01),
                    new THREE.Vector3(p1.x, p1.y, 0.01),
                    new THREE.Vector3(p2.x, p2.y, 0.01),
                    new THREE.Vector3(p0.x, p0.y, 0.01)
                ]
                : [
                    new THREE.Vector3(p0.x, p0.y, 0.01),
                    new THREE.Vector3(p1.x, p1.y, 0.01),
                    new THREE.Vector3(p3.x, p3.y, 0.01),
                    new THREE.Vector3(p2.x, p2.y, 0.01),
                    new THREE.Vector3(p0.x, p0.y, 0.01)
                ];

            const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
            const outlineMaterial = new THREE.LineBasicMaterial({ color });
            group.add(new THREE.Line(outlineGeometry, outlineMaterial));

        } catch (e) {
            // Fallback to just outline if shape fails
            const points = [
                new THREE.Vector3(p0.x, p0.y, 0),
                new THREE.Vector3(p1.x, p1.y, 0),
                new THREE.Vector3(p3.x, p3.y, 0),
                new THREE.Vector3(p2.x, p2.y, 0),
                new THREE.Vector3(p0.x, p0.y, 0)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color });
            group.add(new THREE.Line(geometry, material));
        }

        return group;
    }

    private renderAttrib(attrib: DxfAttrib, color: number): THREE.Sprite {
        // Render ATTRIB/ATTDEF similar to TEXT
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;

        const fontSize = 64;
        const fontFamily = DxfRenderer.FONT_FAMILY;
        context.font = `${fontSize}px ${fontFamily}`;
        const displayText = attrib.text || attrib.tag || '';
        const metrics = context.measureText(displayText);

        canvas.width = Math.max(Math.ceil(metrics.width) + 20, 40);
        canvas.height = fontSize + 20;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.font = `${fontSize}px ${fontFamily}`;
        context.textBaseline = 'top';
        context.fillText(displayText, 10, 10);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);

        const scale = attrib.height / fontSize * canvas.height;
        const spriteWidth = scale * canvas.width / canvas.height;
        const spriteHeight = scale;
        sprite.scale.set(spriteWidth, spriteHeight, 1);

        // Apply alignment
        let posX = attrib.position.x;
        let posY = attrib.position.y;
        const hAlign = attrib.horizontalAlignment || 0;
        const vAlign = attrib.verticalAlignment || 0;

        if (hAlign === 0) {
            posX += spriteWidth / 2;
        } else if (hAlign === 2) {
            posX -= spriteWidth / 2;
        }

        if (vAlign === 0) {
            posY += spriteHeight * 0.3;
        } else if (vAlign === 1) {
            posY += spriteHeight / 2;
        } else if (vAlign === 3) {
            posY -= spriteHeight / 2;
        }

        sprite.position.set(posX, posY, 0);

        if (attrib.rotation) {
            sprite.material.rotation = attrib.rotation * Math.PI / 180;
        }

        return sprite;
    }

    private renderLeader(leader: DxfLeader, color: number): THREE.Group {
        const group = new THREE.Group();

        if (leader.vertices.length < 2) {
            return group;
        }

        // Draw leader line
        const points = leader.vertices.map(v => new THREE.Vector3(v.x, v.y, 0));
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = this.materialCache.getLineBasicMaterial(color);
        group.add(new THREE.Line(lineGeometry, lineMaterial));

        // Draw arrowhead if enabled
        if (leader.hasArrowhead && leader.vertices.length >= 2) {
            const start = leader.vertices[0];
            const next = leader.vertices[1];

            const dx = next.x - start.x;
            const dy = next.y - start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const arrowSize = Math.min(length * 0.15, 5);

            if (arrowSize > 0.1) {
                const angle = Math.atan2(dy, dx);
                const arrowAngle = Math.PI / 6;

                const arrowPoints = [
                    new THREE.Vector3(
                        start.x + arrowSize * Math.cos(angle - arrowAngle),
                        start.y + arrowSize * Math.sin(angle - arrowAngle),
                        0
                    ),
                    new THREE.Vector3(start.x, start.y, 0),
                    new THREE.Vector3(
                        start.x + arrowSize * Math.cos(angle + arrowAngle),
                        start.y + arrowSize * Math.sin(angle + arrowAngle),
                        0
                    )
                ];

                const arrowGeometry = new THREE.BufferGeometry().setFromPoints(arrowPoints);
                group.add(new THREE.Line(arrowGeometry, lineMaterial));
            }
        }

        return group;
    }

    private renderWipeout(wipeout: DxfWipeout): THREE.Mesh | null {
        if (wipeout.clipBoundary.length < 3) {
            return null;
        }

        try {
            const shape = new THREE.Shape();
            shape.moveTo(wipeout.clipBoundary[0].x, wipeout.clipBoundary[0].y);
            for (let i = 1; i < wipeout.clipBoundary.length; i++) {
                shape.lineTo(wipeout.clipBoundary[i].x, wipeout.clipBoundary[i].y);
            }
            shape.closePath();

            const geometry = new THREE.ShapeGeometry(shape);
            // Use the scene background color to mask underlying content
            const material = new THREE.MeshBasicMaterial({
                color: 0x1e1e1e,  // Match scene background
                side: THREE.DoubleSide,
                depthWrite: true
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.z = 0.1;  // Render slightly in front to occlude other entities
            return mesh;
        } catch (e) {
            console.error('Failed to render WIPEOUT:', e);
            return null;
        }
    }

    fitView(padding: number = 0.1): void {
        if (!this.parsedDxf) {
            return;
        }

        const bounds = this.parsedDxf.bounds;
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;

        this.viewCenter.x = bounds.minX + width / 2;
        this.viewCenter.y = bounds.minY + height / 2;

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.viewWidth = Math.max(width, height * aspect) * (1 + padding);

        this.updateCamera();
        this.render();
    }

    zoomIn(): void {
        this.viewWidth *= 0.8;
        this.updateCamera();
        this.render();
    }

    zoomOut(): void {
        this.viewWidth *= 1.25;
        this.updateCamera();
        this.render();
    }

    setLayerVisibility(layerName: string, visible: boolean): void {
        this.layerVisibility.set(layerName, visible);

        this.entityGroup.traverse((object) => {
            if (object.userData.layer === layerName) {
                object.visible = visible;
            }
        });

        this.render();
    }

    toggleLayerVisibility(layerName: string, visible: boolean): void {
        this.setLayerVisibility(layerName, visible);
    }

    getLayerVisibility(): Map<string, boolean> {
        return new Map(this.layerVisibility);
    }

    getLayers(): Array<{ name: string; color: number; visible: boolean; entityCount: number }> {
        if (!this.parsedDxf) {
            return [];
        }

        // Count entities per layer
        const entityCounts = new Map<string, number>();
        for (const entity of this.parsedDxf.entities) {
            const count = entityCounts.get(entity.layer) || 0;
            entityCounts.set(entity.layer, count + 1);
        }

        const layers: Array<{ name: string; color: number; visible: boolean; entityCount: number }> = [];

        // Add default layer if it has entities
        if (entityCounts.has('0') && !this.parsedDxf.layers.has('0')) {
            layers.push({
                name: '0',
                color: 0xffffff,
                visible: this.layerVisibility.get('0') ?? true,
                entityCount: entityCounts.get('0') || 0
            });
        }

        // Add all layers from DXF
        for (const [name, layer] of this.parsedDxf.layers) {
            layers.push({
                name,
                color: aciToColor(layer.color),
                visible: this.layerVisibility.get(name) ?? true,
                entityCount: entityCounts.get(name) || 0
            });
        }

        // Add layers that have entities but weren't defined in TABLES
        for (const [layerName, count] of entityCounts) {
            if (!layers.find(l => l.name === layerName)) {
                layers.push({
                    name: layerName,
                    color: 0xffffff,
                    visible: this.layerVisibility.get(layerName) ?? true,
                    entityCount: count
                });
            }
        }

        // Sort by name
        layers.sort((a, b) => a.name.localeCompare(b.name));

        return layers;
    }

    toggleAllLayers(visible: boolean): void {
        for (const [layerName] of this.layerVisibility) {
            this.layerVisibility.set(layerName, visible);
        }

        this.entityGroup.traverse((object) => {
            if (object.userData.layer !== undefined) {
                object.visible = visible;
            }
        });

        this.render();
    }

    captureImage(): string {
        this.render();
        return this.renderer.domElement.toDataURL('image/png');
    }

    getCanvas(): HTMLCanvasElement {
        return this.renderer.domElement;
    }

    getParsedDxf(): ParsedDxf | null {
        return this.parsedDxf;
    }

    getScene(): THREE.Scene {
        return this.scene;
    }

    getCamera(): THREE.OrthographicCamera {
        return this.camera;
    }

    getAnnotationGroup(): THREE.Group {
        return this.annotationGroup;
    }

    dispose(): void {
        this.materialCache.clear();
        this.renderer.dispose();
    }

    getWidth(): number {
        return this.container.clientWidth;
    }

    getHeight(): number {
        return this.container.clientHeight;
    }

    // ========== Box Zoom ==========

    private zoomToBox(): void {
        const rect = this.container.getBoundingClientRect();

        // Convert screen coordinates to normalized device coordinates
        const startX = (Math.min(this.boxZoomStart.x, this.boxZoomEnd.x) - rect.left) / rect.width;
        const startY = (Math.min(this.boxZoomStart.y, this.boxZoomEnd.y) - rect.top) / rect.height;
        const endX = (Math.max(this.boxZoomStart.x, this.boxZoomEnd.x) - rect.left) / rect.width;
        const endY = (Math.max(this.boxZoomStart.y, this.boxZoomEnd.y) - rect.top) / rect.height;

        // Convert to world coordinates
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const halfWidth = this.viewWidth / 2;
        const halfHeight = halfWidth / aspect;

        const worldMinX = this.viewCenter.x - halfWidth + startX * this.viewWidth;
        const worldMaxX = this.viewCenter.x - halfWidth + endX * this.viewWidth;
        const worldMaxY = this.viewCenter.y + halfHeight - startY * (this.viewWidth / aspect);
        const worldMinY = this.viewCenter.y + halfHeight - endY * (this.viewWidth / aspect);

        // Set new view center and width
        const newWidth = worldMaxX - worldMinX;
        const newHeight = worldMaxY - worldMinY;

        this.viewCenter.x = (worldMinX + worldMaxX) / 2;
        this.viewCenter.y = (worldMinY + worldMaxY) / 2;
        this.viewWidth = Math.max(newWidth, newHeight * aspect) * 1.05; // 5% padding

        this.updateCamera();
        this.render();
    }

    // ========== Hover and Selection ==========

    private screenToNDC(e: MouseEvent): THREE.Vector2 {
        const rect = this.container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        return new THREE.Vector2(x, y);
    }

    private handleHover(e: MouseEvent): void {
        const ndc = this.screenToNDC(e);
        this.raycaster.setFromCamera(ndc, this.camera);

        const intersects = this.raycaster.intersectObjects(this.entityGroup.children, true);

        if (intersects.length > 0) {
            const hitObject = this.findEntityRoot(intersects[0].object);

            if (hitObject !== this.hoveredEntity) {
                // Clear previous hover
                this.clearHover();

                // Set new hover
                this.hoveredEntity = hitObject;
                this.highlightEntity(hitObject, 0x00ffff); // Cyan for hover
                this.container.classList.add('hovering');
                this.showEntityInfo(hitObject, e);
                this.render();
            }
        } else {
            this.clearHover();
        }
    }

    private clearHover(): void {
        if (this.hoveredEntity) {
            // Restore original material if not selected
            if (!this.selectedEntities.has(this.hoveredEntity)) {
                this.restoreEntityMaterial(this.hoveredEntity);
            }
            this.hoveredEntity = null;
            this.container.classList.remove('hovering');
            this.hideEntityInfo();
            this.render();
        }
    }

    private handleClick(e: MouseEvent): void {
        const ndc = this.screenToNDC(e);
        this.raycaster.setFromCamera(ndc, this.camera);

        const intersects = this.raycaster.intersectObjects(this.entityGroup.children, true);

        if (intersects.length > 0) {
            const hitObject = this.findEntityRoot(intersects[0].object);

            if (e.ctrlKey || e.metaKey) {
                // Toggle selection with Ctrl/Cmd
                if (this.selectedEntities.has(hitObject)) {
                    this.deselectEntity(hitObject);
                } else {
                    this.selectEntity(hitObject);
                }
            } else {
                // Single selection
                this.clearSelection();
                this.selectEntity(hitObject);
            }
        } else {
            // Click on empty space - clear selection
            if (!e.ctrlKey && !e.metaKey) {
                this.clearSelection();
            }
        }

        this.updateSelectionStatus();
        this.render();
    }

    private findEntityRoot(object: THREE.Object3D): THREE.Object3D {
        // Walk up to find the root entity object
        let current = object;
        while (current.parent && current.parent !== this.entityGroup) {
            current = current.parent;
        }
        return current;
    }

    private selectEntity(object: THREE.Object3D): void {
        this.selectedEntities.add(object);
        this.highlightEntity(object, 0xffff00); // Yellow for selection
    }

    private deselectEntity(object: THREE.Object3D): void {
        this.selectedEntities.delete(object);
        this.restoreEntityMaterial(object);
    }

    clearSelection(): void {
        for (const entity of this.selectedEntities) {
            this.restoreEntityMaterial(entity);
        }
        this.selectedEntities.clear();
        this.updateSelectionStatus();
        this.render();
    }

    private highlightEntity(object: THREE.Object3D, color: number): void {
        object.traverse((child) => {
            if (child instanceof THREE.Line || child instanceof THREE.Points || child instanceof THREE.Mesh) {
                // Store original material if not already stored
                if (!this.originalMaterials.has(child)) {
                    this.originalMaterials.set(child, child.material);
                }

                // Apply highlight color
                if (child.material instanceof THREE.LineBasicMaterial) {
                    child.material = new THREE.LineBasicMaterial({ color });
                } else if (child.material instanceof THREE.PointsMaterial) {
                    child.material = new THREE.PointsMaterial({
                        color,
                        size: (child.material as THREE.PointsMaterial).size,
                        sizeAttenuation: false
                    });
                } else if (child.material instanceof THREE.MeshBasicMaterial) {
                    child.material = new THREE.MeshBasicMaterial({
                        color,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.6
                    });
                }
            }
        });
    }

    private restoreEntityMaterial(object: THREE.Object3D): void {
        object.traverse((child) => {
            const original = this.originalMaterials.get(child);
            if (original) {
                if (child instanceof THREE.Line || child instanceof THREE.Points || child instanceof THREE.Mesh) {
                    child.material = original;
                }
                this.originalMaterials.delete(child);
            }
        });
    }

    private showEntityInfo(object: THREE.Object3D, e: MouseEvent): void {
        const entity = object.userData.entity;
        if (!entity) return;

        let infoEl = document.getElementById('entity-info');
        if (!infoEl) {
            infoEl = document.createElement('div');
            infoEl.id = 'entity-info';
            this.container.appendChild(infoEl);
        }

        // Build info content
        const rows: string[] = [];
        rows.push(`<div class="info-row"><span class="info-label">Type:</span><span class="info-value">${entity.type}</span></div>`);
        rows.push(`<div class="info-row"><span class="info-label">Layer:</span><span class="info-value">${entity.layer}</span></div>`);
        if (entity.handle) {
            rows.push(`<div class="info-row"><span class="info-label">Handle:</span><span class="info-value">${entity.handle}</span></div>`);
        }

        // Type-specific info
        this.addEntitySpecificInfo(entity, rows);

        infoEl.innerHTML = rows.join('');

        // Position tooltip near mouse
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left + 15;
        const y = e.clientY - rect.top + 15;

        // Keep tooltip within bounds
        infoEl.style.left = `${Math.min(x, rect.width - 220)}px`;
        infoEl.style.top = `${Math.min(y, rect.height - 150)}px`;
        infoEl.classList.add('visible');
    }

    private addEntitySpecificInfo(entity: any, rows: string[]): void {
        switch (entity.type) {
            case 'LINE':
                rows.push(`<div class="info-row"><span class="info-label">Start:</span><span class="info-value">(${entity.start.x.toFixed(2)}, ${entity.start.y.toFixed(2)})</span></div>`);
                rows.push(`<div class="info-row"><span class="info-label">End:</span><span class="info-value">(${entity.end.x.toFixed(2)}, ${entity.end.y.toFixed(2)})</span></div>`);
                break;
            case 'CIRCLE':
                rows.push(`<div class="info-row"><span class="info-label">Center:</span><span class="info-value">(${entity.center.x.toFixed(2)}, ${entity.center.y.toFixed(2)})</span></div>`);
                rows.push(`<div class="info-row"><span class="info-label">Radius:</span><span class="info-value">${entity.radius.toFixed(2)}</span></div>`);
                break;
            case 'ARC':
                rows.push(`<div class="info-row"><span class="info-label">Center:</span><span class="info-value">(${entity.center.x.toFixed(2)}, ${entity.center.y.toFixed(2)})</span></div>`);
                rows.push(`<div class="info-row"><span class="info-label">Radius:</span><span class="info-value">${entity.radius.toFixed(2)}</span></div>`);
                rows.push(`<div class="info-row"><span class="info-label">Angles:</span><span class="info-value">${entity.startAngle.toFixed(1)}° → ${entity.endAngle.toFixed(1)}°</span></div>`);
                break;
            case 'TEXT':
            case 'MTEXT':
                rows.push(`<div class="info-row"><span class="info-label">Text:</span><span class="info-value">${entity.text.substring(0, 20)}${entity.text.length > 20 ? '...' : ''}</span></div>`);
                rows.push(`<div class="info-row"><span class="info-label">Height:</span><span class="info-value">${entity.height.toFixed(2)}</span></div>`);
                break;
            case 'POLYLINE':
            case 'LWPOLYLINE':
                rows.push(`<div class="info-row"><span class="info-label">Vertices:</span><span class="info-value">${entity.vertices.length}</span></div>`);
                rows.push(`<div class="info-row"><span class="info-label">Closed:</span><span class="info-value">${entity.closed ? 'Yes' : 'No'}</span></div>`);
                break;
            case 'INSERT':
                rows.push(`<div class="info-row"><span class="info-label">Block:</span><span class="info-value">${entity.blockName}</span></div>`);
                rows.push(`<div class="info-row"><span class="info-label">Position:</span><span class="info-value">(${entity.position.x.toFixed(2)}, ${entity.position.y.toFixed(2)})</span></div>`);
                break;
        }
    }

    private hideEntityInfo(): void {
        const infoEl = document.getElementById('entity-info');
        if (infoEl) {
            infoEl.classList.remove('visible');
        }
    }

    private updateSelectionStatus(): void {
        const statusEl = document.getElementById('status-text');
        if (!statusEl) return;

        if (this.selectedEntities.size === 0) {
            statusEl.textContent = this.parsedDxf
                ? `Loaded: ${this.parsedDxf.entities.length} entities`
                : 'Ready';
        } else if (this.selectedEntities.size === 1) {
            const entity = Array.from(this.selectedEntities)[0].userData.entity;
            if (entity) {
                statusEl.textContent = `Selected: ${entity.type} on layer "${entity.layer}"`;
            }
        } else {
            statusEl.textContent = `Selected: ${this.selectedEntities.size} entities`;
        }
    }

    getSelectedEntities(): THREE.Object3D[] {
        return Array.from(this.selectedEntities);
    }

    // ========== Entity Deletion ==========

    deleteSelectedEntities(): number {
        const count = this.selectedEntities.size;
        if (count === 0) return 0;

        for (const entity of this.selectedEntities) {
            // Remove from scene
            this.entityGroup.remove(entity);

            // Clean up materials
            this.originalMaterials.delete(entity);

            // Dispose geometry
            entity.traverse((child) => {
                if (child instanceof THREE.Line || child instanceof THREE.Points || child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                }
            });

            // Remove from parsed DXF data if needed
            if (entity.userData.entity && this.parsedDxf) {
                const idx = this.parsedDxf.entities.indexOf(entity.userData.entity);
                if (idx !== -1) {
                    this.parsedDxf.entities.splice(idx, 1);
                }
            }
        }

        this.selectedEntities.clear();
        this.updateSelectionStatus();
        this.render();

        return count;
    }

    // Delete entity by reference
    deleteEntity(object: THREE.Object3D): boolean {
        if (!this.entityGroup.children.includes(object)) {
            return false;
        }

        // Remove from selection if selected
        if (this.selectedEntities.has(object)) {
            this.selectedEntities.delete(object);
        }

        // Remove from scene
        this.entityGroup.remove(object);

        // Clean up
        this.originalMaterials.delete(object);
        object.traverse((child) => {
            if (child instanceof THREE.Line || child instanceof THREE.Points || child instanceof THREE.Mesh) {
                child.geometry.dispose();
            }
        });

        // Remove from parsed DXF
        if (object.userData.entity && this.parsedDxf) {
            const idx = this.parsedDxf.entities.indexOf(object.userData.entity);
            if (idx !== -1) {
                this.parsedDxf.entities.splice(idx, 1);
            }
        }

        this.updateSelectionStatus();
        this.render();
        return true;
    }

    // ========== Snap Markers ==========

    setSnapEnabled(enabled: boolean): void {
        this.snapEnabled = enabled;
        if (!enabled) {
            this.clearSnapMarker();
        }
    }

    isSnapEnabled(): boolean {
        return this.snapEnabled;
    }

    setActiveSnapTypes(types: SnapType[]): void {
        this.activeSnapTypes = new Set(types);
    }

    getActiveSnapTypes(): SnapType[] {
        return Array.from(this.activeSnapTypes);
    }

    getCurrentSnapPoint(): SnapPoint | null {
        return this.currentSnapPoint;
    }

    // Find snap points near a world position
    findSnapPointsNear(worldX: number, worldY: number): SnapPoint[] {
        if (!this.parsedDxf || !this.snapEnabled) {
            return [];
        }

        const snapPoints: SnapPoint[] = [];
        const snapRadiusWorld = this.screenToWorldDistance(this.snapRadius);

        for (const object of this.entityGroup.children) {
            if (!object.visible) continue;

            const entity = object.userData.entity;
            if (!entity) continue;

            const points = this.getEntitySnapPoints(entity, object);
            for (const point of points) {
                if (!this.activeSnapTypes.has(point.type)) continue;

                const dx = point.position.x - worldX;
                const dy = point.position.y - worldY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= snapRadiusWorld) {
                    snapPoints.push(point);
                }
            }
        }

        // Sort by distance
        snapPoints.sort((a, b) => {
            const distA = Math.sqrt(
                Math.pow(a.position.x - worldX, 2) +
                Math.pow(a.position.y - worldY, 2)
            );
            const distB = Math.sqrt(
                Math.pow(b.position.x - worldX, 2) +
                Math.pow(b.position.y - worldY, 2)
            );
            return distA - distB;
        });

        return snapPoints;
    }

    // Convert screen distance to world distance
    private screenToWorldDistance(pixels: number): number {
        return (pixels / this.container.clientWidth) * this.viewWidth;
    }

    // Get snap points for an entity
    private getEntitySnapPoints(entity: DxfEntity, object: THREE.Object3D): SnapPoint[] {
        const points: SnapPoint[] = [];

        switch (entity.type) {
            case 'LINE': {
                const line = entity as DxfLine;
                // Endpoints
                points.push({
                    type: SnapType.ENDPOINT,
                    position: { x: line.start.x, y: line.start.y },
                    entity: object
                });
                points.push({
                    type: SnapType.ENDPOINT,
                    position: { x: line.end.x, y: line.end.y },
                    entity: object
                });
                // Midpoint
                points.push({
                    type: SnapType.MIDPOINT,
                    position: {
                        x: (line.start.x + line.end.x) / 2,
                        y: (line.start.y + line.end.y) / 2
                    },
                    entity: object
                });
                break;
            }

            case 'CIRCLE': {
                const circle = entity as DxfCircle;
                // Center
                points.push({
                    type: SnapType.CENTER,
                    position: { x: circle.center.x, y: circle.center.y },
                    entity: object
                });
                // Quadrant points
                points.push({
                    type: SnapType.QUADRANT,
                    position: { x: circle.center.x + circle.radius, y: circle.center.y },
                    entity: object
                });
                points.push({
                    type: SnapType.QUADRANT,
                    position: { x: circle.center.x - circle.radius, y: circle.center.y },
                    entity: object
                });
                points.push({
                    type: SnapType.QUADRANT,
                    position: { x: circle.center.x, y: circle.center.y + circle.radius },
                    entity: object
                });
                points.push({
                    type: SnapType.QUADRANT,
                    position: { x: circle.center.x, y: circle.center.y - circle.radius },
                    entity: object
                });
                break;
            }

            case 'ARC': {
                const arc = entity as DxfArc;
                // Center
                points.push({
                    type: SnapType.CENTER,
                    position: { x: arc.center.x, y: arc.center.y },
                    entity: object
                });
                // Arc endpoints
                const startRad = arc.startAngle * Math.PI / 180;
                const endRad = arc.endAngle * Math.PI / 180;
                points.push({
                    type: SnapType.ENDPOINT,
                    position: {
                        x: arc.center.x + Math.cos(startRad) * arc.radius,
                        y: arc.center.y + Math.sin(startRad) * arc.radius
                    },
                    entity: object
                });
                points.push({
                    type: SnapType.ENDPOINT,
                    position: {
                        x: arc.center.x + Math.cos(endRad) * arc.radius,
                        y: arc.center.y + Math.sin(endRad) * arc.radius
                    },
                    entity: object
                });
                // Midpoint of arc
                let midAngle = (startRad + endRad) / 2;
                if (endRad < startRad) {
                    midAngle = (startRad + endRad + Math.PI * 2) / 2;
                }
                points.push({
                    type: SnapType.MIDPOINT,
                    position: {
                        x: arc.center.x + Math.cos(midAngle) * arc.radius,
                        y: arc.center.y + Math.sin(midAngle) * arc.radius
                    },
                    entity: object
                });
                break;
            }

            case 'POLYLINE':
            case 'LWPOLYLINE': {
                const polyline = entity as DxfPolyline;
                // Vertex endpoints
                for (const vertex of polyline.vertices) {
                    points.push({
                        type: SnapType.ENDPOINT,
                        position: { x: vertex.x, y: vertex.y },
                        entity: object
                    });
                }
                // Midpoints between vertices
                for (let i = 0; i < polyline.vertices.length - 1; i++) {
                    const v1 = polyline.vertices[i];
                    const v2 = polyline.vertices[i + 1];
                    points.push({
                        type: SnapType.MIDPOINT,
                        position: { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 },
                        entity: object
                    });
                }
                // Closing segment midpoint
                if (polyline.closed && polyline.vertices.length > 2) {
                    const first = polyline.vertices[0];
                    const last = polyline.vertices[polyline.vertices.length - 1];
                    points.push({
                        type: SnapType.MIDPOINT,
                        position: { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 },
                        entity: object
                    });
                }
                break;
            }

            case 'ELLIPSE': {
                const ellipse = entity as DxfEllipse;
                // Center
                points.push({
                    type: SnapType.CENTER,
                    position: { x: ellipse.center.x, y: ellipse.center.y },
                    entity: object
                });
                // Major axis endpoints
                points.push({
                    type: SnapType.QUADRANT,
                    position: {
                        x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
                        y: ellipse.center.y + ellipse.majorAxisEndpoint.y
                    },
                    entity: object
                });
                points.push({
                    type: SnapType.QUADRANT,
                    position: {
                        x: ellipse.center.x - ellipse.majorAxisEndpoint.x,
                        y: ellipse.center.y - ellipse.majorAxisEndpoint.y
                    },
                    entity: object
                });
                break;
            }

            case 'POINT': {
                const point = entity as DxfPoint_;
                points.push({
                    type: SnapType.ENDPOINT,
                    position: { x: point.position.x, y: point.position.y },
                    entity: object
                });
                break;
            }

            case 'TEXT':
            case 'MTEXT': {
                const text = entity as DxfText;
                points.push({
                    type: SnapType.ENDPOINT,
                    position: { x: text.position.x, y: text.position.y },
                    entity: object
                });
                break;
            }

            case 'INSERT': {
                const insert = entity as DxfInsert;
                points.push({
                    type: SnapType.ENDPOINT,
                    position: { x: insert.position.x, y: insert.position.y },
                    entity: object
                });
                break;
            }
        }

        return points;
    }

    // Update snap marker at cursor position
    updateSnapMarker(screenX: number, screenY: number): SnapPoint | null {
        if (!this.snapEnabled) {
            this.clearSnapMarker();
            return null;
        }

        // Convert screen to world coordinates
        const rect = this.container.getBoundingClientRect();
        const x = screenX - rect.left;
        const y = screenY - rect.top;

        const aspect = this.container.clientWidth / this.container.clientHeight;
        const worldX = this.viewCenter.x + (x / this.container.clientWidth - 0.5) * this.viewWidth;
        const worldY = this.viewCenter.y + (0.5 - y / this.container.clientHeight) * this.viewWidth / aspect;

        // Find nearby snap points
        const snapPoints = this.findSnapPointsNear(worldX, worldY);

        if (snapPoints.length > 0) {
            const closestSnap = snapPoints[0];
            this.showSnapMarker(closestSnap);
            this.currentSnapPoint = closestSnap;
            return closestSnap;
        } else {
            this.clearSnapMarker();
            this.currentSnapPoint = null;
            return null;
        }
    }

    // Show snap marker at a snap point
    private showSnapMarker(snapPoint: SnapPoint): void {
        this.clearSnapMarker();

        const markerSize = this.screenToWorldDistance(10);
        const color = SNAP_COLORS[snapPoint.type];

        this.snapMarker = new THREE.Group();
        this.snapMarker.name = 'active-snap-marker';

        switch (snapPoint.type) {
            case SnapType.ENDPOINT:
                // Square marker
                this.createSquareMarker(snapPoint.position, markerSize, color);
                break;
            case SnapType.MIDPOINT:
                // Triangle marker
                this.createTriangleMarker(snapPoint.position, markerSize, color);
                break;
            case SnapType.CENTER:
                // Circle marker
                this.createCircleMarker(snapPoint.position, markerSize, color);
                break;
            case SnapType.QUADRANT:
                // Diamond marker
                this.createDiamondMarker(snapPoint.position, markerSize, color);
                break;
            case SnapType.INTERSECTION:
                // X marker
                this.createXMarker(snapPoint.position, markerSize, color);
                break;
            default:
                // Cross marker
                this.createCrossMarker(snapPoint.position, markerSize, color);
                break;
        }

        this.snapGroup.add(this.snapMarker);
        this.render();
    }

    private createSquareMarker(pos: { x: number; y: number }, size: number, color: number): void {
        if (!this.snapMarker) return;

        const halfSize = size / 2;
        const points = [
            new THREE.Vector3(pos.x - halfSize, pos.y - halfSize, 1),
            new THREE.Vector3(pos.x + halfSize, pos.y - halfSize, 1),
            new THREE.Vector3(pos.x + halfSize, pos.y + halfSize, 1),
            new THREE.Vector3(pos.x - halfSize, pos.y + halfSize, 1),
            new THREE.Vector3(pos.x - halfSize, pos.y - halfSize, 1)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        this.snapMarker.add(new THREE.Line(geometry, material));
    }

    private createTriangleMarker(pos: { x: number; y: number }, size: number, color: number): void {
        if (!this.snapMarker) return;

        const halfSize = size / 2;
        const height = size * Math.sqrt(3) / 2;
        const points = [
            new THREE.Vector3(pos.x, pos.y + height / 2, 1),
            new THREE.Vector3(pos.x + halfSize, pos.y - height / 2, 1),
            new THREE.Vector3(pos.x - halfSize, pos.y - height / 2, 1),
            new THREE.Vector3(pos.x, pos.y + height / 2, 1)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        this.snapMarker.add(new THREE.Line(geometry, material));
    }

    private createCircleMarker(pos: { x: number; y: number }, size: number, color: number): void {
        if (!this.snapMarker) return;

        const segments = 24;
        const radius = size / 2;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                pos.x + Math.cos(angle) * radius,
                pos.y + Math.sin(angle) * radius,
                1
            ));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        this.snapMarker.add(new THREE.Line(geometry, material));
    }

    private createDiamondMarker(pos: { x: number; y: number }, size: number, color: number): void {
        if (!this.snapMarker) return;

        const halfSize = size / 2;
        const points = [
            new THREE.Vector3(pos.x, pos.y + halfSize, 1),
            new THREE.Vector3(pos.x + halfSize, pos.y, 1),
            new THREE.Vector3(pos.x, pos.y - halfSize, 1),
            new THREE.Vector3(pos.x - halfSize, pos.y, 1),
            new THREE.Vector3(pos.x, pos.y + halfSize, 1)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        this.snapMarker.add(new THREE.Line(geometry, material));
    }

    private createXMarker(pos: { x: number; y: number }, size: number, color: number): void {
        if (!this.snapMarker) return;

        const halfSize = size / 2;
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });

        // First diagonal
        const points1 = [
            new THREE.Vector3(pos.x - halfSize, pos.y - halfSize, 1),
            new THREE.Vector3(pos.x + halfSize, pos.y + halfSize, 1)
        ];
        const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
        this.snapMarker.add(new THREE.Line(geometry1, material));

        // Second diagonal
        const points2 = [
            new THREE.Vector3(pos.x + halfSize, pos.y - halfSize, 1),
            new THREE.Vector3(pos.x - halfSize, pos.y + halfSize, 1)
        ];
        const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
        this.snapMarker.add(new THREE.Line(geometry2, material));
    }

    private createCrossMarker(pos: { x: number; y: number }, size: number, color: number): void {
        if (!this.snapMarker) return;

        const halfSize = size / 2;
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });

        // Horizontal line
        const points1 = [
            new THREE.Vector3(pos.x - halfSize, pos.y, 1),
            new THREE.Vector3(pos.x + halfSize, pos.y, 1)
        ];
        const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
        this.snapMarker.add(new THREE.Line(geometry1, material));

        // Vertical line
        const points2 = [
            new THREE.Vector3(pos.x, pos.y - halfSize, 1),
            new THREE.Vector3(pos.x, pos.y + halfSize, 1)
        ];
        const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
        this.snapMarker.add(new THREE.Line(geometry2, material));
    }

    clearSnapMarker(): void {
        if (this.snapMarker) {
            this.snapGroup.remove(this.snapMarker);
            this.snapMarker.traverse((child) => {
                if (child instanceof THREE.Line) {
                    child.geometry.dispose();
                }
            });
            this.snapMarker = null;
            this.currentSnapPoint = null;
            this.render();
        }
    }

    // ========== Drawing Tools ==========

    getDrawingMode(): DrawingMode {
        return this.drawingMode;
    }

    isDrawing(): boolean {
        return this.drawingMode !== DrawingMode.NONE;
    }

    getDrawingPointCount(): number {
        return this.drawingPoints.length;
    }

    setOnDrawingComplete(callback: ((entity: DxfEntity) => void) | null): void {
        this.onDrawingComplete = callback;
    }

    startDrawingLine(): void {
        this.cancelDrawing();
        this.drawingMode = DrawingMode.LINE;
        this.drawingPoints = [];
        this.container.classList.add('drawing-mode');
    }

    startDrawingCircle(): void {
        this.cancelDrawing();
        this.drawingMode = DrawingMode.CIRCLE;
        this.drawingPoints = [];
        this.container.classList.add('drawing-mode');
    }

    cancelDrawing(): void {
        this.drawingMode = DrawingMode.NONE;
        this.drawingPoints = [];
        this.clearRubberBand();
        this.container.classList.remove('drawing-mode');
    }

    // Handle click during drawing mode
    handleDrawingClick(screenX: number, screenY: number): DxfEntity | null {
        if (this.drawingMode === DrawingMode.NONE) {
            return null;
        }

        // Get world position (use snap point if available)
        const worldPos = this.getWorldPositionWithSnap(screenX, screenY);

        switch (this.drawingMode) {
            case DrawingMode.LINE:
                return this.handleLineDrawingClick(worldPos);
            case DrawingMode.CIRCLE:
                return this.handleCircleDrawingClick(worldPos);
            default:
                return null;
        }
    }

    private getWorldPositionWithSnap(screenX: number, screenY: number): { x: number; y: number } {
        // If snap is enabled and we have a snap point, use it
        if (this.snapEnabled && this.currentSnapPoint) {
            return { ...this.currentSnapPoint.position };
        }

        // Otherwise, calculate world position from screen
        const rect = this.container.getBoundingClientRect();
        const x = screenX - rect.left;
        const y = screenY - rect.top;

        const aspect = this.container.clientWidth / this.container.clientHeight;
        const worldX = this.viewCenter.x + (x / this.container.clientWidth - 0.5) * this.viewWidth;
        const worldY = this.viewCenter.y + (0.5 - y / this.container.clientHeight) * this.viewWidth / aspect;

        return { x: worldX, y: worldY };
    }

    private handleLineDrawingClick(worldPos: { x: number; y: number }): DxfEntity | null {
        if (this.drawingPoints.length === 0) {
            // First point - start of line
            this.drawingPoints.push(worldPos);
            return null;
        } else {
            // Second point - end of line
            const startPoint = this.drawingPoints[0];
            const endPoint = worldPos;

            // Create DXF LINE entity
            const lineEntity: DxfLine = {
                type: 'LINE',
                layer: this.currentDrawingLayer,
                handle: this.generateHandle(),
                start: { x: startPoint.x, y: startPoint.y },
                end: { x: endPoint.x, y: endPoint.y }
            };

            // Add to parsed DXF
            if (this.parsedDxf) {
                this.parsedDxf.entities.push(lineEntity);
            }

            // Render the new line
            const lineObject = this.renderLine(lineEntity, this.currentDrawingColor, null);
            lineObject.userData.entity = lineEntity;
            lineObject.userData.layer = lineEntity.layer;
            this.entityGroup.add(lineObject);

            // AutoCAD-style: Continue from last endpoint (don't cancel drawing)
            // Set the endpoint as the new start point for continuous line drawing
            this.drawingPoints = [{ x: endPoint.x, y: endPoint.y }];
            this.clearRubberBand();
            this.render();

            // Notify callback
            if (this.onDrawingComplete) {
                this.onDrawingComplete(lineEntity);
            }

            return lineEntity;
        }
    }

    private handleCircleDrawingClick(worldPos: { x: number; y: number }): DxfEntity | null {
        if (this.drawingPoints.length === 0) {
            // First point - center of circle
            this.drawingPoints.push(worldPos);
            return null;
        } else {
            // Second point - defines radius
            const center = this.drawingPoints[0];
            const radiusPoint = worldPos;
            const radius = Math.sqrt(
                Math.pow(radiusPoint.x - center.x, 2) +
                Math.pow(radiusPoint.y - center.y, 2)
            );

            if (radius < 0.001) {
                // Too small, ignore
                return null;
            }

            // Create DXF CIRCLE entity
            const circleEntity: DxfCircle = {
                type: 'CIRCLE',
                layer: this.currentDrawingLayer,
                handle: this.generateHandle(),
                center: { x: center.x, y: center.y },
                radius: radius
            };

            // Add to parsed DXF
            if (this.parsedDxf) {
                this.parsedDxf.entities.push(circleEntity);
            }

            // Render the new circle
            const circleObject = this.renderCircle(circleEntity, this.currentDrawingColor, null);
            circleObject.userData.entity = circleEntity;
            circleObject.userData.layer = circleEntity.layer;
            this.entityGroup.add(circleObject);

            // AutoCAD-style: Ready to draw another circle (don't cancel drawing)
            // Reset points to wait for new center point
            this.drawingPoints = [];
            this.clearRubberBand();
            this.render();

            // Notify callback
            if (this.onDrawingComplete) {
                this.onDrawingComplete(circleEntity);
            }

            return circleEntity;
        }
    }

    // Update rubber band preview during mouse move
    updateRubberBand(screenX: number, screenY: number): void {
        if (this.drawingMode === DrawingMode.NONE || this.drawingPoints.length === 0) {
            return;
        }

        const worldPos = this.getWorldPositionWithSnap(screenX, screenY);

        switch (this.drawingMode) {
            case DrawingMode.LINE:
                this.updateLineRubberBand(worldPos);
                break;
            case DrawingMode.CIRCLE:
                this.updateCircleRubberBand(worldPos);
                break;
        }
    }

    private updateLineRubberBand(endPos: { x: number; y: number }): void {
        this.clearRubberBand();

        if (this.drawingPoints.length === 0) return;

        const startPos = this.drawingPoints[0];
        const points = [
            new THREE.Vector3(startPos.x, startPos.y, 2),
            new THREE.Vector3(endPos.x, endPos.y, 2)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0x00ff00,
            dashSize: this.screenToWorldDistance(5),
            gapSize: this.screenToWorldDistance(5),
            scale: 1
        });

        this.rubberBandLine = new THREE.Line(geometry, material);
        this.rubberBandLine.computeLineDistances();
        this.drawingGroup.add(this.rubberBandLine);
        this.render();
    }

    private updateCircleRubberBand(radiusPos: { x: number; y: number }): void {
        this.clearRubberBand();

        if (this.drawingPoints.length === 0) return;

        const center = this.drawingPoints[0];
        const radius = Math.sqrt(
            Math.pow(radiusPos.x - center.x, 2) +
            Math.pow(radiusPos.y - center.y, 2)
        );

        if (radius < 0.001) return;

        const segments = 64;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                center.x + Math.cos(angle) * radius,
                center.y + Math.sin(angle) * radius,
                2
            ));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0x00ff00,
            dashSize: this.screenToWorldDistance(5),
            gapSize: this.screenToWorldDistance(5),
            scale: 1
        });

        this.rubberBandCircle = new THREE.Line(geometry, material);
        this.rubberBandCircle.computeLineDistances();
        this.drawingGroup.add(this.rubberBandCircle);
        this.render();
    }

    private clearRubberBand(): void {
        if (this.rubberBandLine) {
            this.drawingGroup.remove(this.rubberBandLine);
            this.rubberBandLine.geometry.dispose();
            (this.rubberBandLine.material as THREE.Material).dispose();
            this.rubberBandLine = null;
        }

        if (this.rubberBandCircle) {
            this.drawingGroup.remove(this.rubberBandCircle);
            this.rubberBandCircle.geometry.dispose();
            (this.rubberBandCircle.material as THREE.Material).dispose();
            this.rubberBandCircle = null;
        }
    }

    private generateHandle(): string {
        // Generate a unique handle for new entities
        const timestamp = Date.now().toString(16).toUpperCase();
        const random = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
        return `NEW_${timestamp}${random}`;
    }

    setDrawingLayer(layerName: string): void {
        this.currentDrawingLayer = layerName;
    }

    setDrawingColor(color: number): void {
        this.currentDrawingColor = color;
    }

    // Toggle snap and return new state
    toggleSnap(): boolean {
        this.snapEnabled = !this.snapEnabled;
        if (!this.snapEnabled) {
            this.clearSnapMarker();
        }
        // Update snap button UI
        const snapBtn = document.getElementById('btn-snap');
        if (snapBtn) {
            snapBtn.classList.toggle('active', this.snapEnabled);
        }
        return this.snapEnabled;
    }

    // Undo last action (placeholder - needs undo stack implementation)
    undo(): void {
        // TODO: Implement undo stack
        console.log('Undo not yet implemented');
    }

    // Redo last undone action (placeholder - needs redo stack implementation)
    redo(): void {
        // TODO: Implement redo stack
        console.log('Redo not yet implemented');
    }
}
