/**
 * DXF Writer - Generates DXF file content from entities
 *
 * Creates valid DXF R12/R2000 format output
 */

import { ParsedDxf, DxfEntity, DxfLine, DxfCircle, DxfArc, DxfPolyline, DxfText, DxfLayer, DxfLineType } from './dxfParser';

/**
 * Creates an empty DXF structure with default settings
 */
export function createEmptyDxf(): ParsedDxf {
    const layers = new Map<string, DxfLayer>();
    layers.set('0', {
        name: '0',
        color: 7,
        frozen: false,
        off: false,
        lineType: 'CONTINUOUS'
    });

    const lineTypes = new Map<string, DxfLineType>();
    lineTypes.set('CONTINUOUS', {
        name: 'CONTINUOUS',
        description: 'Solid line',
        pattern: [],
        totalLength: 0
    });
    lineTypes.set('DASHED', {
        name: 'DASHED',
        description: 'Dashed line',
        pattern: [0.5, -0.25],
        totalLength: 0.75
    });

    return {
        entities: [],
        layers,
        lineTypes,
        blocks: new Map(),
        bounds: {
            minX: 0,
            minY: 0,
            maxX: 100,
            maxY: 100
        }
    };
}

/**
 * Generates DXF file content from ParsedDxf structure
 */
export function generateDxfContent(dxf: ParsedDxf): string {
    const lines: string[] = [];

    // HEADER section
    writeHeader(lines, dxf);

    // TABLES section
    writeTables(lines, dxf);

    // BLOCKS section
    writeBlocks(lines, dxf);

    // ENTITIES section
    writeEntities(lines, dxf);

    // EOF
    lines.push('  0');
    lines.push('EOF');

    return lines.join('\n');
}

function writeHeader(lines: string[], dxf: ParsedDxf): void {
    lines.push('  0');
    lines.push('SECTION');
    lines.push('  2');
    lines.push('HEADER');

    // $ACADVER
    lines.push('  9');
    lines.push('$ACADVER');
    lines.push('  1');
    lines.push('AC1015'); // AutoCAD 2000

    // $INSUNITS (0 = Unitless)
    lines.push('  9');
    lines.push('$INSUNITS');
    lines.push(' 70');
    lines.push('0');

    // $EXTMIN
    lines.push('  9');
    lines.push('$EXTMIN');
    lines.push(' 10');
    lines.push(String(dxf.bounds.minX));
    lines.push(' 20');
    lines.push(String(dxf.bounds.minY));
    lines.push(' 30');
    lines.push('0');

    // $EXTMAX
    lines.push('  9');
    lines.push('$EXTMAX');
    lines.push(' 10');
    lines.push(String(dxf.bounds.maxX));
    lines.push(' 20');
    lines.push(String(dxf.bounds.maxY));
    lines.push(' 30');
    lines.push('0');

    lines.push('  0');
    lines.push('ENDSEC');
}

function writeTables(lines: string[], dxf: ParsedDxf): void {
    lines.push('  0');
    lines.push('SECTION');
    lines.push('  2');
    lines.push('TABLES');

    // LTYPE table
    writeLineTypeTable(lines, dxf);

    // LAYER table
    writeLayerTable(lines, dxf);

    lines.push('  0');
    lines.push('ENDSEC');
}

function writeLineTypeTable(lines: string[], dxf: ParsedDxf): void {
    lines.push('  0');
    lines.push('TABLE');
    lines.push('  2');
    lines.push('LTYPE');
    lines.push(' 70');
    lines.push(String(dxf.lineTypes.size));

    for (const [name, ltype] of dxf.lineTypes) {
        lines.push('  0');
        lines.push('LTYPE');
        lines.push('  2');
        lines.push(name);
        lines.push(' 70');
        lines.push('0');
        lines.push('  3');
        lines.push(ltype.description);
        lines.push(' 72');
        lines.push('65'); // Alignment code (always 65)
        lines.push(' 73');
        lines.push(String(ltype.pattern.length));
        lines.push(' 40');
        lines.push(String(ltype.totalLength));
        // Pattern elements
        for (const elem of ltype.pattern) {
            lines.push(' 49');
            lines.push(String(elem));
        }
    }

    lines.push('  0');
    lines.push('ENDTAB');
}

