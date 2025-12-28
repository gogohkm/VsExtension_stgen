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
    DxfLeader
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
        // Resolve color: use entity color if valid, otherwise use layer color
        let color: number;
        if (entity.color !== undefined && entity.color !== COLOR_BYLAYER && entity.color !== COLOR_BYBLOCK) {
            color = aciToColor(entity.color);
        } else {
            color = this.getLayerColor(entity.layer, dxf);
        }

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
            case 'ELLIPSE':
                return this.renderEllipse(entity as DxfEllipse, color);
            case 'SPLINE':
                return this.renderSpline(entity as DxfSpline, color);
            case 'HATCH':
                return this.renderHatch(entity as DxfHatch, color);
            case 'DIMENSION':
                return this.renderDimension(entity as DxfDimension, color);
            case 'SOLID':
            case '3DFACE':
                return this.renderSolid(entity as DxfSolid, color);
            case 'ATTRIB':
            case 'ATTDEF':
                return this.renderAttrib(entity as DxfAttrib, color);
            case 'LEADER':
                return this.renderLeader(entity as DxfLeader, color);
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

    private renderEllipse(ellipse: DxfEllipse, color: number): THREE.Line {
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
        const material = new THREE.LineBasicMaterial({ color });
        return new THREE.Line(geometry, material);
    }

    private renderSpline(spline: DxfSpline, color: number): THREE.Line {
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
        const material = new THREE.LineBasicMaterial({ color });
        return new THREE.Line(geometry, material);
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
        for (const path of hatch.boundaryPaths) {
            if (path.length < 2) continue;

            const points = path.map(p => new THREE.Vector3(p.x, p.y, 0));
            points.push(points[0].clone()); // Close the path

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color });
            group.add(new THREE.Line(geometry, material));
        }

        // For solid hatches, try to fill with a mesh
        if (hatch.solid && hatch.boundaryPaths.length > 0) {
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
                        const fillMaterial = new THREE.MeshBasicMaterial({
                            color,
                            transparent: true,
                            opacity: 0.3,
                            side: THREE.DoubleSide
                        });
                        const mesh = new THREE.Mesh(shapeGeometry, fillMaterial);
                        mesh.position.z = -0.01; // Slightly behind lines
                        group.add(mesh);
                    } catch (e) {
                        // Ignore fill errors for complex shapes
                    }
                }
            }
        }

        return group;
    }

    private renderDimension(dimension: DxfDimension, color: number): THREE.Group {
        const group = new THREE.Group();

        // Draw dimension line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(dimension.definitionPoint.x, dimension.definitionPoint.y, 0),
            new THREE.Vector3(dimension.middlePoint.x, dimension.middlePoint.y, 0)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ color });
        group.add(new THREE.Line(lineGeometry, lineMaterial));

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
        const lineMaterial = new THREE.LineBasicMaterial({ color });
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

    getAnnotationGroup(): THREE.Group {
        return this.annotationGroup;
    }

    dispose(): void {
        this.renderer.dispose();
    }
}
