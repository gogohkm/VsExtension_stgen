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
    visible?: boolean;  // Group 60: 0=visible (default), 1=invisible
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
    alignmentPoint?: DxfPoint;  // Second alignment point (group 11, 21)
    text: string;
    height: number;
    rotation?: number;
    horizontalAlignment?: number;  // TEXT: 0=Left, 1=Center, 2=Right, 3=Aligned, 4=Middle, 5=Fit
    verticalAlignment?: number;    // TEXT: 0=Baseline, 1=Bottom, 2=Middle, 3=Top
    attachmentPoint?: number;      // MTEXT: 1-9 (1=TopLeft, 2=TopCenter, 3=TopRight, 4=MiddleLeft, etc.)
    width?: number;                // MTEXT width
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
    blockName?: string;  // Anonymous block containing dimension graphics (e.g., *D3)
}

export interface DxfSolid extends DxfEntity {
    type: 'SOLID' | '3DFACE';
    points: DxfPoint[];  // 3 or 4 corner points
}

export interface DxfAttrib extends DxfEntity {
    type: 'ATTRIB' | 'ATTDEF';
    position: DxfPoint;
    text: string;
    tag: string;
    height: number;
    rotation?: number;
    horizontalAlignment?: number;
    verticalAlignment?: number;
}

export interface DxfLeader extends DxfEntity {
    type: 'LEADER';
    vertices: DxfPoint[];
    hasArrowhead: boolean;
    annotationType: number;  // 0=text, 1=tolerance, 2=block ref, 3=none
}

export interface DxfWipeout extends DxfEntity {
    type: 'WIPEOUT';
    insertionPoint: DxfPoint;
    clipBoundary: DxfPoint[];
}

export interface DxfLayer {
    name: string;
    color: number;
    frozen: boolean;
    off: boolean;
    lineType?: string;  // Default linetype for layer
    lineWeight?: number; // Line weight in mm (0.00-2.11), -1 = ByBlock, -2 = ByLayer, -3 = Default
}

export interface DxfLineType {
    name: string;
    description: string;
    pattern: number[];  // Dash/gap lengths (positive=dash, negative=gap)
    totalLength: number;
}

export interface DxfBlock {
    name: string;
    basePoint: DxfPoint;
    entities: DxfEntity[];
}

export interface ParsedDxf {
    entities: DxfEntity[];
    layers: Map<string, DxfLayer>;
    lineTypes: Map<string, DxfLineType>;
    blocks: Map<string, DxfBlock>;
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
}

