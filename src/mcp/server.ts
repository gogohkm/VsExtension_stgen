#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as http from "http";

const DEFAULT_PORT = 52789;

interface BridgeResponse {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Makes an HTTP request to the VS Code extension's HTTP bridge server
 */
async function callBridge(endpoint: string, params: Record<string, any> = {}): Promise<BridgeResponse> {
    const port = process.env.STGEN_MCP_PORT ? parseInt(process.env.STGEN_MCP_PORT) : DEFAULT_PORT;
    const url = new URL(`http://localhost:${port}${endpoint}`);

    // Add query params
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
    }

    return new Promise((resolve, reject) => {
        const req = http.get(url.toString(), (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch {
                    resolve({ success: false, error: 'Invalid JSON response' });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: `Failed to connect to VS Code extension. Is it running? Error: ${error.message}`
            });
        });

        req.setTimeout(30000, () => {
            req.destroy();
            resolve({ success: false, error: 'Request timed out' });
        });
    });
}

async function main() {
    const server = new McpServer({
        name: "stgen-dxf-viewer",
        version: "1.0.0"
    });

    // Tool: Capture current DXF view as PNG image
    server.tool(
        "capture_dxf_view",
        "Captures the current DXF view as a PNG image. Returns a base64-encoded image that can be displayed.",
        {},
        async () => {
            const response = await callBridge('/capture');

            if (!response.success || !response.data) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: ${response.error || 'Failed to capture view'}`
                    }]
                };
            }

            return {
                content: [{
                    type: "image",
                    data: response.data.imageData,
                    mimeType: "image/png"
                }]
            };
        }
    );

    // Tool: Extract DXF entities
    server.tool(
        "extract_dxf_entities",
        "Extracts entity data from the currently open DXF file. Returns structured information about lines, circles, arcs, text, and other CAD entities.",
        {
            format: z.enum(["json", "markdown", "summary"]).default("markdown").describe("Output format: 'json' for raw data, 'markdown' for readable format, 'summary' for overview"),
            limit: z.number().min(1).max(1000).default(100).describe("Maximum number of entities to return"),
            layers: z.array(z.string()).optional().describe("Filter by layer names (optional)"),
            types: z.array(z.string()).optional().describe("Filter by entity types like 'LINE', 'CIRCLE', 'TEXT' (optional)")
        },
        async ({ format, limit, layers, types }) => {
            const response = await callBridge('/entities', {
                format,
                limit,
                layers: layers?.join(','),
                types: types?.join(',')
            });

            if (!response.success) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: ${response.error || 'Failed to extract entities'}`
                    }]
                };
            }

            return {
                content: [{
                    type: "text",
                    text: response.data
                }]
            };
        }
    );

    // Tool: Get layer information
    server.tool(
        "get_dxf_layers",
        "Gets a list of all layers in the currently open DXF file with their visibility status and entity counts.",
        {},
        async () => {
            const response = await callBridge('/layers');

            if (!response.success) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: ${response.error || 'Failed to get layers'}`
                    }]
                };
            }

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(response.data, null, 2)
                }]
            };
        }
    );

    // Tool: Get DXF summary
    server.tool(
        "get_dxf_summary",
        "Gets a summary of the currently open DXF file including file name, entity counts by type, layer list, and bounding box.",
        {},
        async () => {
            const response = await callBridge('/summary');

            if (!response.success) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: ${response.error || 'Failed to get summary'}`
                    }]
                };
            }

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(response.data, null, 2)
                }]
            };
        }
    );

    // Tool: Get currently open DXF file info
    server.tool(
        "get_dxf_status",
        "Checks if a DXF file is currently open in VS Code and returns its file path.",
        {},
        async () => {
            const response = await callBridge('/status');

            if (!response.success) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: ${response.error || 'VS Code extension not responding'}`
                    }]
                };
            }

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(response.data, null, 2)
                }]
            };
        }
    );

    // Start the server with STDIO transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);
