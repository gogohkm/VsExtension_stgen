/**
 * Annotation Manager for DXF Viewer
 * Handles creation and management of annotations
 */

import * as THREE from 'three';

export type AnnotationType = 'text' | 'arrow' | 'rectangle' | 'circle' | 'line';

export interface Annotation {
    id: string;
    type: AnnotationType;
    position: { x: number; y: number };
    properties: Record<string, any>;
    color: number;
}

export class AnnotationManager {
    private scene: THREE.Scene;
    private annotationGroup: THREE.Group;
    private annotations: Map<string, THREE.Object3D> = new Map();
    private annotationData: Map<string, Annotation> = new Map();
    private renderCallback: () => void;
    private getCamera: () => THREE.OrthographicCamera;

    private isAnnotating = false;
    private currentType: AnnotationType = 'text';
    private annotationColor: number = 0xff0000;

    // Callback for requesting text input (since prompt() doesn't work in VS Code webview)
    private textInputCallback: ((position: { x: number; y: number }, callback: (text: string) => void) => void) | null = null;

    constructor(
        scene: THREE.Scene,
        annotationGroup: THREE.Group,
        renderCallback: () => void,
        getCamera?: () => THREE.OrthographicCamera
    ) {
        this.scene = scene;
        this.annotationGroup = annotationGroup;
        this.renderCallback = renderCallback;
        this.getCamera = getCamera || (() => this.scene.children.find(c => c instanceof THREE.Camera) as THREE.OrthographicCamera);
    }

    startAnnotation(type: AnnotationType): void {
        this.isAnnotating = true;
        this.currentType = type;

        // Add click handler for annotation placement
        document.addEventListener('click', this.handleClick);
        document.body.style.cursor = 'crosshair';
    }

    cancelAnnotation(): void {
        this.isAnnotating = false;
        document.removeEventListener('click', this.handleClick);
        document.body.style.cursor = 'default';
    }

    isAnnotationMode(): boolean {
        return this.isAnnotating;
    }

    private handleClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;

        // Only handle clicks on the canvas
        if (target.tagName !== 'CANVAS') {
            return;
        }

        // Get world coordinates from click
        const canvas = target as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Convert to normalized device coordinates (-1 to 1)
        const ndcX = (x / rect.width) * 2 - 1;
        const ndcY = -(y / rect.height) * 2 + 1;

        // Get camera from the provided getter function
        const camera = this.getCamera();
        if (!camera) {
            console.error('AnnotationManager: Camera not found');
            return;
        }

        const worldX = (camera.right - camera.left) * (ndcX + 1) / 2 + camera.left;
        const worldY = (camera.top - camera.bottom) * (ndcY + 1) / 2 + camera.bottom;

