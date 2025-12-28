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
    DxfInsert
} from './dxfParser';

// AutoCAD Color Index (ACI) to RGB
const ACI_COLORS: { [key: number]: number } = {
    1: 0xff0000,   // Red
    2: 0xffff00,   // Yellow
    3: 0x00ff00,   // Green
    4: 0x00ffff,   // Cyan
    5: 0x0000ff,   // Blue
    6: 0xff00ff,   // Magenta
    7: 0xffffff,   // White
    8: 0x808080,   // Gray
    9: 0xc0c0c0,   // Light gray
};

function aciToColor(aci: number): number {
    if (aci <= 0) {
        return 0xffffff;
    }
    return ACI_COLORS[aci] || 0xffffff;
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
            if (e.button === 0 || e.button === 1) {
                this.isDragging = true;
                this.lastMousePos = { x: e.clientX, y: e.clientY };
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMousePos.x;
                const dy = e.clientY - this.lastMousePos.y;

                // Convert screen pixels to world units
                const scale = this.viewWidth / this.container.clientWidth;
                this.viewCenter.x -= dx * scale;
                this.viewCenter.y += dy * scale;

                this.lastMousePos = { x: e.clientX, y: e.clientY };
                this.updateCamera();
                this.render();
            }

            // Update coordinates display
            this.updateCoordinates(e);
        });

        canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
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
        const color = entity.color !== undefined
            ? aciToColor(entity.color)
            : this.getLayerColor(entity.layer, dxf);

        switch (entity.type) {
            case 'LINE':
                return this.renderLine(entity as DxfLine, color);
            case 'CIRCLE':
                return this.renderCircle(entity as DxfCircle, color);
            case 'ARC':
                return this.renderArc(entity as DxfArc, color);
            case 'POLYLINE':
            case 'LWPOLYLINE':
                return this.renderPolyline(entity as DxfPolyline, color);
            case 'TEXT':
            case 'MTEXT':
                return this.renderText(entity as DxfText, color);
            case 'POINT':
                return this.renderPoint(entity as DxfPoint_, color);
            case 'INSERT':
                return this.renderInsert(entity as DxfInsert, color, dxf);
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

    private renderLine(line: DxfLine, color: number): THREE.Line {
        const geometry = new THREE.BufferGeometry();
        const points = [
            new THREE.Vector3(line.start.x, line.start.y, 0),
            new THREE.Vector3(line.end.x, line.end.y, 0)
        ];
        geometry.setFromPoints(points);

        const material = new THREE.LineBasicMaterial({ color });
        return new THREE.Line(geometry, material);
    }

    private renderCircle(circle: DxfCircle, color: number): THREE.Line {
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
        const material = new THREE.LineBasicMaterial({ color });
        return new THREE.Line(geometry, material);
    }

    private renderArc(arc: DxfArc, color: number): THREE.Line {
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
        const material = new THREE.LineBasicMaterial({ color });
        return new THREE.Line(geometry, material);
    }

    private renderPolyline(polyline: DxfPolyline, color: number): THREE.Line {
        if (polyline.vertices.length < 2) {
            return new THREE.Line();
        }

        const geometry = new THREE.BufferGeometry();
        const points = polyline.vertices.map(v => new THREE.Vector3(v.x, v.y, 0));

        if (polyline.closed && points.length > 0) {
            points.push(points[0].clone());
        }

        geometry.setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color });
        return new THREE.Line(geometry, material);
    }

    private renderText(text: DxfText, color: number): THREE.Sprite {
        // Create text sprite using canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;

        const fontSize = 64;
        context.font = `${fontSize}px Arial`;
        const metrics = context.measureText(text.text);

        canvas.width = Math.ceil(metrics.width) + 20;
        canvas.height = fontSize + 20;

        // Clear with transparent background
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw text
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.font = `${fontSize}px Arial`;
        context.textBaseline = 'top';
        context.fillText(text.text, 10, 10);

        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);

        // Scale sprite to match DXF text height
        const scale = text.height / fontSize * canvas.height;
        sprite.scale.set(scale * canvas.width / canvas.height, scale, 1);
        sprite.position.set(text.position.x, text.position.y, 0);

        return sprite;
    }

    private renderPoint(point: DxfPoint_, color: number): THREE.Points {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([point.position.x, point.position.y, 0], 3));

        const material = new THREE.PointsMaterial({ color, size: 5, sizeAttenuation: false });
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

    getLayerVisibility(): Map<string, boolean> {
        return new Map(this.layerVisibility);
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

    getAnnotationGroup(): THREE.Group {
        return this.annotationGroup;
    }

    dispose(): void {
        this.renderer.dispose();
    }
}
