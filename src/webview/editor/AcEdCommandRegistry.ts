/**
 * AcEdCommandRegistry - Registers all CAD commands
 *
 * This file initializes the command stack with all available commands.
 */

import { AcEdCommandStack } from './command/AcEdCommandStack';
import { AcEdCommand } from './command/AcEdCommand';
import { AcLineCmd } from '../commands/AcLineCmd';
import { AcCircleCmd } from '../commands/AcCircleCmd';
import { AcArcCmd } from '../commands/AcArcCmd';
import { AcRectangleCmd } from '../commands/AcRectangleCmd';
import { AcPolylineCmd } from '../commands/AcPolylineCmd';
import { AcDistanceCmd } from '../commands/AcDistanceCmd';
import { AcEraseCmd } from '../commands/AcEraseCmd';
import { AcMoveCmd } from '../commands/AcMoveCmd';
import { AcCopyCmd } from '../commands/AcCopyCmd';
import { AcDimCmd } from '../commands/AcDimCmd';

/**
 * Registers all CAD commands to the command stack
 *
 * Command List (Design-Web compatible):
 * Drawing Commands:
 * - LINE (L): Draw line segments
 * - CIRCLE (C): Draw circles
 * - ARC (A): Draw arcs
 * - RECTANGLE (REC): Draw rectangles
 * - PLINE (PL): Draw polylines
 *
 * Modify Commands:
 * - MOVE (M): Move selected entities
 * - COPY (CO): Copy selected entities
 * - ERASE (E): Delete selected entities
 *
 * Annotation Commands:
 * - DIM (DLI): Create linear dimensions
 *
 * Utility Commands:
 * - DIST (DI): Measure distance between points
 */
export function registerCadCommands(): void {
    const stack = AcEdCommandStack.instance;

    const safeAdd = (group: string, globalName: string, localName: string, command: AcEdCommand) => {
        if (stack.lookupGlobalCmd(globalName)) {
            return;
        }
        stack.addCommand(group, globalName, localName, command);
    };

    // Drawing commands
    safeAdd('ACAD', 'LINE', 'L', new AcLineCmd());
    safeAdd('ACAD', 'CIRCLE', 'C', new AcCircleCmd());
    safeAdd('ACAD', 'ARC', 'A', new AcArcCmd());
    safeAdd('ACAD', 'RECTANGLE', 'REC', new AcRectangleCmd());
    safeAdd('ACAD', 'PLINE', 'PL', new AcPolylineCmd());

    // Modify commands
    safeAdd('ACAD', 'MOVE', 'M', new AcMoveCmd());
    safeAdd('ACAD', 'COPY', 'CO', new AcCopyCmd());
    safeAdd('ACAD', 'ERASE', 'E', new AcEraseCmd());

    // Annotation commands
    safeAdd('ACAD', 'DIM', 'DLI', new AcDimCmd());
    safeAdd('ACAD', 'DIMLINEAR', 'DIMLIN', new AcDimCmd());

    // Utility commands
    safeAdd('ACAD', 'DIST', 'DI', new AcDistanceCmd());
}

/**
 * Resets command registry (for testing)
 */
export function resetCommandRegistry(): void {
    AcEdCommandStack.reset();
}
