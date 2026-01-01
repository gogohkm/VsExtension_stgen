/**
 * Point Handler - Parses coordinate input
 *
 * Supports AutoCAD-style coordinate formats:
 * - Absolute: x,y (e.g., 100,200)
 * - Relative: @x,y (e.g., @50,30)
 * - Polar: @distance<angle (e.g., @100<45)
 */

export interface Point2D {
    x: number;
    y: number;
}

export interface ParseResult {
    success: boolean;
    point?: Point2D;
    error?: string;
}

/**
 * Parses coordinate input string into a point
 *
 * @param input - User input string
 * @param basePoint - Base point for relative coordinates
 * @returns Parse result with point or error
 */
export function parseCoordinate(
    input: string,
    basePoint?: Point2D | null
): ParseResult {
    const clean = input.replace(/\s/g, '').trim();

    if (!clean) {
        return { success: false, error: 'Empty input' };
    }

    // Relative polar: @distance<angle
    const polarMatch = clean.match(/^@(-?\d+\.?\d*)<(-?\d+\.?\d*)$/);
    if (polarMatch) {
        const distance = parseFloat(polarMatch[1]);
        const angleDeg = parseFloat(polarMatch[2]);
        const angleRad = angleDeg * Math.PI / 180;

        const baseX = basePoint?.x || 0;
        const baseY = basePoint?.y || 0;

        return {
            success: true,
            point: {
                x: baseX + distance * Math.cos(angleRad),
                y: baseY + distance * Math.sin(angleRad)
            }
        };
    }

    // Relative cartesian: @x,y
    const relativeMatch = clean.match(/^@(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    if (relativeMatch) {
        const dx = parseFloat(relativeMatch[1]);
        const dy = parseFloat(relativeMatch[2]);

        const baseX = basePoint?.x || 0;
        const baseY = basePoint?.y || 0;

        return {
            success: true,
            point: {
                x: baseX + dx,
                y: baseY + dy
            }
        };
    }

    // Absolute cartesian: x,y
    const absoluteMatch = clean.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    if (absoluteMatch) {
        return {
            success: true,
            point: {
                x: parseFloat(absoluteMatch[1]),
                y: parseFloat(absoluteMatch[2])
            }
        };
    }

    return { success: false, error: 'Invalid coordinate format' };
}

/**
 * Checks if input looks like a coordinate
 */
export function isCoordinateInput(input: string): boolean {
    const clean = input.replace(/\s/g, '');
    return /^@?-?\d+\.?\d*[,<]-?\d+\.?\d*$/.test(clean);
}

/**
 * Checks if input is a single number (for distance/radius input)
 */
export function isNumberInput(input: string): boolean {
    return /^-?\d+\.?\d*$/.test(input.trim());
}

/**
 * Parses a number from input
 */
export function parseNumber(input: string): number | null {
    const value = parseFloat(input.trim());
    return isNaN(value) ? null : value;
}

/**
 * Formats a point for display
 */
export function formatPoint(point: Point2D, decimals: number = 4): string {
    return `${point.x.toFixed(decimals)}, ${point.y.toFixed(decimals)}`;
}

/**
 * Calculates distance between two points
 */
export function distance(p1: Point2D, p2: Point2D): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calculates angle between two points (in degrees)
 */
export function angle(from: Point2D, to: Point2D): number {
    const rad = Math.atan2(to.y - from.y, to.x - from.x);
    return rad * 180 / Math.PI;
}
