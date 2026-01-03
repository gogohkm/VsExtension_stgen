/**
 * DXF Renderer using Three.js
 * Renders parsed DXF entities to a WebGL canvas
 */

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import {
    ParsedDxf,
    DxfEntity,
    DxfLine,
    DxfCircle,
    DxfArc,
    DxfPolyline,
    DxfText,
    DxfPoint_,
    DxfPoint,
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
    PERPENDICULAR = 'perpendicular',
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

interface UndoAction {
    label: string;
    undo: () => void;
    redo: () => void;
}

// Snap marker colors
const SNAP_COLORS: Record<SnapType, number> = {
    [SnapType.ENDPOINT]: 0x00ff00,    // Green
    [SnapType.MIDPOINT]: 0x00ffff,    // Cyan
    [SnapType.CENTER]: 0xff00ff,      // Magenta
    [SnapType.QUADRANT]: 0xffff00,    // Yellow
    [SnapType.INTERSECTION]: 0xff0000, // Red
    [SnapType.PERPENDICULAR]: 0x00ff7f, // Spring Green
    [SnapType.NEAREST]: 0xffa500      // Orange
};

// Material cache for performance optimization
class MaterialCache {
    private lineBasicMaterials: Map<number, THREE.LineBasicMaterial> = new Map();
    private lineDashedMaterials: Map<string, THREE.LineDashedMaterial> = new Map();
    private lineMaterials: Map<string, LineMaterial> = new Map();
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

    getLineMaterial(color: number, lineWidth: number, resolution: THREE.Vector2): LineMaterial {
        const key = `${color}-${lineWidth}`;
        let material = this.lineMaterials.get(key);
        if (!material) {
            material = new LineMaterial({
                color,
                linewidth: lineWidth, // in pixels
                resolution,
                worldUnits: false // Use screen pixels for line width
            });
            this.lineMaterials.set(key, material);
        } else {
            // Update resolution if material already exists
            material.resolution.copy(resolution);
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
        this.lineMaterials.forEach(m => m.dispose());
        this.meshMaterials.forEach(m => m.dispose());
        this.pointMaterials.forEach(m => m.dispose());

        this.lineBasicMaterials.clear();
        this.lineDashedMaterials.clear();
        this.lineMaterials.clear();
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
    private layerLocked: Map<string, boolean> = new Map();

    // Pan/zoom state
    private isDragging = false;
    private lastMousePos = { x: 0, y: 0 };
    private viewCenter = { x: 0, y: 0 };
    private viewWidth = 100;

    // Box selection state (Window/Crossing selection)
    private isBoxSelecting = false;
    private boxSelectStart = { x: 0, y: 0 };
    private boxSelectEnd = { x: 0, y: 0 };
    private selectionBox: HTMLDivElement | null = null;

    // Box zoom state (Shift+drag)
    private isBoxZooming = false;

    // Selection and hover state
    private raycaster: THREE.Raycaster;
    private selectedEntities: Set<THREE.Object3D> = new Set();
    private hoveredEntity: THREE.Object3D | null = null;
    private originalMaterials: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();
    private commandSelectionMode: boolean = false; // When true, clicking empty space doesn't clear selection
    private commandInputMode: boolean = false; // When true, clicks don't affect selection at all (point input mode)
    private entitySelectionMode: boolean = false; // When true, single entity picking is active (for TRIM, EXTEND, etc.)

    // Highlighted entities (for cutting edges, boundaries, etc.)
    private highlightedEntities: Set<THREE.Object3D> = new Set();
    private highlightMaterials: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();

    // Material cache for performance
    private materialCache: MaterialCache = new MaterialCache();

    // Undo/redo history
    private undoStack: UndoAction[] = [];
    private redoStack: UndoAction[] = [];
    private applyingHistory: boolean = false;

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

    // Ortho mode - constrains cursor to horizontal/vertical from base point
    private orthoEnabled: boolean = false;
    private orthoBasePoint: { x: number; y: number } | null = null;

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
        const startX = this.boxSelectStart.x;
        const startY = this.boxSelectStart.y;
        const endX = this.boxSelectEnd.x;
        const endY = this.boxSelectEnd.y;

        const left = Math.min(startX, endX) - rect.left;
        const top = Math.min(startY, endY) - rect.top;
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        this.selectionBox.style.left = `${left}px`;
        this.selectionBox.style.top = `${top}px`;
        this.selectionBox.style.width = `${width}px`;
        this.selectionBox.style.height = `${height}px`;
        this.selectionBox.classList.add('visible');

        // Window selection: drag left-to-right (solid blue box)
        // Crossing selection: drag right-to-left (dashed green box)
        if (this.isBoxSelecting) {
            const isWindowSelection = endX > startX;
            this.selectionBox.classList.toggle('window', isWindowSelection);
            this.selectionBox.classList.toggle('crossing', !isWindowSelection);
        } else {
            // Box zoom mode
            this.selectionBox.classList.remove('window', 'crossing');
        }
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
                // Left button - always start box selection
                // Shift/Ctrl will be checked on mouseup to determine add-to-selection behavior
                this.isBoxSelecting = true;
                this.boxSelectStart = { x: e.clientX, y: e.clientY };
                this.boxSelectEnd = { x: e.clientX, y: e.clientY };
                // Don't show box yet - wait for drag to avoid flicker on click
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
                this.boxSelectEnd = { x: e.clientX, y: e.clientY };
                this.updateSelectionBox();
            } else if (this.isBoxSelecting) {
                // Update box selection
                this.boxSelectEnd = { x: e.clientX, y: e.clientY };
                const dx = Math.abs(this.boxSelectEnd.x - this.boxSelectStart.x);
                const dy = Math.abs(this.boxSelectEnd.y - this.boxSelectStart.y);
                // Show selection box only after dragging a minimum distance
                if (dx > 5 || dy > 5) {
                    this.container.classList.add('selecting');
                    this.updateSelectionBox();
                }
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
                const dx = Math.abs(this.boxSelectEnd.x - this.boxSelectStart.x);
                const dy = Math.abs(this.boxSelectEnd.y - this.boxSelectStart.y);
                if (dx > 10 && dy > 10) {
                    this.zoomToBox();
                }
            } else if (this.isBoxSelecting) {
                this.isBoxSelecting = false;
                this.container.classList.remove('selecting');
                this.hideSelectionBox();

                // Perform box selection if dragged enough
                const dx = Math.abs(this.boxSelectEnd.x - this.boxSelectStart.x);
                const dy = Math.abs(this.boxSelectEnd.y - this.boxSelectStart.y);
                if (dx > 5 || dy > 5) {
                    // Box selection - determine window or crossing based on direction
                    // Shift or Ctrl: add to selection, otherwise replace selection
                    const isWindowSelection = this.boxSelectEnd.x > this.boxSelectStart.x;
                    this.selectByBox(isWindowSelection, e.shiftKey || e.ctrlKey || e.metaKey);
                } else {
                    // Click selection (not a drag)
                    this.handleClick(e);
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
            if (this.isBoxZooming || this.isBoxSelecting) {
                this.isBoxZooming = false;
                this.isBoxSelecting = false;
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

                // Compute bounding sphere for all geometries (required for raycaster)
                object.traverse((child) => {
                    if (child instanceof THREE.Line || child instanceof THREE.LineSegments || child instanceof THREE.Points) {
                        if (child.geometry) {
                            child.geometry.computeBoundingSphere();
                            child.geometry.computeBoundingBox();
                        }
                    }
                });

                this.entityGroup.add(object);
            }
        }

        // Force update world matrices for all objects so raycaster can detect them correctly
        // This is critical for INSERT (block reference) entities which have transformations
        this.entityGroup.updateMatrixWorld(true);

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

        // Resolve line weight (in pixels)
        const lineWidth = this.resolveLineWeight(entity, dxf);

        switch (entity.type) {
            case 'LINE':
                return this.renderLine(entity as DxfLine, color, lineType, lineWidth);
            case 'CIRCLE':
                return this.renderCircle(entity as DxfCircle, color, lineType, lineWidth);
            case 'ARC':
                return this.renderArc(entity as DxfArc, color, lineType, lineWidth);
            case 'POLYLINE':
            case 'LWPOLYLINE':
                return this.renderPolyline(entity as DxfPolyline, color, lineType, lineWidth);
            case 'TEXT':
            case 'MTEXT':
                return this.renderText(entity as DxfText, color);
            case 'POINT':
                return this.renderPoint(entity as DxfPoint_, color);
            case 'INSERT':
                return this.renderInsert(entity as DxfInsert, color, dxf);
            case 'ELLIPSE':
                return this.renderEllipse(entity as DxfEllipse, color, lineType, lineWidth);
            case 'SPLINE':
                return this.renderSpline(entity as DxfSpline, color, lineType, lineWidth);
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
                return this.renderLeader(entity as DxfLeader, color, lineWidth);
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

    /**
     * Resolve line weight for an entity
     * Returns line width in pixels (1 = default thin line)
     */
    private resolveLineWeight(entity: DxfEntity, dxf: ParsedDxf): number {
        // Get layer line weight if available
        const layer = dxf.layers.get(entity.layer);
        const layerLineWeight = layer?.lineWeight;

        // lineWeight is in mm (e.g., 0.25, 0.50, 1.00, 2.00)
        // Special values: -1 = ByBlock, -2 = ByLayer, -3 = Default, 0 = Default
        if (layerLineWeight === undefined || layerLineWeight <= 0) {
            return 1; // Default thin line
        }

        // Convert mm to pixels: approximately 1mm = 4 pixels at 96 DPI
        // But for better visibility, use a more aggressive scaling
        // 0.25mm -> 1px, 0.50mm -> 2px, 1.00mm -> 4px, 2.00mm -> 8px
        const pixelWidth = Math.max(1, Math.round(layerLineWeight * 4));
        return Math.min(pixelWidth, 20); // Cap at 20 pixels
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

    private renderLine(line: DxfLine, color: number, lineType: DxfLineType | null, lineWidth: number = 1): THREE.Object3D {
        // Use Line2 for thick lines (lineWidth >= 2, which is 0.50mm or more)
        if (lineWidth >= 2 && (!lineType || lineType.pattern.length === 0)) {
            const geometry = new LineGeometry();
            geometry.setPositions([
                line.start.x, line.start.y, 0,
                line.end.x, line.end.y, 0
            ]);

            const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
            const material = this.materialCache.getLineMaterial(color, lineWidth, resolution);
            const line2 = new Line2(geometry, material);
            line2.computeLineDistances();
            return line2;
        }

        // Use regular THREE.Line for thin lines or dashed lines
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

    private renderCircle(circle: DxfCircle, color: number, lineType: DxfLineType | null, lineWidth: number = 1): THREE.Object3D {
        const segments = 64;
        const positions: number[] = [];

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            positions.push(
                circle.center.x + Math.cos(angle) * circle.radius,
                circle.center.y + Math.sin(angle) * circle.radius,
                0
            );
        }

        // Use Line2 for thick lines (lineWidth >= 2, which is 0.50mm or more)
        if (lineWidth >= 2 && (!lineType || lineType.pattern.length === 0)) {
            const geometry = new LineGeometry();
            geometry.setPositions(positions);

            const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
            const material = this.materialCache.getLineMaterial(color, lineWidth, resolution);
            const line2 = new Line2(geometry, material);
            line2.computeLineDistances();
            return line2;
        }

        // Use regular THREE.Line for thin lines or dashed lines
        const geometry = new THREE.BufferGeometry();
        const points = [];
        for (let i = 0; i < positions.length; i += 3) {
            points.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
        }
        geometry.setFromPoints(points);

        const material = this.createLineMaterial(color, lineType);
        const lineObj = new THREE.Line(geometry, material);

        if (material instanceof THREE.LineDashedMaterial) {
            lineObj.computeLineDistances();
        }

        return lineObj;
    }

    private renderArc(arc: DxfArc, color: number, lineType: DxfLineType | null, lineWidth: number = 1): THREE.Object3D {
        const segments = 64;

        // Convert degrees to radians
        let startAngle = arc.startAngle * Math.PI / 180;
        let endAngle = arc.endAngle * Math.PI / 180;

        // Handle arc direction
        if (endAngle < startAngle) {
            endAngle += Math.PI * 2;
        }

        const arcAngle = endAngle - startAngle;
        const segmentCount = Math.max(8, Math.ceil(segments * arcAngle / (Math.PI * 2)));

        const positions: number[] = [];
        for (let i = 0; i <= segmentCount; i++) {
            const angle = startAngle + (i / segmentCount) * arcAngle;
            positions.push(
                arc.center.x + Math.cos(angle) * arc.radius,
                arc.center.y + Math.sin(angle) * arc.radius,
                0
            );
        }

        // Use Line2 for thick lines (lineWidth >= 2, which is 0.50mm or more)
        if (lineWidth >= 2 && (!lineType || lineType.pattern.length === 0)) {
            const geometry = new LineGeometry();
            geometry.setPositions(positions);

            const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
            const material = this.materialCache.getLineMaterial(color, lineWidth, resolution);
            const line2 = new Line2(geometry, material);
            line2.computeLineDistances();
            return line2;
        }

        // Use regular THREE.Line for thin lines or dashed lines
        const geometry = new THREE.BufferGeometry();
        const points = [];
        for (let i = 0; i < positions.length; i += 3) {
            points.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
        }
        geometry.setFromPoints(points);

        const material = this.createLineMaterial(color, lineType);
        const lineObj = new THREE.Line(geometry, material);

        if (material instanceof THREE.LineDashedMaterial) {
            lineObj.computeLineDistances();
        }

        return lineObj;
    }

    private renderPolyline(polyline: DxfPolyline, color: number, lineType: DxfLineType | null, lineWidth: number = 1): THREE.Object3D {
        if (polyline.vertices.length < 2) {
            return new THREE.Line();
        }

        const positions: number[] = [];
        for (const v of polyline.vertices) {
            positions.push(v.x, v.y, 0);
        }
        if (polyline.closed && polyline.vertices.length > 0) {
            positions.push(polyline.vertices[0].x, polyline.vertices[0].y, 0);
        }

        // Use Line2 for thick lines (lineWidth >= 2, which is 0.50mm or more)
        if (lineWidth >= 2 && (!lineType || lineType.pattern.length === 0)) {
            const geometry = new LineGeometry();
            geometry.setPositions(positions);

            const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
            const material = this.materialCache.getLineMaterial(color, lineWidth, resolution);
            const line2 = new Line2(geometry, material);
            line2.computeLineDistances();
            return line2;
        }

        // Use regular THREE.Line for thin lines or dashed lines
        const geometry = new THREE.BufferGeometry();
        const points = [];
        for (let i = 0; i < positions.length; i += 3) {
            points.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
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
                // Set userData for block entities so they can be selected
                object.userData.entity = entity;
                object.userData.layer = entity.layer;
                object.userData.blockName = insert.blockName;

                // Compute bounding sphere for raycaster detection
                object.traverse((child) => {
                    if (child instanceof THREE.Line || child instanceof THREE.LineSegments || child instanceof THREE.Points) {
                        if (child.geometry) {
                            child.geometry.computeBoundingSphere();
                            child.geometry.computeBoundingBox();
                        }
                    }
                });

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

        // Force update world matrix so raycaster can detect objects at correct positions
        group.updateMatrixWorld(true);

        return group;
    }

    private renderEllipse(ellipse: DxfEllipse, color: number, lineType: DxfLineType | null, lineWidth: number = 1): THREE.Object3D {
        const segments = 64;

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

        const positions: number[] = [];
        for (let i = 0; i <= segmentCount; i++) {
            const t = startAngle + (i / segmentCount) * angleRange;
            // Parametric ellipse
            const x = majorLength * Math.cos(t);
            const y = minorLength * Math.sin(t);
            // Rotate to match major axis orientation
            const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
            const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);
            positions.push(
                ellipse.center.x + rotatedX,
                ellipse.center.y + rotatedY,
                0
            );
        }

        // Use Line2 for thick lines (lineWidth >= 2, which is 0.50mm or more)
        if (lineWidth >= 2 && (!lineType || lineType.pattern.length === 0)) {
            const geometry = new LineGeometry();
            geometry.setPositions(positions);

            const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
            const material = this.materialCache.getLineMaterial(color, lineWidth, resolution);
            const line2 = new Line2(geometry, material);
            line2.computeLineDistances();
            return line2;
        }

        // Use regular THREE.Line for thin lines or dashed lines
        const geometry = new THREE.BufferGeometry();
        const points = [];
        for (let i = 0; i < positions.length; i += 3) {
            points.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
        }
        geometry.setFromPoints(points);

        const material = this.createLineMaterial(color, lineType);
        const lineObj = new THREE.Line(geometry, material);

        if (material instanceof THREE.LineDashedMaterial) {
            lineObj.computeLineDistances();
        }

        return lineObj;
    }

    private renderSpline(spline: DxfSpline, color: number, lineType: DxfLineType | null, lineWidth: number = 1): THREE.Object3D {
        // Use control points or fit points depending on what's available
        const sourcePoints = spline.controlPoints.length > 0 ? spline.controlPoints : spline.fitPoints;

        if (sourcePoints.length < 2) {
            const geometry = new THREE.BufferGeometry();
            return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }));
        }

        const positions: number[] = [];
        if (spline.degree >= 2 && sourcePoints.length >= 3) {
            // Approximate spline using Catmull-Rom-like interpolation
            const segments = Math.max(sourcePoints.length * 10, 50);
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const point = this.interpolateSpline(sourcePoints, t, spline.closed);
                positions.push(point.x, point.y, 0);
            }
        } else {
            // Fall back to polyline for simple cases
            for (const p of sourcePoints) {
                positions.push(p.x, p.y, 0);
            }
            if (spline.closed && sourcePoints.length > 0) {
                positions.push(sourcePoints[0].x, sourcePoints[0].y, 0);
            }
        }

        // Use Line2 for thick lines (lineWidth >= 2, which is 0.50mm or more)
        if (lineWidth >= 2 && (!lineType || lineType.pattern.length === 0)) {
            const geometry = new LineGeometry();
            geometry.setPositions(positions);

            const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
            const material = this.materialCache.getLineMaterial(color, lineWidth, resolution);
            const line2 = new Line2(geometry, material);
            line2.computeLineDistances();
            return line2;
        }

        // Use regular THREE.Line for thin lines or dashed lines
        const geometry = new THREE.BufferGeometry();
        const points = [];
        for (let i = 0; i < positions.length; i += 3) {
            points.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
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

        // Add nearly invisible selection mesh for all hatches to make them selectable
        // This ensures hatches can be clicked even when pattern lines are thin
        // Note: opacity must be > 0 for raycaster to detect the mesh
        for (const path of hatch.boundaryPaths) {
            if (path.length >= 3) {
                try {
                    const shape = new THREE.Shape();
                    shape.moveTo(path[0].x, path[0].y);
                    for (let i = 1; i < path.length; i++) {
                        shape.lineTo(path[i].x, path[i].y);
                    }
                    shape.closePath();

                    const selectionGeometry = new THREE.ShapeGeometry(shape);
                    const selectionMaterial = new THREE.MeshBasicMaterial({
                        transparent: true,
                        opacity: 0.001, // Nearly invisible but raycaster can detect it
                        side: THREE.DoubleSide,
                        depthWrite: false
                    });
                    const selectionMesh = new THREE.Mesh(selectionGeometry, selectionMaterial);
                    selectionMesh.position.z = -0.005; // Between boundary lines and fill
                    selectionMesh.userData.isSelectionHelper = true;
                    group.add(selectionMesh);
                } catch (e) {
                    // Ignore errors for complex shapes
                }
            }
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

    private renderLeader(leader: DxfLeader, color: number, lineWidth: number = 1): THREE.Group {
        const group = new THREE.Group();

        if (leader.vertices.length < 2) {
            return group;
        }

        // Draw leader line
        if (lineWidth >= 2) {
            const positions: number[] = [];
            for (const v of leader.vertices) {
                positions.push(v.x, v.y, 0);
            }
            const geometry = new LineGeometry();
            geometry.setPositions(positions);
            const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
            const material = this.materialCache.getLineMaterial(color, lineWidth, resolution);
            const line2 = new Line2(geometry, material);
            line2.computeLineDistances();
            group.add(line2);
        } else {
            const points = leader.vertices.map(v => new THREE.Vector3(v.x, v.y, 0));
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const lineMaterial = this.materialCache.getLineBasicMaterial(color);
            group.add(new THREE.Line(lineGeometry, lineMaterial));
        }

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

                if (lineWidth >= 2) {
                    const positions = [
                        start.x + arrowSize * Math.cos(angle - arrowAngle),
                        start.y + arrowSize * Math.sin(angle - arrowAngle),
                        0,
                        start.x, start.y, 0,
                        start.x + arrowSize * Math.cos(angle + arrowAngle),
                        start.y + arrowSize * Math.sin(angle + arrowAngle),
                        0
                    ];
                    const geometry = new LineGeometry();
                    geometry.setPositions(positions);
                    const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
                    const material = this.materialCache.getLineMaterial(color, lineWidth, resolution);
                    const line2 = new Line2(geometry, material);
                    line2.computeLineDistances();
                    group.add(line2);
                } else {
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
                    const lineMaterial = this.materialCache.getLineBasicMaterial(color);
                    group.add(new THREE.Line(arrowGeometry, lineMaterial));
                }
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

    /**
     * Sets the view to specific extents (useful for empty drawings)
     */
    setViewExtents(minX: number, minY: number, maxX: number, maxY: number): void {
        const width = maxX - minX;
        const height = maxY - minY;

        this.viewCenter.x = minX + width / 2;
        this.viewCenter.y = minY + height / 2;

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.viewWidth = Math.max(width, height * aspect);

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

    setLayerLocked(layerName: string, locked: boolean): void {
        this.layerLocked.set(layerName, locked);
        // Apply visual dimming to locked layers
        this.updateLockedLayerAppearance(layerName, locked);
    }

    /**
     * Updates the visual appearance of entities on a locked layer
     * Locked layers are dimmed to indicate they cannot be edited
     */
    private updateLockedLayerAppearance(layerName: string, locked: boolean): void {
        this.entityGroup.traverse((object) => {
            if (object.userData.layer === layerName) {
                if (object instanceof THREE.Line || object instanceof THREE.LineSegments) {
                    const material = object.material as THREE.LineBasicMaterial;
                    if (locked) {
                        // Dim the entity by reducing opacity
                        material.transparent = true;
                        material.opacity = 0.35;
                        object.userData.lockedDimmed = true;
                    } else if (object.userData.lockedDimmed) {
                        // Restore normal appearance
                        material.opacity = 1.0;
                        material.transparent = false;
                        delete object.userData.lockedDimmed;
                    }
                } else if (object instanceof THREE.Mesh) {
                    const material = object.material as THREE.MeshBasicMaterial;
                    if (locked) {
                        material.transparent = true;
                        material.opacity = 0.35;
                        object.userData.lockedDimmed = true;
                    } else if (object.userData.lockedDimmed) {
                        material.opacity = 1.0;
                        material.transparent = false;
                        delete object.userData.lockedDimmed;
                    }
                }
            }
        });
        this.render();
    }

    isLayerLocked(layerName: string): boolean {
        return this.layerLocked.get(layerName) ?? false;
    }

    getLayers(): Array<{ name: string; color: number; colorIndex: number; visible: boolean; locked: boolean; entityCount: number; lineType: string; lineWeight: number }> {
        if (!this.parsedDxf) {
            return [];
        }

        // Count entities per layer
        const entityCounts = new Map<string, number>();
        for (const entity of this.parsedDxf.entities) {
            const count = entityCounts.get(entity.layer) || 0;
            entityCounts.set(entity.layer, count + 1);
        }

        const layers: Array<{ name: string; color: number; colorIndex: number; visible: boolean; locked: boolean; entityCount: number; lineType: string; lineWeight: number }> = [];

        // Add default layer if it has entities
        if (entityCounts.has('0') && !this.parsedDxf.layers.has('0')) {
            layers.push({
                name: '0',
                color: 0xffffff,
                colorIndex: 7,
                visible: this.layerVisibility.get('0') ?? true,
                locked: this.layerLocked.get('0') ?? false,
                entityCount: entityCounts.get('0') || 0,
                lineType: 'CONTINUOUS',
                lineWeight: 0.25 // Default
            });
        }

        // Add all layers from DXF
        for (const [name, layer] of this.parsedDxf.layers) {
            layers.push({
                name,
                color: aciToColor(layer.color),
                colorIndex: layer.color,
                visible: this.layerVisibility.get(name) ?? true,
                locked: this.layerLocked.get(name) ?? false,
                entityCount: entityCounts.get(name) || 0,
                lineType: layer.lineType || 'CONTINUOUS',
                lineWeight: layer.lineWeight ?? 0.25
            });
        }

        // Add layers that have entities but weren't defined in TABLES
        for (const [layerName, count] of entityCounts) {
            if (!layers.find(l => l.name === layerName)) {
                layers.push({
                    name: layerName,
                    color: 0xffffff,
                    colorIndex: 7,
                    visible: this.layerVisibility.get(layerName) ?? true,
                    locked: this.layerLocked.get(layerName) ?? false,
                    entityCount: count,
                    lineType: 'CONTINUOUS',
                    lineWeight: 0.25
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

    createLayer(name: string, options: { visible?: boolean; frozen?: boolean; locked?: boolean; color?: string; lineWeight?: number } = {}): void {
        if (!this.parsedDxf) return;

        // Check if layer already exists
        if (this.parsedDxf.layers.has(name)) {
            return;
        }

        // Convert hex color to ACI (simplified - use white=7 as default)
        let colorIndex = 7;
        if (options.color) {
            // Simplified color mapping for common colors
            const colorMap: { [key: string]: number } = {
                '#ff0000': 1, '#ffff00': 2, '#00ff00': 3, '#00ffff': 4,
                '#0000ff': 5, '#ff00ff': 6, '#ffffff': 7, '#808080': 8, '#c0c0c0': 9
            };
            colorIndex = colorMap[options.color.toLowerCase()] || 7;
        }

        // Create layer entry
        const layerData = {
            name: name,
            color: colorIndex,
            lineType: 'CONTINUOUS',
            lineWeight: options.lineWeight ?? 0.25,
            flags: 0,
            frozen: options.frozen ?? false,
            off: !(options.visible ?? true)
        };

        this.parsedDxf.layers.set(name, layerData);
        this.layerVisibility.set(name, options.visible ?? true);
    }

    deleteLayer(name: string): void {
        if (!this.parsedDxf) return;

        // Cannot delete layer 0
        if (name === '0') return;

        // Check if layer exists
        if (!this.parsedDxf.layers.has(name)) return;

        // Move all entities from this layer to layer 0
        for (const entity of this.parsedDxf.entities) {
            if (entity.layer === name) {
                entity.layer = '0';
            }
        }

        // Update 3D objects
        this.entityGroup.traverse((object) => {
            if (object.userData.layer === name) {
                object.userData.layer = '0';
            }
        });

        // Delete the layer
        this.parsedDxf.layers.delete(name);
        this.layerVisibility.delete(name);

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
        const startX = (Math.min(this.boxSelectStart.x, this.boxSelectEnd.x) - rect.left) / rect.width;
        const startY = (Math.min(this.boxSelectStart.y, this.boxSelectEnd.y) - rect.top) / rect.height;
        const endX = (Math.max(this.boxSelectStart.x, this.boxSelectEnd.x) - rect.left) / rect.width;
        const endY = (Math.max(this.boxSelectStart.y, this.boxSelectEnd.y) - rect.top) / rect.height;

        // Convert to world coordinates
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const halfWidth = this.viewWidth / 2;
        const halfHeight = halfWidth / aspect;

        const worldMinX = this.viewCenter.x - halfWidth + startX * this.viewWidth;
        const worldMaxX = this.viewCenter.x - halfWidth + endX * this.viewWidth;
        const worldMaxY = this.viewCenter.y + halfHeight - startY * (this.viewWidth / aspect);
        const worldMinY = this.viewCenter.y + halfHeight - endY * (this.viewWidth / aspect);

        // Use the public method
        this.zoomToWindow(
            { x: worldMinX, y: worldMinY },
            { x: worldMaxX, y: worldMaxY }
        );
    }

    /**
     * Zoom to a rectangular window defined by two corner points (world coordinates)
     * @param corner1 First corner point
     * @param corner2 Second corner point (opposite corner)
     * @param padding Padding factor (default 5%)
     */
    zoomToWindow(
        corner1: { x: number; y: number },
        corner2: { x: number; y: number },
        padding: number = 0.05
    ): void {
        const minX = Math.min(corner1.x, corner2.x);
        const maxX = Math.max(corner1.x, corner2.x);
        const minY = Math.min(corner1.y, corner2.y);
        const maxY = Math.max(corner1.y, corner2.y);

        const width = maxX - minX;
        const height = maxY - minY;

        if (width <= 0 || height <= 0) {
            return; // Invalid window
        }

        const aspect = this.container.clientWidth / this.container.clientHeight;

        this.viewCenter.x = (minX + maxX) / 2;
        this.viewCenter.y = (minY + maxY) / 2;
        this.viewWidth = Math.max(width, height * aspect) * (1 + padding);

        this.updateCamera();
        this.render();
    }

    // ========== Box Selection (Window/Crossing) ==========

    /**
     * Select entities by box
     * @param isWindowSelection true for window (must be fully inside), false for crossing (any overlap)
     * @param addToSelection true to add to current selection (Ctrl key)
     */
    private selectByBox(isWindowSelection: boolean, addToSelection: boolean): void {
        const rect = this.container.getBoundingClientRect();

        // Convert screen coordinates to world coordinates
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const halfWidth = this.viewWidth / 2;
        const halfHeight = halfWidth / aspect;

        // Calculate world box coordinates
        const screenStartX = (this.boxSelectStart.x - rect.left) / rect.width;
        const screenStartY = (this.boxSelectStart.y - rect.top) / rect.height;
        const screenEndX = (this.boxSelectEnd.x - rect.left) / rect.width;
        const screenEndY = (this.boxSelectEnd.y - rect.top) / rect.height;

        const worldX1 = this.viewCenter.x - halfWidth + screenStartX * this.viewWidth;
        const worldY1 = this.viewCenter.y + halfHeight - screenStartY * (this.viewWidth / aspect);
        const worldX2 = this.viewCenter.x - halfWidth + screenEndX * this.viewWidth;
        const worldY2 = this.viewCenter.y + halfHeight - screenEndY * (this.viewWidth / aspect);

        const boxMinX = Math.min(worldX1, worldX2);
        const boxMaxX = Math.max(worldX1, worldX2);
        const boxMinY = Math.min(worldY1, worldY2);
        const boxMaxY = Math.max(worldY1, worldY2);

        // Clear selection if not adding
        if (!addToSelection) {
            this.clearSelection();
        }

        // Check each entity
        for (const object of this.entityGroup.children) {
            const entity = object.userData.entity as DxfEntity;
            if (!entity) continue;

            // Always try to get bounds from Three.js object first (most accurate)
            // Falls back to entity-based bounds if object bounds fail
            let entityBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;

            entityBounds = this.getObjectBounds(object);
            if (!entityBounds) {
                entityBounds = this.getEntityBounds(entity);
            }

            if (!entityBounds) continue;

            let shouldSelect = false;

            if (isWindowSelection) {
                // Window selection: entity must be fully inside the box
                shouldSelect = (
                    entityBounds.minX >= boxMinX &&
                    entityBounds.maxX <= boxMaxX &&
                    entityBounds.minY >= boxMinY &&
                    entityBounds.maxY <= boxMaxY
                );
            } else {
                // Crossing selection: entity must overlap with the box
                shouldSelect = !(
                    entityBounds.maxX < boxMinX ||
                    entityBounds.minX > boxMaxX ||
                    entityBounds.maxY < boxMinY ||
                    entityBounds.minY > boxMaxY
                );
            }

            if (shouldSelect) {
                this.selectEntity(object);
            }
        }

        this.updateSelectionStatus();
        this.render();
    }

    /**
     * Get bounding box from Three.js object (for INSERT and groups)
     * This computes the actual world-space bounds of transformed objects
     */
    private getObjectBounds(object: THREE.Object3D): { minX: number; maxX: number; minY: number; maxY: number } | null {
        const box = new THREE.Box3();
        box.setFromObject(object);

        if (box.isEmpty()) {
            return null;
        }

        return {
            minX: box.min.x,
            maxX: box.max.x,
            minY: box.min.y,
            maxY: box.max.y
        };
    }

    /**
     * Get bounding box of an entity
     */
    private getEntityBounds(entity: DxfEntity): { minX: number; maxX: number; minY: number; maxY: number } | null {
        switch (entity.type) {
            case 'LINE': {
                const line = entity as DxfLine;
                return {
                    minX: Math.min(line.start.x, line.end.x),
                    maxX: Math.max(line.start.x, line.end.x),
                    minY: Math.min(line.start.y, line.end.y),
                    maxY: Math.max(line.start.y, line.end.y)
                };
            }
            case 'CIRCLE': {
                const circle = entity as DxfCircle;
                return {
                    minX: circle.center.x - circle.radius,
                    maxX: circle.center.x + circle.radius,
                    minY: circle.center.y - circle.radius,
                    maxY: circle.center.y + circle.radius
                };
            }
            case 'ARC': {
                const arc = entity as DxfArc;
                // Simplified: use circle bounds
                return {
                    minX: arc.center.x - arc.radius,
                    maxX: arc.center.x + arc.radius,
                    minY: arc.center.y - arc.radius,
                    maxY: arc.center.y + arc.radius
                };
            }
            case 'POINT': {
                const point = entity as DxfPoint_;
                return {
                    minX: point.position.x,
                    maxX: point.position.x,
                    minY: point.position.y,
                    maxY: point.position.y
                };
            }
            case 'LWPOLYLINE':
            case 'POLYLINE': {
                const polyline = entity as any;
                if (!polyline.vertices || polyline.vertices.length === 0) return null;
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (const v of polyline.vertices) {
                    minX = Math.min(minX, v.x);
                    maxX = Math.max(maxX, v.x);
                    minY = Math.min(minY, v.y);
                    maxY = Math.max(maxY, v.y);
                }
                return { minX, maxX, minY, maxY };
            }
            case 'TEXT':
            case 'MTEXT': {
                const text = entity as any;
                const pos = text.position || text.insertionPoint;
                if (!pos) return null;
                // Estimate text bounds (rough)
                const height = text.height || 1;
                const width = (text.text?.length || 1) * height * 0.6;
                return {
                    minX: pos.x,
                    maxX: pos.x + width,
                    minY: pos.y,
                    maxY: pos.y + height
                };
            }
            case 'ELLIPSE': {
                const ellipse = entity as any;
                if (!ellipse.center) return null;
                // Simplified: use major axis as radius
                const majorAxis = ellipse.majorAxis || { x: 1, y: 0 };
                const radius = Math.sqrt(majorAxis.x * majorAxis.x + majorAxis.y * majorAxis.y);
                return {
                    minX: ellipse.center.x - radius,
                    maxX: ellipse.center.x + radius,
                    minY: ellipse.center.y - radius,
                    maxY: ellipse.center.y + radius
                };
            }
            case 'SPLINE': {
                const spline = entity as any;
                const points = spline.controlPoints || spline.fitPoints;
                if (!points || points.length === 0) return null;
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (const p of points) {
                    minX = Math.min(minX, p.x);
                    maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y);
                    maxY = Math.max(maxY, p.y);
                }
                return { minX, maxX, minY, maxY };
            }
            case 'INSERT': {
                const insert = entity as any;
                if (!insert.position) return null;
                // Simplified: use insertion point with some extent
                return {
                    minX: insert.position.x - 10,
                    maxX: insert.position.x + 10,
                    minY: insert.position.y - 10,
                    maxY: insert.position.y + 10
                };
            }
            default:
                return null;
        }
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

        // Adjust raycaster threshold based on current view scale
        const pickThreshold = this.viewWidth / this.container.clientWidth * 10;
        this.raycaster.params.Line = { threshold: pickThreshold };
        this.raycaster.params.Points = { threshold: pickThreshold };

        const intersects = this.raycaster.intersectObjects(this.entityGroup.children, true);

        if (intersects.length > 0) {
            const hitObject = this.findEntityRoot(intersects[0].object);

            if (hitObject !== this.hoveredEntity) {
                // Clear previous hover
                this.clearHover();

                // Set new hover - but skip highlight if already selected
                this.hoveredEntity = hitObject;
                if (!this.selectedEntities.has(hitObject)) {
                    this.highlightEntity(hitObject, 0x00ffff, false); // Cyan for hover (solid line)
                }
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
        // Skip selection handling when in command input mode (e.g., getPoint)
        if (this.commandInputMode) {
            return;
        }

        const ndc = this.screenToNDC(e);
        this.raycaster.setFromCamera(ndc, this.camera);

        // Adjust raycaster threshold based on current view scale
        const pickThreshold = this.viewWidth / this.container.clientWidth * 10;
        this.raycaster.params.Line = { threshold: pickThreshold };
        this.raycaster.params.Points = { threshold: pickThreshold };

        const intersects = this.raycaster.intersectObjects(this.entityGroup.children, true);

        if (intersects.length > 0) {
            const hitObject = this.findEntityRoot(intersects[0].object);

            // AutoCAD-style selection:
            // - Shift: Add to selection (keep existing, add new)
            // - Ctrl/Cmd: Toggle selection (remove if selected, add if not)
            // - No modifier: Replace selection (clear existing, select new)
            if (e.shiftKey || this.commandSelectionMode) {
                // Shift: Add to selection (don't deselect if already selected)
                if (!this.selectedEntities.has(hitObject)) {
                    this.selectEntity(hitObject);
                }
            } else if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd: Toggle selection
                if (this.selectedEntities.has(hitObject)) {
                    this.deselectEntity(hitObject);
                } else {
                    this.selectEntity(hitObject);
                }
            } else {
                // No modifier: Replace selection
                this.clearSelection();
                this.selectEntity(hitObject);
            }
        } else {
            // Click on empty space - clear selection (but not with modifiers or in command mode)
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !this.commandSelectionMode) {
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
        this.highlightEntity(object, 0xffff00, true); // Yellow for selection (dashed line)
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

    private highlightEntity(object: THREE.Object3D, color: number, useDashed: boolean = true): void {
        // Calculate dash size based on current view scale
        const dashSize = this.screenToWorldDistance(6);
        const gapSize = this.screenToWorldDistance(4);

        object.traverse((child) => {
            // Handle Line2 (thick lines) first - Line2 extends LineSegments2 extends Mesh
            // Must check before THREE.Mesh since Line2 is a Mesh subclass
            if (child instanceof Line2) {
                if (!this.originalMaterials.has(child)) {
                    this.originalMaterials.set(child, child.material);
                }
                const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
                const originalMat = child.material as LineMaterial;
                if (useDashed) {
                    const dashedMat = new LineMaterial({
                        color,
                        linewidth: originalMat.linewidth,
                        resolution,
                        dashed: true,
                        dashSize,
                        gapSize,
                        dashScale: 1
                    });
                    dashedMat.defines.USE_DASH = '';
                    dashedMat.needsUpdate = true;
                    child.material = dashedMat;
                    child.computeLineDistances();
                } else {
                    const solidMat = new LineMaterial({
                        color,
                        linewidth: originalMat.linewidth,
                        resolution
                    });
                    solidMat.needsUpdate = true;
                    child.material = solidMat;
                }
            } else if (child instanceof THREE.Line) {
                // Regular THREE.Line (not Line2)
                if (!this.originalMaterials.has(child)) {
                    this.originalMaterials.set(child, child.material);
                }

                if (useDashed) {
                    const dashedMat = new THREE.LineDashedMaterial({
                        color,
                        dashSize,
                        gapSize,
                        scale: 1
                    });
                    dashedMat.needsUpdate = true;
                    child.material = dashedMat;
                    child.computeLineDistances();
                } else {
                    child.material = new THREE.LineBasicMaterial({ color });
                }
            } else if (child instanceof THREE.Points) {
                if (!this.originalMaterials.has(child)) {
                    this.originalMaterials.set(child, child.material);
                }
                child.material = new THREE.PointsMaterial({
                    color,
                    size: (child.material as THREE.PointsMaterial).size,
                    sizeAttenuation: false
                });
            } else if (child instanceof THREE.Sprite) {
                // Handle Sprite (text entities)
                if (!this.originalMaterials.has(child)) {
                    this.originalMaterials.set(child, child.material);
                }
                const spriteMat = new THREE.SpriteMaterial({
                    map: (child.material as THREE.SpriteMaterial).map,
                    color: color
                });
                child.material = spriteMat;
            } else if (child instanceof THREE.Mesh) {
                if (!this.originalMaterials.has(child)) {
                    this.originalMaterials.set(child, child.material);
                }
                child.material = new THREE.MeshBasicMaterial({
                    color,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.6
                });
            }
        });
    }

    private restoreEntityMaterial(object: THREE.Object3D): void {
        object.traverse((child) => {
            const original = this.originalMaterials.get(child);
            if (original) {
                if (child instanceof Line2 || child instanceof THREE.Line || child instanceof THREE.Points || child instanceof THREE.Sprite || child instanceof THREE.Mesh) {
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

    /**
     * Gets all visible entities as THREE.Object3D array
     * Used for TRIM/EXTEND commands when no cutting edges are selected
     */
    getAllVisibleEntities(): THREE.Object3D[] {
        const entities: THREE.Object3D[] = [];

        this.entityGroup.traverse((object) => {
            if (object.userData.entity && object.visible) {
                entities.push(object);
            }
        });

        return entities;
    }

    /**
     * Gets all entities in the drawing as DxfEntity array
     * Used for saving the drawing to DXF file
     */
    getAllEntities(): DxfEntity[] {
        const entities: DxfEntity[] = [];

        this.entityGroup.traverse((object) => {
            if (object.userData.entity) {
                entities.push(object.userData.entity as DxfEntity);
            }
        });

        return entities;
    }

    // ========== Highlight Mode (for cutting edges, boundaries, etc.) ==========

    /**
     * Highlights entities with dashed lines (e.g., for cutting edges in TRIM/EXTEND)
     */
    highlightEntities(entities: THREE.Object3D[]): void {
        // Clear any existing highlights first
        this.clearHighlight();

        // Calculate dash size based on current view scale
        const dashSize = this.screenToWorldDistance(6);
        const gapSize = this.screenToWorldDistance(4);

        for (const object of entities) {
            this.highlightedEntities.add(object);

            // Traverse to handle nested objects (INSERT, Group, etc.)
            object.traverse((child) => {
                // Handle Line2 first - Line2 extends LineSegments2 extends Mesh
                // Must check before THREE.Mesh since Line2 is a Mesh subclass
                if (child instanceof Line2) {
                    if (!this.highlightMaterials.has(child)) {
                        this.highlightMaterials.set(child, child.material);
                    }
                    const resolution = new THREE.Vector2(this.container.clientWidth, this.container.clientHeight);
                    const originalMat = child.material as LineMaterial;
                    const dashedMat = new LineMaterial({
                        color: 0x00ffff,
                        linewidth: originalMat.linewidth,
                        resolution,
                        dashed: true,
                        dashSize,
                        gapSize,
                        dashScale: 1
                    });
                    dashedMat.defines.USE_DASH = '';
                    dashedMat.needsUpdate = true;
                    child.material = dashedMat;
                    child.computeLineDistances();
                } else if (child instanceof THREE.Line) {
                    // Regular THREE.Line (not Line2)
                    if (!this.highlightMaterials.has(child)) {
                        this.highlightMaterials.set(child, child.material);
                    }

                    const highlightMaterial = new THREE.LineDashedMaterial({
                        color: 0x00ffff,
                        dashSize,
                        gapSize,
                        scale: 1
                    });
                    highlightMaterial.needsUpdate = true;
                    child.material = highlightMaterial;
                    child.computeLineDistances();
                } else if (child instanceof THREE.Points) {
                    if (!this.highlightMaterials.has(child)) {
                        this.highlightMaterials.set(child, child.material);
                    }

                    child.material = new THREE.PointsMaterial({
                        color: 0x00ffff,
                        size: (child.material as THREE.PointsMaterial).size,
                        sizeAttenuation: false
                    });
                } else if (child instanceof THREE.Sprite) {
                    if (!this.highlightMaterials.has(child)) {
                        this.highlightMaterials.set(child, child.material);
                    }

                    child.material = new THREE.SpriteMaterial({
                        map: (child.material as THREE.SpriteMaterial).map,
                        color: 0x00ffff
                    });
                } else if (child instanceof THREE.Mesh) {
                    if (!this.highlightMaterials.has(child)) {
                        this.highlightMaterials.set(child, child.material);
                    }

                    child.material = new THREE.MeshBasicMaterial({
                        color: 0x00ffff,
                        transparent: true,
                        opacity: 0.8
                    });
                }
            });
        }

        this.render();
    }

    /**
     * Clears all highlighted entities, restoring their original materials
     */
    clearHighlight(): void {
        // Restore materials for all stored objects (including children)
        for (const [object, originalMaterial] of this.highlightMaterials) {
            if (object instanceof Line2 ||
                object instanceof THREE.Line ||
                object instanceof THREE.LineSegments ||
                object instanceof THREE.Points ||
                object instanceof THREE.Sprite ||
                object instanceof THREE.Mesh) {
                object.material = originalMaterial;
            }
        }

        this.highlightedEntities.clear();
        this.highlightMaterials.clear();
        this.render();
    }

    // ========== Command Selection Mode ==========

    /**
     * Sets command selection mode.
     * When enabled, clicking on empty space doesn't clear selection
     * and clicking on entities toggles selection (like Ctrl+click).
     */
    setCommandSelectionMode(enabled: boolean): void {
        this.commandSelectionMode = enabled;
    }

    /**
     * Gets whether command selection mode is active
     */
    isCommandSelectionMode(): boolean {
        return this.commandSelectionMode;
    }

    /**
     * Sets command input mode.
     * When enabled, clicks don't affect selection at all (used during getPoint, etc.)
     */
    setCommandInputMode(enabled: boolean): void {
        this.commandInputMode = enabled;
    }

    /**
     * Gets whether command input mode is active
     */
    isCommandInputMode(): boolean {
        return this.commandInputMode;
    }

    /**
     * Sets entity selection mode.
     * When enabled, single entity picking is active (for TRIM, EXTEND, etc.)
     */
    setEntitySelectionMode(enabled: boolean): void {
        this.entitySelectionMode = enabled;
    }

    /**
     * Gets whether entity selection mode is active
     */
    isEntitySelectionMode(): boolean {
        return this.entitySelectionMode;
    }

    /**
     * Pick entity at a world point
     * Returns the closest entity to the pick point, or null if none found
     */
    pickEntityAtPoint(worldPoint: { x: number; y: number }): THREE.Object3D | null {
        // Convert world point to screen coords for raycasting
        const screenPoint = this.worldToScreen(worldPoint.x, worldPoint.y);
        if (!screenPoint) return null;

        // Create raycaster
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
            (screenPoint.x / this.container.clientWidth) * 2 - 1,
            -(screenPoint.y / this.container.clientHeight) * 2 + 1
        );

        raycaster.setFromCamera(mouse, this.camera);
        raycaster.params.Line = { threshold: 5 / this.camera.zoom };
        raycaster.params.Points = { threshold: 5 / this.camera.zoom };

        // Get all intersections
        const intersects = raycaster.intersectObjects(this.entityGroup.children, true);

        // Find closest entity
        for (const intersect of intersects) {
            let object = intersect.object;
            // Walk up to find entity parent
            while (object.parent && !object.userData.entity && object.parent !== this.entityGroup) {
                object = object.parent;
            }
            if (object.userData.entity) {
                return object;
            }
        }

        return null;
    }

    // ========== Entity Deletion ==========

    /**
     * Gets the count of currently selected entities
     */
    getSelectedCount(): number {
        return this.selectedEntities.size;
    }

    deleteSelectedEntities(recordUndo: boolean = true): number {
        const selected = Array.from(this.selectedEntities);
        if (selected.length === 0) return 0;

        // Filter out entities on locked layers
        const deletable: THREE.Object3D[] = [];
        const lockedCount = { count: 0 };

        for (const object of selected) {
            const layerName = object.userData.layer || '0';
            if (this.isLayerLocked(layerName)) {
                lockedCount.count++;
            } else {
                deletable.push(object);
            }
        }

        if (lockedCount.count > 0) {
            console.log(`${lockedCount.count} object(s) on locked layer(s) - skipped`);
        }

        if (deletable.length === 0) return 0;

        const entities = deletable
            .map(object => object.userData.entity as DxfEntity | undefined)
            .filter((entity): entity is DxfEntity => !!entity);
        const indices = this.parsedDxf
            ? entities.map(entity => this.parsedDxf!.entities.indexOf(entity))
            : [];

        for (const object of deletable) {
            // Remove from scene
            this.entityGroup.remove(object);
            // Also remove from selection
            this.selectedEntities.delete(object);

            // Clean up materials
            this.originalMaterials.delete(object);

            // Dispose geometry
            object.traverse((child) => {
                if (child instanceof THREE.Line || child instanceof THREE.Points || child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                }
            });

            // Remove from parsed DXF data if needed
            if (object.userData.entity && this.parsedDxf) {
                const idx = this.parsedDxf.entities.indexOf(object.userData.entity);
                if (idx !== -1) {
                    this.parsedDxf.entities.splice(idx, 1);
                }
            }
        }

        this.updateSelectionStatus();
        this.render();

        if (recordUndo && entities.length > 0) {
            this.recordDeleteAction(entities, indices);
        }

        return deletable.length;
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

    // Delete entity by handle
    removeEntityByHandle(handle: string): boolean {
        for (const object of this.entityGroup.children) {
            const entity = object.userData.entity as DxfEntity;
            if (entity && entity.handle === handle) {
                return this.deleteEntity(object);
            }
        }
        return false;
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

        // Collect visible entities for intersection checking
        const visibleEntities: { entity: DxfEntity; object: THREE.Object3D }[] = [];

        for (const object of this.entityGroup.children) {
            if (!object.visible) continue;

            const entity = object.userData.entity;
            if (!entity) continue;

            visibleEntities.push({ entity, object });

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

            // Add perpendicular snap points if enabled
            if (this.activeSnapTypes.has(SnapType.PERPENDICULAR)) {
                const perpPoint = this.getPerpendicularSnapPoint(entity, object, worldX, worldY, snapRadiusWorld);
                if (perpPoint) {
                    snapPoints.push(perpPoint);
                }
            }
        }

        // Add intersection snap points if enabled
        if (this.activeSnapTypes.has(SnapType.INTERSECTION)) {
            const intersections = this.findIntersectionSnapPoints(visibleEntities, worldX, worldY, snapRadiusWorld);
            snapPoints.push(...intersections);
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

    // Get perpendicular snap point from cursor to a line entity
    private getPerpendicularSnapPoint(
        entity: DxfEntity,
        object: THREE.Object3D,
        worldX: number,
        worldY: number,
        snapRadius: number
    ): SnapPoint | null {
        if (entity.type !== 'LINE') return null;

        const line = entity as DxfLine;
        const { start, end } = line;

        // Vector from start to end
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) return null;

        // Project cursor point onto the line
        const t = ((worldX - start.x) * dx + (worldY - start.y) * dy) / lengthSq;

        // Only consider points on the line segment (not extensions)
        if (t < 0 || t > 1) return null;

        const perpX = start.x + t * dx;
        const perpY = start.y + t * dy;

        // Check if perpendicular point is within snap radius
        const distToCursor = Math.sqrt(
            Math.pow(perpX - worldX, 2) + Math.pow(perpY - worldY, 2)
        );

        if (distToCursor <= snapRadius) {
            return {
                type: SnapType.PERPENDICULAR,
                position: { x: perpX, y: perpY },
                entity: object
            };
        }

        return null;
    }

    // Find intersection points between visible entities
    private findIntersectionSnapPoints(
        entities: { entity: DxfEntity; object: THREE.Object3D }[],
        worldX: number,
        worldY: number,
        snapRadius: number
    ): SnapPoint[] {
        const intersections: SnapPoint[] = [];

        // Check all pairs of entities
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const e1 = entities[i];
                const e2 = entities[j];

                const points = this.findEntityIntersections(e1.entity, e2.entity, e1.object);
                for (const point of points) {
                    const dist = Math.sqrt(
                        Math.pow(point.x - worldX, 2) + Math.pow(point.y - worldY, 2)
                    );
                    if (dist <= snapRadius) {
                        intersections.push({
                            type: SnapType.INTERSECTION,
                            position: point,
                            entity: e1.object
                        });
                    }
                }
            }
        }

        return intersections;
    }

    // Find intersection points between two entities
    private findEntityIntersections(
        e1: DxfEntity,
        e2: DxfEntity,
        object: THREE.Object3D
    ): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];

        // Line-Line intersection
        if (e1.type === 'LINE' && e2.type === 'LINE') {
            const line1 = e1 as DxfLine;
            const line2 = e2 as DxfLine;
            const intersection = this.lineLineIntersection(
                line1.start, line1.end,
                line2.start, line2.end
            );
            if (intersection) {
                points.push(intersection);
            }
        }

        // Line-Circle intersection
        if (e1.type === 'LINE' && e2.type === 'CIRCLE') {
            const line = e1 as DxfLine;
            const circle = e2 as DxfCircle;
            points.push(...this.lineCircleIntersection(line.start, line.end, circle.center, circle.radius));
        } else if (e1.type === 'CIRCLE' && e2.type === 'LINE') {
            const circle = e1 as DxfCircle;
            const line = e2 as DxfLine;
            points.push(...this.lineCircleIntersection(line.start, line.end, circle.center, circle.radius));
        }

        // Circle-Circle intersection
        if (e1.type === 'CIRCLE' && e2.type === 'CIRCLE') {
            const c1 = e1 as DxfCircle;
            const c2 = e2 as DxfCircle;
            points.push(...this.circleCircleIntersection(c1.center, c1.radius, c2.center, c2.radius));
        }

        return points;
    }

    // Line-line intersection calculation
    private lineLineIntersection(
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
        if (Math.abs(cross) < 1e-10) return null; // Parallel lines

        const dx = p3.x - p1.x;
        const dy = p3.y - p1.y;

        const t1 = (dx * d2y - dy * d2x) / cross;
        const t2 = (dx * d1y - dy * d1x) / cross;

        // Check if intersection is within both line segments
        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
            return {
                x: p1.x + t1 * d1x,
                y: p1.y + t1 * d1y
            };
        }

        return null;
    }

    // Line-circle intersection calculation
    private lineCircleIntersection(
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        center: { x: number; y: number },
        radius: number
    ): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const fx = p1.x - center.x;
        const fy = p1.y - center.y;

        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - radius * radius;

        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return points;

        const sqrtDisc = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);

        if (t1 >= 0 && t1 <= 1) {
            points.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
        }
        if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-10) {
            points.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
        }

        return points;
    }

    // Circle-circle intersection calculation
    private circleCircleIntersection(
        c1: { x: number; y: number },
        r1: number,
        c2: { x: number; y: number },
        r2: number
    ): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        // No intersection cases
        if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) {
            return points;
        }

        const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
        const h = Math.sqrt(r1 * r1 - a * a);

        const px = c1.x + a * dx / d;
        const py = c1.y + a * dy / d;

        points.push({
            x: px + h * dy / d,
            y: py - h * dx / d
        });

        if (Math.abs(h) > 1e-10) {
            points.push({
                x: px - h * dy / d,
                y: py + h * dx / d
            });
        }

        return points;
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

    // ========== Ortho Mode ==========

    /**
     * Enables/disables orthogonal mode
     * When enabled, cursor movement is constrained to horizontal or vertical from base point
     */
    setOrthoEnabled(enabled: boolean): void {
        this.orthoEnabled = enabled;
    }

    isOrthoEnabled(): boolean {
        return this.orthoEnabled;
    }

    toggleOrtho(): boolean {
        this.orthoEnabled = !this.orthoEnabled;
        return this.orthoEnabled;
    }

    /**
     * Sets the base point for ortho constraint
     * Should be called when user clicks the first point of a line/move operation
     */
    setOrthoBasePoint(point: { x: number; y: number } | null): void {
        this.orthoBasePoint = point;
    }

    getOrthoBasePoint(): { x: number; y: number } | null {
        return this.orthoBasePoint;
    }

    /**
     * Applies ortho constraint to a point relative to the base point
     * Constrains to horizontal or vertical based on which axis has larger delta
     * @param point The current cursor position
     * @returns The constrained point if ortho is enabled and base point is set, otherwise the original point
     */
    applyOrthoConstraint(point: { x: number; y: number }): { x: number; y: number } {
        if (!this.orthoEnabled || !this.orthoBasePoint) {
            return point;
        }

        const dx = Math.abs(point.x - this.orthoBasePoint.x);
        const dy = Math.abs(point.y - this.orthoBasePoint.y);

        if (dx >= dy) {
            // Horizontal constraint - lock Y to base point Y
            return { x: point.x, y: this.orthoBasePoint.y };
        } else {
            // Vertical constraint - lock X to base point X
            return { x: this.orthoBasePoint.x, y: point.y };
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
        return this.screenToWorld(screenX, screenY);
    }

    /**
     * Converts screen coordinates to world coordinates
     */
    screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        const rect = this.container.getBoundingClientRect();
        const x = screenX - rect.left;
        const y = screenY - rect.top;

        const aspect = this.container.clientWidth / this.container.clientHeight;
        const worldX = this.viewCenter.x + (x / this.container.clientWidth - 0.5) * this.viewWidth;
        const worldY = this.viewCenter.y + (0.5 - y / this.container.clientHeight) * this.viewWidth / aspect;

        return { x: worldX, y: worldY };
    }

    /**
     * Converts world coordinates to screen coordinates (relative to container)
     */
    worldToScreen(worldX: number, worldY: number): { x: number; y: number } | null {
        const aspect = this.container.clientWidth / this.container.clientHeight;

        // Inverse of screenToWorld calculation
        const x = ((worldX - this.viewCenter.x) / this.viewWidth + 0.5) * this.container.clientWidth;
        const y = (0.5 - (worldY - this.viewCenter.y) * aspect / this.viewWidth) * this.container.clientHeight;

        return { x, y };
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

            // Render the new line with layer color and linetype
            const layerColor = this.getCurrentLayerColor();
            const layerLineType = this.getCurrentLayerLineType();
            const lineObject = this.renderLine(lineEntity, layerColor, layerLineType);
            lineObject.userData.entity = lineEntity;
            lineObject.userData.layer = lineEntity.layer;
            this.entityGroup.add(lineObject);
            this.recordAddAction([lineEntity]);

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

            // Render the new circle with layer color and linetype
            const layerColor = this.getCurrentLayerColor();
            const layerLineType = this.getCurrentLayerLineType();
            const circleObject = this.renderCircle(circleEntity, layerColor, layerLineType);
            circleObject.userData.entity = circleEntity;
            circleObject.userData.layer = circleEntity.layer;
            this.entityGroup.add(circleObject);
            this.recordAddAction([circleEntity]);

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

    clearRubberBand(): void {
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

    /**
     * Generate a unique handle for new entities
     * Made public for use by commands like COPY
     */
    generateHandle(): string {
        const timestamp = Date.now().toString(16).toUpperCase();
        const random = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
        return `NEW_${timestamp}${random}`;
    }

    setDrawingLayer(layerName: string): void {
        this.currentDrawingLayer = layerName;
    }

    getCurrentDrawingLayer(): string {
        return this.currentDrawingLayer;
    }

    /**
     * Adds a new layer to the drawing
     * @param name Layer name
     * @param color ACI color index (default: 7 = white)
     * @returns true if layer was added, false if it already exists
     */
    addLayer(name: string, color: number = 7, lineType: string = 'CONTINUOUS'): boolean {
        if (!this.parsedDxf) return false;

        // Check if layer already exists
        if (this.parsedDxf.layers.has(name)) {
            return false;
        }

        // Add new layer
        this.parsedDxf.layers.set(name, {
            name,
            color,
            frozen: false,
            off: false,
            lineType: lineType
        });

        // Set layer visibility
        this.layerVisibility.set(name, true);

        return true;
    }

    /**
     * Sets the color for a layer (ACI color index)
     * @param layerName Layer name
     * @param color ACI color index (1-255)
     */
    setLayerColor(layerName: string, color: number): boolean {
        if (!this.parsedDxf) return false;

        const layer = this.parsedDxf.layers.get(layerName);
        if (!layer) {
            // Layer might exist only in entities, add it
            this.parsedDxf.layers.set(layerName, {
                name: layerName,
                color: color,
                frozen: false,
                off: false,
                lineType: 'CONTINUOUS'
            });
        } else {
            layer.color = color;
        }

        // Re-render entities on this layer with new color
        this.updateLayerAppearance(layerName);
        return true;
    }

    /**
     * Sets the linetype for a layer
     * @param layerName Layer name
     * @param lineTypeName Linetype name (CONTINUOUS, DASHED, HIDDEN, CENTER, etc.)
     */
    setLayerLineType(layerName: string, lineTypeName: string): boolean {
        if (!this.parsedDxf) return false;

        const layer = this.parsedDxf.layers.get(layerName);
        if (!layer) {
            // Layer might exist only in entities, add it
            this.parsedDxf.layers.set(layerName, {
                name: layerName,
                color: 7,
                frozen: false,
                off: false,
                lineType: lineTypeName.toUpperCase()
            });
        } else {
            layer.lineType = lineTypeName.toUpperCase();
        }

        // Re-render entities on this layer with new linetype
        this.updateLayerAppearance(layerName);
        return true;
    }

    /**
     * Sets the line weight for a layer
     * @param layerName Layer name
     * @param lineWeight Line weight in mm (0.00-2.11)
     */
    setLayerLineWeight(layerName: string, lineWeight: number): boolean {
        if (!this.parsedDxf) {
            return false;
        }

        const layer = this.parsedDxf.layers.get(layerName);
        if (!layer) {
            // Layer might exist only in entities, add it
            this.parsedDxf.layers.set(layerName, {
                name: layerName,
                color: 7,
                frozen: false,
                off: false,
                lineType: 'CONTINUOUS',
                lineWeight: lineWeight
            });
        } else {
            layer.lineWeight = lineWeight;
        }

        // Re-render entities on this layer with new line weight
        this.updateLayerAppearance(layerName);
        return true;
    }

    /**
     * Gets the current layer's line weight (in mm)
     */
    getCurrentLayerLineWeight(): number {
        if (this.parsedDxf) {
            const layer = this.parsedDxf.layers.get(this.currentDrawingLayer);
            if (layer?.lineWeight !== undefined) {
                return layer.lineWeight;
            }
        }
        return 0.25; // Default
    }

    /**
     * Convert line weight (in mm) to pixel width for rendering
     */
    private convertLineWeightToPixels(lineWeight: number): number {
        // lineWeight is in mm (e.g., 0.25, 0.50, 1.00)
        // Convert to pixels: approximately 1mm = 4 pixels at 96 DPI
        if (lineWeight <= 0) {
            return 1; // Default thin line
        }
        // 0.25mm -> 1px, 0.50mm -> 2px, 1.00mm -> 4px, 2.00mm -> 8px
        const pixelWidth = Math.round(lineWeight * 4);
        return Math.min(Math.max(1, pixelWidth), 20); // Clamp between 1 and 20 pixels
    }

    /**
     * Gets available linetypes
     */
    getAvailableLineTypes(): Array<{ name: string; description: string }> {
        if (!this.parsedDxf) {
            return [
                { name: 'CONTINUOUS', description: 'Solid line' },
                { name: 'DASHED', description: 'Dashed line' },
                { name: 'HIDDEN', description: 'Hidden line' },
                { name: 'CENTER', description: 'Center line' },
                { name: 'DASHDOT', description: 'Dash dot line' },
                { name: 'PHANTOM', description: 'Phantom line' },
                { name: 'DOT', description: 'Dotted line' }
            ];
        }

        const lineTypes: Array<{ name: string; description: string }> = [];
        for (const [, lt] of this.parsedDxf.lineTypes) {
            lineTypes.push({ name: lt.name, description: lt.description });
        }
        return lineTypes.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Re-renders all entities on a layer with updated appearance
     */
    private updateLayerAppearance(layerName: string): void {
        if (!this.parsedDxf) {
            return;
        }

        // Find and update all entities on this layer
        const entitiesToUpdate: THREE.Object3D[] = [];
        this.entityGroup.traverse((object) => {
            if (object.userData.layer === layerName) {
                entitiesToUpdate.push(object);
            }
        });

        // Remove and re-render each entity
        for (const oldObject of entitiesToUpdate) {
            const entity = oldObject.userData.entity;
            if (!entity) {
                continue;
            }

            // Re-render the entity (renderEntity will resolve color and linetype from layer)
            const newObject = this.renderEntity(entity, this.parsedDxf);
            if (newObject) {
                newObject.userData.entity = entity;
                newObject.userData.layer = entity.layer;
                newObject.visible = oldObject.visible;

                // Replace in entity group
                const index = this.entityGroup.children.indexOf(oldObject);
                if (index >= 0) {
                    this.entityGroup.children[index] = newObject;
                } else {
                    this.entityGroup.add(newObject);
                }
            }

            // Remove old object
            this.entityGroup.remove(oldObject);
        }

        this.render();
    }

    setDrawingColor(color: number): void {
        this.currentDrawingColor = color;
    }

    /**
     * Gets the color for drawing on the current layer
     * Returns the layer color if defined, otherwise the current drawing color
     */
    getCurrentLayerColor(): number {
        if (this.parsedDxf) {
            const layer = this.parsedDxf.layers.get(this.currentDrawingLayer);
            if (layer) {
                return aciToColor(layer.color);
            }
        }
        return this.currentDrawingColor;
    }

    /**
     * Gets the linetype for the current drawing layer
     */
    getCurrentLayerLineType(): DxfLineType | null {
        if (this.parsedDxf) {
            const layer = this.parsedDxf.layers.get(this.currentDrawingLayer);
            if (layer?.lineType && layer.lineType.toUpperCase() !== 'CONTINUOUS') {
                return this.parsedDxf.lineTypes.get(layer.lineType.toUpperCase()) || null;
            }
        }
        return null;
    }

    // Add a drawing point (for command line coordinate input)
    addDrawingPoint(x: number, y: number): void {
        this.drawingPoints.push({ x, y });
    }

    /**
     * Create a line from two points (for command line input)
     * Returns the created entity and Three.js object for undo tracking
     */
    createLineFromPoints(start: { x: number; y: number }, end: { x: number; y: number }): DxfLine | null {
        const result = this.createLineFromPointsWithObject(start, end);
        return result ? result.entity : null;
    }

    /**
     * Create a line from two points and return both entity and Three.js object
     * Used by LINE/PLINE commands for undo tracking
     */
    createLineFromPointsWithObject(start: { x: number; y: number }, end: { x: number; y: number }): { entity: DxfLine; object: THREE.Object3D } | null {
        // Create DXF LINE entity
        const lineEntity: DxfLine = {
            type: 'LINE',
            layer: this.currentDrawingLayer,
            handle: this.generateHandle(),
            start: { x: start.x, y: start.y },
            end: { x: end.x, y: end.y }
        };

        // Add to parsed DXF
        if (this.parsedDxf) {
            this.parsedDxf.entities.push(lineEntity);
        }

        // Render the new line with layer color, linetype, and lineweight
        const layerColor = this.getCurrentLayerColor();
        const layerLineType = this.getCurrentLayerLineType();
        const layerLineWeight = this.getCurrentLayerLineWeight();
        const lineWidth = this.convertLineWeightToPixels(layerLineWeight);
        const lineObject = this.renderLine(lineEntity, layerColor, layerLineType, lineWidth);
        lineObject.userData.entity = lineEntity;
        lineObject.userData.layer = lineEntity.layer;
        this.entityGroup.add(lineObject);

        // Update drawing state for continuous drawing
        this.drawingPoints = [{ x: end.x, y: end.y }];
        this.clearRubberBand();
        this.render();

        // Notify callback
        if (this.onDrawingComplete) {
            this.onDrawingComplete(lineEntity);
        }

        return { entity: lineEntity, object: lineObject };
    }

    // Create a circle from center and radius (for command line input)
    createCircleFromCenterRadius(center: { x: number; y: number }, radius: number): DxfCircle | null {
        if (radius < 0.001) {
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

        // Render the new circle with layer color, linetype, and lineweight
        const layerColor = this.getCurrentLayerColor();
        const layerLineType = this.getCurrentLayerLineType();
        const layerLineWeight = this.getCurrentLayerLineWeight();
        const lineWidth = this.convertLineWeightToPixels(layerLineWeight);
        const circleObject = this.renderCircle(circleEntity, layerColor, layerLineType, lineWidth);
        circleObject.userData.entity = circleEntity;
        circleObject.userData.layer = circleEntity.layer;
        this.entityGroup.add(circleObject);

        // Reset drawing state
        this.drawingPoints = [];
        this.clearRubberBand();
        this.render();

        // Notify callback
        if (this.onDrawingComplete) {
            this.onDrawingComplete(circleEntity);
        }

        return circleEntity;
    }

    /**
     * Create an arc from center, radius, and angles
     */
    createArcFromCenterRadiusAngles(
        center: { x: number; y: number },
        radius: number,
        startAngle: number,
        endAngle: number
    ): DxfArc | null {
        if (radius < 0.001) {
            return null;
        }

        // Create DXF ARC entity
        const arcEntity: DxfArc = {
            type: 'ARC',
            layer: this.currentDrawingLayer,
            handle: this.generateHandle(),
            center: { x: center.x, y: center.y },
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle
        };

        // Add to parsed DXF
        if (this.parsedDxf) {
            this.parsedDxf.entities.push(arcEntity);
        }

        // Render the new arc with layer color, linetype, and lineweight
        const layerColor = this.getCurrentLayerColor();
        const layerLineType = this.getCurrentLayerLineType();
        const layerLineWeight = this.getCurrentLayerLineWeight();
        const lineWidth = this.convertLineWeightToPixels(layerLineWeight);
        const arcObject = this.renderArc(arcEntity, layerColor, layerLineType, lineWidth);
        arcObject.userData.entity = arcEntity;
        arcObject.userData.layer = arcEntity.layer;
        this.entityGroup.add(arcObject);

        // Reset drawing state
        this.drawingPoints = [];
        this.clearRubberBand();
        this.render();

        // Notify callback
        if (this.onDrawingComplete) {
            this.onDrawingComplete(arcEntity);
        }

        return arcEntity;
    }

    /**
     * Update rubber band for line preview
     */
    updateLineRubberBandFromPoints(start: { x: number; y: number }, end: { x: number; y: number }): void {
        this.clearRubberBand();

        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
        });

        const points = [
            new THREE.Vector3(start.x, start.y, 0.1),
            new THREE.Vector3(end.x, end.y, 0.1)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.rubberBandLine = new THREE.Line(geometry, material);
        this.drawingGroup.add(this.rubberBandLine);
        this.render();
    }

    /**
     * Update rubber band for circle preview
     */
    updateCircleRubberBandFromCenterRadius(center: { x: number; y: number }, radius: number): void {
        this.clearRubberBand();

        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
        });

        const segments = 64;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                center.x + radius * Math.cos(theta),
                center.y + radius * Math.sin(theta),
                0.1
            ));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.rubberBandLine = new THREE.Line(geometry, material);
        this.drawingGroup.add(this.rubberBandLine);
        this.render();
    }

    /**
     * Update rubber band for rectangle preview
     */
    updateRectangleRubberBand(p1: { x: number; y: number }, p2: { x: number; y: number }): void {
        this.clearRubberBand();

        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
        });

        const points = [
            new THREE.Vector3(p1.x, p1.y, 0.1),
            new THREE.Vector3(p2.x, p1.y, 0.1),
            new THREE.Vector3(p2.x, p2.y, 0.1),
            new THREE.Vector3(p1.x, p2.y, 0.1),
            new THREE.Vector3(p1.x, p1.y, 0.1)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.rubberBandLine = new THREE.Line(geometry, material);
        this.drawingGroup.add(this.rubberBandLine);
        this.render();
    }

    /**
     * Update rubber band for polyline preview (multiple connected segments)
     */
    updatePolylineRubberBand(vertices: { x: number; y: number }[]): void {
        this.clearRubberBand();

        if (vertices.length < 2) return;

        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
        });

        const points = vertices.map(v => new THREE.Vector3(v.x, v.y, 0.1));

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.rubberBandLine = new THREE.Line(geometry, material);
        this.drawingGroup.add(this.rubberBandLine);
        this.render();
    }

    /**
     * Update rubber band for arc preview (center, radius, angles)
     */
    updateArcRubberBand(
        center: { x: number; y: number },
        radius: number,
        startAngleDeg: number,
        endAngleDeg: number
    ): void {
        this.clearRubberBand();

        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
        });

        const startRad = startAngleDeg * Math.PI / 180;
        const endRad = endAngleDeg * Math.PI / 180;

        // Determine sweep direction (counterclockwise)
        let angleDiff = endRad - startRad;
        if (angleDiff <= 0) {
            angleDiff += 2 * Math.PI;
        }

        const segments = Math.max(16, Math.floor(Math.abs(angleDiff) * 20));
        const points: THREE.Vector3[] = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = startRad + angleDiff * t;
            points.push(new THREE.Vector3(
                center.x + radius * Math.cos(angle),
                center.y + radius * Math.sin(angle),
                0.1
            ));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.rubberBandLine = new THREE.Line(geometry, material);
        this.drawingGroup.add(this.rubberBandLine);
        this.render();
    }

    /**
     * Update rubber band for arc through 3 points
     */
    updateArc3PointRubberBand(
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        p3: { x: number; y: number }
    ): void {
        this.clearRubberBand();

        // Calculate circle through 3 points
        const arc = this.calculateArcFrom3Points(p1, p2, p3);
        if (!arc) {
            // Points are collinear, show a line instead
            this.updateLineRubberBandFromPoints(p1, p3);
            return;
        }

        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
        });

        const { center, radius, startAngle, endAngle } = arc;
        const startRad = startAngle * Math.PI / 180;
        const endRad = endAngle * Math.PI / 180;

        // Calculate sweep to pass through second point
        const midAngle = Math.atan2(p2.y - center.y, p2.x - center.x);

        let angleDiff = endRad - startRad;
        // Determine direction based on midpoint
        const midT = (midAngle - startRad + 2 * Math.PI) % (2 * Math.PI);
        const endT = (endRad - startRad + 2 * Math.PI) % (2 * Math.PI);

        if (midT > endT) {
            // Need to go the other way
            angleDiff = -(2 * Math.PI - angleDiff);
        }

        const segments = Math.max(32, Math.floor(Math.abs(angleDiff) * 20));
        const points: THREE.Vector3[] = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = startRad + angleDiff * t;
            points.push(new THREE.Vector3(
                center.x + radius * Math.cos(angle),
                center.y + radius * Math.sin(angle),
                0.1
            ));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.rubberBandLine = new THREE.Line(geometry, material);
        this.drawingGroup.add(this.rubberBandLine);
        this.render();
    }

    /**
     * Calculate arc parameters from 3 points (for preview)
     */
    private calculateArcFrom3Points(
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        p3: { x: number; y: number }
    ): { center: { x: number; y: number }; radius: number; startAngle: number; endAngle: number } | null {
        const ax = p1.x, ay = p1.y;
        const bx = p2.x, by = p2.y;
        const cx = p3.x, cy = p3.y;

        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

        if (Math.abs(d) < 0.0001) {
            return null; // Points are collinear
        }

        const ux = ((ax * ax + ay * ay) * (by - cy) +
            (bx * bx + by * by) * (cy - ay) +
            (cx * cx + cy * cy) * (ay - by)) / d;

        const uy = ((ax * ax + ay * ay) * (cx - bx) +
            (bx * bx + by * by) * (ax - cx) +
            (cx * cx + cy * cy) * (bx - ax)) / d;

        const center = { x: ux, y: uy };
        const radius = Math.sqrt(Math.pow(ax - ux, 2) + Math.pow(ay - uy, 2));

        const startAngle = Math.atan2(ay - uy, ax - ux) * 180 / Math.PI;
        const endAngle = Math.atan2(cy - uy, cx - ux) * 180 / Math.PI;

        return { center, radius, startAngle, endAngle };
    }

    /**
     * Update rubber band for dimension preview
     */
    updateDimensionRubberBand(
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        dimLocation: { x: number; y: number },
        dimType: 'horizontal' | 'vertical' | 'aligned' | 'auto'
    ): void {
        this.clearRubberBand();

        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 1,
            transparent: true,
            opacity: 0.7
        });

        const points: THREE.Vector3[] = [];

        let actualType = dimType;
        if (dimType === 'auto') {
            // Auto-detect based on cursor position
            const isHorizontal = Math.abs(dimLocation.y - (p1.y + p2.y) / 2) >
                                Math.abs(dimLocation.x - (p1.x + p2.x) / 2);
            actualType = isHorizontal ? 'horizontal' : 'vertical';
        }

        if (actualType === 'horizontal') {
            const dimY = dimLocation.y;
            // Extension line 1
            points.push(new THREE.Vector3(p1.x, p1.y, 0.1));
            points.push(new THREE.Vector3(p1.x, dimY, 0.1));
            points.push(new THREE.Vector3(p1.x, dimY, 0.1)); // Break for new line
            // Dimension line
            points.push(new THREE.Vector3(p1.x, dimY, 0.1));
            points.push(new THREE.Vector3(p2.x, dimY, 0.1));
            // Extension line 2
            points.push(new THREE.Vector3(p2.x, dimY, 0.1));
            points.push(new THREE.Vector3(p2.x, p2.y, 0.1));
        } else if (actualType === 'vertical') {
            const dimX = dimLocation.x;
            // Extension line 1
            points.push(new THREE.Vector3(p1.x, p1.y, 0.1));
            points.push(new THREE.Vector3(dimX, p1.y, 0.1));
            // Dimension line
            points.push(new THREE.Vector3(dimX, p1.y, 0.1));
            points.push(new THREE.Vector3(dimX, p2.y, 0.1));
            // Extension line 2
            points.push(new THREE.Vector3(dimX, p2.y, 0.1));
            points.push(new THREE.Vector3(p2.x, p2.y, 0.1));
        } else {
            // Aligned dimension
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 0.001) return;

            const perpX = -dy / len;
            const perpY = dx / len;
            const offset = (dimLocation.x - p1.x) * perpX + (dimLocation.y - p1.y) * perpY;

            const d1Start = { x: p1.x, y: p1.y };
            const d1End = { x: p1.x + perpX * offset, y: p1.y + perpY * offset };
            const d2Start = { x: p2.x, y: p2.y };
            const d2End = { x: p2.x + perpX * offset, y: p2.y + perpY * offset };

            // Extension lines
            points.push(new THREE.Vector3(d1Start.x, d1Start.y, 0.1));
            points.push(new THREE.Vector3(d1End.x, d1End.y, 0.1));
            // Dimension line
            points.push(new THREE.Vector3(d1End.x, d1End.y, 0.1));
            points.push(new THREE.Vector3(d2End.x, d2End.y, 0.1));
            // Extension line 2
            points.push(new THREE.Vector3(d2End.x, d2End.y, 0.1));
            points.push(new THREE.Vector3(d2Start.x, d2Start.y, 0.1));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.rubberBandLine = new THREE.LineSegments(geometry, material);
        this.drawingGroup.add(this.rubberBandLine);
        this.render();
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

    recordAction(action: UndoAction): void {
        if (this.applyingHistory) {
            return;
        }
        this.undoStack.push(action);
        this.redoStack = [];
    }

    recordAddAction(entities: DxfEntity[]): void {
        if (!this.parsedDxf || entities.length === 0) return;
        const indices = entities.map(entity => this.parsedDxf!.entities.indexOf(entity));

        this.recordAction({
            label: 'Add',
            undo: () => {
                for (const entity of entities) {
                    this.removeEntityByReference(entity);
                }
            },
            redo: () => {
                this.insertEntitiesAtIndices(entities, indices);
            }
        });
    }

    recordDeleteAction(entities: DxfEntity[], indices: number[]): void {
        if (!this.parsedDxf || entities.length === 0) return;

        this.recordAction({
            label: 'Delete',
            undo: () => {
                this.insertEntitiesAtIndices(entities, indices);
            },
            redo: () => {
                for (const entity of entities) {
                    this.removeEntityByReference(entity);
                }
            }
        });
    }

    recordMoveAction(entities: DxfEntity[], dx: number, dy: number): void {
        if (entities.length === 0) return;

        this.recordAction({
            label: 'Move',
            undo: () => {
                this.moveEntities(entities, -dx, -dy);
            },
            redo: () => {
                this.moveEntities(entities, dx, dy);
            }
        });
    }

    /**
     * Record a trim action (delete original + create new segments)
     */
    recordTrimAction(deletedEntity: DxfEntity, deletedIndex: number, createdEntities: DxfEntity[]): void {
        this.recordAction({
            label: 'Trim',
            undo: () => {
                // Remove created entities
                for (const entity of createdEntities) {
                    this.removeEntityByReference(entity);
                }
                // Restore deleted entity
                this.insertEntitiesAtIndices([deletedEntity], [deletedIndex]);
            },
            redo: () => {
                // Delete the original entity
                this.removeEntityByReference(deletedEntity);
                // Re-create the trimmed segments
                for (const entity of createdEntities) {
                    this.addEntity(entity);
                }
            }
        });
    }

    /**
     * Record a PEDIT action (delete multiple entities + create multiple new entities)
     */
    recordPeditAction(
        deletedEntities: DxfEntity[],
        deletedIndices: number[],
        createdEntities: DxfEntity[],
        label: string = 'PEDIT'
    ): void {
        this.recordAction({
            label,
            undo: () => {
                // Remove created entities
                for (const entity of createdEntities) {
                    this.removeEntityByReference(entity);
                }
                // Restore deleted entities at original indices
                this.insertEntitiesAtIndices(deletedEntities, deletedIndices);
            },
            redo: () => {
                // Delete the original entities
                for (const entity of deletedEntities) {
                    this.removeEntityByReference(entity);
                }
                // Re-create the new entities
                for (const entity of createdEntities) {
                    this.addEntity(entity);
                }
            }
        });
    }

    /**
     * Record a polyline modification action (vertices changed, closed state changed, etc.)
     */
    recordPolylineModifyAction(
        polyline: DxfPolyline,
        oldVertices: DxfPoint[],
        oldClosed: boolean,
        newVertices: DxfPoint[],
        newClosed: boolean
    ): void {
        this.recordAction({
            label: 'PEDIT Modify',
            undo: () => {
                // Restore old state
                polyline.vertices = oldVertices.map(v => ({ x: v.x, y: v.y }));
                polyline.closed = oldClosed;
                this.refreshPolylineDisplay(polyline);
            },
            redo: () => {
                // Apply new state
                polyline.vertices = newVertices.map(v => ({ x: v.x, y: v.y }));
                polyline.closed = newClosed;
                this.refreshPolylineDisplay(polyline);
            }
        });
    }

    /**
     * Refresh the display of a polyline without creating undo record
     */
    refreshPolylineDisplay(polyline: DxfPolyline): void {
        // Find existing three object for this polyline
        const existingObj = this.entityGroup.children.find(
            obj => obj.userData.entity === polyline
        );

        if (existingObj) {
            // Remove old display
            this.entityGroup.remove(existingObj);
            existingObj.traverse((child) => {
                if (child instanceof THREE.Line || child instanceof THREE.Points || child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                }
            });
            this.originalMaterials.delete(existingObj);
        }

        // Get layer info for color and linetype
        const layerName = polyline.layer || '0';
        const layer = this.parsedDxf?.layers?.get(layerName);
        const color = layer?.color ?? 7;
        const lineTypeName = layer?.lineType || 'CONTINUOUS';
        const lineType = this.parsedDxf?.lineTypes?.get(lineTypeName) || null;
        const lineWidth = layer?.lineWeight ?? 1;

        // Create new display using renderPolyline
        const newObj = this.renderPolyline(polyline, color, lineType, lineWidth);
        newObj.userData.entity = polyline;
        newObj.userData.layer = layerName;
        this.entityGroup.add(newObj);

        this.render();
    }

    /**
     * Get the index of an entity in parsedDxf.entities
     */
    getEntityIndex(entity: DxfEntity): number {
        if (!this.parsedDxf) return -1;
        return this.parsedDxf.entities.indexOf(entity);
    }

    /**
     * Delete entity without recording undo (for use in compound operations)
     */
    deleteEntityWithoutUndo(object: THREE.Object3D): boolean {
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

    // Undo last action
    undo(): void {
        if (this.undoStack.length === 0) {
            console.log('Undo stack is empty');
            return;
        }

        const action = this.undoStack.pop()!;
        this.applyingHistory = true;
        try {
            this.clearSelection();
            action.undo();
        } finally {
            this.applyingHistory = false;
        }
        this.redoStack.push(action);
        this.render();
    }

    // Redo last undone action
    redo(): void {
        if (this.redoStack.length === 0) {
            console.log('Redo stack is empty');
            return;
        }

        const action = this.redoStack.pop()!;
        this.applyingHistory = true;
        try {
            this.clearSelection();
            action.redo();
        } finally {
            this.applyingHistory = false;
        }
        this.undoStack.push(action);
        this.render();
    }

    /**
     * Remove the last entity from the entity group
     * Used for Undo functionality in drawing commands
     * Returns true if an entity was removed, false otherwise
     */
    undoLastEntity(): boolean {
        if (this.entityGroup.children.length === 0) {
            return false;
        }

        // Get the last added entity
        const lastObject = this.entityGroup.children[this.entityGroup.children.length - 1];

        // Delete it
        return this.deleteEntity(lastObject);
    }

    /**
     * Re-renders all entities in the entity group.
     * Used after entity data has been modified (e.g., by MOVE or COPY commands).
     */
    reRenderEntities(): void {
        if (!this.parsedDxf) return;

        // Clear existing entity group
        while (this.entityGroup.children.length > 0) {
            const child = this.entityGroup.children[0];
            this.entityGroup.remove(child);
            // Dispose geometry
            child.traverse((obj) => {
                if (obj instanceof THREE.Line || obj instanceof THREE.Points || obj instanceof THREE.Mesh) {
                    obj.geometry.dispose();
                }
            });
        }

        // Clear selection state
        this.selectedEntities.clear();
        this.originalMaterials.clear();

        // Re-render all entities
        for (const entity of this.parsedDxf.entities) {
            const object = this.renderEntity(entity, this.parsedDxf);
            if (object) {
                object.userData.entity = entity;
                object.userData.layer = entity.layer;
                this.entityGroup.add(object);
            }
        }

        this.updateSelectionStatus();
        this.render();
    }

    private findObjectByEntity(entity: DxfEntity): THREE.Object3D | undefined {
        for (const object of this.entityGroup.children) {
            if (object.userData.entity === entity) {
                return object;
            }
        }

        if (entity.handle) {
            for (const object of this.entityGroup.children) {
                const objEntity = object.userData.entity as DxfEntity | undefined;
                if (objEntity?.handle === entity.handle) {
                    return object;
                }
            }
        }

        return undefined;
    }

    removeEntityByReference(entity: DxfEntity): void {
        const object = this.findObjectByEntity(entity);
        if (object) {
            this.deleteEntity(object);
            return;
        }

        if (this.parsedDxf) {
            const idx = this.parsedDxf.entities.indexOf(entity);
            if (idx !== -1) {
                this.parsedDxf.entities.splice(idx, 1);
            }
        }
    }

    insertEntitiesAtIndices(entities: DxfEntity[], indices: number[]): void {
        if (!this.parsedDxf) return;

        const pairs = entities.map((entity, i) => ({
            entity,
            index: indices[i] ?? -1
        }));

        pairs.sort((a, b) => {
            if (a.index < 0 && b.index < 0) return 0;
            if (a.index < 0) return 1;
            if (b.index < 0) return -1;
            return a.index - b.index;
        });

        for (const pair of pairs) {
            this.addEntity(pair.entity, {
                insertIndex: pair.index >= 0 ? pair.index : undefined,
                render: false
            });
        }

        this.render();
    }

    moveEntities(entities: DxfEntity[], dx: number, dy: number): void {
        if (entities.length === 0) return;

        let needsReRender = false;
        for (const entity of entities) {
            this.applyDisplacementToEntity(entity, dx, dy);
            const object = this.findObjectByEntity(entity);
            if (object) {
                object.position.x += dx;
                object.position.y += dy;
            } else {
                needsReRender = true;
            }
        }

        if (needsReRender) {
            this.reRenderEntities();
        } else {
            this.render();
        }
    }

    applyDisplacementToEntity(entity: DxfEntity, dx: number, dy: number): void {
        switch (entity.type) {
            case 'LINE': {
                const line = entity as DxfLine;
                line.start.x += dx;
                line.start.y += dy;
                line.end.x += dx;
                line.end.y += dy;
                break;
            }
            case 'CIRCLE': {
                const circle = entity as DxfCircle;
                circle.center.x += dx;
                circle.center.y += dy;
                break;
            }
            case 'ARC': {
                const arc = entity as DxfArc;
                arc.center.x += dx;
                arc.center.y += dy;
                break;
            }
            case 'POINT': {
                const point = entity as DxfPoint_;
                point.position.x += dx;
                point.position.y += dy;
                break;
            }
            case 'LWPOLYLINE':
            case 'POLYLINE': {
                const polyline = entity as DxfPolyline;
                for (const vertex of polyline.vertices) {
                    vertex.x += dx;
                    vertex.y += dy;
                }
                break;
            }
            case 'TEXT':
            case 'MTEXT': {
                const text = entity as DxfText;
                text.position.x += dx;
                text.position.y += dy;
                if (text.alignmentPoint) {
                    text.alignmentPoint.x += dx;
                    text.alignmentPoint.y += dy;
                }
                break;
            }
            case 'ELLIPSE': {
                const ellipse = entity as DxfEllipse;
                ellipse.center.x += dx;
                ellipse.center.y += dy;
                break;
            }
            case 'SPLINE': {
                const spline = entity as DxfSpline;
                for (const cp of spline.controlPoints) {
                    cp.x += dx;
                    cp.y += dy;
                }
                for (const fp of spline.fitPoints) {
                    fp.x += dx;
                    fp.y += dy;
                }
                break;
            }
            case 'INSERT': {
                const insert = entity as DxfInsert;
                insert.position.x += dx;
                insert.position.y += dy;
                break;
            }
            case 'DIMENSION': {
                const dim = entity as DxfDimension;
                dim.definitionPoint.x += dx;
                dim.definitionPoint.y += dy;
                dim.middlePoint.x += dx;
                dim.middlePoint.y += dy;
                break;
            }
            case 'LEADER': {
                const leader = entity as DxfLeader;
                for (const vertex of leader.vertices) {
                    vertex.x += dx;
                    vertex.y += dy;
                }
                break;
            }
            case 'WIPEOUT': {
                const wipeout = entity as DxfWipeout;
                wipeout.insertionPoint.x += dx;
                wipeout.insertionPoint.y += dy;
                for (const point of wipeout.clipBoundary) {
                    point.x += dx;
                    point.y += dy;
                }
                break;
            }
            case 'ATTRIB':
            case 'ATTDEF': {
                const attrib = entity as DxfAttrib;
                attrib.position.x += dx;
                attrib.position.y += dy;
                break;
            }
            case 'SOLID':
            case '3DFACE': {
                const solid = entity as DxfSolid;
                for (const point of solid.points) {
                    point.x += dx;
                    point.y += dy;
                }
                break;
            }
            case 'HATCH': {
                const hatch = entity as DxfHatch;
                for (const path of hatch.boundaryPaths) {
                    for (const point of path) {
                        point.x += dx;
                        point.y += dy;
                    }
                }
                break;
            }
            default: {
                const anyEntity = entity as any;
                if (anyEntity.position) {
                    anyEntity.position.x += dx;
                    anyEntity.position.y += dy;
                }
                if (anyEntity.center) {
                    anyEntity.center.x += dx;
                    anyEntity.center.y += dy;
                }
                break;
            }
        }
    }

    /**
     * Clone an entity and add it to the DXF
     * Returns the new cloned entity
     */
    cloneEntity(entity: DxfEntity): DxfEntity | null {
        if (!this.parsedDxf) return null;

        // Deep clone the entity
        const cloned = JSON.parse(JSON.stringify(entity)) as DxfEntity;

        // Generate new handle
        cloned.handle = this.generateHandle();

        // Add to parsed DXF
        this.parsedDxf.entities.push(cloned);

        // Render the new entity
        const object = this.renderEntity(cloned, this.parsedDxf);
        if (object) {
            object.userData.entity = cloned;
            object.userData.layer = cloned.layer;
            this.entityGroup.add(object);
        }

        this.render();
        return cloned;
    }

    /**
     * Add a pre-configured entity to the DXF and render it
     * Used by COPY command after displacement is applied
     * @param entity The entity with coordinates already set to final position
     * @returns The Three.js object created for the entity
     */
    addEntity(entity: DxfEntity, options: { insertIndex?: number; render?: boolean } = {}): THREE.Object3D | null {
        if (!this.parsedDxf) return null;

        const insertIndex = options.insertIndex;
        const shouldRender = options.render !== false;

        // Add to parsed DXF data
        if (insertIndex === undefined || insertIndex < 0 || insertIndex > this.parsedDxf.entities.length) {
            this.parsedDxf.entities.push(entity);
        } else {
            this.parsedDxf.entities.splice(insertIndex, 0, entity);
        }

        // Render the entity at its current coordinates
        const object = this.renderEntity(entity, this.parsedDxf);
        if (object) {
            object.userData.entity = entity;
            object.userData.layer = entity.layer;
            this.entityGroup.add(object);
        }

        if (shouldRender) {
            this.render();
        }
        return object;
    }

    /**
     * Create a text entity at the specified position
     * Used for dimension annotations
     */
    createTextEntity(
        position: { x: number; y: number },
        text: string,
        height: number,
        rotation: number = 0
    ): DxfText | null {
        // Create DXF TEXT entity
        const textEntity: DxfText = {
            type: 'TEXT',
            layer: this.currentDrawingLayer,
            handle: this.generateHandle(),
            position: { x: position.x, y: position.y },
            text: text,
            height: height,
            rotation: rotation,
            horizontalAlignment: 1, // Center
            verticalAlignment: 2   // Middle
        };

        // Add to parsed DXF
        if (this.parsedDxf) {
            this.parsedDxf.entities.push(textEntity);
        }

        // Render the new text with layer color
        const layerColor = this.getCurrentLayerColor();
        const textObject = this.renderText(textEntity, layerColor);
        textObject.userData.entity = textEntity;
        textObject.userData.layer = textEntity.layer;
        this.entityGroup.add(textObject);
        this.render();

        return textEntity;
    }

    /**
     * Updates an entity's property and re-renders it
     * @param entity The entity to update
     * @param property The property name to change
     * @param value The new value
     * @returns true if successful
     */
    updateEntityProperty(entity: DxfEntity, property: string, value: any): boolean {
        if (!entity || !this.parsedDxf) {
            return false;
        }

        // Update the entity property
        const entityAny = entity as any;

        // Handle nested properties like 'start.x', 'center.y'
        const parts = property.split('.');
        if (parts.length === 2) {
            if (entityAny[parts[0]]) {
                entityAny[parts[0]][parts[1]] = value;
            }
        } else {
            entityAny[property] = value;
        }

        // Find and re-render the 3D object
        let objectToRemove: THREE.Object3D | null = null;
        this.entityGroup.traverse((object) => {
            if (object.userData.entity === entity) {
                objectToRemove = object;
            }
        });

        if (objectToRemove) {
            this.entityGroup.remove(objectToRemove);

            // Re-render the entity
            const newObject = this.renderEntity(entity, this.parsedDxf);
            if (newObject) {
                newObject.userData.entity = entity;
                newObject.userData.layer = entity.layer;
                this.entityGroup.add(newObject);
            }
        }

        this.render();
        return true;
    }

    /**
     * Changes an entity's layer
     * @param entity The entity to move
     * @param newLayerName The new layer name
     * @returns true if successful
     */
    changeEntityLayer(entity: DxfEntity, newLayerName: string): boolean {
        if (!entity || !this.parsedDxf) {
            return false;
        }

        // Update entity layer
        entity.layer = newLayerName;

        // Ensure layer exists
        if (!this.parsedDxf.layers.has(newLayerName)) {
            this.addLayer(newLayerName);
        }

        // Find and re-render the 3D object
        let objectToRemove: THREE.Object3D | null = null;
        this.entityGroup.traverse((object) => {
            if (object.userData.entity === entity) {
                objectToRemove = object;
            }
        });

        if (objectToRemove) {
            this.entityGroup.remove(objectToRemove);

            // Re-render with new layer properties
            const newObject = this.renderEntity(entity, this.parsedDxf);
            if (newObject) {
                newObject.userData.entity = entity;
                newObject.userData.layer = newLayerName;
                newObject.visible = this.layerVisibility.get(newLayerName) ?? true;
                this.entityGroup.add(newObject);
            }
        }

        this.render();
        return true;
    }
}
