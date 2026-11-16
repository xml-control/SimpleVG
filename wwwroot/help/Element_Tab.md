# Inspector & Element Controls

The **Element Tab** in the right Inspector panel gives you full control over the geometry, styling, gradients, stroke, markers, text, layering, and alignment of any selected shape or symbol on the canvas.

---

## 1. Transform & Position Controls

- **X Position & Y Position**: Precise pixel coordinates of the element origin.
- **Width & Height**: Exact element dimensions in pixels.
- **Rotation (°)**: Rotate the selected shape from `0°` to `360°`.
- **Corner Radius (`rx`)**: Add smooth rounded corners to rectangles.
- **Polygon / Star Points**: Adjust the number of sides (3 to 16) for polygon and star shapes.

---

## 2. Text Properties (Text Elements)

When a text element is selected, the Text section allows you to customize:
- **Text Content**: Type custom label text.
- **Font Size (px)**: Adjust font size from 6px to 200px.
- **Font Family**: Choose between **Inter** (Modern Sans), **Arial** (Standard), **Monospace** (JetBrains Mono code style), and **Serif** (Times New Roman).

---

## 3. Fill Modes & Custom SCADA Color Picker

Choose between three Fill Modes: **Solid**, **Linear Gradient**, or **Radial Gradient**.

### A. SCADA Custom Color Picker Popover
Click either the **Fill Color** or **Stroke Color** button to open the SCADA Color Picker Popover:
- **48 Basic Colors**: Quick access to SCADA accent tokens, a 4-tier spectrum spread across all HSL hues, and a complete grayscale palette.
- **HEX Input & Preview**: Live preview chip with an upper-case HEX code input field.
- **▼ More Options (RGB Sliders)**: Expandable fine-tuning section with **R (Red)**, **G (Green)**, and **B (Blue)** range sliders (`0`–`255`) and live number readouts.
- **Live Preview & Revert**: Changes preview live on the canvas as you drag sliders or click swatches. Click **Cancel** to revert or **OK** to apply.
- **⚙️ ISA-101 Gray Button**: Click to instantly convert any selected symbol to neutral ISA-101 gray.
- **Opacity / Alpha Slider**: Adjust transparency from `0%` (Fully Transparent) to `100%` (Opaque).

---

## 4. Linear & Radial Gradient Controls

Switch to **Linear Gradient** or **Radial Gradient** fill mode to generate gradients for **any user-selected color**:
- **Dynamic Color Gradients**: Any color picked from the Color Picker (swatches, HEX, or RGB sliders) automatically converts into a 3-stop metallic linear gradient or glowing 3-stop LED radial gradient!
- **Gradient Angle Slider**: Smoothly rotate linear gradient angles from `0°` to `360°` (default `90°` vertical).
- **Built-In Preset Gradients**: Instant 1-click gradient styles:
  - *Steel Pipe*, *Copper*, *Brass/Gold*, *Green LED*, *Red LED*, *Blue LED*, *Amber LED*, *Off/Gray LED*, *Water Flow*.
- **Custom Gradient Stops**: Check **Custom Stops** to pick custom **Start** and **End** colors using interactive color pickers.

---

## 5. Stroke & Line Styling

- **Stroke Color**: Click the **Stroke Color** button to open the color picker popover and pick outline/border colors.
- **Stroke Width**: Line thickness in pixels (`0` for borderless).
- **Stroke Dash**: Choose border pattern:
  - **Solid**, **Dashed (4,4)**, **Long Dash (8,4)**, **Dotted (2,2)**.

---

## 6. Arrowhead & Endpoint Markers

For lines, paths, arcs, and polylines, customize start and end line markers:
- **Start Marker & End Marker**: `None`, `Arrow`, `Circle`, `Diamond`.

---

## 7. Format, Alignment & Radial Patterns

> [!NOTE]
> Layer Z-ordering, object alignment, 15° step rotation, draggable pivot origins (⨁), and radial pattern creation (petals) are located in the **Format ▼** top menu bar dropdown. See [Format, Align & Radial Patterns](Format_Menu.md).
