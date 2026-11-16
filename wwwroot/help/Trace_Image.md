# Reference Image Tracing Layer

The **Trace Image** feature allows you to place a raster or vector sketch image directly onto a dedicated background layer. This serves as a reference canvas for tracing complex logos, engineering blueprints, HVAC schematics, and custom illustrations into clean SVG vector paths.

---

## Overview & Key Capabilities

- **Dedicated Bottom Layer**: The reference sketch is automatically placed at the very bottom of the SVG stack (`#tracing-layer`), underneath all vector shapes and SCADA symbols.
- **Pass-Through Click Interaction**: The tracing layer uses `pointer-events: none`, meaning your drawing tools, selection boxes, and element clicks pass right through to vector shapes without accidentally selecting, moving, or dragging the background sketch.
- **Excluded on Export by Default**: When exporting your completed SVG or PNG, the reference sketch is automatically omitted so your final vector output remains clean and lightweight.

---

## How to Use Trace Image Controls

Navigate to the **Trace Image** tab header in the Right Inspector Panel to access all tracing layer controls:

| Control | Action / Description |
| --- | --- |
| **Load Image** | Opens a file picker to select a PNG, JPEG, SVG, WEBP, or GIF image to place on the tracing layer. |
| **Clear (Remove)** | Removes the currently loaded reference image from the canvas. |
| **Show Reference Image** | Toggle checkbox to quickly show or hide the reference sketch while reviewing your vector artwork. |
| **Opacity (1% – 100%)** | Adjusts the transparency of the reference image. Lowering opacity (e.g. 30–50%) makes your drawn vector lines stand out clearly. |
| **Scale / Zoom (0.1x – 10.0x)** | Scales the reference image up or down. Use the range slider or enter an exact numeric factor (e.g. `1.5`). |
| **Offset X / Y (px)** | Shifts the position of the sketch horizontally or vertically to align key reference points with canvas grid lines. |
| **Include in SVG / PNG Export** | Checkbox option to include the reference sketch image inside exported SVG/PNG files. Disabled by default. |

---

## Recommended Tracing Workflow

1. **Prepare Sketch**: Export or scan your drawing as a PNG or JPEG file.
2. **Load Sketch**: Open the **Trace Image** tab in SimpleVG and click **📁 Load Image**.
3. **Set Transparency**: Lower the **Opacity** slider to around `40%–50%`.
4. **Position & Scale**: Adjust **Scale** and **Offset X / Y** so the reference aligns with your desired canvas dimensions or centerlines.
5. **Draw Vector Shapes**: Switch to the **Pen / Bezier Tool** (`P`), **Path Tool**, **Rectangle** (`R`), or **Ellipse** (`E`) to trace over the sketch lines.
6. **Toggle Preview**: Uncheck **Show Reference Image** periodically to review your vector paths in isolation.
7. **Export SVG**: When finished, click **File ➔ Save SVG** or **Export PNG**. The tracing sketch is automatically stripped, producing a clean, standalone vector file.
