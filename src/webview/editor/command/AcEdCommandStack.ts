/**
 * Command Stack - Registry for all CAD commands
 * Adapted from cad-viewer-main/cad-simple-viewer
 */

import { AcEdCommand } from './AcEdCommand';

/**
 * Interface representing a command group
 */
export interface AcEdCommandGroup {
    groupName: string;
    commandsByGlobalName: Map<string, AcEdCommand>;
    commandsByLocalName: Map<string, AcEdCommand>;
}

/**
 * Iterator item for traversing commands
 */
export interface AcEdCommandIteratorItem {
    groupName: string;
    command: AcEdCommand;
}

/**
 * Singleton class that manages all command registration and lookup.
 *
 * Commands are organized into groups:
 * - ACAD: System commands
 * - USER: User-defined commands
 *
 * @example
 * ```typescript
 * const stack = AcEdCommandStack.instance;
 * stack.addCommand('ACAD', 'LINE', 'L', new AcLineCmd());
 *
 * const cmd = stack.lookupGlobalCmd('LINE');
 * // or
 * const cmd = stack.lookupLocalCmd('L');
 * ```
 */
export class AcEdCommandStack {
    static readonly SYSTEM_COMMAND_GROUP_NAME = 'ACAD';
    static readonly DEFAULT_COMMAND_GROUP_NAME = 'USER';

    private _commandsByGroup: AcEdCommandGroup[] = [];
    private _systemCommandGroup: AcEdCommandGroup;
    private _defaultCommandGroup: AcEdCommandGroup;

    private static _instance?: AcEdCommandStack;

    private constructor() {
        this._systemCommandGroup = {
            groupName: AcEdCommandStack.SYSTEM_COMMAND_GROUP_NAME,
            commandsByGlobalName: new Map(),
            commandsByLocalName: new Map()
        };
        this._defaultCommandGroup = {
            groupName: AcEdCommandStack.DEFAULT_COMMAND_GROUP_NAME,
            commandsByGlobalName: new Map(),
            commandsByLocalName: new Map()
        };
        this._commandsByGroup.push(this._systemCommandGroup);
        this._commandsByGroup.push(this._defaultCommandGroup);
    }

    /**
     * Gets the singleton instance
     */
    static get instance(): AcEdCommandStack {
        if (!AcEdCommandStack._instance) {
            AcEdCommandStack._instance = new AcEdCommandStack();
        }
        return AcEdCommandStack._instance;
    }

    /**
     * Resets the singleton instance (useful for testing)
     */
    static reset(): void {
        AcEdCommandStack._instance = undefined;
    }

    /**
     * Adds a command to the specified group
     *
     * @param cmdGroupName - Group name (ACAD, USER, or custom)
     * @param cmdGlobalName - Global command name (e.g., 'LINE')
     * @param cmdLocalName - Local/alias name (e.g., 'L')
     * @param cmd - The command instance
     */
    addCommand(
        cmdGroupName: string,
        cmdGlobalName: string,
        cmdLocalName: string,
        cmd: AcEdCommand
    ): void {
        cmdGroupName = cmdGroupName.toUpperCase();
        cmdGlobalName = cmdGlobalName.toUpperCase();
        cmdLocalName = cmdLocalName.toUpperCase();

        if (!cmdGlobalName) {
            throw new Error('[AcEdCommandStack] Global name is required!');
        }

        if (!cmdLocalName) {
            cmdLocalName = cmdGlobalName;
        }

        // Find or create command group
        let commandGroup = this._commandsByGroup.find(
            g => g.groupName === cmdGroupName
        );

        if (!commandGroup) {
            commandGroup = {
                groupName: cmdGroupName,
                commandsByGlobalName: new Map(),
                commandsByLocalName: new Map()
            };
            this._commandsByGroup.push(commandGroup);
        }

        // Check for duplicates
        if (commandGroup.commandsByGlobalName.has(cmdGlobalName)) {
            throw new Error(
                `[AcEdCommandStack] Command '${cmdGlobalName}' already exists!`
            );
        }

        // Register command
        commandGroup.commandsByGlobalName.set(cmdGlobalName, cmd);
        commandGroup.commandsByLocalName.set(cmdLocalName, cmd);
        cmd.globalName = cmdGlobalName;
        cmd.localName = cmdLocalName;
    }

    /**
     * Looks up a command by global name
     */
    lookupGlobalCmd(cmdName: string): AcEdCommand | undefined {
        cmdName = cmdName.toUpperCase();
        for (const group of this._commandsByGroup) {
            const cmd = group.commandsByGlobalName.get(cmdName);
            if (cmd) return cmd;
        }
        return undefined;
    }

    /**
     * Looks up a command by local/alias name
     */
    lookupLocalCmd(cmdName: string): AcEdCommand | undefined {
        cmdName = cmdName.toUpperCase();
        for (const group of this._commandsByGroup) {
            const cmd = group.commandsByLocalName.get(cmdName);
            if (cmd) return cmd;
        }
        return undefined;
    }

    /**
     * Looks up a command by either global or local name
     */
    lookupCmd(cmdName: string): AcEdCommand | undefined {
        return this.lookupGlobalCmd(cmdName) || this.lookupLocalCmd(cmdName);
    }

    /**
     * Searches for commands matching a prefix
     */
    searchCommandsByPrefix(prefix: string): AcEdCommandIteratorItem[] {
        prefix = prefix.toUpperCase();
        const results: AcEdCommandIteratorItem[] = [];

        for (const group of this._commandsByGroup) {
            for (const [name, command] of group.commandsByGlobalName) {
                if (name.startsWith(prefix) || command.localName.startsWith(prefix)) {
                    results.push({ groupName: group.groupName, command });
                }
            }
        }

        return results;
    }

    /**
     * Removes a command from a group
     */
    removeCmd(cmdGroupName: string, cmdGlobalName: string): boolean {
        cmdGroupName = cmdGroupName.toUpperCase();
        cmdGlobalName = cmdGlobalName.toUpperCase();

        for (const group of this._commandsByGroup) {
            if (group.groupName === cmdGroupName) {
                const cmd = group.commandsByGlobalName.get(cmdGlobalName);
                if (cmd) {
                    group.commandsByGlobalName.delete(cmdGlobalName);
                    group.commandsByLocalName.delete(cmd.localName);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Gets all registered commands
     */
    getAllCommands(): AcEdCommandIteratorItem[] {
        const results: AcEdCommandIteratorItem[] = [];
        for (const group of this._commandsByGroup) {
            for (const command of group.commandsByGlobalName.values()) {
                results.push({ groupName: group.groupName, command });
            }
        }
        return results;
    }
}
