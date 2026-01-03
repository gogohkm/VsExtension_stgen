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
import { AcTrimCmd } from '../commands/AcTrimCmd';
import { AcExtendCmd } from '../commands/AcExtendCmd';
import { AcOffsetCmd } from '../commands/AcOffsetCmd';
import { AcDimCmd, AcDimHorCmd, AcDimVerCmd, AcDimAlignedCmd, AcDimAngularCmd } from '../commands/AcDimCmd';
import { AcZoomCmd, AcZoomWindowCmd, AcZoomExtentsCmd, AcZoomAllCmd } from '../commands/AcZoomCmd';
import { AcPeditCmd } from '../commands/AcPeditCmd';

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
 * - TRIM (TR): Trim objects to cutting edges
 * - EXTEND (EX): Extend objects to boundary edges
 * - OFFSET (O): Create parallel copies at a distance
 *
 * Annotation Commands:
 * - DIM (DLI): Create linear dimensions (auto-detect H/V)
 * - DIMHOR (DH): Create horizontal dimension
 * - DIMVER (DV): Create vertical dimension
 * - DIMALIGNED (DAL): Create aligned dimension
 * - DIMANGULAR (DAN): Create angular dimension
 *
 * Utility Commands:
 * - DIST (DI): Measure distance between points
 *
 * View Commands:
 * - ZOOM (Z): Control view magnification
 * - ZOOMWINDOW (ZW): Zoom to window
 * - ZOOMEXTENTS (ZE): Zoom to extents
 * - ZOOMALL (ZA): Zoom to all
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
    safeAdd('ACAD', 'TRIM', 'TR', new AcTrimCmd());
    safeAdd('ACAD', 'EXTEND', 'EX', new AcExtendCmd());
    safeAdd('ACAD', 'OFFSET', 'O', new AcOffsetCmd());
    safeAdd('ACAD', 'PEDIT', 'PE', new AcPeditCmd());

    // Annotation commands - Dimensions
    safeAdd('ACAD', 'DIM', 'DLI', new AcDimCmd());
    safeAdd('ACAD', 'DIMLINEAR', 'DIMLIN', new AcDimCmd());
    safeAdd('ACAD', 'DIMHOR', 'DH', new AcDimHorCmd());
    safeAdd('ACAD', 'DIMVER', 'DV', new AcDimVerCmd());
    safeAdd('ACAD', 'DIMALIGNED', 'DAL', new AcDimAlignedCmd());
    safeAdd('ACAD', 'DIMANGULAR', 'DAN', new AcDimAngularCmd());

    // Utility commands
    safeAdd('ACAD', 'DIST', 'DI', new AcDistanceCmd());

    // View commands
    safeAdd('ACAD', 'ZOOM', 'Z', new AcZoomCmd());
    safeAdd('ACAD', 'ZOOMWINDOW', 'ZW', new AcZoomWindowCmd());
    safeAdd('ACAD', 'ZOOMEXTENTS', 'ZE', new AcZoomExtentsCmd());
    safeAdd('ACAD', 'ZOOMALL', 'ZA', new AcZoomAllCmd());
}

/**
 * Resets command registry (for testing)
 */
export function resetCommandRegistry(): void {
    AcEdCommandStack.reset();
}
