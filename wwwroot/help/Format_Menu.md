# Format, Alignment & Radial Patterns

The **Format ▼** menu in the top menu bar provides tools for layer z-ordering, object alignment, 15° step rotation, custom pivot origins, and circular/radial pattern duplicating (petals, turbine blades, cog teeth).

---

## 1. Format ▼ Menu Dropdown

Access global object formatting options by clicking the **Format ▼** dropdown button in the top menu bar:

- **Bring to Front**: Moves selected element(s) to the very top of the canvas rendering stack.
- **Bring Forward (Up)**: Moves selected element(s) **one step forward** in the layer stack.
- **Send Backward (Down)**: Moves selected element(s) **one step backward** in the layer stack.
- **Send to Back**: Moves selected element(s) to the very bottom of the canvas rendering stack.

---

## 2. Object Alignment Tools

Position selected shapes precisely relative to the artboard or each other:

- **Single Shape Selected**: Aligns relative to the **500 × 500 px Canvas Artboard**:
  - **Left**: Flushes left edge to `x = 0`.
  - **Center**: Centers horizontally at `x = 250`.
  - **Right**: Flushes right edge to `x = 500`.
  - **Top**: Flushes top edge to `y = 0`.
  - **Middle**: Centers vertically at `y = 250`.
  - **Bottom**: Flushes bottom edge to `y = 500`.

- **Multiple Shapes Selected**: Aligns shapes **relative to each other** (using their selection bounding box):
  - **Left / Right**: Flushes edges together.
  - **Center / Middle**: Aligns horizontal or vertical centerlines.
  - **Top / Bottom**: Flushes top or bottom edges together.

---

## 3. Object Rotation & Draggable Pivot Anchor (⨁)

Rotate selected shapes around their center or a custom pivot point:

### Keyboard Rotation Shortcuts
- **Rotate Clockwise (+15°)**: Press **`Ctrl + R`**.
- **Rotate Anti-Clockwise (-15°)**: Press **`Ctrl + U`**.

### Draggable Pivot Anchor (⨁)
When a shape is selected, an orange **Pivot Target Crosshair (⨁)** appears:
- **Custom Rotation Origin**: Drag the orange **Pivot ⨁** handle anywhere on the canvas (e.g. to the center of a flower disc or gear hub). All rotation shortcuts and handles will rotate around that custom pivot point!
- **Attached Pivot**: The pivot stays attached to the shape when moved.
- **Double-Click Reset**: Double-clicking the orange **Pivot ⨁** handle instantly resets it back to the shape's exact center.

---

## 4. Flip & Mirror / Symmetry Duplicate 🪞

Flip or duplicate selected shapes symmetrically:

- **In-Place Flip**:
  - **Flip Horizontal (↔)**: Press **`Ctrl + Shift + H`** or click **Format ▼** → **Flip Horizontal** (or use Inspector quick buttons).
  - **Flip Vertical (↕)**: Press **`Ctrl + Shift + V`** or click **Format ▼** → **Flip Vertical**.
- **Mirror / Symmetry Duplicate**:
  - Open **Format ▼** → **Mirror / Symmetry Duplicate...**.
  - Duplicate shapes seamlessly edge-to-edge (`Right`, `Left`, `Top`, `Bottom`) or across the center axis while keeping the original.
- **Transform & Scaling Behavior**:
  - Mirrored shapes, rotated groups, and transformed elements maintain fixed 1:1 handle pixel sizing, pin-point edge/corner handle resizing, and in-situation rotation around their center or custom pivot origin (⨁).

---

## 5. Path Operations & Join Paths (🔗)

Combine multiple open curves, arcs, or lines into a single continuous vector shape:

- **Join / Combine Paths (`Ctrl + J`)**:
  - Select two or more open paths, arcs, lines, or polylines (or a group containing them).
  - Press **`Ctrl + J`** or click **Format ▼** → **🔗 Join / Combine Paths (Ctrl+J)**.
  - Stitches all path commands into a single closed `<path d="...">` element.
  - Enables unified **Linear Gradients** and **Radial Gradients** to flow continuously across the entire interior of complex shapes (such as multi-arc leaves or custom petals).

---

## 6. Selection Counter & Status Indicators 🔢

Track selected objects effortlessly across overlapping shapes:

- **Bottom Status Bar**: Displays real-time numeric selection count next to mouse coordinates (e.g. `Selected: None (0)`, `Selected: 1 item (path)`, or `Selected: 3 items`).
- **Inspector Header Badge**: Displays a live pill badge in the Element Inspector tab header (e.g., `0 Selected`, `1 Selected`, `3 Selected`).

---

## 7. Radial Array / Circular Duplicate Tool (Petal Patterns) 🌸

Create circular patterns—such as petals around a flower hub, cooling fan blades, or gauge tick marks:

1. Select one or more shapes on the canvas.
2. Open **Format ▼** → **Radial Array (Petal Pattern)...** or press **`Ctrl + Shift + D`**.
3. Configure radial array options:
   - **Total Items / Clones**: Specify the number of items (e.g., `8` petals).
   - **Total Span Angle (°)**: `360°` for a full circle or `180°` for a semi-circle.
   - **Pivot Origin**: Select between **Custom Pivot Anchor ⨁**, **Canvas Center (250, 250)**, or **Element Bottom-Center**.
4. Click **Create Radial Pattern** to generate and arrange all clones in a perfect circular pattern!