function writeLayerTable(lines: string[], dxf: ParsedDxf): void {
    lines.push('  0');
    lines.push('TABLE');
    lines.push('  2');
    lines.push('LAYER');
    lines.push(' 70');
    lines.push(String(dxf.layers.size));

    for (const [name, layer] of dxf.layers) {
        lines.push('  0');
        lines.push('LAYER');
        lines.push('  2');
        lines.push(name);
        lines.push(' 70');
        let flags = 0;
        if (layer.frozen) flags |= 1;
        if (layer.off) flags |= 1; // Off uses same flag in simple cases
        lines.push(String(flags));
        lines.push(' 62');
        lines.push(String(layer.color));
        lines.push('  6');
        lines.push(layer.lineType || 'CONTINUOUS');
    }

    lines.push('  0');
    lines.push('ENDTAB');
}

function writeBlocks(lines: string[], dxf: ParsedDxf): void {
    lines.push('  0');
    lines.push('SECTION');
    lines.push('  2');
    lines.push('BLOCKS');

    // Write each block
    for (const [name, block] of dxf.blocks) {
        lines.push('  0');
        lines.push('BLOCK');
        lines.push('  8');
        lines.push('0'); // Block layer
        lines.push('  2');
        lines.push(name);
        lines.push(' 70');
        lines.push('0');
        lines.push(' 10');
        lines.push(String(block.basePoint.x));
        lines.push(' 20');
        lines.push(String(block.basePoint.y));
        lines.push(' 30');
        lines.push('0');

        // Block entities
        for (const entity of block.entities) {
            writeEntity(lines, entity);
        }

        lines.push('  0');
        lines.push('ENDBLK');
        lines.push('  8');
        lines.push('0');
    }

    lines.push('  0');
    lines.push('ENDSEC');
}

function writeEntities(lines: string[], dxf: ParsedDxf): void {
    lines.push('  0');
    lines.push('SECTION');
    lines.push('  2');
    lines.push('ENTITIES');

    for (const entity of dxf.entities) {
        writeEntity(lines, entity);
    }

    lines.push('  0');
    lines.push('ENDSEC');
}

function writeEntity(lines: string[], entity: DxfEntity): void {
    switch (entity.type) {
        case 'LINE':
            writeLine(lines, entity as DxfLine);
            break;
        case 'CIRCLE':
            writeCircle(lines, entity as DxfCircle);
            break;
        case 'ARC':
            writeArc(lines, entity as DxfArc);
            break;
        case 'POLYLINE':
        case 'LWPOLYLINE':
            writePolyline(lines, entity as DxfPolyline);
            break;
        case 'TEXT':
        case 'MTEXT':
            writeText(lines, entity as DxfText);
            break;
        // Add more entity types as needed
    }
}

function writeEntityCommon(lines: string[], entity: DxfEntity): void {
    // Layer
    lines.push('  8');
    lines.push(entity.layer || '0');

    // Color (if not ByLayer)
    if (entity.color !== undefined && entity.color !== 256) {
        lines.push(' 62');
        lines.push(String(entity.color));
    }

    // Linetype (if not ByLayer)
    if (entity.lineType && entity.lineType !== 'BYLAYER') {
        lines.push('  6');
        lines.push(entity.lineType);
    }
}

function writeLine(lines: string[], line: DxfLine): void {
    lines.push('  0');
    lines.push('LINE');
    writeEntityCommon(lines, line);

    // Start point
    lines.push(' 10');
    lines.push(String(line.start.x));
    lines.push(' 20');
    lines.push(String(line.start.y));
    lines.push(' 30');
    lines.push(String(line.start.z || 0));

    // End point
    lines.push(' 11');
    lines.push(String(line.end.x));
    lines.push(' 21');
    lines.push(String(line.end.y));
    lines.push(' 31');
    lines.push(String(line.end.z || 0));
}

function writeCircle(lines: string[], circle: DxfCircle): void {
    lines.push('  0');
    lines.push('CIRCLE');
    writeEntityCommon(lines, circle);

    // Center point
    lines.push(' 10');
    lines.push(String(circle.center.x));
    lines.push(' 20');
    lines.push(String(circle.center.y));
    lines.push(' 30');
    lines.push(String(circle.center.z || 0));

    // Radius
    lines.push(' 40');
    lines.push(String(circle.radius));
}

