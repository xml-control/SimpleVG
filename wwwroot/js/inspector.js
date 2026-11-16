/**
 * SimpleVG - Inspector & Property Panel Controller
 * Handles Tab switching, Element Properties, SCADA Tag binding, Color Picker (HEX/RGB/HSL), and Gradients
 */

class InspectorPanel {
  constructor(canvasInstance, gradientManager) {
    this.canvas = canvasInstance;
    this.gradients = gradientManager;
    this.activeFillMode = 'solid';

    this.init();
  }

  init() {
    this.bindTabs();
    this.bindColorPickers();
    this.bindPropertyInputs();
    this.bindScadaTags();
    this.bindLayeringAndAlignment();
    this.bindPanelResizer();
    this.bindTraceImageTab();

    // Listen for canvas selection changes
    this.canvas.onSelectionChange = (selectedEls) => {
      this.populateElementProperties(selectedEls[0]);
    };
  }

  bindPanelResizer() {
    const resizer = document.getElementById('inspector-resizer');
    const panel = document.getElementById('right-inspector');
    if (!resizer || !panel) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isResizing = true;
      resizer.classList.add('dragging');
      document.body.style.cursor = 'ew-resize';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const windowW = window.innerWidth;
      const newWidth = Math.max(280, Math.min(650, windowW - e.clientX));
      panel.style.width = `${newWidth}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove('dragging');
        document.body.style.cursor = 'default';
      }
    });
  }

  bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetTab = document.getElementById(btn.dataset.tab);
        if (targetTab) targetTab.classList.add('active');
      });
    });
  }

  populateElementProperties(el) {
    if (!el) {
      this.resetFields();
      return;
    }

    const bbox = el.getBBox();
    const setVal = (id, val) => {
      const input = document.getElementById(id);
      if (input) input.value = Math.round(val || 0);
    };

    if (this.usesAttrGeometry(el)) {
      setVal('prop-x', el.getAttribute('x') || bbox.x);
      setVal('prop-y', el.getAttribute('y') || bbox.y);
      setVal('prop-w', el.getAttribute('width') || bbox.width);
      setVal('prop-h', el.getAttribute('height') || bbox.height);
    } else {
      const sb = this.getStageBBox(el);
      setVal('prop-x', sb.x);
      setVal('prop-y', sb.y);
      setVal('prop-w', sb.width);
      setVal('prop-h', sb.height);
    }
    setVal('prop-rx', el.getAttribute('rx') || 0);

    const transform = el.getAttribute('transform') || '';
    const match = transform.match(/rotate\(\s*(-?\d+\.?\d*)/);
    setVal('prop-rotate', match ? parseFloat(match[1]) : 0);

    const isText = el.tagName.toLowerCase() === 'text';
    const textGroup = document.getElementById('text-prop-group');
    if (textGroup) textGroup.style.display = isText ? 'block' : 'none';

    if (isText) {
      document.getElementById('prop-text-content').value = el.textContent || '';
      document.getElementById('prop-font-size').value = el.getAttribute('font-size') || 20;
      document.getElementById('prop-font-family').value = el.getAttribute('font-family') || 'Inter, sans-serif';
    }

    // Fill & Stroke
    const target = (el.tagName.toLowerCase() === 'g') ? (el.querySelector('circle, rect, polygon, path') || el) : el;
    const fill = target.getAttribute('fill') || '#3182CE';
    const stroke = target.getAttribute('stroke') || '#262626';
    const strokeWidth = target.getAttribute('stroke-width') || '2';
    const opacity = el.getAttribute('opacity') || '1';

    const fillChip = document.getElementById('fill-chip');
    const fillLabel = document.getElementById('fill-hex-label');
    if (fillChip) fillChip.style.background = fill;
    if (fillLabel && fill.startsWith('#')) fillLabel.textContent = fill.toUpperCase();

    const strokeChip = document.getElementById('stroke-chip');
    const strokeLabel = document.getElementById('stroke-hex-label');
    if (strokeChip) strokeChip.style.background = stroke;
    if (strokeLabel && stroke.startsWith('#')) strokeLabel.textContent = stroke.toUpperCase();

    document.getElementById('prop-stroke-width').value = strokeWidth;
    document.getElementById('prop-opacity').value = opacity;
    document.getElementById('opacity-val').innerText = `${Math.round(opacity * 100)}%`;

    // Polygon / Star Controls Visibility & Values
    const isPolygon = el.tagName.toLowerCase() === 'polygon';
    const polyGroup = document.getElementById('polygon-prop-group');
    const starRatioGroup = document.getElementById('star-ratio-group');
    if (polyGroup) polyGroup.style.display = isPolygon ? 'grid' : 'none';
    if (isPolygon) {
      const shapeType = el.getAttribute('data-shape-type') || 'polygon';
      const sidesInput = document.getElementById('prop-polygon-sides');
      if (sidesInput) sidesInput.value = el.getAttribute('data-sides') || '5';
      if (starRatioGroup) starRatioGroup.style.display = (shapeType === 'star') ? 'block' : 'none';
      const starRatioInput = document.getElementById('prop-star-ratio');
      if (starRatioInput) starRatioInput.value = el.getAttribute('data-inner-ratio') || '0.4';
    }

    // Path / Bézier Controls
    const isPath = el.tagName.toLowerCase() === 'path';
    const pathGroup = document.getElementById('path-prop-group');
    if (pathGroup) pathGroup.style.display = isPath ? 'block' : 'none';
    if (isPath) {
      const d = (el.getAttribute('d') || '').trim();
      const chkClosed = document.getElementById('chk-path-closed');
      if (chkClosed) chkClosed.checked = /z$/i.test(d);
    }

    // Markers & Dash
    const markerStart = document.getElementById('prop-marker-start');
    const markerEnd = document.getElementById('prop-marker-end');
    const strokeDash = document.getElementById('prop-stroke-dash');
    if (markerStart) markerStart.value = el.getAttribute('marker-start') || 'none';
    if (markerEnd) markerEnd.value = el.getAttribute('marker-end') || 'none';
    if (strokeDash) strokeDash.value = el.getAttribute('stroke-dasharray') || 'none';

    // SCADA Binding Tab
    document.getElementById('scada-prop-id').value = el.getAttribute('id') || '';
    document.getElementById('scada-prop-class').value = el.getAttribute('class') || '';
    document.getElementById('scada-prop-datatag').value = el.getAttribute('data-tag') || '';
  }

  resetFields() {
    ['prop-x', 'prop-y', 'prop-w', 'prop-h', 'prop-rx'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = 0;
    });
    document.getElementById('scada-prop-id').value = '';
    document.getElementById('scada-prop-class').value = '';
    document.getElementById('scada-prop-datatag').value = '';
  }

  bindColorPickers() {
    // Fill Mode Tabs (Solid / Linear / Radial)
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFillMode = btn.dataset.fillMode;

        const gradPanel = document.getElementById('gradient-panel');
        const angleGroup = document.getElementById('grad-angle-group');
        if (gradPanel) {
          gradPanel.style.display = (this.activeFillMode !== 'solid') ? 'block' : 'none';
        }
        if (angleGroup) {
          angleGroup.style.display = (this.activeFillMode === 'linear') ? 'block' : 'none';
        }

        // Re-apply fill using current base color for the newly selected fill mode
        const currentColor = this.lastSelectedBaseColor || document.getElementById('fill-hex-label')?.textContent || '#3182CE';
        this.applyFillColor(currentColor);
      });
    });

    // SCADA Swatches
    document.querySelectorAll('.swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        this.applyFillColor(color);
      });
    });

    // Apply ISA-101 Neutral Gray Preset Button
    document.getElementById('btn-apply-isa-gray')?.addEventListener('click', () => {
      const isaGrayFill = '#718096';
      const isaStroke = '#1A202C';
      
      this.canvas.selectedElements.forEach(el => {
        if (el.tagName.toLowerCase() === 'g') {
          // Color all shapes inside group to ISA-101 neutral gray
          el.querySelectorAll('circle, rect, polygon, path').forEach(child => {
            child.setAttribute('fill', isaGrayFill);
            child.setAttribute('stroke', isaStroke);
          });
        } else {
          el.setAttribute('fill', isaGrayFill);
          el.setAttribute('stroke', isaStroke);
        }
      });

      const hexInput = document.getElementById('color-hex-val');
      if (hexInput) hexInput.value = isaGrayFill;
      document.getElementById('fill-chip').style.background = isaGrayFill;
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    // Color format switching (HEX / RGB / HSL)
    document.querySelectorAll('.color-format-header span').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.color-format-header span').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.color-fmt-panel').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const fmt = tab.dataset.colorFmt;
        document.getElementById(`fmt-${fmt}-panel`)?.classList.add('active');
      });
    });

    // SCADA Custom Color Picker Popover Triggers (Fill & Stroke)
    document.getElementById('btn-color-fill')?.addEventListener('click', (e) => {
      const currentFill = document.getElementById('fill-hex-label')?.textContent || '#3182CE';
      if (window.colorPickerPopover) {
        window.colorPickerPopover.open(
          e.currentTarget,
          currentFill,
          (liveColor) => this.applyFillColor(liveColor),
          (appliedColor) => this.applyFillColor(appliedColor)
        );
      }
    });

    document.getElementById('btn-color-stroke')?.addEventListener('click', (e) => {
      const currentStroke = document.getElementById('stroke-hex-label')?.textContent || '#262626';
      if (window.colorPickerPopover) {
        window.colorPickerPopover.open(
          e.currentTarget,
          currentStroke,
          (liveColor) => this.applyStrokeColor(liveColor),
          (appliedColor) => this.applyStrokeColor(appliedColor)
        );
      }
    });

    // Canvas Tab Default Fill Picker
    document.getElementById('btn-canvas-default-fill-picker')?.addEventListener('click', (e) => {
      const currentFill = document.getElementById('canvas-default-fill')?.value || '#3182CE';
      if (window.colorPickerPopover) {
        window.colorPickerPopover.open(
          e.currentTarget,
          currentFill,
          (liveColor) => {
            const chip = document.getElementById('canvas-default-fill-chip');
            const label = document.getElementById('canvas-default-fill-label');
            const input = document.getElementById('canvas-default-fill');
            if (chip) chip.style.background = liveColor;
            if (label) label.textContent = liveColor.toUpperCase();
            if (input) input.value = liveColor;
          },
          (appliedColor) => {
            const chip = document.getElementById('canvas-default-fill-chip');
            const label = document.getElementById('canvas-default-fill-label');
            const input = document.getElementById('canvas-default-fill');
            if (chip) chip.style.background = appliedColor;
            if (label) label.textContent = appliedColor.toUpperCase();
            if (input) input.value = appliedColor;
          }
        );
      }
    });

    // Canvas Tab Default Stroke Picker
    document.getElementById('btn-canvas-default-stroke-picker')?.addEventListener('click', (e) => {
      const currentStroke = document.getElementById('canvas-default-stroke')?.value || '#2D3748';
      if (window.colorPickerPopover) {
        window.colorPickerPopover.open(
          e.currentTarget,
          currentStroke,
          (liveColor) => {
            const chip = document.getElementById('canvas-default-stroke-chip');
            const label = document.getElementById('canvas-default-stroke-label');
            const input = document.getElementById('canvas-default-stroke');
            if (chip) chip.style.background = liveColor;
            if (label) label.textContent = liveColor.toUpperCase();
            if (input) input.value = liveColor;
          },
          (appliedColor) => {
            const chip = document.getElementById('canvas-default-stroke-chip');
            const label = document.getElementById('canvas-default-stroke-label');
            const input = document.getElementById('canvas-default-stroke');
            if (chip) chip.style.background = appliedColor;
            if (label) label.textContent = appliedColor.toUpperCase();
            if (input) input.value = appliedColor;
            this.canvas.saveUserSettings();
          }
        );
      }
    });

    // Canvas Tab Centerline Color Picker
    document.getElementById('btn-canvas-centerline-color-picker')?.addEventListener('click', (e) => {
      const currentColor = document.getElementById('canvas-centerline-color')?.value || '#CBD5E0';
      if (window.colorPickerPopover) {
        window.colorPickerPopover.open(
          e.currentTarget,
          currentColor,
          (liveColor) => {
            const chip = document.getElementById('canvas-centerline-color-chip');
            const label = document.getElementById('canvas-centerline-color-label');
            const input = document.getElementById('canvas-centerline-color');
            if (chip) chip.style.background = liveColor;
            if (label) label.textContent = liveColor.toUpperCase();
            if (input) input.value = liveColor;
            this.canvas.setCenterlineColor(liveColor);
          },
          (appliedColor) => {
            const chip = document.getElementById('canvas-centerline-color-chip');
            const label = document.getElementById('canvas-centerline-color-label');
            const input = document.getElementById('canvas-centerline-color');
            if (chip) chip.style.background = appliedColor;
            if (label) label.textContent = appliedColor.toUpperCase();
            if (input) input.value = appliedColor;
            this.canvas.setCenterlineColor(appliedColor);
          }
        );
      }
    });

    // Opacity Range Slider
    const opacitySlider = document.getElementById('prop-opacity');
    opacitySlider?.addEventListener('input', (e) => {
      const val = e.target.value;
      document.getElementById('opacity-val').innerText = `${Math.round(val * 100)}%`;
      this.canvas.selectedElements.forEach(el => el.setAttribute('opacity', val));
    });

    // Direction Angle Slider (Linear Gradients)
    const angleSlider = document.getElementById('grad-angle');
    angleSlider?.addEventListener('input', (e) => {
      const angle = parseInt(e.target.value, 10);
      const angleText = document.getElementById('grad-angle-val');
      if (angleText) angleText.innerText = `${angle}°`;
      this.canvas.selectedElements.forEach(el => {
        const fill = el.getAttribute('fill') || '';
        const match = fill.match(/url\(#([^)]+)\)/);
        if (match) {
          const gradId = match[1];
          const grad = document.getElementById(gradId);
          if (grad && grad.tagName.toLowerCase() === 'lineargradient') {
            const angleRad = (angle * Math.PI) / 180;
            const x1 = Math.round(50 - Math.cos(angleRad) * 50);
            const y1 = Math.round(50 - Math.sin(angleRad) * 50);
            const x2 = Math.round(50 + Math.cos(angleRad) * 50);
            const y2 = Math.round(50 + Math.sin(angleRad) * 50);
            grad.setAttribute('x1', `${x1}%`);
            grad.setAttribute('y1', `${y1}%`);
            grad.setAttribute('x2', `${x2}%`);
            grad.setAttribute('y2', `${y2}%`);
          }
        }
      });

      // Update preview bar angle
      const previewBar = document.getElementById('gradient-preview-bar');
      if (previewBar && previewBar.style.background.includes('linear-gradient')) {
        previewBar.style.background = previewBar.style.background.replace(/linear-gradient\(-?\d+deg/, `linear-gradient(${angle}deg`);
      }

      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    // Custom Stop Colors Checkbox Toggle
    const chkCustom = document.getElementById('chk-use-custom-stops');
    const customPickers = document.getElementById('custom-stops-pickers');

    chkCustom?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      if (customPickers) {
        customPickers.style.opacity = enabled ? '1' : '0.5';
        customPickers.style.pointerEvents = enabled ? 'auto' : 'none';
      }
      if (enabled) {
        updateCustomGradientStops();
      }
    });

    // Custom Gradient Stop Pickers (Start & End Color)
    const updateCustomGradientStops = () => {
      if (chkCustom && !chkCustom.checked) return;

      const startC = document.getElementById('grad-start-color')?.value || '#ffffff';
      const endC = document.getElementById('grad-end-color')?.value || '#000000';
      const stops = [
        { offset: "0%", color: startC },
        { offset: "100%", color: endC }
      ];

      let gradUrl;
      if (this.activeFillMode === 'radial') {
        gradUrl = this.gradients.createRadialGradient(stops);
        this.updateGradientPreview(stops, 'radial');
      } else {
        const currentAngle = parseInt(document.getElementById('grad-angle')?.value || '90', 10);
        gradUrl = this.gradients.createLinearGradient(stops, currentAngle);
        this.updateGradientPreview(stops, 'linear', currentAngle);
      }

      this.applyFillColor(gradUrl);
    };

    document.getElementById('grad-start-color')?.addEventListener('input', updateCustomGradientStops);
    document.getElementById('grad-end-color')?.addEventListener('input', updateCustomGradientStops);

    // Gradient Presets
    document.querySelectorAll('.grad-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Uncheck custom stops when clicking a preset
        if (chkCustom) {
          chkCustom.checked = false;
          if (customPickers) {
            customPickers.style.opacity = '0.5';
            customPickers.style.pointerEvents = 'none';
          }
        }

        const preset = btn.dataset.gradPreset;
        const stops = this.gradients.getPresetStops(preset);
        
        let gradUrl;
        if (this.activeFillMode === 'radial' || preset.startsWith('led')) {
          gradUrl = this.gradients.createRadialGradient(stops);
          this.updateGradientPreview(stops, 'radial');
        } else {
          const currentAngle = parseInt(document.getElementById('grad-angle')?.value || '90', 10);
          gradUrl = this.gradients.createLinearGradient(stops, currentAngle);
          this.updateGradientPreview(stops, 'linear', currentAngle);
        }

        this.applyFillColor(gradUrl);
      });
    });
  }

  updateGradientPreview(stops, mode = 'linear', angle = 90) {
    const previewBar = document.getElementById('gradient-preview-bar');
    if (!previewBar || !stops) return;

    const stopCss = stops.map(s => `${s.color} ${s.offset}`).join(', ');
    if (mode === 'radial') {
      previewBar.style.background = `radial-gradient(circle at center, ${stopCss})`;
    } else {
      previewBar.style.background = `linear-gradient(${angle}deg, ${stopCss})`;
    }
  }

  applyFillColor(color) {
    if (!color) return;

    let finalFill = color;

    // If color is a solid color string (not a url(#grad...))
    if (!color.startsWith('url(')) {
      this.lastSelectedBaseColor = color;

      const chip = document.getElementById('fill-chip');
      const label = document.getElementById('fill-hex-label');
      if (chip) chip.style.background = color;
      if (label && color.startsWith('#')) label.textContent = color.toUpperCase();

      if (this.activeFillMode === 'radial') {
        const stops = [
          { offset: "0%", color: "#FFFFFF" },
          { offset: "40%", color: color },
          { offset: "100%", color: "#1A202C" }
        ];
        finalFill = this.gradients.createRadialGradient(stops);
        this.updateGradientPreview(stops, 'radial');
      } else if (this.activeFillMode === 'linear') {
        const stops = [
          { offset: "0%", color: color },
          { offset: "50%", color: "#FFFFFF" },
          { offset: "100%", color: color }
        ];
        const currentAngle = parseInt(document.getElementById('grad-angle')?.value || '90', 10);
        finalFill = this.gradients.createLinearGradient(stops, currentAngle);
        this.updateGradientPreview(stops, 'linear', currentAngle);
      }
    }

    this.canvas.selectedElements.forEach(el => {
      if (el.tagName.toLowerCase() === 'g') {
        const target = el.querySelector('circle, rect, polygon, path') || el;
        target.setAttribute('fill', finalFill);
      } else {
        el.setAttribute('fill', finalFill);
      }
    });
    if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
  }

  applyStrokeColor(color) {
    const chip = document.getElementById('stroke-chip');
    const label = document.getElementById('stroke-hex-label');
    if (chip) chip.style.background = color;
    if (label && color.startsWith('#')) label.textContent = color.toUpperCase();

    this.canvas.selectedElements.forEach(el => {
      if (el.tagName.toLowerCase() === 'g') {
        el.querySelectorAll('circle, rect, polygon, path, line, polyline').forEach(child => {
          child.setAttribute('stroke', color);
        });
      } else {
        el.setAttribute('stroke', color);
      }
    });
    this.canvas.updateSelectionHandles();
    if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
  }

  // Elements whose position and size are stored directly in x / y / width / height attributes.
  usesAttrGeometry(el) {
    const tag = el.tagName.toLowerCase();
    return tag === 'rect' || tag === 'text' || tag === 'image';
  }

  // Visual bounding box of an element in stage (canvas pixel) coordinates, including its transform.
  getStageBBox(el) {
    const bbox = el.getBBox();
    const stage = this.canvas.stage;
    const elCTM = el.getScreenCTM();
    const stageCTM = stage && stage.getScreenCTM();
    if (!elCTM || !stageCTM) return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
    const m = stageCTM.inverse().multiply(elCTM);
    const pts = [
      [bbox.x, bbox.y], [bbox.x + bbox.width, bbox.y],
      [bbox.x, bbox.y + bbox.height], [bbox.x + bbox.width, bbox.y + bbox.height]
    ].map(([px, py]) => ({ x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f }));
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }

  // Move an element so its visual top-left corner is at (x, y); either value may be null to leave it alone.
  setElementPosition(el, x, y) {
    if (this.usesAttrGeometry(el)) {
      if (x !== null) el.setAttribute('x', x);
      if (y !== null) el.setAttribute('y', y);
      return;
    }
    const cur = this.getStageBBox(el);
    const dx = x !== null ? x - cur.x : 0;
    const dy = y !== null ? y - cur.y : 0;
    if (dx !== 0 || dy !== 0) this.canvas.moveElement(el, dx, dy);
  }

  // Resize an element so its visual width / height match the given values, keeping its top-left corner fixed.
  setElementSize(el, w, h) {
    if (this.usesAttrGeometry(el)) {
      if (w !== null) el.setAttribute('width', w);
      if (h !== null) el.setAttribute('height', h);
      return;
    }

    const tag = el.tagName.toLowerCase();
    const transform = el.getAttribute('transform') || '';
    const cur = this.getStageBBox(el);
    const newW = w !== null ? w : cur.width;
    const newH = h !== null ? h : cur.height;

    // Ellipses and circles: resize the radii directly (only when not transformed).
    if ((tag === 'ellipse' || tag === 'circle') && !transform) {
      const rx = newW / 2, ry = newH / 2;
      if (tag === 'circle') {
        el.setAttribute('r', (rx + ry) / 2);
        el.setAttribute('cx', cur.x + rx);
        el.setAttribute('cy', cur.y + ry);
      } else {
        el.setAttribute('rx', rx);
        el.setAttribute('ry', ry);
        el.setAttribute('cx', cur.x + rx);
        el.setAttribute('cy', cur.y + ry);
      }
      return;
    }

    // Lines, polylines and polygons (not transformed): rescale their points about the top-left corner.
    if (!transform && (tag === 'line' || tag === 'polyline' || tag === 'polygon')) {
      const sx = cur.width > 0 ? newW / cur.width : 1;
      const sy = cur.height > 0 ? newH / cur.height : 1;
      const scaleX = (v) => cur.x + (v - cur.x) * sx;
      const scaleY = (v) => cur.y + (v - cur.y) * sy;
      if (tag === 'line') {
        ['x1', 'x2'].forEach(a => el.setAttribute(a, scaleX(parseFloat(el.getAttribute(a) || 0))));
        ['y1', 'y2'].forEach(a => el.setAttribute(a, scaleY(parseFloat(el.getAttribute(a) || 0))));
      } else {
        const nums = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(parseFloat);
        const out = [];
        for (let i = 0; i + 1 < nums.length; i += 2) out.push(`${scaleX(nums[i])},${scaleY(nums[i + 1])}`);
        el.setAttribute('points', out.join(' '));
      }
      return;
    }

    // Groups, paths and anything else: use a translate + scale transform, as the resize handles do.
    // Transforms containing rotation or other functions are left alone.
    const m = transform.match(/^\s*(?:translate\(\s*(-?[\d.]+)\s*[\s,]\s*(-?[\d.]+)\s*\))?\s*(?:scale\(\s*(-?[\d.]+)\s*(?:[\s,]\s*(-?[\d.]+))?\s*\))?\s*$/i);
    if (!m) return;
    const local = el.getBBox();
    const oldSx = m[3] !== undefined ? parseFloat(m[3]) : 1;
    const oldSy = m[4] !== undefined ? parseFloat(m[4]) : (m[3] !== undefined ? oldSx : 1);
    const sx = (oldSx >= 0 ? 1 : -1) * (local.width > 0 ? newW / local.width : 1);
    const sy = (oldSy >= 0 ? 1 : -1) * (local.height > 0 ? newH / local.height : 1);
    const tx = sx >= 0 ? (cur.x - local.x * sx) : ((cur.x + newW) - local.x * sx);
    const ty = sy >= 0 ? (cur.y - local.y * sy) : ((cur.y + newH) - local.y * sy);
    el.setAttribute('transform', `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`);
  }

  bindGeometryInputs() {
    const bind = (id, apply) => {
      const input = document.getElementById(id);
      if (!input) return;
      const clamp = (raw) => {
        let val = parseFloat(raw);
        if (isNaN(val)) return null;
        const min = input.hasAttribute('min') ? parseFloat(input.getAttribute('min')) : -Infinity;
        const max = input.hasAttribute('max') ? parseFloat(input.getAttribute('max')) : Infinity;
        return Math.min(max, Math.max(min, val));
      };
      input.addEventListener('input', (e) => {
        const val = clamp(e.target.value);
        if (val === null) return;
        this.canvas.selectedElements.forEach(el => apply(el, val));
        this.canvas.updateSelectionHandles();
        if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
      });
      input.addEventListener('change', (e) => {
        const val = clamp(e.target.value);
        if (val !== null) e.target.value = val;
      });
    };
    bind('prop-x', (el, v) => this.setElementPosition(el, v, null));
    bind('prop-y', (el, v) => this.setElementPosition(el, null, v));
    bind('prop-w', (el, v) => this.setElementSize(el, v, null));
    bind('prop-h', (el, v) => this.setElementSize(el, null, v));
  }

  bindPropertyInputs() {
    const updateAttr = (id, attr) => {
      const input = document.getElementById(id);
      if (!input) return;

      const getClampedVal = (rawVal) => {
        let val = parseFloat(rawVal);
        if (isNaN(val)) return null;
        const min = input.hasAttribute('min') ? parseFloat(input.getAttribute('min')) : -Infinity;
        const max = input.hasAttribute('max') ? parseFloat(input.getAttribute('max')) : Infinity;
        if (val < min) val = min;
        if (val > max) val = max;
        return val;
      };

      input.addEventListener('input', (e) => {
        const val = getClampedVal(e.target.value);
        if (val === null) return;
        this.canvas.selectedElements.forEach(el => {
          el.setAttribute(attr, val);
        });
        this.canvas.updateSelectionHandles();
        if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
      });

      input.addEventListener('change', (e) => {
        const val = getClampedVal(e.target.value);
        if (val !== null) {
          e.target.value = val;
        }
      });
    };

    this.bindGeometryInputs();
    updateAttr('prop-rx', 'rx');
    updateAttr('prop-stroke-width', 'stroke-width');
    updateAttr('prop-font-size', 'font-size');
    updateAttr('prop-font-family', 'font-family');

    const rotateInput = document.getElementById('prop-rotate');
    if (rotateInput) {
      const getClampedRotate = (rawVal) => {
        let deg = parseFloat(rawVal || '0');
        if (isNaN(deg)) deg = 0;
        if (deg < -360) deg = -360;
        if (deg > 360) deg = 360;
        return deg;
      };

      rotateInput.addEventListener('input', (e) => {
        const deg = getClampedRotate(e.target.value);
        this.canvas.selectedElements.forEach(el => {
          this.canvas.setElementRotation(el, deg);
        });
        this.canvas.updateSelectionHandles();
        if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
      });

      rotateInput.addEventListener('change', (e) => {
        e.target.value = getClampedRotate(e.target.value);
      });
    }

    document.getElementById('prop-text-content')?.addEventListener('input', (e) => {
      const textVal = e.target.value;
      this.canvas.selectedElements.forEach(el => {
        if (el.tagName.toLowerCase() === 'text') {
          el.textContent = textVal;
        }
      });
      this.canvas.updateSelectionHandles();
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    // Marker Start / End Listeners
    document.getElementById('prop-marker-start')?.addEventListener('change', (e) => {
      const val = e.target.value;
      this.canvas.selectedElements.forEach(el => {
        if (val === 'none') el.removeAttribute('marker-start');
        else el.setAttribute('marker-start', val);
      });
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    document.getElementById('prop-marker-end')?.addEventListener('change', (e) => {
      const val = e.target.value;
      this.canvas.selectedElements.forEach(el => {
        if (val === 'none') el.removeAttribute('marker-end');
        else el.setAttribute('marker-end', val);
      });
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    // Stroke Dash Listener
    document.getElementById('prop-stroke-dash')?.addEventListener('change', (e) => {
      const val = e.target.value;
      this.canvas.selectedElements.forEach(el => {
        if (val === 'none') el.removeAttribute('stroke-dasharray');
        else el.setAttribute('stroke-dasharray', val);
      });
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    // Polygon Sides Listener
    const polygonSidesInput = document.getElementById('prop-polygon-sides');
    if (polygonSidesInput) {
      polygonSidesInput.addEventListener('input', (e) => {
        let sides = parseInt(e.target.value || '3', 10);
        if (isNaN(sides)) sides = 3;
        sides = Math.max(3, Math.min(32, sides));
        this.canvas.selectedElements.forEach(el => {
          if (el.tagName.toLowerCase() === 'polygon') {
            el.setAttribute('data-sides', sides);
            const shapeType = el.getAttribute('data-shape-type') || 'polygon';
            if (shapeType === 'star') {
              const innerRatio = parseFloat(el.getAttribute('data-inner-ratio') || '0.4');
              const { cx, cy, rx, ry } = getStarParameters(el);
              el.setAttribute('points', generateStarPoints(cx, cy, rx, ry, sides, innerRatio));
            } else {
              const bbox = el.getBBox();
              const rx = bbox.width / 2;
              const ry = bbox.height / 2;
              const cx = bbox.x + rx;
              const cy = bbox.y + ry;
              el.setAttribute('points', generatePolygonPoints(cx, cy, rx, ry, sides));
            }
          }
        });
        this.canvas.updateSelectionHandles();
        if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
      });

      polygonSidesInput.addEventListener('change', (e) => {
        let sides = parseInt(e.target.value || '3', 10);
        if (isNaN(sides)) sides = 3;
        e.target.value = Math.max(3, Math.min(32, sides));
      });
    }

    // Star Inner Radius Listener
    document.getElementById('prop-star-ratio')?.addEventListener('input', (e) => {
      const innerRatio = parseFloat(e.target.value || '0.4');
      this.canvas.selectedElements.forEach(el => {
        if (el.tagName.toLowerCase() === 'polygon' && el.getAttribute('data-shape-type') === 'star') {
          el.setAttribute('data-inner-ratio', innerRatio);
          const sides = parseInt(el.getAttribute('data-sides') || '5', 10);
          const { cx, cy, rx, ry } = getStarParameters(el);
          el.setAttribute('points', generateStarPoints(cx, cy, rx, ry, sides, innerRatio));
        }
      });
      this.canvas.updateSelectionHandles();
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    // Path Closed Checkbox Listener
    document.getElementById('chk-path-closed')?.addEventListener('change', (e) => {
      const isClosed = e.target.checked;
      this.canvas.selectedElements.forEach(el => {
        if (el.tagName.toLowerCase() === 'path') {
          let d = el.getAttribute('d') || '';
          if (isClosed) {
            if (!/z\s*$/i.test(d)) d += ' Z';
          } else {
            d = d.replace(/\s*z\s*$/i, '');
          }
          el.setAttribute('d', d);
        }
      });
      this.canvas.updateSelectionHandles();
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    // Canvas Document & Grid Settings Tab
    const canvasWInput = document.getElementById('canvas-prop-w');
    if (canvasWInput) {
      canvasWInput.addEventListener('input', (e) => {
        let w = parseInt(e.target.value, 10);
        if (!isNaN(w) && w >= 50 && w <= 10000) {
          this.canvas.setCanvasSize(w, this.canvas.height);
        }
      });
      canvasWInput.addEventListener('change', (e) => {
        let w = parseInt(e.target.value, 10);
        if (isNaN(w) || w < 50) e.target.value = 50;
        else if (w > 10000) e.target.value = 10000;
      });
    }

    const canvasHInput = document.getElementById('canvas-prop-h');
    if (canvasHInput) {
      canvasHInput.addEventListener('input', (e) => {
        let h = parseInt(e.target.value, 10);
        if (!isNaN(h) && h >= 50 && h <= 10000) {
          this.canvas.setCanvasSize(this.canvas.width, h);
        }
      });
      canvasHInput.addEventListener('change', (e) => {
        let h = parseInt(e.target.value, 10);
        if (isNaN(h) || h < 50) e.target.value = 50;
        else if (h > 10000) e.target.value = 10000;
      });
    }

    const canvasGridInput = document.getElementById('canvas-prop-grid');
    if (canvasGridInput) {
      canvasGridInput.addEventListener('input', (e) => {
        let gridSize = parseInt(e.target.value, 10);
        if (!isNaN(gridSize) && gridSize >= 2 && gridSize <= 200) {
          this.canvas.setGrid(this.canvas.showGrid, this.canvas.snapToGrid, gridSize);
        }
      });
      canvasGridInput.addEventListener('change', (e) => {
        let gridSize = parseInt(e.target.value, 10);
        if (isNaN(gridSize) || gridSize < 2) e.target.value = 2;
        else if (gridSize > 200) e.target.value = 200;
      });
    }
  }

  bindScadaTags() {
    const updateScadaAttr = (inputId, attrName) => {
      document.getElementById(inputId)?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        this.canvas.selectedElements.forEach(el => {
          if (val) {
            el.setAttribute(attrName, val);
          } else {
            el.removeAttribute(attrName);
          }
        });
        if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
      });
    };

    updateScadaAttr('scada-prop-id', 'id');
    updateScadaAttr('scada-prop-class', 'class');
    updateScadaAttr('scada-prop-datatag', 'data-tag');

    // Quick tag chips
    document.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const className = chip.dataset.applyClass;
        const input = document.getElementById('scada-prop-class');
        if (input) {
          const current = input.value ? input.value + ' ' : '';
          input.value = current + className;
          input.dispatchEvent(new Event('input'));
        }
      });
    });

    // Canvas Document & Grid Settings Tab
    document.getElementById('canvas-prop-w')?.addEventListener('input', (e) => {
      const w = parseInt(e.target.value, 10);
      if (w >= 50) this.canvas.setCanvasSize(w, this.canvas.height);
    });

    document.getElementById('canvas-prop-h')?.addEventListener('input', (e) => {
      const h = parseInt(e.target.value, 10);
      if (h >= 50) this.canvas.setCanvasSize(this.canvas.width, h);
    });

    document.getElementById('canvas-prop-grid')?.addEventListener('input', (e) => {
      const gridSize = parseInt(e.target.value, 10);
      if (gridSize >= 2 && gridSize <= 200) {
        this.canvas.setGrid(this.canvas.showGrid, this.canvas.snapToGrid, gridSize);
      }
    });
  }

  bindLayeringAndAlignment() {
    document.getElementById('btn-layer-to-front')?.addEventListener('click', () => {
      this.canvas.selectedElements.forEach(el => this.canvas.stage.appendChild(el));
      this.canvas.updateSelectionHandles();
    });

    document.getElementById('btn-layer-to-back')?.addEventListener('click', () => {
      this.canvas.selectedElements.forEach(el => {
        if (this.canvas.stage.firstChild) {
          this.canvas.stage.insertBefore(el, this.canvas.stage.firstChild);
        }
      });
      this.canvas.updateSelectionHandles();
    });
  }

  bindTraceImageTab() {
    const btnLoad = document.getElementById('btn-load-trace-img');
    const inputFileInput = document.getElementById('input-trace-file');
    const btnRemove = document.getElementById('btn-remove-trace-img');
    const wrapperControls = document.getElementById('trace-controls-wrapper');

    const chkVisible = document.getElementById('chk-trace-visible');
    const sliderOpacity = document.getElementById('slider-trace-opacity');
    const lblOpacity = document.getElementById('lbl-trace-opacity');

    const sliderScale = document.getElementById('slider-trace-scale');
    const numScale = document.getElementById('num-trace-scale');
    const lblScale = document.getElementById('lbl-trace-scale');

    const numPosX = document.getElementById('num-trace-pos-x');
    const numPosY = document.getElementById('num-trace-pos-y');
    const chkExport = document.getElementById('chk-trace-export');

    const updateControlsUI = () => {
      const hasImage = !!this.canvas.traceState.dataUrl;
      if (btnRemove) btnRemove.disabled = !hasImage;
      if (wrapperControls) {
        wrapperControls.style.opacity = hasImage ? '1' : '0.5';
        wrapperControls.style.pointerEvents = hasImage ? 'auto' : 'none';
      }
    };

    btnLoad?.addEventListener('click', () => {
      inputFileInput?.click();
    });

    inputFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        this.canvas.setTraceImage(dataUrl, () => {
          updateControlsUI();
          if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
        });
      };
      reader.readAsDataURL(file);
    });

    btnRemove?.addEventListener('click', () => {
      this.canvas.removeTraceImage();
      if (inputFileInput) inputFileInput.value = '';
      updateControlsUI();
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    chkVisible?.addEventListener('change', (e) => {
      this.canvas.traceState.visible = e.target.checked;
      this.canvas.updateTraceImage();
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    sliderOpacity?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.canvas.traceState.opacity = val / 100;
      if (lblOpacity) lblOpacity.textContent = `${val}%`;
      this.canvas.updateTraceImage();
    });

    const setScale = (val) => {
      let num = parseFloat(val);
      if (isNaN(num)) num = 1.0;
      num = Math.max(0.1, Math.min(10.0, num));
      this.canvas.traceState.scale = num;
      if (sliderScale) sliderScale.value = num;
      if (numScale) numScale.value = num;
      if (lblScale) lblScale.textContent = `${num.toFixed(1)}x`;
      this.canvas.updateTraceImage();
    };

    sliderScale?.addEventListener('input', (e) => setScale(e.target.value));
    numScale?.addEventListener('input', (e) => setScale(e.target.value));

    numPosX?.addEventListener('input', (e) => {
      this.canvas.traceState.posX = parseFloat(e.target.value) || 0;
      this.canvas.updateTraceImage();
    });

    numPosY?.addEventListener('input', (e) => {
      this.canvas.traceState.posY = parseFloat(e.target.value) || 0;
      this.canvas.updateTraceImage();
    });

    chkExport?.addEventListener('change', (e) => {
      this.canvas.traceState.includeInExport = e.target.checked;
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });
  }
}
