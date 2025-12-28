# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VS Code extension for viewing DXF (CAD) files with annotation support and AI integration. The extension provides a custom editor for .dxf files with Three.js-based 2D rendering.

## Commands

```bash
# Install dependencies
npm install

# Compile extension TypeScript
npm run compile

# Build webview bundle
npm run build:webview

# Watch mode for extension
npm run watch

# Watch mode for webview
npm run watch:webview

# Run linting
npm run lint

# Run tests
npm run test

# Full build (compile + webview)
npm run vscode:prepublish
```

## Development Workflow

1. Run `npm run watch` in one terminal (for extension code)
2. Run `npm run watch:webview` in another terminal (for webview code)
3. Press F5 in VS Code to launch Extension Development Host
4. Open any .dxf file to test the viewer

## Architecture

```
stgen/
├── src/
│   ├── extension.ts           # Extension entry point, command registration
│   ├── dxfEditorProvider.ts   # CustomEditorProvider for .dxf files
│   └── webview/               # Webview code (bundled separately)
│       ├── main.ts            # Webview entry point
│       ├── dxfParser.ts       # DXF file parser
│       ├── dxfRenderer.ts     # Three.js-based renderer
│       └── annotationManager.ts # Annotation system
├── media/                     # Webview build output
│   ├── webview.js             # Bundled webview JavaScript
│   └── webview.css            # Webview styles
├── out/                       # Extension TypeScript output
├── webpack.config.js          # Webview bundling config
├── tsconfig.json              # Extension TS config
└── tsconfig.webview.json      # Webview TS config
```

### Key Components

- **DxfEditorProvider** (`src/dxfEditorProvider.ts`): Registers custom editor for .dxf files, manages webview lifecycle and message passing
- **DxfParser** (`src/webview/dxfParser.ts`): Parses DXF file format into structured data (supports LINE, CIRCLE, ARC, POLYLINE, TEXT, MTEXT, POINT, INSERT)
- **DxfRenderer** (`src/webview/dxfRenderer.ts`): Three.js orthographic camera renderer with pan/zoom controls
- **AnnotationManager** (`src/webview/annotationManager.ts`): Handles text, arrow, rectangle annotations

### Extension <-> Webview Communication

Messages are passed via `postMessage()`:
- Extension → Webview: `loadDxf`, `requestCapture`, `requestEntities`, `fitView`
- Webview → Extension: `ready`, `captured`, `entitiesExtracted`, `error`, `info`

## Features

- **Custom Editor**: Double-click .dxf files to open in viewer
- **Screen Capture**: Export view as PNG for sharing with Claude
- **Entity Extraction**: Extract DXF entity data as Markdown text
- **Annotations**: Add text, arrows, rectangles overlay
- **Pan/Zoom**: Mouse drag to pan, scroll to zoom

## Reference Code

The `ref_app/dxf-viewer-master/` directory contains a comprehensive DXF viewer implementation for reference (Three.js + custom parser). It includes advanced features like hatching, fonts, and web workers that can be adopted if needed.