function writeArc(lines: string[], arc: DxfArc): void {
    lines.push('  0');
    lines.push('ARC');
    writeEntityCommon(lines, arc);

    // Center point
    lines.push(' 10');
    lines.push(String(arc.center.x));
    lines.push(' 20');
    lines.push(String(arc.center.y));
    lines.push(' 30');
    lines.push(String(arc.center.z || 0));

    // Radius
    lines.push(' 40');
    lines.push(String(arc.radius));

    // Start angle
    lines.push(' 50');
    lines.push(String(arc.startAngle));

    // End angle
    lines.push(' 51');
    lines.push(String(arc.endAngle));
}

function writePolyline(lines: string[], polyline: DxfPolyline): void {
    // Write as LWPOLYLINE (lightweight polyline)
    lines.push('  0');
    lines.push('LWPOLYLINE');
    writeEntityCommon(lines, polyline);

    // Number of vertices
    lines.push(' 90');
    lines.push(String(polyline.vertices.length));

    // Closed flag
    lines.push(' 70');
    lines.push(polyline.closed ? '1' : '0');

    // Vertices
    for (const vertex of polyline.vertices) {
        lines.push(' 10');
        lines.push(String(vertex.x));
        lines.push(' 20');
        lines.push(String(vertex.y));
        // Bulge is optional, skip if not present
    }
}

function writeText(lines: string[], text: DxfText): void {
    lines.push('  0');
    lines.push('TEXT');
    writeEntityCommon(lines, text);

    // Insertion point
    lines.push(' 10');
    lines.push(String(text.position.x));
    lines.push(' 20');
    lines.push(String(text.position.y));
    lines.push(' 30');
    lines.push(String(text.position.z || 0));

    // Height
    lines.push(' 40');
    lines.push(String(text.height));

    // Text value
    lines.push('  1');
    lines.push(text.text);

    // Rotation (if any)
    if (text.rotation) {
        lines.push(' 50');
        lines.push(String(text.rotation));
    }
}

/**
 * Calculates the extents of all entities
 */
export function calculateExtents(entities: DxfEntity[]): { min: { x: number; y: number }; max: { x: number; y: number } } {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const entity of entities) {
        switch (entity.type) {
            case 'LINE': {
                const line = entity as DxfLine;
                minX = Math.min(minX, line.start.x, line.end.x);
                minY = Math.min(minY, line.start.y, line.end.y);
                maxX = Math.max(maxX, line.start.x, line.end.x);
                maxY = Math.max(maxY, line.start.y, line.end.y);
                break;
            }
            case 'CIRCLE': {
                const circle = entity as DxfCircle;
                minX = Math.min(minX, circle.center.x - circle.radius);
                minY = Math.min(minY, circle.center.y - circle.radius);
                maxX = Math.max(maxX, circle.center.x + circle.radius);
                maxY = Math.max(maxY, circle.center.y + circle.radius);
                break;
            }
            case 'ARC': {
                const arc = entity as DxfArc;
                // Simplified: use center and radius
                minX = Math.min(minX, arc.center.x - arc.radius);
                minY = Math.min(minY, arc.center.y - arc.radius);
                maxX = Math.max(maxX, arc.center.x + arc.radius);
                maxY = Math.max(maxY, arc.center.y + arc.radius);
                break;
            }
            case 'POLYLINE':
            case 'LWPOLYLINE': {
                const polyline = entity as DxfPolyline;
                for (const vertex of polyline.vertices) {
                    minX = Math.min(minX, vertex.x);
                    minY = Math.min(minY, vertex.y);
                    maxX = Math.max(maxX, vertex.x);
                    maxY = Math.max(maxY, vertex.y);
                }
                break;
            }
            case 'TEXT':
            case 'MTEXT': {
                const text = entity as DxfText;
                minX = Math.min(minX, text.position.x);
                minY = Math.min(minY, text.position.y);
                maxX = Math.max(maxX, text.position.x);
                maxY = Math.max(maxY, text.position.y);
                break;
            }
        }
    }

    // Default extents if no entities
    if (!isFinite(minX)) {
        return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
    }

    return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}
