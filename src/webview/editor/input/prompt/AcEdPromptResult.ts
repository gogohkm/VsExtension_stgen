/**
 * Prompt Result - Result of user input operations
 */

/**
 * Status of a prompt operation
 */
export enum PromptStatus {
    /** User provided valid input */
    OK = 'OK',
    /** User cancelled the operation (ESC) */
    Cancel = 'Cancel',
    /** User entered a keyword option */
    Keyword = 'Keyword',
    /** No input provided (empty Enter) */
    None = 'None',
    /** Invalid input */
    Error = 'Error'
}

/**
 * Result of a point input prompt
 */
export interface AcEdPromptPointResult {
    status: PromptStatus;
    value?: { x: number; y: number };
    keyword?: string;
}

/**
 * Result of a distance input prompt
 */
export interface AcEdPromptDistanceResult {
    status: PromptStatus;
    value?: number;
    keyword?: string;
}

/**
 * Result of a string input prompt
 */
export interface AcEdPromptStringResult {
    status: PromptStatus;
    value?: string;
    keyword?: string;
}

/**
 * Result of an entity selection prompt
 */
export interface AcEdPromptSelectionResult {
    status: PromptStatus;
    /** Array of selected THREE.Object3D entities */
    value?: any[];
    keyword?: string;
}
