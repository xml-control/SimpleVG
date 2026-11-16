# Interface & Workspace Tour

SimpleVG is split into four primary workspace regions:

```
+-------------------------------------------------------------------------+
|                              TOP MENU BAR                               |
+-------------------+-----------------------------------+-----------------+
|   LEFT SIDEBAR    |          CENTER CANVAS            | RIGHT INSPECTOR |
| (Tools & Libraries|         (SVG Artboard)            |  (Properties &  |
|    Accordions)    |                                   |  SCADA Tags)    |
+-------------------+-----------------------------------+-----------------+
```

---

## 1. Top Menu Bar
The top menu bar contains global project actions, format menus, and view toggles:
- **New / Open / Save**: Manage SVG project files.
- **Import SVG**: Merge external `.svg` files into active canvas with auto-scaling & centering.
- **Export PNG**: Download canvas graphics as high-res PNG with custom scale and crop options.
- **Undo / Redo** (`Ctrl+Z` / `Ctrl+Y`): Full step history.
- **Copy / Paste / Group / Ungroup**: Selection operations.
- **Format ▼ Menu**:
  - **Layer Z-Ordering**: (*Bring to Front*, *Bring Forward*, *Send Backward*, *Send to Back*).
  - **Object Alignment**: (*Left*, *Center*, *Right*, *Top*, *Middle*, *Bottom*).
  - **Path Operations**: **🔗 Join / Combine Paths (`Ctrl+J`)** to stitch open curves/arcs into single closed paths.
  - **Flip & Mirror**: **↔ Flip Horizontal (`Ctrl+Shift+H`)**, **↕ Flip Vertical (`Ctrl+Shift+V`)**, and **🪞 Mirror / Symmetry Duplicate**.
  - **Radial Array**: **🌸 Radial Array (`Ctrl+Shift+D`)** for petal patterns.
- **Selection Counter**: Live numeric item counter displayed in the bottom status bar and top of the Element Inspector tab.
- **View Controls**:
  - **Grid**: Toggle grid dot/line overlay.
  - **Snap**: Toggle magnet snap-to-grid.
  - **Ruler**: Toggle top and left pixel rulers.
- **Theme Toggle**: Switch between Light and Dark mode UI.
- **Help ❓**: Opens this interactive help system (`F1`).

---

## 2. Left Sidebar (Toolbox & Libraries)
Contains the **ISA-101 Gray** toggle at the top, followed by 11 collapsible, alphabetically sorted accordion sections:
- **ISA-101 Gray Checkbox** *(located **above** the accordions at the very top of the sidebar)*: Toggles HMI color compliance for library symbols.

> [!NOTE]
> The **ISA-101 Gray Mode** setting specifically applies to SCADA library preset symbols **as they are clicked and added to the canvas** (or when converting selected symbols via the Inspector's *⚙️ ISA-101 Gray* button).

### Accordion Library Sections:
- **BASIC SHAPES**: Core vector creation tools.
- **FACILITIES**: Building structures, houses, workshops, factories, shops.
- **HVAC & DUCTWORK**: Ducts, elbows, dampers, AHUs, coils, filters.
- **KNOBS & SWITCHES**: Rotary dials, pushbuttons, toggles, selectors, E-Stops.
- **LAMPS & INDICATORS**: Pilot lights, alarm beacons, stack lights, LED tiles.
- **LANDSCAPE**: Trees, shrubs, flower beds, fences, trellis, brick walls, ponds.
- **METERS & GAUGES**: Pressure gauges, level bars, digital meters, flowmeters.
- **MOTORS & PUMPS**: Centrifugal pumps, AC motors, agitators, blowers.
- **PIPES & CONNECTORS**: 3D pipes, 90° elbows, tees, flanges.
- **SENSORS**: Duct, room, and outdoor weather sensors.
- **VALVES & VESSELS**: Valve bodies and storage tanks.

---

## 3. Center Canvas & Rulers
The central artboard features zoom controls (`+`, `-`, `1:1`, `Fit`), panning, and interactive object selection handles with 8-point resizing and rotation.

---

## 4. Right Inspector Panel
Inspect and adjust attributes of any selected shape or preset:
- **Element Tab**: Position (X, Y), Dimensions (W, H), Rotation, Fill, Custom SCADA Color Picker Popover, Gradients, Stroke, Arrow Markers, Text styling, and Opacity. See [Inspector & Element Controls](Element_Tab.md).
- **SCADA Tagging Tab**: Tag Name, Description, Units, Min/Max Limits, ISA-101 status bindings.
- **Canvas Tab**: Document Width, Height, and background color settings.