type AnyDxfEntity = DxfLine | DxfCircle | DxfArc | DxfPolyline | DxfText | DxfPoint_ | DxfInsert | DxfEllipse | DxfSpline | DxfHatch | DxfDimension | DxfSolid | DxfAttrib | DxfLeader | DxfWipeout;

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
            lineTypes: new Map(),
            blocks: new Map(),
            bounds: {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            }
        };

        // Add standard linetypes
        this.addStandardLineTypes(result);

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
                    if (tableCode === 2) {
                        if (tableName === 'LAYER') {
                            this.parseLayerTable(result);
                        } else if (tableName === 'LTYPE') {
                            this.parseLineTypeTable(result);
                        }
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

    private parseLineTypeTable(result: ParsedDxf): void {
        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                if (this.groupValue === 'ENDTAB') {
                    break;
                } else if (this.groupValue === 'LTYPE') {
                    const lineType = this.parseLineType();
                    if (lineType && lineType.name) {
                        result.lineTypes.set(lineType.name.toUpperCase(), lineType);
                    }
                }
            }
        }
    }

    private parseLineType(): DxfLineType | null {
        const lineType: DxfLineType = {
            name: '',
            description: '',
            pattern: [],
            totalLength: 0
        };

        let elementCount = 0;

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2; // Unread the group
                break;
            }

            switch (this.groupCode) {
                case 2:
                    lineType.name = this.groupValue;
                    break;
                case 3:
                    lineType.description = this.groupValue;
                    break;
                case 73:
                    elementCount = parseInt(this.groupValue, 10);
                    break;
                case 40:
                    lineType.totalLength = parseFloat(this.groupValue);
                    break;
                case 49:
                    // Dash/gap element
                    const element = parseFloat(this.groupValue);
                    lineType.pattern.push(element);
                    break;
            }
        }

        return lineType;
    }

    private addStandardLineTypes(result: ParsedDxf): void {
        // Add standard AutoCAD linetypes
        result.lineTypes.set('CONTINUOUS', {
            name: 'CONTINUOUS',
            description: 'Solid line',
            pattern: [],
            totalLength: 0
        });

        result.lineTypes.set('DASHED', {
            name: 'DASHED',
            description: 'Dashed line',
            pattern: [12.7, -6.35],  // 0.5", 0.25" gap
            totalLength: 19.05
        });

        result.lineTypes.set('HIDDEN', {
            name: 'HIDDEN',
            description: 'Hidden line',
            pattern: [6.35, -3.175],  // 0.25", 0.125" gap
            totalLength: 9.525
        });

        result.lineTypes.set('CENTER', {
            name: 'CENTER',
            description: 'Center line',
            pattern: [31.75, -6.35, 6.35, -6.35],  // Long, gap, short, gap
            totalLength: 50.8
        });

        result.lineTypes.set('DASHDOT', {
            name: 'DASHDOT',
            description: 'Dash dot line',
            pattern: [12.7, -6.35, 0, -6.35],  // Dash, gap, dot, gap
            totalLength: 25.4
        });

        result.lineTypes.set('PHANTOM', {
            name: 'PHANTOM',
            description: 'Phantom line',
            pattern: [31.75, -6.35, 6.35, -6.35, 6.35, -6.35],
            totalLength: 63.5
        });

        result.lineTypes.set('DOT', {
            name: 'DOT',
            description: 'Dotted line',
            pattern: [0, -6.35],
            totalLength: 6.35
        });
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
            case 'SOLID':
            case '3DFACE':
                return this.parseSolid(entityType);
            case 'ATTRIB':
            case 'ATTDEF':
                return this.parseAttrib(entityType);
            case 'LEADER':
                return this.parseLeader();
            case 'WIPEOUT':
                return this.parseWipeout();
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
                case 60:
                    line.visible = parseInt(this.groupValue, 10) === 0;
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
                case 60:
                    circle.visible = parseInt(this.groupValue, 10) === 0;
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
                case 60:
                    arc.visible = parseInt(this.groupValue, 10) === 0;
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
                case 60:
                    polyline.visible = parseInt(this.groupValue, 10) === 0;
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
                    case 60:
                        polyline.visible = parseInt(this.groupValue, 10) === 0;
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
            height: 1,
            horizontalAlignment: 0,
            verticalAlignment: 0
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
                case 60:
                    text.visible = parseInt(this.groupValue, 10) === 0;
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
                case 11:
                    // Second alignment point X
                    if (!text.alignmentPoint) {
                        text.alignmentPoint = { x: 0, y: 0 };
                    }
                    text.alignmentPoint.x = parseFloat(this.groupValue);
                    break;
                case 21:
                    // Second alignment point Y
                    if (!text.alignmentPoint) {
                        text.alignmentPoint = { x: 0, y: 0 };
                    }
                    text.alignmentPoint.y = parseFloat(this.groupValue);
                    break;
                case 40:
                    text.height = parseFloat(this.groupValue);
                    break;
                case 50:
                    text.rotation = parseFloat(this.groupValue);
                    break;
                case 72:
                    text.horizontalAlignment = parseInt(this.groupValue, 10);
                    break;
                case 73:
                    text.verticalAlignment = parseInt(this.groupValue, 10);
                    break;
            }
        }

        // If alignment is not left-baseline and alignmentPoint exists, use it as the reference
        if ((text.horizontalAlignment !== 0 || text.verticalAlignment !== 0) && text.alignmentPoint) {
            // For aligned text, the alignmentPoint is the actual position
            text.position = text.alignmentPoint;
        }

        return text;
    }

    private parseMText(): DxfText {
        const text: DxfText = {
            type: 'MTEXT',
            layer: '0',
            position: { x: 0, y: 0 },
            text: '',
            height: 1,
            attachmentPoint: 1  // Default: top-left
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
                case 60:
                    text.visible = parseInt(this.groupValue, 10) === 0;
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
                case 41:
                    text.width = parseFloat(this.groupValue);
                    break;
                case 50:
                    text.rotation = parseFloat(this.groupValue);
                    break;
                case 71:
                    // Attachment point: 1=TL, 2=TC, 3=TR, 4=ML, 5=MC, 6=MR, 7=BL, 8=BC, 9=BR
                    text.attachmentPoint = parseInt(this.groupValue, 10);
                    break;
            }
        }

        // Strip MTEXT formatting codes
        text.text = this.stripMTextFormatting(text.text);

        return text;
    }

    private stripMTextFormatting(text: string): string {
        // Remove common MTEXT formatting codes while preserving Korean/Unicode text
        let result = text
            // Handle Unicode escape sequences (\U+XXXX or \u+XXXX)
            .replace(/\\[Uu]\+([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            // Handle font changes like {\fArial;text}
            .replace(/\{\\f[^;]*;([^}]*)\}/g, '$1')
            // Handle color changes like {\C1;text}
            .replace(/\{\\[Cc]\d+;([^}]*)\}/g, '$1')
            // Remove formatting codes: \A (alignment), \H (height), \W (width), \Q (oblique), \T (tracking), \L (underline), \O (overline), \K (strikethrough), \S (stacked text)
            .replace(/\\[AHWQTLOKSachwqtloks][^;]*;/g, '')
            // Handle paragraph breaks
            .replace(/\\[Pp]/g, '\n')
            // Handle special characters
            .replace(/\\~/g, ' ')              // Non-breaking space
            .replace(/%%[dDcC]/g, '°')         // Degree symbol
            .replace(/%%[pP]/g, '±')           // Plus/minus
            .replace(/%%[uU]/g, '')            // Underline toggle (remove)
            .replace(/%%[oO]/g, '')            // Overline toggle (remove)
            // Remove remaining formatting braces
            .replace(/\{|\}/g, '')
            // Handle escaped backslashes (double backslash -> single)
            .replace(/\\\\/g, '\\');

        // Remove remaining isolated backslash formatting codes but NOT actual backslash characters in text
        // Only remove \X patterns where X is a formatting letter
        result = result.replace(/\\[ACFHLOPQSTWacfhlopqstw]/g, '');

        return result;
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
                case 60:
                    point.visible = parseInt(this.groupValue, 10) === 0;
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
                case 60:
                    insert.visible = parseInt(this.groupValue, 10) === 0;
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
                case 60:
                    ellipse.visible = parseInt(this.groupValue, 10) === 0;
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
                case 60:
                    spline.visible = parseInt(this.groupValue, 10) === 0;
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
        let boundaryType = 0;
        let isPolylineBoundary = false;
        let numVerticesOrEdges = 0;
        let edgeType = 0;
        let inBoundary = false;
        let vertexCount = 0;
        let edgeCount = 0;

        // Edge parsing state
        let edgeStartX = 0, edgeStartY = 0;
        let edgeCenterX = 0, edgeCenterY = 0;
        let edgeRadius = 0;
        let edgeStartAngle = 0, edgeEndAngle = 0;

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
                case 60:
                    hatch.visible = parseInt(this.groupValue, 10) === 0;
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
                    boundaryType = parseInt(this.groupValue, 10);
                    // Bit 1 (value 2) indicates polyline boundary
                    isPolylineBoundary = (boundaryType & 2) !== 0;
                    inBoundary = true;
                    vertexCount = 0;
                    edgeCount = 0;
                    break;
                case 72:
                    if (inBoundary && !isPolylineBoundary) {
                        // Edge type: 1=line, 2=circular arc, 3=elliptic arc, 4=spline
                        edgeType = parseInt(this.groupValue, 10);
                    }
                    // For polyline boundary, 72 is "has bulge" flag - ignore
                    break;
                case 73:
                    // For polyline: is closed flag (ignore)
                    // For edges: is counterclockwise flag (ignore)
                    break;
                case 93:
                    numVerticesOrEdges = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    if (inBoundary) {
                        if (isPolylineBoundary) {
                            // Polyline vertex
                            currentPath.push({ x: parseFloat(this.groupValue), y: 0 });
                            vertexCount++;
                        } else {
                            // Edge start point or center
                            if (edgeType === 1) {
                                // Line: start point
                                edgeStartX = parseFloat(this.groupValue);
                            } else if (edgeType === 2) {
                                // Arc: center point
                                edgeCenterX = parseFloat(this.groupValue);
                            }
                        }
                    }
                    break;
                case 20:
                    if (inBoundary) {
                        if (isPolylineBoundary && currentPath.length > 0) {
                            currentPath[currentPath.length - 1].y = parseFloat(this.groupValue);
                        } else if (!isPolylineBoundary) {
                            if (edgeType === 1) {
                                edgeStartY = parseFloat(this.groupValue);
                                currentPath.push({ x: edgeStartX, y: edgeStartY });
                            } else if (edgeType === 2) {
                                edgeCenterY = parseFloat(this.groupValue);
                            }
                        }
                    }
                    break;
                case 11:
                    if (inBoundary && !isPolylineBoundary && edgeType === 1) {
                        // Line end point X
                        edgeStartX = parseFloat(this.groupValue);
                    }
                    break;
                case 21:
                    if (inBoundary && !isPolylineBoundary && edgeType === 1) {
                        // Line end point Y
                        edgeStartY = parseFloat(this.groupValue);
                        currentPath.push({ x: edgeStartX, y: edgeStartY });
                        edgeCount++;
                    }
                    break;
                case 40:
                    if (inBoundary && !isPolylineBoundary && edgeType === 2) {
                        // Arc radius
                        edgeRadius = parseFloat(this.groupValue);
                    }
                    break;
                case 50:
                    if (inBoundary && !isPolylineBoundary && edgeType === 2) {
                        // Arc start angle
                        edgeStartAngle = parseFloat(this.groupValue);
                    }
                    break;
                case 51:
                    if (inBoundary && !isPolylineBoundary && edgeType === 2) {
                        // Arc end angle - generate arc points
                        edgeEndAngle = parseFloat(this.groupValue);
                        const arcPoints = this.generateArcPoints(
                            edgeCenterX, edgeCenterY, edgeRadius,
                            edgeStartAngle, edgeEndAngle, 16
                        );
                        currentPath.push(...arcPoints);
                        edgeCount++;
                    }
                    break;
                case 97:
                    // Number of source boundary objects (end of boundary definition)
                    if (currentPath.length > 0) {
                        hatch.boundaryPaths.push(currentPath);
                        currentPath = [];
                    }
                    inBoundary = false;
                    break;
            }
        }

        return hatch;
    }

    private generateArcPoints(
        cx: number, cy: number, radius: number,
        startAngle: number, endAngle: number, segments: number
    ): DxfPoint[] {
        const points: DxfPoint[] = [];

        // Convert degrees to radians
        let start = startAngle * Math.PI / 180;
        let end = endAngle * Math.PI / 180;

        // Handle arc direction
        if (end < start) {
            end += Math.PI * 2;
        }

        const arcLength = end - start;
        const actualSegments = Math.max(4, Math.ceil(segments * arcLength / (Math.PI * 2)));

        for (let i = 0; i <= actualSegments; i++) {
            const angle = start + (i / actualSegments) * arcLength;
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }

        return points;
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
                case 2:
                    // Block name containing dimension graphics (e.g., *D3)
                    dimension.blockName = this.groupValue;
                    break;
                case 5:
                    dimension.handle = this.groupValue;
                    break;
                case 8:
                    dimension.layer = this.groupValue;
                    break;
                case 60:
                    dimension.visible = parseInt(this.groupValue, 10) === 0;
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

    private parseSolid(entityType: string): DxfSolid {
        const solid: DxfSolid = {
            type: entityType as 'SOLID' | '3DFACE',
            layer: '0',
            points: [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 0 }
            ]
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    solid.handle = this.groupValue;
                    break;
                case 8:
                    solid.layer = this.groupValue;
                    break;
                case 60:
                    solid.visible = parseInt(this.groupValue, 10) === 0;
                    break;
                case 62:
                    solid.color = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    solid.points[0].x = parseFloat(this.groupValue);
                    break;
                case 20:
                    solid.points[0].y = parseFloat(this.groupValue);
                    break;
                case 11:
                    solid.points[1].x = parseFloat(this.groupValue);
                    break;
                case 21:
                    solid.points[1].y = parseFloat(this.groupValue);
                    break;
                case 12:
                    solid.points[2].x = parseFloat(this.groupValue);
                    break;
                case 22:
                    solid.points[2].y = parseFloat(this.groupValue);
                    break;
                case 13:
                    solid.points[3].x = parseFloat(this.groupValue);
                    break;
                case 23:
                    solid.points[3].y = parseFloat(this.groupValue);
                    break;
            }
        }

        return solid;
    }

    private parseAttrib(entityType: string): DxfAttrib {
        const attrib: DxfAttrib = {
            type: entityType as 'ATTRIB' | 'ATTDEF',
            layer: '0',
            position: { x: 0, y: 0 },
            text: '',
            tag: '',
            height: 1,
            horizontalAlignment: 0,
            verticalAlignment: 0
        };

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                break;
            }

            switch (this.groupCode) {
                case 5:
                    attrib.handle = this.groupValue;
                    break;
                case 8:
                    attrib.layer = this.groupValue;
                    break;
                case 60:
                    attrib.visible = parseInt(this.groupValue, 10) === 0;
                    break;
                case 62:
                    attrib.color = parseInt(this.groupValue, 10);
                    break;
                case 1:
                    attrib.text = this.groupValue;
                    break;
                case 2:
                    attrib.tag = this.groupValue;
                    break;
                case 10:
                    attrib.position.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    attrib.position.y = parseFloat(this.groupValue);
                    break;
                case 40:
                    attrib.height = parseFloat(this.groupValue);
                    break;
                case 50:
                    attrib.rotation = parseFloat(this.groupValue);
                    break;
                case 72:
                    attrib.horizontalAlignment = parseInt(this.groupValue, 10);
                    break;
                case 74:
                    attrib.verticalAlignment = parseInt(this.groupValue, 10);
                    break;
            }
        }

        return attrib;
    }

    private parseLeader(): DxfLeader {
        const leader: DxfLeader = {
            type: 'LEADER',
            layer: '0',
            vertices: [],
            hasArrowhead: true,
            annotationType: 0
        };

        let currentVertex: DxfPoint | null = null;

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                if (currentVertex) {
                    leader.vertices.push(currentVertex);
                }
                break;
            }

            switch (this.groupCode) {
                case 5:
                    leader.handle = this.groupValue;
                    break;
                case 8:
                    leader.layer = this.groupValue;
                    break;
                case 60:
                    leader.visible = parseInt(this.groupValue, 10) === 0;
                    break;
                case 62:
                    leader.color = parseInt(this.groupValue, 10);
                    break;
                case 71:
                    leader.hasArrowhead = parseInt(this.groupValue, 10) === 1;
                    break;
                case 73:
                    leader.annotationType = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    if (currentVertex) {
                        leader.vertices.push(currentVertex);
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

        return leader;
    }

    private parseWipeout(): DxfWipeout {
        const wipeout: DxfWipeout = {
            type: 'WIPEOUT',
            layer: '0',
            insertionPoint: { x: 0, y: 0 },
            clipBoundary: []
        };

        let currentClipPoint: DxfPoint | null = null;
        let inClipBoundary = false;

        while (this.pos < this.lines.length) {
            this.readGroup();

            if (this.groupCode === 0) {
                this.pos -= 2;
                if (currentClipPoint) {
                    wipeout.clipBoundary.push(currentClipPoint);
                }
                break;
            }

            switch (this.groupCode) {
                case 5:
                    wipeout.handle = this.groupValue;
                    break;
                case 8:
                    wipeout.layer = this.groupValue;
                    break;
                case 60:
                    wipeout.visible = parseInt(this.groupValue, 10) === 0;
                    break;
                case 62:
                    wipeout.color = parseInt(this.groupValue, 10);
                    break;
                case 10:
                    wipeout.insertionPoint.x = parseFloat(this.groupValue);
                    break;
                case 20:
                    wipeout.insertionPoint.y = parseFloat(this.groupValue);
                    break;
                case 91:
                    // Number of clip boundary vertices
                    inClipBoundary = true;
                    break;
                case 14:
                    // Clip boundary vertex X
                    if (currentClipPoint) {
                        wipeout.clipBoundary.push(currentClipPoint);
                    }
                    currentClipPoint = { x: parseFloat(this.groupValue), y: 0 };
                    break;
                case 24:
                    // Clip boundary vertex Y
                    if (currentClipPoint) {
                        currentClipPoint.y = parseFloat(this.groupValue);
                    }
                    break;
            }
        }

        return wipeout;
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
                case 'SOLID':
                case '3DFACE': {
                    const solid = entity as DxfSolid;
                    for (const point of solid.points) {
                        updateBounds(point.x, point.y);
                    }
                    break;
                }
                case 'ATTRIB':
                case 'ATTDEF': {
                    const attrib = entity as DxfAttrib;
                    updateBounds(attrib.position.x, attrib.position.y);
                    break;
                }
                case 'LEADER': {
                    const leader = entity as DxfLeader;
                    for (const vertex of leader.vertices) {
                        updateBounds(vertex.x, vertex.y);
                    }
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