        this.createAnnotation(this.currentType, worldX, worldY);
        this.cancelAnnotation();
    };

    private createAnnotation(type: AnnotationType, x: number, y: number): void {
        const id = this.generateId();
        const annotation: Annotation = {
            id,
            type,
            position: { x, y },
            properties: {},
            color: this.annotationColor
        };

        let object: THREE.Object3D | null = null;

        switch (type) {
            case 'text':
                // Use text input callback if available, otherwise use prompt (which may not work in VS Code)
                if (this.textInputCallback) {
                    this.textInputCallback({ x, y }, (text: string) => {
                        if (!text) {
                            return;
                        }
                        annotation.properties.text = text;
                        const textObject = this.createTextAnnotation(x, y, text, this.annotationColor);
                        if (textObject) {
                            textObject.userData.annotationId = id;
                            this.annotations.set(id, textObject);
                            this.annotationData.set(id, annotation);
                            this.annotationGroup.add(textObject);
                            this.renderCallback();
                        }
                    });
                    return; // Return early - the callback will handle creation
                }
                // Fallback to prompt (may not work in VS Code webview)
                const text = prompt('Enter annotation text:', 'Note');
                if (!text) {
                    return;
                }
                annotation.properties.text = text;
                object = this.createTextAnnotation(x, y, text, this.annotationColor);
                break;

            case 'arrow':
                annotation.properties.end = { x: x + 20, y: y + 20 };
                object = this.createArrowAnnotation(
                    { x, y },
                    annotation.properties.end,
                    this.annotationColor
                );
                break;

            case 'rectangle':
                annotation.properties.width = 30;
                annotation.properties.height = 20;
                object = this.createRectangleAnnotation(
                    x, y,
                    annotation.properties.width,
                    annotation.properties.height,
                    this.annotationColor
                );
                break;

            case 'circle':
                annotation.properties.radius = 15;
                object = this.createCircleAnnotation(
                    x, y,
                    annotation.properties.radius,
                    this.annotationColor
                );
                break;

            case 'line':
                annotation.properties.end = { x: x + 30, y: y };
                object = this.createLineAnnotation(
                    { x, y },
                    annotation.properties.end,
                    this.annotationColor
                );
                break;
        }

        if (object) {
            object.userData.annotationId = id;
            this.annotations.set(id, object);
            this.annotationData.set(id, annotation);
            this.annotationGroup.add(object);
            this.renderCallback();
        }
    }

    // Font stack that supports Korean, Japanese, Chinese and Western characters
    private static readonly FONT_FAMILY = '"Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans KR", "NanumGothic", "나눔고딕", "Dotum", "돋움", "Gulim", "굴림", "Microsoft YaHei", "SimSun", "Meiryo", "MS Gothic", Arial, sans-serif';

    private createTextAnnotation(x: number, y: number, text: string, color: number): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;

        const fontSize = 64; // Higher resolution for better quality
        const padding = 12;
        const fontFamily = AnnotationManager.FONT_FAMILY;

        context.font = `bold ${fontSize}px ${fontFamily}`;
        const metrics = context.measureText(text);

        canvas.width = Math.max(Math.ceil(metrics.width) + padding * 2, 80);
        canvas.height = fontSize + padding * 2;

        // Draw background
        context.fillStyle = 'rgba(30, 30, 30, 0.85)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw border
        context.strokeStyle = '#' + color.toString(16).padStart(6, '0');
        context.lineWidth = 3;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

        // Draw text with Korean-supporting font
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.font = `bold ${fontSize}px ${fontFamily}`;
        context.textBaseline = 'top';
        context.fillText(text, padding, padding);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);

        // Calculate scale based on current view width for proper sizing relative to drawing
        const camera = this.getCamera();
        const viewWidth = camera ? (camera.right - camera.left) : 100;

        // Scale text to be approximately 3% of view width, with min/max limits
        const baseTextSize = viewWidth * 0.03;
        const minSize = 5;   // Minimum world units
        const maxSize = 100; // Maximum world units
        const textWorldSize = Math.max(minSize, Math.min(maxSize, baseTextSize));

        // Calculate scale factor: sprite scale = world size / canvas pixel ratio
        const aspectRatio = canvas.width / canvas.height;
        sprite.scale.set(textWorldSize * aspectRatio, textWorldSize, 1);
        sprite.position.set(x, y, 1);

        return sprite;
    }

    private createArrowAnnotation(
        start: { x: number; y: number },
        end: { x: number; y: number },
        color: number
    ): THREE.Group {
        const group = new THREE.Group();
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });

        // Arrow line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(start.x, start.y, 1),
            new THREE.Vector3(end.x, end.y, 1)
        ]);
        const line = new THREE.Line(lineGeometry, material);
        group.add(line);

        // Arrowhead
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const arrowSize = Math.min(5, length * 0.3);

        const angle = Math.atan2(dy, dx);
        const arrowAngle = Math.PI / 6;

        const arrowPoints = [
            new THREE.Vector3(
                end.x - arrowSize * Math.cos(angle - arrowAngle),
                end.y - arrowSize * Math.sin(angle - arrowAngle),
                1
            ),
            new THREE.Vector3(end.x, end.y, 1),
            new THREE.Vector3(
                end.x - arrowSize * Math.cos(angle + arrowAngle),
                end.y - arrowSize * Math.sin(angle + arrowAngle),
                1
            )
        ];

        const arrowGeometry = new THREE.BufferGeometry().setFromPoints(arrowPoints);
        const arrow = new THREE.Line(arrowGeometry, material);
        group.add(arrow);

        return group;
    }

    private createRectangleAnnotation(
        x: number,
        y: number,
        width: number,
        height: number,
        color: number
    ): THREE.Line {
        const points = [
            new THREE.Vector3(x, y, 1),
            new THREE.Vector3(x + width, y, 1),
            new THREE.Vector3(x + width, y + height, 1),
            new THREE.Vector3(x, y + height, 1),
            new THREE.Vector3(x, y, 1)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        return new THREE.Line(geometry, material);
    }

    private createCircleAnnotation(
        x: number,
        y: number,
        radius: number,
        color: number
    ): THREE.Line {
        const segments = 64;
        const points: THREE.Vector3[] = [];

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                x + Math.cos(angle) * radius,
                y + Math.sin(angle) * radius,
                1
            ));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        return new THREE.Line(geometry, material);
    }

    private createLineAnnotation(
        start: { x: number; y: number },
        end: { x: number; y: number },
        color: number
    ): THREE.Line {
        const points = [
            new THREE.Vector3(start.x, start.y, 1),
            new THREE.Vector3(end.x, end.y, 1)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        return new THREE.Line(geometry, material);
    }

    removeAnnotation(id: string): void {
        const object = this.annotations.get(id);
        if (object) {
            this.annotationGroup.remove(object);
            this.annotations.delete(id);
            this.annotationData.delete(id);
            this.renderCallback();
        }
    }

    clearAll(): void {
        for (const object of this.annotations.values()) {
            this.annotationGroup.remove(object);
        }
        this.annotations.clear();
        this.annotationData.clear();
    }

    getAnnotations(): Annotation[] {
        return Array.from(this.annotationData.values());
    }

    setColor(color: number): void {
        this.annotationColor = color;
    }

    /**
     * Sets a callback for requesting text input from the user.
     * This is needed because prompt() doesn't work in VS Code webview.
     */
    setTextInputCallback(callback: (position: { x: number; y: number }, done: (text: string) => void) => void): void {
        this.textInputCallback = callback;
    }

    private generateId(): string {
        return 'ann_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    serialize(): string {
        return JSON.stringify(Array.from(this.annotationData.values()));
    }

    deserialize(data: string): void {
        try {
            const annotations: Annotation[] = JSON.parse(data);
            this.clearAll();

            for (const annotation of annotations) {
                let object: THREE.Object3D | null = null;

                switch (annotation.type) {
                    case 'text':
                        object = this.createTextAnnotation(
                            annotation.position.x,
                            annotation.position.y,
                            annotation.properties.text,
                            annotation.color
                        );
                        break;
                    case 'arrow':
                        object = this.createArrowAnnotation(
                            annotation.position,
                            annotation.properties.end,
                            annotation.color
                        );
                        break;
                    case 'rectangle':
                        object = this.createRectangleAnnotation(
                            annotation.position.x,
                            annotation.position.y,
                            annotation.properties.width,
                            annotation.properties.height,
                            annotation.color
                        );
                        break;
                    case 'circle':
                        object = this.createCircleAnnotation(
                            annotation.position.x,
                            annotation.position.y,
                            annotation.properties.radius,
                            annotation.color
                        );
                        break;
                    case 'line':
                        object = this.createLineAnnotation(
                            annotation.position,
                            annotation.properties.end,
                            annotation.color
                        );
                        break;
                }

                if (object) {
                    object.userData.annotationId = annotation.id;
                    this.annotations.set(annotation.id, object);
                    this.annotationData.set(annotation.id, annotation);
                    this.annotationGroup.add(object);
                }
            }

            this.renderCallback();
        } catch (error) {
            console.error('Failed to deserialize annotations:', error);
        }
    }
}
