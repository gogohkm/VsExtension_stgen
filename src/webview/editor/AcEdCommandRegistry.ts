/**
 * AcEdCommandRegistry - Registers all CAD commands
 *
 * This file initializes the command stack with all available commands.
 */

import { AcEdCommandStack } from './command/AcEdCommandStack';
import { AcLineCmd } from '../commands/AcLineCmd';
import { AcCircleCmd } from '../commands/AcCircleCmd';

/**
 * Registers all CAD commands to the command stack
 */
export function registerCadCommands(): void {
    const stack = AcEdCommandStack.instance;

    // Drawing commands
    stack.addCommand('ACAD', 'LINE', 'L', new AcLineCmd());
    stack.addCommand('ACAD', 'CIRCLE', 'C', new AcCircleCmd());

    // Future commands can be added here:
    // stack.addCommand('ACAD', 'ARC', 'A', new AcArcCmd());
    // stack.addCommand('ACAD', 'RECTANGLE', 'REC', new AcRectangleCmd());
    // stack.addCommand('ACAD', 'POLYLINE', 'PL', new AcPolylineCmd());
}

/**
 * Resets command registry (for testing)
 */
export function resetCommandRegistry(): void {
    AcEdCommandStack.reset();
}
