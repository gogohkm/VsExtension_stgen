/**
 * Simple DXF Parser for VS Code Extension
 * Parses basic DXF entities: LINE, CIRCLE, ARC, POLYLINE, LWPOLYLINE, TEXT, MTEXT, POINT
 */

export interface DxfPoint {
    x: number;
    y: number;
    z?: number;
}

export interface DxfEntity {
    type: string;
    handle?: string;
    layer: string;
    color?: number;
    lineType?: string;
}

export interface DxfLine extends DxfEntity {
    type: 'LINE';
    start: DxfPoint;
    end: DxfPoint;
}

export interface DxfCircle extends DxfEntity {
    type: 'CIRCLE';
    center: DxfPoint;
    radius: number;
}

export interface DxfArc extends DxfEntity {
    type: 'ARC';
    center: DxfPoint;
    radius: number;
    startAngle: number;
    endAngle: number;
}

export interface DxfPolyline extends DxfEntity {
    type: 'POLYLINE' | 'LWPOLYLINE';
    vertices: DxfPoint[];
    closed: boolean;
}

export interface DxfText extends DxfEntity {
    type: 'TEXT' | 'MTEXT';
    position: DxfPoint;
    text: string;
    height: number;
    rotation?: number;
}

export interface DxfPoint_ extends DxfEntity {
    type: 'POINT';
    position: DxfPoint;
}

export interface DxfInsert extends DxfEntity {
    type: 'INSERT';
    blockName: string;
    position: DxfPoint;
    scale: DxfPoint;
    rotation: number;
}

export interface DxfEllipse extends DxfEntity {
    type: 'ELLIPSE';
    center: DxfPoint;
    majorAxisEndpoint: DxfPoint;  // Endpoint of major axis relative to center
    ratio: number;  // Ratio of minor axis to major axis
    startAngle: number;  // Start parameter (0-2*PI)
    endAngle: number;  // End parameter (0-2*PI)
}

export interface DxfSpline extends DxfEntity {
    type: 'SPLINE';
    degree: number;
    closed: boolean;
    controlPoints: DxfPoint[];
    fitPoints: DxfPoint[];
    knots: number[];
}

export interface DxfHatch extends DxfEntity {
    type: 'HATCH';
    patternName: string;
    solid: boolean;
    boundaryPaths: DxfPoint[][];  // Array of boundary loops
}

export interface DxfDimension extends DxfEntity {
    type: 'DIMENSION';
    dimensionType: number;
    definitionPoint: DxfPoint;
    middlePoint: DxfPoint;
    text: string;
    rotation: number;
}

export interface DxfLayer {
    name: string;
    color: number;
    frozen: boolean;
    off: boolean;
}

export interface DxfBlock {
    name: string;
    basePoint: DxfPoint;
    entities: DxfEntity[];
}

export interface ParsedDxf {
    entities: DxfEntity[];
    layers: Map<string, DxfLayer>;
    blocks: Map<string, DxfBlock>;
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
}

type AnyDxfEntity = DxfLine | DxfCircle | DxfArc | DxfPolyline | DxfText | DxfPoint_ | DxfInsert | DxfEllipse | DxfSpline | DxfHatch | DxfDimension;

export class DxfParser {
    private lines: string[] = [];
    private pos: number = 0;
    private groupCode: number = 0;
    private groupValue: string = '';


    parse(dxfString: string): ParsedDxf {
        this.lines = dxfString.split(/\r?\n/);
        this.pos = 0;

        const result: ParsedDxf = {
            entities: [],
            layers: new Map(),
            blocks: new Map(),
            bounds: {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            }
        };

        while (this.pos < this.lines.length) {
            this.readGroup();
            const code = this.groupCode;
            const value = this.groupValue;

            if (code === 0) {
                if (value === 'SECTION') {
                    this.readGroup();
                    const sectionCode = this.groupCode;
                    const sectionName = this.groupValue;
                    if (sectionCode === 2) {
                        if (sectionName === 'ENTITIES') {
                            this.parseEntitiesSection(result);
                        } else if (sectionName === 'TABLES') {
                            this.parseTablesSection(result);
                        } else if (sectionName === 'BLOCKS') {
                            this.parseBlocksSection(result);
                        } else {
                            this.skipSection();
                        }
                    }
                } else if (value === 'EOF') {
                    break;
                }
            }
        }

        // Calculate bounds from entities
        this.calculateBounds(result);

        return result;
    }

