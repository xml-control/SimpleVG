# Live SVG XML Drawer & 2-Way Code Editor

SimpleVG features an interactive bottom drawer providing real-time 2-way synchronization between your visual canvas drawing and raw SVG XML code.

---

## Overview & Key Capabilities

- **Live 2-Way Code Editing**: Any shape added, moved, styled, or deleted on the canvas instantly updates the XML code drawer. Conversely, typing or pasting custom SVG markup into the editor updates the visual canvas in real time.
- **VB.NET Server XML Formatter**: Uses the backend ASP.NET / VB.NET Core server engine to clean, indent, and format raw XML markup into clean, production-ready SVG code.
- **Find Selected Element**: Instantly locate the exact XML code line corresponding to any shape currently selected on the canvas.

---

## Drawer Toolbar Controls

| Control Button | Function / Description |
| --- | --- |
| **🔍 Find Selected** | Expands the drawer and searches the raw XML for the selected shape's `id`, `data-tag`, `class`, or tag type. Highlights the matching code segment and auto-scrolls to center it in the editor. |
| **Clean & Format XML (VB.NET)** | Sends the XML code to the backend server for indentation, attribute normalization, and removal of redundant default properties. |
| **Copy to Clipboard** | Copies the full SVG XML document text directly to your system clipboard for easy pasting into code editors or SCADA HMI packages. |
| **Collapse / Expand ▼** | Toggles the height of the bottom drawer to maximize your canvas drawing area when code view is not needed. |

---

## Features & Workflows

### 1. Live 2-Way Editing
- **Canvas to Code**: Select any tool (e.g. Rectangle, Ellipse, Bezier Curve) and draw on the canvas. The XML drawer automatically reflects the new element syntax.
- **Code to Canvas**: Type or paste valid SVG elements (such as `<rect>`, `<path d="...">`, `<circle>`, or `<g>`) directly into the code drawer textarea. The canvas immediately parses the XML and renders the vector shapes.

### 2. Locating Elements with "Find Selected"
When working with complex drawings or SCADA symbol libraries with dozens of shapes:
1. Select any element on the canvas using the **Select Tool** (`S`).
2. Click **🔍 Find Selected** in the bottom drawer header (or press the corresponding toolbar button).
3. The drawer automatically expands, selects the line of XML matching your element, and scrolls it into view.

### 3. Server-Side XML Formatting
Click **Clean & Format XML (VB.NET)** to run server-side XML cleanup:
- Formats tag nesting with 2-space indentation.
- Re-orders attributes cleanly (`id`, `x`, `y`, `width`, `height`, `fill`, `stroke`).
- Strips redundant default values (such as `stroke="none"` or `opacity="1"`).
