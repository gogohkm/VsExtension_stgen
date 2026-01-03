/**
 * Prompt Options - Configuration for user input prompts
 */

import { AcEdPreviewJig } from '../AcEdPreviewJig';

/**
 * Keyword option for prompts (e.g., [Close/Undo])
 */
export interface AcEdKeyword {
    /** Display name shown in prompt */
    displayName: string;
    /** Global keyword (uppercase) */
    globalName: string;
    /** Local keyword (alias) */
    localName?: string;
}

/**
 * Base options for all prompts
 */
export interface AcEdPromptOptionsBase {
    /** Message shown to user */
    message: string;
    /** Keywords available (e.g., Close, Undo) */
    keywords?: AcEdKeyword[];
    /** Allow empty input (Enter without value) */
    allowNone?: boolean;
}

/**
 * Options for point input prompt
 */
export interface AcEdPromptPointOptions extends AcEdPromptOptionsBase {
    /** Base point for relative coordinates */
    basePoint?: { x: number; y: number };
    /** Use dashed line for rubber band */
    useDashedLine?: boolean;
    /** Jig for preview */
    jig?: AcEdPreviewJig;
}

/**
 * Options for distance input prompt
 */
export interface AcEdPromptDistanceOptions extends AcEdPromptOptionsBase {
    /** Base point for measuring distance */
    basePoint?: { x: number; y: number };
    /** Default value if user presses Enter */
    defaultValue?: number;
    /** Jig for preview */
    jig?: AcEdPreviewJig;
}

/**
 * Options for string input prompt
 */
export interface AcEdPromptStringOptions extends AcEdPromptOptionsBase {
    /** Default value if user presses Enter */
    defaultValue?: string;
}

/**
 * Options for entity selection prompt
 */
export interface AcEdPromptSelectionOptions {
    /** Message shown to user */
    message?: string;
    /** Allow single selection only */
    singleOnly?: boolean;
    /** Minimum number of entities required */
    minCount?: number;
    /** Allow empty input (Enter without selection) */
    allowNone?: boolean;
}

/**
 * Options for single entity selection prompt (for TRIM, EXTEND, etc.)
 */
export interface AcEdPromptEntityOptions {
    /** Message shown to user */
    message?: string;
    /** Allow empty input (Enter without selection) */
    allowNone?: boolean;
}

/**
 * Helper to create keyword options string for display
 * e.g., "[Close/Undo]"
 */
export function formatKeywords(keywords?: AcEdKeyword[]): string {
    if (!keywords || keywords.length === 0) return '';
    const names = keywords.map(k => k.displayName);
    return `[${names.join('/')}]`;
}

/**
 * Helper to check if input matches a keyword
 */
export function matchKeyword(input: string, keywords?: AcEdKeyword[]): AcEdKeyword | undefined {
    if (!keywords) return undefined;
    const upper = input.toUpperCase();
    return keywords.find(k =>
        k.globalName.toUpperCase() === upper ||
        k.localName?.toUpperCase() === upper ||
        k.displayName.toUpperCase().startsWith(upper)
    );
}