    private readGroup(): void {
        if (this.pos >= this.lines.length) {
            this.groupCode = -1;
            this.groupValue = '';
            return;
        }

        const codeLine = this.lines[this.pos++]?.trim() || '';
        const valueLine = this.lines[this.pos++]?.trim() || '';

        this.groupCode = parseInt(codeLine, 10) || 0;
        this.groupValue = valueLine;
    }

    private skipSection(): void {
        while (this.pos < this.lines.length) {
            this.readGroup();
            if (this.groupCode === 0 && this.groupValue === 'ENDSEC') {
                break;
            }
        }
    }

    private parseTablesSection(result: ParsedDxf): void {
        while (this.pos < this.lines.length) {
            this.readGroup();
            const code = this.groupCode;
            const value = this.groupValue;

            if (code === 0) {
                if (value === 'ENDSEC') {
                    break;
                } else if (value === 'TABLE') {
                    this.readGroup();
                    const tableCode = this.groupCode;
                    const tableName = this.groupValue;
                    if (tableCode === 2 && tableName === 'LAYER') {
                        this.parseLayerTable(result);
                    }
                }
            }
        }
    }

    private parseLayerTable(result: ParsedDxf): void {
        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                if (this.groupValue === 'ENDTAB') {
                    break;
                } else if (this.groupValue === 'LAYER') {
                    const layer = this.parseLayer();
                    if (layer) {
                        result.layers.set(layer.name, layer);
                    }
                }
            }
        }
    }

    private parseLayer(): DxfLayer | null {
        const layer: DxfLayer = {
            name: '0',
            color: 7,
            frozen: false,
            off: false
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2; // Unread the group
                break;
            }

            switch (this.groupCode) {
                case 2:
                    layer.name = this.groupValue;
                    break;
                case 62:
                    layer.color = parseInt(this.groupValue, 10);
                    if (layer.color < 0) {
                        layer.off = true;
                        layer.color = Math.abs(layer.color);
                    }
                    break;
                case 70:
                    const flags = parseInt(this.groupValue, 10);
                    layer.frozen = (flags & 1) !== 0;
                    break;
            }
        }

        return layer;
    }

    private parseBlocksSection(result: ParsedDxf): void {
        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                if (this.groupValue === 'ENDSEC') {
                    break;
                } else if (this.groupValue === 'BLOCK') {
                    const block = this.parseBlock();
                    if (block) {
                        result.blocks.set(block.name, block);
                    }
                }
            }
        }
    }

    private parseBlock(): DxfBlock | null {
        const block: DxfBlock = {
            name: '',
            basePoint: { x: 0, y: 0, z: 0 },
            entities: []
        };

        // Read block header
        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 2:
                    block.name = this.groupValue;
                    break;
                case 10:
                    block.basePoint.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    block.basePoint.y = parseFloat(this.groupValue);
                    break;
                case 30:
                    block.basePoint.z = parseFloat(this.groupValue);
                    break;
            }
        }

        // Read block entities
        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                if (this.groupValue === 'ENDBLK') {
                    break;
                }
                const entity = this.parseEntity(this.groupValue);
                if (entity) {
                    block.entities.push(entity);
                }
            }
        }

        return block.name ? block : null;
    }

    private parseEntitiesSection(result: ParsedDxf): void {
        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                if (this.groupValue === 'ENDSEC') {
                    break;
                }
                const entity = this.parseEntity(this.groupValue);
                if (entity) {
                    result.entities.push(entity);
                }
            }
        }
    }

    private parseEntity(entityType: string): AnyDxfEntity | null {
        switch (entityType) {
            case 'LINE':
                return this.parseLine();
            case 'CIRCLE':
                return this.parseCircle();
            case 'ARC':
                return this.parseArc();
            case 'LWPOLYLINE':
                return this.parseLwPolyline();
            case 'POLYLINE':
                return this.parsePolyline();
            case 'TEXT':
                return this.parseText();
            case 'MTEXT':
                return this.parseMText();
            case 'POINT':
                return this.parsePoint();
            case 'INSERT':
                return this.parseInsert();
            case 'ELLIPSE':
                return this.parseEllipse();
            case 'SPLINE':
                return this.parseSpline();
            case 'HATCH':
                return this.parseHatch();
            case 'DIMENSION':
                return this.parseDimension();
            default:
                this.skipEntity();
                return null;
        }
    }

    private parseCommonProperties(): Partial<DxfEntity> {
        const props: Partial<DxfEntity> = {
            layer: '0'
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    props.handle = this.groupValue;
                    break;
                case 8:
                    props.layer = this.groupValue;
                    break;
                case 62:
                    props.color = parseInt(this.groupValue, 10);
                    break;
                case 6:
                    props.lineType = this.groupValue;
                    break;
            }
        }

        return props;
    }

    private parseLine(): DxfLine {
        const line: DxfLine = {
            type: 'LINE',
            layer: '0',
            start: { x: 0, y: 0 },
            end: { x: 0, y: 0 }
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    line.handle = this.groupValue;
                    break;
                case 8:
                    line.layer = this.groupValue;
                    break;
                case 62:
                    line.color = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    line.start.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    line.start.y = parseFloat(this.groupValue);
                    break;
                case 11:
                    line.end.x = parseFloat(this.groupValue);
                    break;
                case 21:
                    line.end.y = parseFloat(this.groupValue);
                    break;
            }
        }

        return line;
    }

    private parseCircle(): DxfCircle {
        const circle: DxfCircle = {
            type: 'CIRCLE',
            layer: '0',
            center: { x: 0, y: 0 },
            radius: 1
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    circle.handle = this.groupValue;
                    break;
                case 8:
                    circle.layer = this.groupValue;
                    break;
                case 62:
                    circle.color = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    circle.center.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    circle.center.y = parseFloat(this.groupValue);
                    break;
                case 40:
                    circle.radius = parseFloat(this.groupValue);
                    break;
            }
        }

        return circle;
    }

    private parseArc(): DxfArc {
        const arc: DxfArc = {
            type: 'ARC',
            layer: '0',
            center: { x: 0, y: 0 },
            radius: 1,
            startAngle: 0,
            endAngle: 360
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    arc.handle = this.groupValue;
                    break;
                case 8:
                    arc.layer = this.groupValue;
                    break;
                case 62:
                    arc.color = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    arc.center.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    arc.center.y = parseFloat(this.groupValue);
                    break;
                case 40:
                    arc.radius = parseFloat(this.groupValue);
                    break;
                case 50:
                    arc.startAngle = parseFloat(this.groupValue);
                    break;
                case 51:
                    arc.endAngle = parseFloat(this.groupValue);
                    break;
            }
        }

        return arc;
    }

    private parseLwPolyline(): DxfPolyline {
        const polyline: DxfPolyline = {
            type: 'LWPOLYLINE',
            layer: '0',
            vertices: [],
            closed: false
        };

        let currentVertex: DxfPoint | null = null;

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                if (currentVertex) {
                    polyline.vertices.push(currentVertex);
                }
                break;
            }

            switch (this.groupCode) {
                case 5:
                    polyline.handle = this.groupValue;
                    break;
                case 8:
                    polyline.layer = this.groupValue;
                    break;
                case 62:
                    polyline.color = parseInt(this.groupValue, 10);
                    break;
                case 70:
                    const flags = parseInt(this.groupValue, 10);
                    polyline.closed = (flags & 1) !== 0;
                    break;
                case 10:
                    if (currentVertex) {
                        polyline.vertices.push(currentVertex);
                    }
                    currentVertex = { x: parseFloat(this.groupValue), y: 0 };
                    break;
                case 20:
                    if (currentVertex) {
                        currentVertex.y = parseFloat(this.groupValue);
                    }
                    break;
            }
        }

        return polyline;
    }

    private parsePolyline(): DxfPolyline {
        const polyline: DxfPolyline = {
            type: 'POLYLINE',
            layer: '0',
            vertices: [],
            closed: false
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                if (this.groupValue === 'SEQEND') {
                    break;
                } else if (this.groupValue === 'VERTEX') {
                    const vertex = this.parseVertex();
                    if (vertex) {
                        polyline.vertices.push(vertex);
                    }
                } else {
                    this.pos -= 2;
                    break;
                }
            } else {
                switch (this.groupCode) {
                    case 5:
                        polyline.handle = this.groupValue;
                        break;
                    case 8:
                        polyline.layer = this.groupValue;
                        break;
                    case 62:
                        polyline.color = parseInt(this.groupValue, 10);
                        break;
                    case 70:
                        const flags = parseInt(this.groupValue, 10);
                        polyline.closed = (flags & 1) !== 0;
                        break;
                }
            }
        }

        return polyline;
    }

    private parseVertex(): DxfPoint | null {
        const vertex: DxfPoint = { x: 0, y: 0 };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 10:
                    vertex.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    vertex.y = parseFloat(this.groupValue);
                    break;
            }
        }

        return vertex;
    }

    private parseText(): DxfText {
        const text: DxfText = {
            type: 'TEXT',
            layer: '0',
            position: { x: 0, y: 0 },
            text: '',
            height: 1
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    text.handle = this.groupValue;
                    break;
                case 8:
                    text.layer = this.groupValue;
                    break;
                case 62:
                    text.color = parseInt(this.groupValue, 10);
                    break;
                case 1:
                    text.text = this.groupValue;
                    break;
                case 10:
                    text.position.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    text.position.y = parseFloat(this.groupValue);
                    break;
                case 40:
                    text.height = parseFloat(this.groupValue);
                    break;
                case 50:
                    text.rotation = parseFloat(this.groupValue);
                    break;
            }
        }

        return text;
    }

    private parseMText(): DxfText {
        const text: DxfText = {
            type: 'MTEXT',
            layer: '0',
            position: { x: 0, y: 0 },
            text: '',
            height: 1
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    text.handle = this.groupValue;
                    break;
                case 8:
                    text.layer = this.groupValue;
                    break;
                case 62:
                    text.color = parseInt(this.groupValue, 10);
                    break;
                case 1:
                case 3:
                    text.text += this.groupValue;
                    break;
                case 10:
                    text.position.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    text.position.y = parseFloat(this.groupValue);
                    break;
                case 40:
                    text.height = parseFloat(this.groupValue);
                    break;
                case 50:
                    text.rotation = parseFloat(this.groupValue);
                    break;
            }
        }

        // Strip MTEXT formatting codes
        text.text = this.stripMTextFormatting(text.text);

        return text;
    }

    private stripMTextFormatting(text: string): string {
        // Remove common MTEXT formatting codes
        return text
            .replace(/\\[A-Za-z][^;]*;/g, '') // \A1; alignment, \H1; height, etc.
            .replace(/\\P/g, '\n')             // Paragraph break
            .replace(/\{|\}/g, '')             // Braces
            .replace(/\\/g, '');               // Remaining backslashes
    }

    private parsePoint(): DxfPoint_ {
        const point: DxfPoint_ = {
            type: 'POINT',
            layer: '0',
            position: { x: 0, y: 0 }
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    point.handle = this.groupValue;
                    break;
                case 8:
                    point.layer = this.groupValue;
                    break;
                case 62:
                    point.color = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    point.position.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    point.position.y = parseFloat(this.groupValue);
                    break;
            }
        }

        return point;
    }

    private parseInsert(): DxfInsert {
        const insert: DxfInsert = {
            type: 'INSERT',
            layer: '0',
            blockName: '',
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1, z: 1 },
            rotation: 0
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    insert.handle = this.groupValue;
                    break;
                case 8:
                    insert.layer = this.groupValue;
                    break;
                case 62:
                    insert.color = parseInt(this.groupValue, 10);
                    break;
                case 2:
                    insert.blockName = this.groupValue;
                    break;
                case 10:
                    insert.position.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    insert.position.y = parseFloat(this.groupValue);
                    break;
                case 41:
                    insert.scale.x = parseFloat(this.groupValue);
                    break;
                case 42:
                    insert.scale.y = parseFloat(this.groupValue);
                    break;
                case 43:
                    insert.scale.z = parseFloat(this.groupValue);
                    break;
                case 50:
                    insert.rotation = parseFloat(this.groupValue);
                    break;
            }
        }

        return insert;
    }

    private parseEllipse(): DxfEllipse {
        const ellipse: DxfEllipse = {
            type: 'ELLIPSE',
            layer: '0',
            center: { x: 0, y: 0 },
            majorAxisEndpoint: { x: 1, y: 0 },
            ratio: 1,
            startAngle: 0,
            endAngle: Math.PI * 2
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    ellipse.handle = this.groupValue;
                    break;
                case 8:
                    ellipse.layer = this.groupValue;
                    break;
                case 62:
                    ellipse.color = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    ellipse.center.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    ellipse.center.y = parseFloat(this.groupValue);
                    break;
                case 11:
                    ellipse.majorAxisEndpoint.x = parseFloat(this.groupValue);
                    break;
                case 21:
                    ellipse.majorAxisEndpoint.y = parseFloat(this.groupValue);
                    break;
                case 40:
                    ellipse.ratio = parseFloat(this.groupValue);
                    break;
                case 41:
                    ellipse.startAngle = parseFloat(this.groupValue);
                    break;
                case 42:
                    ellipse.endAngle = parseFloat(this.groupValue);
                    break;
            }
        }

        return ellipse;
    }

    private parseSpline(): DxfSpline {
        const spline: DxfSpline = {
            type: 'SPLINE',
            layer: '0',
            degree: 3,
            closed: false,
            controlPoints: [],
            fitPoints: [],
            knots: []
        };

        let currentControlPoint: DxfPoint | null = null;
        let currentFitPoint: DxfPoint | null = null;
        let readingControlPoints = false;
        let readingFitPoints = false;

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                if (currentControlPoint) {
                    spline.controlPoints.push(currentControlPoint);
                }
                if (currentFitPoint) {
                    spline.fitPoints.push(currentFitPoint);
                }
                break;
            }

            switch (this.groupCode) {
                case 5:
                    spline.handle = this.groupValue;
                    break;
                case 8:
                    spline.layer = this.groupValue;
                    break;
                case 62:
                    spline.color = parseInt(this.groupValue, 10);
                    break;
                case 70:
                    const flags = parseInt(this.groupValue, 10);
                    spline.closed = (flags & 1) !== 0;
                    break;
                case 71:
                    spline.degree = parseInt(this.groupValue, 10);
                    break;
                case 40:
                    spline.knots.push(parseFloat(this.groupValue));
                    break;
                case 10:
                    // Control point X
                    if (currentControlPoint) {
                        spline.controlPoints.push(currentControlPoint);
                    }
                    currentControlPoint = { x: parseFloat(this.groupValue), y: 0 };
                    readingControlPoints = true;
                    readingFitPoints = false;
                    break;
                case 20:
                    if (currentControlPoint && readingControlPoints) {
                        currentControlPoint.y = parseFloat(this.groupValue);
                    } else if (currentFitPoint && readingFitPoints) {
                        currentFitPoint.y = parseFloat(this.groupValue);
                    }
                    break;
                case 11:
                    // Fit point X
                    if (currentFitPoint) {
                        spline.fitPoints.push(currentFitPoint);
                    }
                    currentFitPoint = { x: parseFloat(this.groupValue), y: 0 };
                    readingFitPoints = true;
                    readingControlPoints = false;
                    break;
                case 21:
                    if (currentFitPoint) {
                        currentFitPoint.y = parseFloat(this.groupValue);
                    }
                    break;
            }
        }

        return spline;
    }

    private parseHatch(): DxfHatch {
        const hatch: DxfHatch = {
            type: 'HATCH',
            layer: '0',
            patternName: 'SOLID',
            solid: true,
            boundaryPaths: []
        };

        let currentPath: DxfPoint[] = [];
        let numBoundaryPaths = 0;
        let numEdges = 0;
        let inBoundary = false;

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                if (currentPath.length > 0) {
                    hatch.boundaryPaths.push(currentPath);
                }
                break;
            }

            switch (this.groupCode) {
                case 5:
                    hatch.handle = this.groupValue;
                    break;
                case 8:
                    hatch.layer = this.groupValue;
                    break;
                case 62:
                    hatch.color = parseInt(this.groupValue, 10);
                    break;
                case 2:
                    hatch.patternName = this.groupValue;
                    break;
                case 70:
                    hatch.solid = parseInt(this.groupValue, 10) === 1;
                    break;
                case 91:
                    numBoundaryPaths = parseInt(this.groupValue, 10);
                    break;
                case 92:
                    // Start of new boundary path
                    if (currentPath.length > 0) {
                        hatch.boundaryPaths.push(currentPath);
                        currentPath = [];
                    }
                    inBoundary = true;
                    break;
                case 93:
                    numEdges = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    if (inBoundary) {
                        currentPath.push({ x: parseFloat(this.groupValue), y: 0 });
                    }
                    break;
                case 20:
                    if (inBoundary && currentPath.length > 0) {
                        currentPath[currentPath.length - 1].y = parseFloat(this.groupValue);
                    }
                    break;
                case 97:
                    // End of boundary path edges
                    inBoundary = false;
                    break;
            }
        }

        return hatch;
    }

    private parseDimension(): DxfDimension {
        const dimension: DxfDimension = {
            type: 'DIMENSION',
            layer: '0',
            dimensionType: 0,
            definitionPoint: { x: 0, y: 0 },
            middlePoint: { x: 0, y: 0 },
            text: '',
            rotation: 0
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    dimension.handle = this.groupValue;
                    break;
                case 8:
                    dimension.layer = this.groupValue;
                    break;
                case 62:
                    dimension.color = parseInt(this.groupValue, 10);
                    break;
                case 70:
                    dimension.dimensionType = parseInt(this.groupValue, 10);
                    break;
                case 1:
                    dimension.text = this.groupValue;
                    break;
                case 10:
                    dimension.definitionPoint.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    dimension.definitionPoint.y = parseFloat(this.groupValue);
                    break;
                case 11:
                    dimension.middlePoint.x = parseFloat(this.groupValue);
                    break;
                case 21:
                    dimension.middlePoint.y = parseFloat(this.groupValue);
                    break;
                case 50:
                    dimension.rotation = parseFloat(this.groupValue);
                    break;
            }
        }

        return dimension;
    }

    private skipEntity(): void {
        while (this.pos < this.lines.length) {
            this.readGroup();
            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }
        }
    }

    private calculateBounds(result: ParsedDxf): void {
        const updateBounds = (x: number, y: number) => {
            if (isFinite(x) && isFinite(y)) {
                result.bounds.minX = Math.min(result.bounds.minX, x);
                result.bounds.minY = Math.min(result.bounds.minY, y);
                result.bounds.maxX = Math.max(result.bounds.maxX, x);
                result.bounds.maxY = Math.max(result.bounds.maxY, y);
            }
        };

        for (const entity of result.entities) {
            switch (entity.type) {
                case 'LINE': {
                    const line = entity as DxfLine;
                    updateBounds(line.start.x, line.start.y);
                    updateBounds(line.end.x, line.end.y);
                    break;
                }
                case 'CIRCLE': {
                    const circle = entity as DxfCircle;
                    updateBounds(circle.center.x - circle.radius, circle.center.y - circle.radius);
                    updateBounds(circle.center.x + circle.radius, circle.center.y + circle.radius);
                    break;
                }
                case 'ARC': {
                    const arc = entity as DxfArc;
                    updateBounds(arc.center.x - arc.radius, arc.center.y - arc.radius);
                    updateBounds(arc.center.x + arc.radius, arc.center.y + arc.radius);
                    break;
                }
                case 'POLYLINE':
                case 'LWPOLYLINE': {
                    const polyline = entity as DxfPolyline;
                    for (const vertex of polyline.vertices) {
                        updateBounds(vertex.x, vertex.y);
                    }
                    break;
                }
                case 'TEXT':
                case 'MTEXT': {
                    const text = entity as DxfText;
                    updateBounds(text.position.x, text.position.y);
                    break;
                }
                case 'POINT': {
                    const point = entity as DxfPoint_;
                    updateBounds(point.position.x, point.position.y);
                    break;
                }
                case 'INSERT': {
                    const insert = entity as DxfInsert;
                    updateBounds(insert.position.x, insert.position.y);
                    break;
                }
                case 'ELLIPSE': {
                    const ellipse = entity as DxfEllipse;
                    const majorLen = Math.sqrt(
                        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                        ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
                    );
                    const minorLen = majorLen * ellipse.ratio;
                    const maxRadius = Math.max(majorLen, minorLen);
                    updateBounds(ellipse.center.x - maxRadius, ellipse.center.y - maxRadius);
                    updateBounds(ellipse.center.x + maxRadius, ellipse.center.y + maxRadius);
                    break;
                }
                case 'SPLINE': {
                    const spline = entity as DxfSpline;
                    for (const point of spline.controlPoints) {
                        updateBounds(point.x, point.y);
                    }
                    for (const point of spline.fitPoints) {
                        updateBounds(point.x, point.y);
                    }
                    break;
                }
                case 'HATCH': {
                    const hatch = entity as DxfHatch;
                    for (const path of hatch.boundaryPaths) {
                        for (const point of path) {
                            updateBounds(point.x, point.y);
                        }
                    }
                    break;
                }
                case 'DIMENSION': {
                    const dimension = entity as DxfDimension;
                    updateBounds(dimension.definitionPoint.x, dimension.definitionPoint.y);
                    updateBounds(dimension.middlePoint.x, dimension.middlePoint.y);
                    break;
                }
            }
        }

        // Handle empty drawings
        if (!isFinite(result.bounds.minX)) {
            result.bounds = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
        }
    }
}
