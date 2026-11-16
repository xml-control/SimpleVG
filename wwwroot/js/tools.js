/**
 * SimpleVG - Drawing Tools & SCADA Symbol Presets
 * Rect, Circle, Line, Polyline (Multi-point click/drag), Freehand Path, Text, and SCADA Pipe/Valve/Lamp/Tank helpers
 */

class ToolManager {
  constructor(canvasInstance, gradientManager) {
    this.canvas = canvasInstance;
    this.gradients = gradientManager;
    this.activeTool = 'select';

    this.isDrawing = false;
    this.currentShape = null;
    this.startX = 0;
    this.startY = 0;
    this.pointsList = [];
    this.bezierNodes = [];
    this.isDraggingControlHandle = false;

    this.init();
  }

  init() {
    this.bindToolButtons();
    this.bindDrawingEvents();
    this.bindPresetButtons();
    this.bindAccordionToggles();
  }

  bindAccordionToggles() {
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const targetSection = header.closest('.tool-accordion-section');
        if (!targetSection) return;

        const isCurrentlyCollapsed = targetSection.classList.contains('collapsed');

        // Collapse all other library sections (exclusive accordion mode)
        document.querySelectorAll('.tool-accordion-section').forEach(sec => {
          // Keep SELECTION section visible, collapse all other category sections
          if (sec !== targetSection && !sec.classList.contains('static-section')) {
            sec.classList.add('collapsed');
          }
        });

        // Toggle target section
        if (isCurrentlyCollapsed) {
          targetSection.classList.remove('collapsed');
        } else {
          targetSection.classList.add('collapsed');
        }
      });
    });
  }

  setActiveTool(toolName) {
    this.activeTool = toolName;
    this.canvas.activeTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
    this.canvas.svg.style.cursor = toolName === 'select' ? 'default' : (toolName === 'pan' ? 'grab' : 'crosshair');
  }

  bindToolButtons() {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setActiveTool(btn.dataset.tool);
      });
    });
  }

  bindDrawingEvents() {
    const svg = this.canvas.svg;

    svg.addEventListener('mousedown', (e) => {
      if (this.activeTool === 'select' || this.activeTool === 'pan') return;

      const coords = this.canvas.getPointerCoords(e);
      const snapX = this.canvas.snap(coords.x);
      const snapY = this.canvas.snap(coords.y);

      if (this.activeTool === 'polyline') {
        if (!this.isDrawing) {
          this.isDrawing = true;
          this.pointsList = [`${snapX},${snapY}`];
          this.currentShape = this.createShape('polyline', snapX, snapY);
          this.canvas.stage.appendChild(this.currentShape);
        } else {
          this.pointsList.push(`${snapX},${snapY}`);
          this.currentShape.setAttribute('points', this.pointsList.join(' '));
        }
        return;
      }

      if (this.activeTool === 'bezier') {
        if (!this.isDrawing) {
          this.isDrawing = true;
          this.bezierNodes = [{ x: snapX, y: snapY, cp1: { x: snapX, y: snapY }, cp2: { x: snapX, y: snapY } }];
          this.currentShape = this.createShape('bezier', snapX, snapY);
          this.canvas.stage.appendChild(this.currentShape);
        } else {
          this.bezierNodes.push({ x: snapX, y: snapY, cp1: { x: snapX, y: snapY }, cp2: { x: snapX, y: snapY } });
          this.currentShape.setAttribute('d', this.buildBezierPathD(this.bezierNodes));
        }
        this.isDraggingControlHandle = true;
        return;
      }

      this.startX = snapX;
      this.startY = snapY;
      this.isDrawing = true;

      if (this.activeTool === 'path') {
        this.pointsList = [`M ${coords.x} ${coords.y}`];
      }

      this.currentShape = this.createShape(this.activeTool, this.startX, this.startY);
      if (this.currentShape) {
        this.canvas.stage.appendChild(this.currentShape);
      }
    });

    svg.addEventListener('mousemove', (e) => {
      if (!this.isDrawing || !this.currentShape) return;

      const coords = this.canvas.getPointerCoords(e);

      if (this.activeTool === 'polyline') {
        const tempPoints = [...this.pointsList, `${this.canvas.snap(coords.x)},${this.canvas.snap(coords.y)}`].join(' ');
        this.currentShape.setAttribute('points', tempPoints);
        return;
      }

      if (this.activeTool === 'bezier') {
        if (this.isDraggingControlHandle && this.bezierNodes.length > 0) {
          const activeNode = this.bezierNodes[this.bezierNodes.length - 1];
          const dx = coords.x - activeNode.x;
          const dy = coords.y - activeNode.y;
          activeNode.cp2 = { x: activeNode.x + dx, y: activeNode.y + dy };
          activeNode.cp1 = { x: activeNode.x - dx, y: activeNode.y - dy };
          this.currentShape.setAttribute('d', this.buildBezierPathD(this.bezierNodes));
          this.renderLiveBezierHandles(this.bezierNodes);
        } else {
          const snapX = this.canvas.snap(coords.x);
          const snapY = this.canvas.snap(coords.y);
          this.currentShape.setAttribute('d', this.buildBezierPathD(this.bezierNodes, { x: snapX, y: snapY }));
        }
        return;
      }

      if (this.activeTool === 'path') {
        this.pointsList.push(`L ${coords.x} ${coords.y}`);
        this.currentShape.setAttribute('d', this.pointsList.join(' '));
        return;
      }

      const currentX = this.canvas.snap(coords.x);
      const currentY = this.canvas.snap(coords.y);
      this.lastMouseX = currentX;
      this.lastMouseY = currentY;

      this.updateShape(this.activeTool, this.currentShape, this.startX, this.startY, currentX, currentY, e);
    });

    window.addEventListener('keydown', (e) => {
      if (this.isDrawing && this.activeTool === 'arc' && this.currentShape) {
        if (e.key === 'Shift' || e.key === 'Alt') {
          this.updateShape('arc', this.currentShape, this.startX, this.startY, this.lastMouseX, this.lastMouseY, e);
        }
      }
      // Enter or Escape key to finish multi-point drawing (polyline / bezier)
      if ((e.key === 'Enter' || e.key === 'Escape') && this.isDrawing && (this.activeTool === 'polyline' || this.activeTool === 'bezier') && this.currentShape) {
        this.isDrawing = false;
        this.isDraggingControlHandle = false;
        if (this.activeTool === 'bezier') {
          this.currentShape.setAttribute('d', this.buildBezierPathD(this.bezierNodes));
          this.canvas.selectionLayer.innerHTML = '';
        }
        this.canvas.selectElement(this.currentShape);
        this.currentShape = null;
        this.pointsList = [];
        this.bezierNodes = [];
        if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
        this.setActiveTool('select');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.isDrawing && this.activeTool === 'arc' && this.currentShape) {
        if (e.key === 'Shift' || e.key === 'Alt') {
          this.updateShape('arc', this.currentShape, this.startX, this.startY, this.lastMouseX, this.lastMouseY, e);
        }
      }
    });

    // Double click to finish Polyline & Bézier Pen
    svg.addEventListener('dblclick', (e) => {
      if ((this.activeTool === 'polyline' || this.activeTool === 'bezier') && this.isDrawing && this.currentShape) {
        this.isDrawing = false;
        this.isDraggingControlHandle = false;
        if (this.activeTool === 'bezier') {
          this.currentShape.setAttribute('d', this.buildBezierPathD(this.bezierNodes));
          this.canvas.selectionLayer.innerHTML = '';
        }
        this.canvas.selectElement(this.currentShape);
        this.currentShape = null;
        this.pointsList = [];
        this.bezierNodes = [];
        if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
        this.setActiveTool('select');
      }
    });

    svg.addEventListener('mouseup', () => {
      if (this.activeTool === 'bezier') {
        this.isDraggingControlHandle = false;
        return;
      }
      if (this.activeTool === 'polyline') return; // Handled on dblclick / Enter

      if (this.isDrawing && this.currentShape) {
        this.isDrawing = false;
        this.canvas.selectElement(this.currentShape);
        this.currentShape = null;
        this.pointsList = [];
        if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
        this.setActiveTool('select');
      }
    });
  }

  buildBezierPathD(nodes, previewPt = null) {
    if (!nodes || nodes.length === 0) return '';
    let d = `M ${nodes[0].x} ${nodes[0].y}`;
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      d += ` C ${prev.cp2.x} ${prev.cp2.y} ${curr.cp1.x} ${curr.cp1.y} ${curr.x} ${curr.y}`;
    }
    if (previewPt) {
      const last = nodes[nodes.length - 1];
      d += ` C ${last.cp2.x} ${last.cp2.y} ${previewPt.x} ${previewPt.y} ${previewPt.x} ${previewPt.y}`;
    }
    return d;
  }

  renderLiveBezierHandles(nodes) {
    this.canvas.selectionLayer.innerHTML = '';
    const ns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(ns, "g");

    nodes.forEach((node, idx) => {
      const anchor = document.createElementNS(ns, "circle");
      anchor.setAttribute("cx", node.x);
      anchor.setAttribute("cy", node.y);
      anchor.setAttribute("r", "5");
      anchor.setAttribute("fill", "#805AD5");
      anchor.setAttribute("stroke", "#FFFFFF");
      anchor.setAttribute("stroke-width", "1.5");
      g.appendChild(anchor);

      if (idx === nodes.length - 1 && (node.cp1.x !== node.x || node.cp1.y !== node.y)) {
        const l1 = document.createElementNS(ns, "line");
        l1.setAttribute("x1", node.x); l1.setAttribute("y1", node.y);
        l1.setAttribute("x2", node.cp1.x); l1.setAttribute("y2", node.cp1.y);
        l1.setAttribute("stroke", "#805AD5"); l1.setAttribute("stroke-width", "1.5");
        l1.setAttribute("stroke-dasharray", "3,3");
        g.appendChild(l1);

        const d1 = document.createElementNS(ns, "circle");
        d1.setAttribute("cx", node.cp1.x); d1.setAttribute("cy", node.cp1.y);
        d1.setAttribute("r", "4"); d1.setAttribute("fill", "#D6BCFA");
        d1.setAttribute("stroke", "#805AD5"); d1.setAttribute("stroke-width", "1.5");
        g.appendChild(d1);

        const l2 = document.createElementNS(ns, "line");
        l2.setAttribute("x1", node.x); l2.setAttribute("y1", node.y);
        l2.setAttribute("x2", node.cp2.x); l2.setAttribute("y2", node.cp2.y);
        l2.setAttribute("stroke", "#805AD5"); l2.setAttribute("stroke-width", "1.5");
        l2.setAttribute("stroke-dasharray", "3,3");
        g.appendChild(l2);

        const d2 = document.createElementNS(ns, "circle");
        d2.setAttribute("cx", node.cp2.x); d2.setAttribute("cy", node.cp2.y);
        d2.setAttribute("r", "4"); d2.setAttribute("fill", "#D6BCFA");
        d2.setAttribute("stroke", "#805AD5"); d2.setAttribute("stroke-width", "1.5");
        g.appendChild(d2);
      }
    });

    this.canvas.selectionLayer.appendChild(g);
  }

  getDefaultShapeStyles(isClosedShape = true) {
    const isIsaGray = document.getElementById('chk-isa-gray-on-drop')?.checked;
    if (isIsaGray) {
      return {
        fill: isClosedShape ? "#718096" : "none",
        stroke: "#1A202C",
        strokeWidth: "2"
      };
    }

    const defaultFill = document.getElementById('canvas-default-fill')?.value || "#3182CE";
    const defaultStroke = document.getElementById('canvas-default-stroke')?.value || "#2D3748";
    const defaultWidth = document.getElementById('canvas-default-stroke-width')?.value || "2";

    return {
      fill: isClosedShape ? defaultFill : "none",
      stroke: defaultStroke,
      strokeWidth: defaultWidth
    };
  }

  createShape(tool, x, y) {
    const ns = "http://www.w3.org/2000/svg";
    let el = null;
    const closedStyles = this.getDefaultShapeStyles(true);
    const openStyles = this.getDefaultShapeStyles(false);

    switch (tool) {
      case 'rect':
        el = document.createElementNS(ns, "rect");
        el.setAttribute("x", x);
        el.setAttribute("y", y);
        el.setAttribute("width", 0);
        el.setAttribute("height", 0);
        el.setAttribute("fill", closedStyles.fill);
        el.setAttribute("stroke", closedStyles.stroke);
        el.setAttribute("stroke-width", closedStyles.strokeWidth);
        break;

      case 'circle':
        el = document.createElementNS(ns, "ellipse");
        el.setAttribute("cx", x);
        el.setAttribute("cy", y);
        el.setAttribute("rx", 0);
        el.setAttribute("ry", 0);
        el.setAttribute("fill", closedStyles.fill);
        el.setAttribute("stroke", closedStyles.stroke);
        el.setAttribute("stroke-width", closedStyles.strokeWidth);
        break;

      case 'line':
        el = document.createElementNS(ns, "line");
        el.setAttribute("x1", x);
        el.setAttribute("y1", y);
        el.setAttribute("x2", x);
        el.setAttribute("y2", y);
        el.setAttribute("stroke", openStyles.stroke);
        el.setAttribute("stroke-width", Math.max(2, parseInt(openStyles.strokeWidth, 10)));
        break;

      case 'polyline':
        el = document.createElementNS(ns, "polyline");
        el.setAttribute("points", `${x},${y}`);
        el.setAttribute("fill", openStyles.fill);
        el.setAttribute("stroke", openStyles.stroke);
        el.setAttribute("stroke-width", openStyles.strokeWidth);
        break;

      case 'polygon':
        el = document.createElementNS(ns, "polygon");
        el.setAttribute("data-shape-type", "polygon");
        el.setAttribute("data-sides", "3");
        el.setAttribute("points", generatePolygonPoints(x, y, 0, 0, 3));
        el.setAttribute("fill", closedStyles.fill);
        el.setAttribute("stroke", closedStyles.stroke);
        el.setAttribute("stroke-width", closedStyles.strokeWidth);
        break;

      case 'star':
        el = document.createElementNS(ns, "polygon");
        el.setAttribute("data-shape-type", "star");
        el.setAttribute("data-sides", "5");
        el.setAttribute("data-inner-ratio", "0.4");
        el.setAttribute("points", generateStarPoints(x, y, 0, 0, 5, 0.4));
        el.setAttribute("fill", closedStyles.fill);
        el.setAttribute("stroke", closedStyles.stroke);
        el.setAttribute("stroke-width", closedStyles.strokeWidth);
        break;

      case 'arrow':
        el = document.createElementNS(ns, "line");
        el.setAttribute("x1", x);
        el.setAttribute("y1", y);
        el.setAttribute("x2", x);
        el.setAttribute("y2", y);
        el.setAttribute("stroke", openStyles.stroke);
        el.setAttribute("stroke-width", openStyles.strokeWidth);
        el.setAttribute("marker-end", "url(#marker-arrow-end)");
        break;

      case 'arc':
        el = document.createElementNS(ns, "path");
        el.setAttribute("d", `M ${x} ${y} A 0 0 0 0 1 ${x} ${y}`);
        el.setAttribute("fill", openStyles.fill);
        el.setAttribute("stroke", openStyles.stroke);
        el.setAttribute("stroke-width", openStyles.strokeWidth);
        el.setAttribute("stroke-linecap", "round");
        break;

      case 'bezier':
        el = document.createElementNS(ns, "path");
        el.setAttribute("data-shape-type", "bezier");
        el.setAttribute("d", `M ${x} ${y}`);
        el.setAttribute("fill", openStyles.fill);
        el.setAttribute("stroke", openStyles.stroke);
        el.setAttribute("stroke-width", openStyles.strokeWidth);
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-linejoin", "round");
        break;

      case 'path':
        el = document.createElementNS(ns, "path");
        el.setAttribute("d", `M ${x} ${y}`);
        el.setAttribute("fill", openStyles.fill);
        el.setAttribute("stroke", openStyles.stroke);
        el.setAttribute("stroke-width", openStyles.strokeWidth);
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-linejoin", "round");
        break;

      case 'text':
        el = document.createElementNS(ns, "text");
        el.setAttribute("x", x);
        el.setAttribute("y", y);
        el.setAttribute("font-family", "Inter, sans-serif");
        el.setAttribute("font-size", "24");
        el.setAttribute("fill", openStyles.stroke);
        el.textContent = "SCADA Tag Label";
        break;
    }
    return el;
  }

  updateShape(tool, el, startX, startY, curX, curY, evt = null) {
    const width = Math.abs(curX - startX);
    const height = Math.abs(curY - startY);
    const left = Math.min(startX, curX);
    const top = Math.min(startY, curY);

    switch (tool) {
      case 'rect':
        el.setAttribute("x", left);
        el.setAttribute("y", top);
        el.setAttribute("width", width);
        el.setAttribute("height", height);
        break;
      case 'circle':
        el.setAttribute("cx", startX);
        el.setAttribute("cy", startY);
        el.setAttribute("rx", width);
        el.setAttribute("ry", height);
        break;
      case 'line':
      case 'arrow':
        el.setAttribute("x2", curX);
        el.setAttribute("y2", curY);
        break;
      case 'polygon': {
        const sides = parseInt(el.getAttribute("data-sides") || "3", 10);
        const rx = width / 2;
        const ry = height / 2;
        const cx = left + rx;
        const cy = top + ry;
        el.setAttribute("points", generatePolygonPoints(cx, cy, rx, ry, sides));
        break;
      }
      case 'star': {
        const points = parseInt(el.getAttribute("data-sides") || "5", 10);
        const innerRatio = parseFloat(el.getAttribute("data-inner-ratio") || "0.4");
        const rx = width / 2;
        const ry = height / 2;
        const cx = left + rx;
        const cy = top + ry;
        el.setAttribute("points", generateStarPoints(cx, cy, rx, ry, points, innerRatio));
        break;
      }
      case 'arc': {
        const L = Math.hypot(curX - startX, curY - startY);
        if (L < 1) {
          el.setAttribute("d", `M ${startX} ${startY} A 0 0 0 0 1 ${curX} ${curY}`);
          break;
        }

        const is3PointMode = evt ? evt.shiftKey : false;
        const isFlippedSweep = evt ? evt.altKey : false;

        if (is3PointMode) {
          // CAD 3-Point Arc Mode (Shift key): calculate circumcircle radius R and arc flags
          const h = (width > height ? height : width) * (curY >= startY ? 1 : -1);
          const absH = Math.max(1, Math.abs(h));
          const R = ((L * L / 4) + (absH * absH)) / (2 * absH);
          const baseSweep = h >= 0 ? 1 : 0;
          const sweepFlag = isFlippedSweep ? (baseSweep === 1 ? 0 : 1) : baseSweep;
          const largeArcFlag = absH > (L / 2) ? 1 : 0;

          el.setAttribute("d", `M ${startX} ${startY} A ${R.toFixed(1)} ${R.toFixed(1)} 0 ${largeArcFlag} ${sweepFlag} ${curX} ${curY}`);
        } else {
          // Standard Elliptical Sweep Arc Mode (Alt key flips sweep side)
          const rx = Math.max(1, width);
          const ry = Math.max(1, height);
          let baseSweep = (curX >= startX) ? 1 : 0;
          const sweepFlag = isFlippedSweep ? (baseSweep === 1 ? 0 : 1) : baseSweep;
          el.setAttribute("d", `M ${startX} ${startY} A ${rx} ${ry} 0 0 ${sweepFlag} ${curX} ${curY}`);
        }
        break;
      }
    }
  }

  bindPresetButtons() {
    document.getElementById('preset-pipe')?.addEventListener('click', () => {
      const stops = this.gradients.getPresetStops('metal');
      const gradUrl = this.gradients.createLinearGradient(stops, 90);

      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-pipe");
      g.setAttribute("id", `pipe_${Date.now().toString().slice(-4)}`);

      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", "100");
      rect.setAttribute("y", "200");
      rect.setAttribute("width", "300");
      rect.setAttribute("height", "40");
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", gradUrl);
      rect.setAttribute("stroke", "#2D3748");
      rect.setAttribute("stroke-width", "2");

      g.appendChild(rect);
      this.canvas.addElement(g);
    });

    // 90° Pipe Elbow Preset
    document.getElementById('preset-elbow')?.addEventListener('click', () => {
      const stops = this.gradients.getPresetStops('metal');
      const gradUrl = this.gradients.createLinearGradient(stops, 45);

      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-elbow");
      g.setAttribute("id", `elbow_${Date.now().toString().slice(-4)}`);

      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M 100 150 L 160 150 A 40 40 0 0 0 200 110 L 200 50");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", gradUrl);
      path.setAttribute("stroke-width", "40");
      path.setAttribute("stroke-linecap", "square");

      g.appendChild(path);
      this.canvas.addElement(g);
    });

    // Pipe Tee Junction Preset
    document.getElementById('preset-tee')?.addEventListener('click', () => {
      const stops = this.gradients.getPresetStops('metal');
      const horizGrad = this.gradients.createLinearGradient(stops, 90);
      const vertGrad = this.gradients.createLinearGradient(stops, 0);

      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-tee");
      g.setAttribute("id", `tee_${Date.now().toString().slice(-4)}`);

      // Horizontal Main Pipe
      const hPipe = document.createElementNS(ns, "rect");
      hPipe.setAttribute("x", "100");
      hPipe.setAttribute("y", "180");
      hPipe.setAttribute("width", "200");
      hPipe.setAttribute("height", "40");
      hPipe.setAttribute("fill", horizGrad);
      hPipe.setAttribute("stroke", "#2D3748");
      hPipe.setAttribute("stroke-width", "2");

      // Vertical Branch Pipe
      const vPipe = document.createElementNS(ns, "rect");
      vPipe.setAttribute("x", "180");
      vPipe.setAttribute("y", "220");
      vPipe.setAttribute("width", "40");
      vPipe.setAttribute("height", "100");
      vPipe.setAttribute("fill", vertGrad);
      vPipe.setAttribute("stroke", "#2D3748");
      vPipe.setAttribute("stroke-width", "2");

      g.appendChild(hPipe);
      g.appendChild(vPipe);
      this.canvas.addElement(g);
    });

    // Pipe Flange Joint Preset
    document.getElementById('preset-flange')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-flange");
      g.setAttribute("id", `flange_${Date.now().toString().slice(-4)}`);

      // Left Ring
      const ring1 = document.createElementNS(ns, "rect");
      ring1.setAttribute("x", "185");
      ring1.setAttribute("y", "170");
      ring1.setAttribute("width", "12");
      ring1.setAttribute("height", "60");
      ring1.setAttribute("rx", "2");
      ring1.setAttribute("fill", "#718096");
      ring1.setAttribute("stroke", "#1A202C");
      ring1.setAttribute("stroke-width", "2");

      // Right Ring
      const ring2 = document.createElementNS(ns, "rect");
      ring2.setAttribute("x", "203");
      ring2.setAttribute("y", "170");
      ring2.setAttribute("width", "12");
      ring2.setAttribute("height", "60");
      ring2.setAttribute("rx", "2");
      ring2.setAttribute("fill", "#718096");
      ring2.setAttribute("stroke", "#1A202C");
      ring2.setAttribute("stroke-width", "2");

      // Gasket Center
      const gasket = document.createElementNS(ns, "rect");
      gasket.setAttribute("x", "197");
      gasket.setAttribute("y", "174");
      gasket.setAttribute("width", "6");
      gasket.setAttribute("height", "52");
      gasket.setAttribute("fill", "#E53E3E");

      g.appendChild(ring1);
      g.appendChild(ring2);
      g.appendChild(gasket);
      this.canvas.addElement(g);
    });
    // Helper to check if ISA-101 Gray on drop is enabled
    const getSymbolColors = (defaultBody, defaultNozzle = defaultBody) => {
      const isIsaGray = document.getElementById('chk-isa-gray-on-drop')?.checked;
      if (isIsaGray) {
        return { body: "#718096", nozzle: "#A0AEC0", stroke: "#1A202C" };
      }
      return { body: defaultBody, nozzle: defaultNozzle, stroke: "#1A202C" };
    };

    // Centrifugal Pump Preset
    document.getElementById('preset-pump')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-pump scada-status-running");
      g.setAttribute("id", `pump_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#38A169", "#2F855A");

      // Pump Casing Volute (Main Circle)
      const casing = document.createElementNS(ns, "circle");
      casing.setAttribute("cx", "200");
      casing.setAttribute("cy", "200");
      casing.setAttribute("r", "50");
      casing.setAttribute("fill", cols.body);
      casing.setAttribute("stroke", cols.stroke);
      casing.setAttribute("stroke-width", "3");

      // Tangent Outlet Discharge Nozzle (Top-Right Flange)
      const nozzle = document.createElementNS(ns, "polygon");
      nozzle.setAttribute("points", "200,150 250,150 250,200 200,200");
      nozzle.setAttribute("fill", cols.nozzle);
      nozzle.setAttribute("stroke", cols.stroke);
      nozzle.setAttribute("stroke-width", "2");

      // Suction Inlet / Shaft Eye
      const eye = document.createElementNS(ns, "circle");
      eye.setAttribute("cx", "200");
      eye.setAttribute("cy", "200");
      eye.setAttribute("r", "16");
      eye.setAttribute("fill", "#E2E8F0");
      eye.setAttribute("stroke", "#1A202C");
      eye.setAttribute("stroke-width", "2");

      // Base Support Feet
      const base = document.createElementNS(ns, "rect");
      base.setAttribute("x", "170");
      base.setAttribute("y", "250");
      base.setAttribute("width", "60");
      base.setAttribute("height", "10");
      base.setAttribute("fill", "#4A5568");
      base.setAttribute("stroke", "#1A202C");
      base.setAttribute("stroke-width", "2");

      g.appendChild(nozzle);
      g.appendChild(casing);
      g.appendChild(eye);
      g.appendChild(base);
      this.canvas.addElement(g);
    });

    // AC Motor Preset
    document.getElementById('preset-motor')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-motor scada-status-running");
      g.setAttribute("id", `motor_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#3182CE", "#2B6CB0");

      // Drive Shaft
      const shaft = document.createElementNS(ns, "rect");
      shaft.setAttribute("x", "130");
      shaft.setAttribute("y", "190");
      shaft.setAttribute("width", "35");
      shaft.setAttribute("height", "20");
      shaft.setAttribute("fill", "#A0AEC0");
      shaft.setAttribute("stroke", cols.stroke);
      shaft.setAttribute("stroke-width", "2");

      // Motor Body Block
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "160");
      body.setAttribute("y", "160");
      body.setAttribute("width", "110");
      body.setAttribute("height", "80");
      body.setAttribute("rx", "6");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", cols.stroke);
      body.setAttribute("stroke-width", "3");

      // Motor Cooling Fin Lines
      for (let x = 180; x <= 240; x += 15) {
        const fin = document.createElementNS(ns, "line");
        fin.setAttribute("x1", x.toString());
        fin.setAttribute("y1", "160");
        fin.setAttribute("x2", x.toString());
        fin.setAttribute("y2", "240");
        fin.setAttribute("stroke", cols.nozzle);
        fin.setAttribute("stroke-width", "2");
        g.appendChild(fin);
      }

      // Motor Terminal Box (Top)
      const termBox = document.createElementNS(ns, "rect");
      termBox.setAttribute("x", "195");
      termBox.setAttribute("y", "145");
      termBox.setAttribute("width", "40");
      termBox.setAttribute("height", "15");
      termBox.setAttribute("rx", "2");
      termBox.setAttribute("fill", cols.nozzle);
      termBox.setAttribute("stroke", cols.stroke);
      termBox.setAttribute("stroke-width", "2");

      // Motor "M" Designation Tag
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", "215");
      text.setAttribute("y", "212");
      text.setAttribute("fill", "#FFFFFF");
      text.setAttribute("font-size", "34");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("text-anchor", "middle");
      text.textContent = "M";

      g.appendChild(shaft);
      g.appendChild(body);
      g.appendChild(termBox);
      g.appendChild(text);
      this.canvas.addElement(g);
    });

    // Tank Agitator Preset
    document.getElementById('preset-agitator')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-agitator");
      g.setAttribute("id", `agitator_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#DD6B20");

      // Top Motor Box
      const motor = document.createElementNS(ns, "rect");
      motor.setAttribute("x", "180");
      motor.setAttribute("y", "100");
      motor.setAttribute("width", "40");
      motor.setAttribute("height", "30");
      motor.setAttribute("rx", "3");
      motor.setAttribute("fill", "#4A5568");
      motor.setAttribute("stroke", "#1A202C");
      motor.setAttribute("stroke-width", "2");

      // Vertical Shaft
      const shaft = document.createElementNS(ns, "line");
      shaft.setAttribute("x1", "200");
      shaft.setAttribute("y1", "130");
      shaft.setAttribute("x2", "200");
      shaft.setAttribute("y2", "240");
      shaft.setAttribute("stroke", "#718096");
      shaft.setAttribute("stroke-width", "6");

      // Impeller Blade Left
      const blade1 = document.createElementNS(ns, "polygon");
      blade1.setAttribute("points", "200,240 160,225 160,255");
      blade1.setAttribute("fill", cols.body);
      blade1.setAttribute("stroke", "#1A202C");
      blade1.setAttribute("stroke-width", "2");

      // Impeller Blade Right
      const blade2 = document.createElementNS(ns, "polygon");
      blade2.setAttribute("points", "200,240 240,225 240,255");
      blade2.setAttribute("fill", cols.body);
      blade2.setAttribute("stroke", "#1A202C");
      blade2.setAttribute("stroke-width", "2");

      g.appendChild(shaft);
      g.appendChild(motor);
      g.appendChild(blade1);
      g.appendChild(blade2);
      this.canvas.addElement(g);
    });

    // Blower Fan Preset
    document.getElementById('preset-blower')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-blower");
      g.setAttribute("id", `blower_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#3182CE");

      // Outer Fan Housing
      const housing = document.createElementNS(ns, "circle");
      housing.setAttribute("cx", "200");
      housing.setAttribute("cy", "200");
      housing.setAttribute("r", "50");
      housing.setAttribute("fill", "#F7FAFC");
      housing.setAttribute("stroke", "#2D3748");
      housing.setAttribute("stroke-width", "4");

      g.appendChild(housing);

      // 4 Solid Teardrop Fan Blades
      const bladePaths = [
        "M 200 200 C 180 160 210 150 200 150 C 190 150 200 180 200 200", // Top
        "M 200 200 C 240 180 250 210 250 200 C 250 190 220 200 200 200", // Right
        "M 200 200 C 220 240 190 250 200 250 C 210 250 200 220 200 200", // Bottom
        "M 200 200 C 160 220 150 190 150 200 C 150 210 180 200 200 200"  // Left
      ];

      bladePaths.forEach(d => {
        const blade = document.createElementNS(ns, "path");
        blade.setAttribute("d", d);
        blade.setAttribute("fill", cols.body);
        blade.setAttribute("stroke", "#1A365D");
        blade.setAttribute("stroke-width", "2");
        g.appendChild(blade);
      });

      // Center Hub Cap
      const cap = document.createElementNS(ns, "circle");
      cap.setAttribute("cx", "200");
      cap.setAttribute("cy", "200");
      cap.setAttribute("r", "14");
      cap.setAttribute("fill", cols.nozzle);
      cap.setAttribute("stroke", "#1A202C");
      cap.setAttribute("stroke-width", "2");

      g.appendChild(cap);
      this.canvas.addElement(g);
    });

    document.getElementById('preset-valve')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-valve");
      g.setAttribute("id", `valve_${Date.now().toString().slice(-4)}`);

      const poly1 = document.createElementNS(ns, "polygon");
      poly1.setAttribute("points", "100,100 150,125 100,150");
      poly1.setAttribute("fill", "#718096");
      poly1.setAttribute("stroke", "#1A202C");
      poly1.setAttribute("stroke-width", "2");

      const poly2 = document.createElementNS(ns, "polygon");
      poly2.setAttribute("points", "200,100 150,125 200,150");
      poly2.setAttribute("fill", "#718096");
      poly2.setAttribute("stroke", "#1A202C");
      poly2.setAttribute("stroke-width", "2");

      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", "150");
      line.setAttribute("y1", "125");
      line.setAttribute("x2", "150");
      line.setAttribute("y2", "85");
      line.setAttribute("stroke", "#1A202C");
      line.setAttribute("stroke-width", "3");

      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", "150");
      circle.setAttribute("cy", "80");
      circle.setAttribute("r", "12");
      circle.setAttribute("fill", "#E53E3E");
      circle.setAttribute("stroke", "#1A202C");
      circle.setAttribute("stroke-width", "2");

      g.appendChild(poly1);
      g.appendChild(poly2);
      g.appendChild(line);
      g.appendChild(circle);
      this.canvas.addElement(g);
    });

    // Green Pilot Light Preset (Running/Normal)
    document.getElementById('preset-lamp')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-lamp-green");
      g.setAttribute("id", `lamp_green_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#38A169", "#48BB78");

      // Outer Bezel Ring
      const bezelOuter = document.createElementNS(ns, "circle");
      bezelOuter.setAttribute("cx", "200"); bezelOuter.setAttribute("cy", "200");
      bezelOuter.setAttribute("r", "28");
      bezelOuter.setAttribute("fill", "#2D3748");
      bezelOuter.setAttribute("stroke", "#1A202C"); bezelOuter.setAttribute("stroke-width", "3");

      const bezelInner = document.createElementNS(ns, "circle");
      bezelInner.setAttribute("cx", "200"); bezelInner.setAttribute("cy", "200");
      bezelInner.setAttribute("r", "24");
      bezelInner.setAttribute("fill", "#CBD5E0");
      bezelInner.setAttribute("stroke", "#718096");

      // Lens Circle
      const lens = document.createElementNS(ns, "circle");
      lens.setAttribute("cx", "200"); lens.setAttribute("cy", "200");
      lens.setAttribute("r", "20");
      lens.setAttribute("fill", cols.body);
      lens.setAttribute("stroke", "#1C4532"); lens.setAttribute("stroke-width", "2");

      // Traditional Filament Cross lines (X symbol)
      const f1 = document.createElementNS(ns, "line");
      f1.setAttribute("x1", "188"); f1.setAttribute("y1", "188");
      f1.setAttribute("x2", "212"); f1.setAttribute("y2", "212");
      f1.setAttribute("stroke", "#1C4532"); f1.setAttribute("stroke-width", "2");

      const f2 = document.createElementNS(ns, "line");
      f2.setAttribute("x1", "188"); f2.setAttribute("y1", "212");
      f2.setAttribute("x2", "212"); f2.setAttribute("y2", "188");
      f2.setAttribute("stroke", "#1C4532"); f2.setAttribute("stroke-width", "2");

      const glassReflection = document.createElementNS(ns, "circle");
      glassReflection.setAttribute("cx", "193"); glassReflection.setAttribute("cy", "193");
      glassReflection.setAttribute("r", "8");
      glassReflection.setAttribute("fill", cols.nozzle); glassReflection.setAttribute("opacity", "0.6");

      g.appendChild(bezelOuter);
      g.appendChild(bezelInner);
      g.appendChild(lens);
      g.appendChild(f1); g.appendChild(f2);
      g.appendChild(glassReflection);
      this.canvas.addElement(g);
    });

    // Red Alarm Light Preset (Stop/Fault)
    document.getElementById('preset-lamp-red')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-lamp-red");
      g.setAttribute("id", `lamp_red_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E53E3E", "#FEB2B2");

      const bezelOuter = document.createElementNS(ns, "circle");
      bezelOuter.setAttribute("cx", "200"); bezelOuter.setAttribute("cy", "200");
      bezelOuter.setAttribute("r", "28");
      bezelOuter.setAttribute("fill", "#2D3748");
      bezelOuter.setAttribute("stroke", "#1A202C"); bezelOuter.setAttribute("stroke-width", "3");

      const bezelInner = document.createElementNS(ns, "circle");
      bezelInner.setAttribute("cx", "200"); bezelInner.setAttribute("cy", "200");
      bezelInner.setAttribute("r", "24");
      bezelInner.setAttribute("fill", "#CBD5E0");
      bezelInner.setAttribute("stroke", "#718096");

      const lens = document.createElementNS(ns, "circle");
      lens.setAttribute("cx", "200"); lens.setAttribute("cy", "200");
      lens.setAttribute("r", "20");
      lens.setAttribute("fill", cols.body);
      lens.setAttribute("stroke", "#9B2C2C"); lens.setAttribute("stroke-width", "2");

      const f1 = document.createElementNS(ns, "line");
      f1.setAttribute("x1", "188"); f1.setAttribute("y1", "188");
      f1.setAttribute("x2", "212"); f1.setAttribute("y2", "212");
      f1.setAttribute("stroke", "#9B2C2C"); f1.setAttribute("stroke-width", "2");

      const f2 = document.createElementNS(ns, "line");
      f2.setAttribute("x1", "188"); f2.setAttribute("y1", "212");
      f2.setAttribute("x2", "212"); f2.setAttribute("y2", "188");
      f2.setAttribute("stroke", "#9B2C2C"); f2.setAttribute("stroke-width", "2");

      const glassReflection = document.createElementNS(ns, "circle");
      glassReflection.setAttribute("cx", "193"); glassReflection.setAttribute("cy", "193");
      glassReflection.setAttribute("r", "8");
      glassReflection.setAttribute("fill", cols.nozzle); glassReflection.setAttribute("opacity", "0.6");

      g.appendChild(bezelOuter);
      g.appendChild(bezelInner);
      g.appendChild(lens);
      g.appendChild(f1); g.appendChild(f2);
      g.appendChild(glassReflection);
      this.canvas.addElement(g);
    });

    // Amber Warning Light Preset (Caution/Alert)
    document.getElementById('preset-lamp-amber')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-lamp-amber");
      g.setAttribute("id", `lamp_amber_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#DD6B20", "#F6AD55");

      const bezelOuter = document.createElementNS(ns, "circle");
      bezelOuter.setAttribute("cx", "200"); bezelOuter.setAttribute("cy", "200");
      bezelOuter.setAttribute("r", "28");
      bezelOuter.setAttribute("fill", "#2D3748");
      bezelOuter.setAttribute("stroke", "#1A202C"); bezelOuter.setAttribute("stroke-width", "3");

      const bezelInner = document.createElementNS(ns, "circle");
      bezelInner.setAttribute("cx", "200"); bezelInner.setAttribute("cy", "200");
      bezelInner.setAttribute("r", "24");
      bezelInner.setAttribute("fill", "#CBD5E0");
      bezelInner.setAttribute("stroke", "#718096");

      const lens = document.createElementNS(ns, "circle");
      lens.setAttribute("cx", "200"); lens.setAttribute("cy", "200");
      lens.setAttribute("r", "20");
      lens.setAttribute("fill", cols.body);
      lens.setAttribute("stroke", "#C05621"); lens.setAttribute("stroke-width", "2");

      const f1 = document.createElementNS(ns, "line");
      f1.setAttribute("x1", "188"); f1.setAttribute("y1", "188");
      f1.setAttribute("x2", "212"); f1.setAttribute("y2", "212");
      f1.setAttribute("stroke", "#C05621"); f1.setAttribute("stroke-width", "2");

      const f2 = document.createElementNS(ns, "line");
      f2.setAttribute("x1", "188"); f2.setAttribute("y1", "212");
      f2.setAttribute("x2", "212"); f2.setAttribute("y2", "188");
      f2.setAttribute("stroke", "#C05621"); f2.setAttribute("stroke-width", "2");

      const glassReflection = document.createElementNS(ns, "circle");
      glassReflection.setAttribute("cx", "193"); glassReflection.setAttribute("cy", "193");
      glassReflection.setAttribute("r", "8");
      glassReflection.setAttribute("fill", cols.nozzle); glassReflection.setAttribute("opacity", "0.6");

      g.appendChild(bezelOuter);
      g.appendChild(bezelInner);
      g.appendChild(lens);
      g.appendChild(f1); g.appendChild(f2);
      g.appendChild(glassReflection);
      this.canvas.addElement(g);
    });

    // Blue Pilot Light Preset (Ready/Auto)
    document.getElementById('preset-lamp-blue')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-lamp-blue");
      g.setAttribute("id", `lamp_blue_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#3182CE", "#90CDF4");

      const bezelOuter = document.createElementNS(ns, "circle");
      bezelOuter.setAttribute("cx", "200"); bezelOuter.setAttribute("cy", "200");
      bezelOuter.setAttribute("r", "28");
      bezelOuter.setAttribute("fill", "#2D3748");
      bezelOuter.setAttribute("stroke", "#1A202C"); bezelOuter.setAttribute("stroke-width", "3");

      const bezelInner = document.createElementNS(ns, "circle");
      bezelInner.setAttribute("cx", "200"); bezelInner.setAttribute("cy", "200");
      bezelInner.setAttribute("r", "24");
      bezelInner.setAttribute("fill", "#CBD5E0");
      bezelInner.setAttribute("stroke", "#718096");

      const lens = document.createElementNS(ns, "circle");
      lens.setAttribute("cx", "200"); lens.setAttribute("cy", "200");
      lens.setAttribute("r", "20");
      lens.setAttribute("fill", cols.body);
      lens.setAttribute("stroke", "#2B6CB0"); lens.setAttribute("stroke-width", "2");

      const f1 = document.createElementNS(ns, "line");
      f1.setAttribute("x1", "188"); f1.setAttribute("y1", "188");
      f1.setAttribute("x2", "212"); f1.setAttribute("y2", "212");
      f1.setAttribute("stroke", "#2B6CB0"); f1.setAttribute("stroke-width", "2");

      const f2 = document.createElementNS(ns, "line");
      f2.setAttribute("x1", "188"); f2.setAttribute("y1", "212");
      f2.setAttribute("x2", "212"); f2.setAttribute("y2", "188");
      f2.setAttribute("stroke", "#2B6CB0"); f2.setAttribute("stroke-width", "2");

      const glassReflection = document.createElementNS(ns, "circle");
      glassReflection.setAttribute("cx", "193"); glassReflection.setAttribute("cy", "193");
      glassReflection.setAttribute("r", "8");
      glassReflection.setAttribute("fill", cols.nozzle); glassReflection.setAttribute("opacity", "0.6");

      g.appendChild(bezelOuter);
      g.appendChild(bezelInner);
      g.appendChild(lens);
      g.appendChild(f1); g.appendChild(f2);
      g.appendChild(glassReflection);
      this.canvas.addElement(g);
    });

    // Alarm Beacon Strobe Preset
    document.getElementById('preset-beacon-strobe')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-beacon");
      g.setAttribute("id", `beacon_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E53E3E", "#ECC94B");

      // Base Mounting Socket
      const base = document.createElementNS(ns, "rect");
      base.setAttribute("x", "175"); base.setAttribute("y", "215");
      base.setAttribute("width", "50"); base.setAttribute("height", "25");
      base.setAttribute("rx", "3");
      base.setAttribute("fill", "#1A202C");
      base.setAttribute("stroke", "#4A5568"); base.setAttribute("stroke-width", "2");

      // Fresnel Lens Dome
      const dome = document.createElementNS(ns, "path");
      dome.setAttribute("d", "M 175 215 C 175 160, 225 160, 225 215 Z");
      dome.setAttribute("fill", cols.body);
      dome.setAttribute("stroke", "#9B2C2C"); dome.setAttribute("stroke-width", "3");

      // Fresnel Glass Ridges
      for (let y = 175; y <= 205; y += 10) {
        const ridge = document.createElementNS(ns, "line");
        ridge.setAttribute("x1", "178"); ridge.setAttribute("y1", y.toString());
        ridge.setAttribute("x2", "222"); ridge.setAttribute("y2", y.toString());
        ridge.setAttribute("stroke", "#FEB2B2"); ridge.setAttribute("stroke-width", "1.5");
        g.appendChild(ridge);
      }

      // Radiating Strobe Rays
      const rays = [
        { x1: 200, y1: 145, x2: 200, y2: 132 },
        { x1: 172, y1: 155, x2: 160, y2: 144 },
        { x1: 228, y1: 155, x2: 240, y2: 144 },
        { x1: 158, y1: 185, x2: 144, y2: 180 },
        { x1: 242, y1: 185, x2: 256, y2: 180 }
      ];

      rays.forEach(r => {
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", r.x1.toString()); line.setAttribute("y1", r.y1.toString());
        line.setAttribute("x2", r.x2.toString()); line.setAttribute("y2", r.y2.toString());
        line.setAttribute("stroke", cols.nozzle); line.setAttribute("stroke-width", "2.5");
        line.setAttribute("stroke-linecap", "round");
        g.appendChild(line);
      });

      g.appendChild(base);
      g.appendChild(dome);
      this.canvas.addElement(g);
    });

    // 3-Tier Signal Tower / Stack Light Preset
    document.getElementById('preset-stack-light')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-stack-light");
      g.setAttribute("id", `stack_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#1A202C", "#CBD5E0");

      // Mounting Base & Pole
      const basePed = document.createElementNS(ns, "rect");
      basePed.setAttribute("x", "185"); basePed.setAttribute("y", "240");
      basePed.setAttribute("width", "30"); basePed.setAttribute("height", "25");
      basePed.setAttribute("rx", "2");
      basePed.setAttribute("fill", cols.body);
      basePed.setAttribute("stroke", "#4A5568"); basePed.setAttribute("stroke-width", "2");

      const pole = document.createElementNS(ns, "rect");
      pole.setAttribute("x", "195"); pole.setAttribute("y", "198");
      pole.setAttribute("width", "10"); pole.setAttribute("height", "42");
      pole.setAttribute("fill", "#718096");

      // Housing Enclosure Stack
      const housing = document.createElementNS(ns, "rect");
      housing.setAttribute("x", "180"); housing.setAttribute("y", "80");
      housing.setAttribute("width", "40"); housing.setAttribute("height", "118");
      housing.setAttribute("rx", "4");
      housing.setAttribute("fill", cols.body);
      housing.setAttribute("stroke", "#2D3748"); housing.setAttribute("stroke-width", "3");

      // Top Tier: Red Light
      const redTier = document.createElementNS(ns, "rect");
      redTier.setAttribute("x", "184"); redTier.setAttribute("y", "85");
      redTier.setAttribute("width", "32"); redTier.setAttribute("height", "34");
      redTier.setAttribute("rx", "2");
      redTier.setAttribute("fill", "#E53E3E"); redTier.setAttribute("stroke", "#9B2C2C");

      // Middle Tier: Amber Light
      const amberTier = document.createElementNS(ns, "rect");
      amberTier.setAttribute("x", "184"); amberTier.setAttribute("y", "122");
      amberTier.setAttribute("width", "32"); amberTier.setAttribute("height", "34");
      amberTier.setAttribute("rx", "2");
      amberTier.setAttribute("fill", "#ECC94B"); amberTier.setAttribute("stroke", "#D69E2E");

      // Bottom Tier: Green Light
      const greenTier = document.createElementNS(ns, "rect");
      greenTier.setAttribute("x", "184"); greenTier.setAttribute("y", "159");
      greenTier.setAttribute("width", "32"); greenTier.setAttribute("height", "34");
      greenTier.setAttribute("rx", "2");
      greenTier.setAttribute("fill", "#38A169"); greenTier.setAttribute("stroke", "#276749");

      g.appendChild(basePed);
      g.appendChild(pole);
      g.appendChild(housing);
      g.appendChild(redTier);
      g.appendChild(amberTier);
      g.appendChild(greenTier);
      this.canvas.addElement(g);
    });

    // Flush LED Panel Indicator Preset
    document.getElementById('preset-led-indicator')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-led-indicator");
      g.setAttribute("id", `led_panel_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#1A202C", "#48BB78");

      // Bezel Frame
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "150"); frame.setAttribute("y", "175");
      frame.setAttribute("width", "100"); frame.setAttribute("height", "50");
      frame.setAttribute("rx", "4");
      frame.setAttribute("fill", cols.body);
      frame.setAttribute("stroke", "#4A5568"); frame.setAttribute("stroke-width", "3");

      // Glowing LED Bar
      const ledBar = document.createElementNS(ns, "rect");
      ledBar.setAttribute("x", "160"); ledBar.setAttribute("y", "185");
      ledBar.setAttribute("width", "20"); ledBar.setAttribute("height", "30");
      ledBar.setAttribute("rx", "2");
      ledBar.setAttribute("fill", cols.nozzle);
      ledBar.setAttribute("stroke", "#276749");

      // Status Text
      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "215"); txt.setAttribute("y", "204");
      txt.setAttribute("fill", "#FFFFFF");
      txt.setAttribute("font-size", "13"); txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "RUN";

      g.appendChild(frame);
      g.appendChild(ledBar);
      g.appendChild(txt);
      this.canvas.addElement(g);
    });

    // Annunciator Alarm Tile Preset
    document.getElementById('preset-annunciator-tile')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-annunciator-tile");
      g.setAttribute("id", `annunciator_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#1A202C", "#FEFCBF");

      // Outer Bezel Frame
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "130"); frame.setAttribute("y", "150");
      frame.setAttribute("width", "140"); frame.setAttribute("height", "100");
      frame.setAttribute("rx", "2");
      frame.setAttribute("fill", cols.body);
      frame.setAttribute("stroke", "#4A5568"); frame.setAttribute("stroke-width", "3");

      // Backlit Window Tile
      const tile = document.createElementNS(ns, "rect");
      tile.setAttribute("x", "138"); tile.setAttribute("y", "158");
      tile.setAttribute("width", "124"); tile.setAttribute("height", "84");
      tile.setAttribute("rx", "2");
      tile.setAttribute("fill", cols.nozzle);
      tile.setAttribute("stroke", "#ECC94B"); tile.setAttribute("stroke-width", "2");

      const txt1 = document.createElementNS(ns, "text");
      txt1.setAttribute("x", "200"); txt1.setAttribute("y", "192");
      txt1.setAttribute("fill", "#9C4221");
      txt1.setAttribute("font-size", "13"); txt1.setAttribute("font-weight", "bold");
      txt1.setAttribute("text-anchor", "middle");
      txt1.textContent = "ALARM TRIP";

      const txt2 = document.createElementNS(ns, "text");
      txt2.setAttribute("x", "200"); txt2.setAttribute("y", "215");
      txt2.setAttribute("fill", "#C05621");
      txt2.setAttribute("font-size", "10"); txt2.setAttribute("font-weight", "bold");
      txt2.setAttribute("text-anchor", "middle");
      txt2.textContent = "HIGH TEMP";

      g.appendChild(frame);
      g.appendChild(tile);
      g.appendChild(txt1);
      g.appendChild(txt2);
      this.canvas.addElement(g);
    });

    // Raised Dome Lens Pilot Light Preset
    document.getElementById('preset-dome-light')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-dome-light");
      g.setAttribute("id", `dome_light_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#3182CE", "#90CDF4");

      // Socket Rim
      const socket = document.createElementNS(ns, "ellipse");
      socket.setAttribute("cx", "200"); socket.setAttribute("cy", "225");
      socket.setAttribute("rx", "30"); socket.setAttribute("ry", "10");
      socket.setAttribute("fill", "#4A5568");
      socket.setAttribute("stroke", "#1A202C"); socket.setAttribute("stroke-width", "2");

      // Raised Translucent Dome Lens
      const dome = document.createElementNS(ns, "path");
      dome.setAttribute("d", "M 170 225 A 30 45 0 0 1 230 225 Z");
      dome.setAttribute("fill", cols.body);
      dome.setAttribute("stroke", "#2B6CB0"); dome.setAttribute("stroke-width", "2.5");

      const highlight = document.createElementNS(ns, "path");
      highlight.setAttribute("d", "M 182 220 A 18 30 0 0 1 204 195");
      highlight.setAttribute("fill", "none");
      highlight.setAttribute("stroke", cols.nozzle); highlight.setAttribute("stroke-width", "2");
      highlight.setAttribute("opacity", "0.7");

      g.appendChild(socket);
      g.appendChild(dome);
      g.appendChild(highlight);
      this.canvas.addElement(g);
    });

    document.getElementById('preset-tank')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-tank");
      g.setAttribute("id", `tank_${Date.now().toString().slice(-4)}`);

      const tankOutline = document.createElementNS(ns, "rect");
      tankOutline.setAttribute("x", "200");
      tankOutline.setAttribute("y", "100");
      tankOutline.setAttribute("width", "160");
      tankOutline.setAttribute("height", "240");
      tankOutline.setAttribute("rx", "20");
      tankOutline.setAttribute("fill", "#EDF2F7");
      tankOutline.setAttribute("stroke", "#2D3748");
      tankOutline.setAttribute("stroke-width", "3");

      const liquidLevel = document.createElementNS(ns, "rect");
      liquidLevel.setAttribute("x", "202");
      liquidLevel.setAttribute("y", "180");
      liquidLevel.setAttribute("width", "156");
      liquidLevel.setAttribute("height", "156");
      liquidLevel.setAttribute("rx", "4");
      liquidLevel.setAttribute("fill", "#3182CE");
      liquidLevel.setAttribute("opacity", "0.75");

      g.appendChild(tankOutline);
      g.appendChild(liquidLevel);
      this.canvas.addElement(g);
    });

    // ==========================================
    // KNOBS & SWITCHES LIBRARY PRESETS
    // ==========================================

    // Rotary Knob Preset
    document.getElementById('preset-knob')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-knob");
      g.setAttribute("id", `knob_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#4A5568", "#2B6CB0");

      // Outer Escutcheon / Bezel
      const bezel = document.createElementNS(ns, "circle");
      bezel.setAttribute("cx", "200");
      bezel.setAttribute("cy", "200");
      bezel.setAttribute("r", "40");
      bezel.setAttribute("fill", "#2D3748");
      bezel.setAttribute("stroke", cols.stroke);
      bezel.setAttribute("stroke-width", "3");

      // Outer Tick Marks (8 radial positions around dial)
      for (let angle = 0; angle < 360; angle += 45) {
        const rad = angle * Math.PI / 180;
        const x1 = 200 + 42 * Math.cos(rad);
        const y1 = 200 + 42 * Math.sin(rad);
        const x2 = 200 + 49 * Math.cos(rad);
        const y2 = 200 + 49 * Math.sin(rad);
        const tick = document.createElementNS(ns, "line");
        tick.setAttribute("x1", x1.toFixed(1));
        tick.setAttribute("y1", y1.toFixed(1));
        tick.setAttribute("x2", x2.toFixed(1));
        tick.setAttribute("y2", y2.toFixed(1));
        tick.setAttribute("stroke", "#CBD5E0");
        tick.setAttribute("stroke-width", "2");
        g.appendChild(tick);
      }

      // Inner Knob Face
      const knob = document.createElementNS(ns, "circle");
      knob.setAttribute("cx", "200");
      knob.setAttribute("cy", "200");
      knob.setAttribute("r", "28");
      knob.setAttribute("fill", cols.body);
      knob.setAttribute("stroke", "#A0AEC0");
      knob.setAttribute("stroke-width", "2");

      // Pointer Index Line
      const pointer = document.createElementNS(ns, "line");
      pointer.setAttribute("x1", "200");
      pointer.setAttribute("y1", "200");
      pointer.setAttribute("x2", "220");
      pointer.setAttribute("y2", "180");
      pointer.setAttribute("stroke", "#E2E8F0");
      pointer.setAttribute("stroke-width", "4");
      pointer.setAttribute("stroke-linecap", "round");

      g.appendChild(bezel);
      g.appendChild(knob);
      g.appendChild(pointer);
      this.canvas.addElement(g);
    });

    // Push Button Preset
    document.getElementById('preset-pushbutton')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-pushbutton");
      g.setAttribute("id", `pushbutton_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E53E3E", "#F56565");

      // Outer Square Mounting Bezel
      const plate = document.createElementNS(ns, "rect");
      plate.setAttribute("x", "160");
      plate.setAttribute("y", "160");
      plate.setAttribute("width", "80");
      plate.setAttribute("height", "80");
      plate.setAttribute("rx", "10");
      plate.setAttribute("fill", "#4A5568");
      plate.setAttribute("stroke", cols.stroke);
      plate.setAttribute("stroke-width", "3");

      // Button Outer Ring
      const ring = document.createElementNS(ns, "circle");
      ring.setAttribute("cx", "200");
      ring.setAttribute("cy", "200");
      ring.setAttribute("r", "28");
      ring.setAttribute("fill", "#2D3748");
      ring.setAttribute("stroke", "#CBD5E0");
      ring.setAttribute("stroke-width", "2");

      // Button Actuator Cap
      const cap = document.createElementNS(ns, "circle");
      cap.setAttribute("cx", "200");
      cap.setAttribute("cy", "200");
      cap.setAttribute("r", "22");
      cap.setAttribute("fill", cols.body);
      cap.setAttribute("stroke", cols.stroke);
      cap.setAttribute("stroke-width", "2");

      // Inner Highlight Ring
      const highlight = document.createElementNS(ns, "circle");
      highlight.setAttribute("cx", "195");
      highlight.setAttribute("cy", "195");
      highlight.setAttribute("r", "14");
      highlight.setAttribute("fill", cols.nozzle);
      highlight.setAttribute("opacity", "0.4");

      g.appendChild(plate);
      g.appendChild(ring);
      g.appendChild(cap);
      g.appendChild(highlight);
      this.canvas.addElement(g);
    });

    // Toggle Switch Preset
    document.getElementById('preset-toggle')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-toggle");
      g.setAttribute("id", `toggle_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#CBD5E0", "#A0AEC0");

      // Base Plate
      const plate = document.createElementNS(ns, "rect");
      plate.setAttribute("x", "175");
      plate.setAttribute("y", "150");
      plate.setAttribute("width", "50");
      plate.setAttribute("height", "100");
      plate.setAttribute("rx", "6");
      plate.setAttribute("fill", "#718096");
      plate.setAttribute("stroke", "#1A202C");
      plate.setAttribute("stroke-width", "3");

      // Toggle Slot
      const slot = document.createElementNS(ns, "rect");
      slot.setAttribute("x", "192");
      slot.setAttribute("y", "170");
      slot.setAttribute("width", "16");
      slot.setAttribute("height", "60");
      slot.setAttribute("rx", "8");
      slot.setAttribute("fill", "#1A202C");

      // Toggle Lever Bat
      const lever = document.createElementNS(ns, "polygon");
      lever.setAttribute("points", "194,200 206,200 212,165 188,165");
      lever.setAttribute("fill", cols.body);
      lever.setAttribute("stroke", "#2D3748");
      lever.setAttribute("stroke-width", "2");

      // Metallic Lever Tip Knob
      const tip = document.createElementNS(ns, "circle");
      tip.setAttribute("cx", "200");
      tip.setAttribute("cy", "165");
      tip.setAttribute("r", "12");
      tip.setAttribute("fill", cols.nozzle);
      tip.setAttribute("stroke", "#1A202C");
      tip.setAttribute("stroke-width", "2");

      g.appendChild(plate);
      g.appendChild(slot);
      g.appendChild(lever);
      g.appendChild(tip);
      this.canvas.addElement(g);
    });

    // Selector Switch Preset
    document.getElementById('preset-selector')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-selector");
      g.setAttribute("id", `selector_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#2D3748", "#E2E8F0");

      // Outer Circular Plate
      const plate = document.createElementNS(ns, "circle");
      plate.setAttribute("cx", "200");
      plate.setAttribute("cy", "200");
      plate.setAttribute("r", "45");
      plate.setAttribute("fill", cols.body);
      plate.setAttribute("stroke", "#1A202C");
      plate.setAttribute("stroke-width", "3");

      // Labels: HAND, OFF, AUTO
      const lblOff = document.createElementNS(ns, "text");
      lblOff.setAttribute("x", "200");
      lblOff.setAttribute("y", "170");
      lblOff.setAttribute("fill", "#E2E8F0");
      lblOff.setAttribute("font-size", "10");
      lblOff.setAttribute("font-weight", "bold");
      lblOff.setAttribute("text-anchor", "middle");
      lblOff.textContent = "OFF";

      const lblAuto = document.createElementNS(ns, "text");
      lblAuto.setAttribute("x", "232");
      lblAuto.setAttribute("y", "225");
      lblAuto.setAttribute("fill", "#A0AEC0");
      lblAuto.setAttribute("font-size", "9");
      lblAuto.setAttribute("font-weight", "bold");
      lblAuto.setAttribute("text-anchor", "middle");
      lblAuto.textContent = "AUTO";

      const lblHand = document.createElementNS(ns, "text");
      lblHand.setAttribute("x", "168");
      lblHand.setAttribute("y", "225");
      lblHand.setAttribute("fill", "#A0AEC0");
      lblHand.setAttribute("font-size", "9");
      lblHand.setAttribute("font-weight", "bold");
      lblHand.setAttribute("text-anchor", "middle");
      lblHand.textContent = "HAND";

      // Rotary Pointer Bar
      const pointer = document.createElementNS(ns, "polygon");
      pointer.setAttribute("points", "194,220 206,220 203,174 197,174");
      pointer.setAttribute("fill", cols.nozzle);
      pointer.setAttribute("stroke", "#1A202C");
      pointer.setAttribute("stroke-width", "2");

      g.appendChild(plate);
      g.appendChild(lblOff);
      g.appendChild(lblAuto);
      g.appendChild(lblHand);
      g.appendChild(pointer);
      this.canvas.addElement(g);
    });

    // Emergency Stop Button Preset
    document.getElementById('preset-estop')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-estop");
      g.setAttribute("id", `estop_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#C53030", "#D69E2E");

      // Yellow Circular Base Plate
      const base = document.createElementNS(ns, "circle");
      base.setAttribute("cx", "200");
      base.setAttribute("cy", "200");
      base.setAttribute("r", "50");
      base.setAttribute("fill", cols.nozzle);
      base.setAttribute("stroke", "#1A202C");
      base.setAttribute("stroke-width", "3");

      // Yellow Base Text Arc / Border Ring
      const textRing = document.createElementNS(ns, "circle");
      textRing.setAttribute("cx", "200");
      textRing.setAttribute("cy", "200");
      textRing.setAttribute("r", "40");
      textRing.setAttribute("fill", "none");
      textRing.setAttribute("stroke", "#744210");
      textRing.setAttribute("stroke-width", "1.5");

      // Red Mushroom Cap
      const cap = document.createElementNS(ns, "circle");
      cap.setAttribute("cx", "200");
      cap.setAttribute("cy", "200");
      cap.setAttribute("r", "32");
      cap.setAttribute("fill", cols.body);
      cap.setAttribute("stroke", "#1A202C");
      cap.setAttribute("stroke-width", "3");

      // Arrow Ring on Cap
      const arrowRing = document.createElementNS(ns, "path");
      arrowRing.setAttribute("d", "M 180 200 A 20 20 0 1 1 220 200");
      arrowRing.setAttribute("fill", "none");
      arrowRing.setAttribute("stroke", "#FFFFFF");
      arrowRing.setAttribute("stroke-width", "3");
      arrowRing.setAttribute("stroke-dasharray", "8,4");

      g.appendChild(base);
      g.appendChild(textRing);
      g.appendChild(cap);
      g.appendChild(arrowRing);
      this.canvas.addElement(g);
    });

    // Key Switch Preset
    document.getElementById('preset-keyswitch')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-keyswitch");
      g.setAttribute("id", `keyswitch_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#718096", "#E2E8F0");

      // Escutcheon Ring
      const bezel = document.createElementNS(ns, "circle");
      bezel.setAttribute("cx", "200");
      bezel.setAttribute("cy", "200");
      bezel.setAttribute("r", "38");
      bezel.setAttribute("fill", "#2D3748");
      bezel.setAttribute("stroke", "#1A202C");
      bezel.setAttribute("stroke-width", "3");

      // Chrome Inner Cylinder
      const cyl = document.createElementNS(ns, "circle");
      cyl.setAttribute("cx", "200");
      cyl.setAttribute("cy", "200");
      cyl.setAttribute("r", "24");
      cyl.setAttribute("fill", cols.body);
      cyl.setAttribute("stroke", "#1A202C");
      cyl.setAttribute("stroke-width", "2");

      // Keyhole Slot
      const slotRect = document.createElementNS(ns, "rect");
      slotRect.setAttribute("x", "197");
      slotRect.setAttribute("y", "186");
      slotRect.setAttribute("width", "6");
      slotRect.setAttribute("height", "24");
      slotRect.setAttribute("rx", "1");
      slotRect.setAttribute("fill", "#1A202C");

      const slotCircle = document.createElementNS(ns, "circle");
      slotCircle.setAttribute("cx", "200");
      slotCircle.setAttribute("cy", "190");
      slotCircle.setAttribute("r", "5");
      slotCircle.setAttribute("fill", "#1A202C");

      g.appendChild(bezel);
      g.appendChild(cyl);
      g.appendChild(slotRect);
      g.appendChild(slotCircle);
      this.canvas.addElement(g);
    });

    // ==========================================
    // HVAC & DUCTWORK LIBRARY PRESETS
    // ==========================================

    // Straight Rectangular Duct Preset
    document.getElementById('preset-duct')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-duct");
      g.setAttribute("id", `duct_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#CBD5E0", "#A0AEC0");

      // Main Duct Body
      const duct = document.createElementNS(ns, "rect");
      duct.setAttribute("x", "100");
      duct.setAttribute("y", "175");
      duct.setAttribute("width", "200");
      duct.setAttribute("height", "50");
      duct.setAttribute("fill", cols.body);
      duct.setAttribute("stroke", "#4A5568");
      duct.setAttribute("stroke-width", "2");

      // Left & Right Flange Joint Ribs
      const leftFlange = document.createElementNS(ns, "rect");
      leftFlange.setAttribute("x", "95");
      leftFlange.setAttribute("y", "170");
      leftFlange.setAttribute("width", "8");
      leftFlange.setAttribute("height", "60");
      leftFlange.setAttribute("rx", "1");
      leftFlange.setAttribute("fill", "#718096");
      leftFlange.setAttribute("stroke", "#2D3748");

      const rightFlange = document.createElementNS(ns, "rect");
      rightFlange.setAttribute("x", "297");
      rightFlange.setAttribute("y", "170");
      rightFlange.setAttribute("width", "8");
      rightFlange.setAttribute("height", "60");
      rightFlange.setAttribute("rx", "1");
      rightFlange.setAttribute("fill", "#718096");
      rightFlange.setAttribute("stroke", "#2D3748");

      // Sheet Metal Stiffener Seams
      const seam1 = document.createElementNS(ns, "line");
      seam1.setAttribute("x1", "160");
      seam1.setAttribute("y1", "175");
      seam1.setAttribute("x2", "160");
      seam1.setAttribute("y2", "225");
      seam1.setAttribute("stroke", cols.nozzle);
      seam1.setAttribute("stroke-width", "2");

      const seam2 = document.createElementNS(ns, "line");
      seam2.setAttribute("x1", "240");
      seam2.setAttribute("y1", "175");
      seam2.setAttribute("x2", "240");
      seam2.setAttribute("y2", "225");
      seam2.setAttribute("stroke", cols.nozzle);
      seam2.setAttribute("stroke-width", "2");

      g.appendChild(leftFlange);
      g.appendChild(rightFlange);
      g.appendChild(duct);
      g.appendChild(seam1);
      g.appendChild(seam2);
      this.canvas.addElement(g);
    });

    // 90° Duct Elbow Preset
    document.getElementById('preset-duct-elbow')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-duct-elbow");
      g.setAttribute("id", `duct_elbow_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#CBD5E0", "#A0AEC0");

      // Main 90° Curved Duct Elbow Body (Constant 50px Duct Width)
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M 100 250 L 100 190 A 90 90 0 0 1 190 100 L 250 100 L 250 150 L 190 150 A 40 40 0 0 0 150 190 L 150 250 Z");
      path.setAttribute("fill", cols.body);
      path.setAttribute("stroke", "#4A5568");
      path.setAttribute("stroke-width", "2");

      // Bottom End Flange Rib (Connecting to vertical straight duct)
      const btmFlange = document.createElementNS(ns, "rect");
      btmFlange.setAttribute("x", "95");
      btmFlange.setAttribute("y", "246");
      btmFlange.setAttribute("width", "60");
      btmFlange.setAttribute("height", "8");
      btmFlange.setAttribute("rx", "1");
      btmFlange.setAttribute("fill", "#718096");
      btmFlange.setAttribute("stroke", "#2D3748");
      btmFlange.setAttribute("stroke-width", "1.5");

      // Right End Flange Rib (Connecting to horizontal straight duct)
      const rgtFlange = document.createElementNS(ns, "rect");
      rgtFlange.setAttribute("x", "246");
      rgtFlange.setAttribute("y", "95");
      rgtFlange.setAttribute("width", "8");
      rgtFlange.setAttribute("height", "60");
      rgtFlange.setAttribute("rx", "1");
      rgtFlange.setAttribute("fill", "#718096");
      rgtFlange.setAttribute("stroke", "#2D3748");
      rgtFlange.setAttribute("stroke-width", "1.5");

      // Turning Vanes inside the elbow
      const vane1 = document.createElementNS(ns, "path");
      vane1.setAttribute("d", "M 125 190 A 65 65 0 0 1 190 125");
      vane1.setAttribute("fill", "none");
      vane1.setAttribute("stroke", cols.nozzle);
      vane1.setAttribute("stroke-width", "2");
      vane1.setAttribute("stroke-dasharray", "5,3");

      g.appendChild(btmFlange);
      g.appendChild(rgtFlange);
      g.appendChild(path);
      g.appendChild(vane1);
      this.canvas.addElement(g);
    });

    // 3-Way Duct Tee Junction Preset
    document.getElementById('preset-duct-tee')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-duct-tee");
      g.setAttribute("id", `duct_tee_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#CBD5E0", "#3182CE");

      // 3-Way T-Junction Duct Body
      const teePath = document.createElementNS(ns, "path");
      teePath.setAttribute("d", "M 100 170 L 300 170 L 300 230 L 230 230 L 230 300 L 170 300 L 170 230 L 100 230 Z");
      teePath.setAttribute("fill", cols.body);
      teePath.setAttribute("stroke", "#4A5568");
      teePath.setAttribute("stroke-width", "2.5");

      // Connecting Flange Ribs on all 3 Ports
      const leftFlange = document.createElementNS(ns, "rect");
      leftFlange.setAttribute("x", "94"); leftFlange.setAttribute("y", "166");
      leftFlange.setAttribute("width", "8"); leftFlange.setAttribute("height", "68");
      leftFlange.setAttribute("rx", "1");
      leftFlange.setAttribute("fill", "#718096");
      leftFlange.setAttribute("stroke", "#2D3748"); leftFlange.setAttribute("stroke-width", "1.5");

      const rightFlange = document.createElementNS(ns, "rect");
      rightFlange.setAttribute("x", "298"); rightFlange.setAttribute("y", "166");
      rightFlange.setAttribute("width", "8"); rightFlange.setAttribute("height", "68");
      rightFlange.setAttribute("rx", "1");
      rightFlange.setAttribute("fill", "#718096");
      rightFlange.setAttribute("stroke", "#2D3748"); rightFlange.setAttribute("stroke-width", "1.5");

      const btmFlange = document.createElementNS(ns, "rect");
      btmFlange.setAttribute("x", "166"); btmFlange.setAttribute("y", "298");
      btmFlange.setAttribute("width", "68"); btmFlange.setAttribute("height", "8");
      btmFlange.setAttribute("rx", "1");
      btmFlange.setAttribute("fill", "#718096");
      btmFlange.setAttribute("stroke", "#2D3748"); btmFlange.setAttribute("stroke-width", "1.5");

      g.appendChild(leftFlange);
      g.appendChild(rightFlange);
      g.appendChild(btmFlange);
      g.appendChild(teePath);
      this.canvas.addElement(g);
    });

    // Duct Reducer Preset
    document.getElementById('preset-duct-reducer')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-duct-reducer");
      g.setAttribute("id", `duct_reducer_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#CBD5E0", "#718096");

      // Tapered Reducer Body
      const body = document.createElementNS(ns, "polygon");
      body.setAttribute("points", "120,160 260,180 260,220 120,240");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#4A5568");
      body.setAttribute("stroke-width", "2");

      // Wide End Flange
      const flg1 = document.createElementNS(ns, "rect");
      flg1.setAttribute("x", "114");
      flg1.setAttribute("y", "154");
      flg1.setAttribute("width", "6");
      flg1.setAttribute("height", "92");
      flg1.setAttribute("fill", cols.nozzle);
      flg1.setAttribute("stroke", "#2D3748");

      // Narrow End Flange
      const flg2 = document.createElementNS(ns, "rect");
      flg2.setAttribute("x", "260");
      flg2.setAttribute("y", "176");
      flg2.setAttribute("width", "6");
      flg2.setAttribute("height", "48");
      flg2.setAttribute("fill", cols.nozzle);
      flg2.setAttribute("stroke", "#2D3748");

      g.appendChild(body);
      g.appendChild(flg1);
      g.appendChild(flg2);
      this.canvas.addElement(g);
    });

    // Air Louver Damper Preset
    document.getElementById('preset-damper')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-damper");
      g.setAttribute("id", `damper_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E2E8F0", "#3182CE");

      // Frame Box
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "150");
      frame.setAttribute("y", "150");
      frame.setAttribute("width", "100");
      frame.setAttribute("height", "100");
      frame.setAttribute("fill", cols.body);
      frame.setAttribute("stroke", "#2D3748");
      frame.setAttribute("stroke-width", "3");

      // Louver Blades (Angled lines)
      for (let y = 170; y <= 230; y += 20) {
        const blade = document.createElementNS(ns, "line");
        blade.setAttribute("x1", "160");
        blade.setAttribute("y1", (y + 6).toString());
        blade.setAttribute("x2", "240");
        blade.setAttribute("y2", (y - 6).toString());
        blade.setAttribute("stroke", "#4A5568");
        blade.setAttribute("stroke-width", "3");
        blade.setAttribute("stroke-linecap", "round");
        g.appendChild(blade);
      }

      // Actuator Linkage Shaft
      const shaft = document.createElementNS(ns, "line");
      shaft.setAttribute("x1", "200");
      shaft.setAttribute("y1", "160");
      shaft.setAttribute("x2", "200");
      shaft.setAttribute("y2", "240");
      shaft.setAttribute("stroke", cols.nozzle);
      shaft.setAttribute("stroke-width", "2");

      g.appendChild(frame);
      g.appendChild(shaft);
      this.canvas.addElement(g);
    });

    // Air Handling Unit (AHU) Preset
    document.getElementById('preset-ahu')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-ahu");
      g.setAttribute("id", `ahu_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#EDF2F7", "#3182CE");

      // Main AHU Box Enclosure
      const box = document.createElementNS(ns, "rect");
      box.setAttribute("x", "80");
      box.setAttribute("y", "130");
      box.setAttribute("width", "260");
      box.setAttribute("height", "140");
      box.setAttribute("rx", "4");
      box.setAttribute("fill", cols.body);
      box.setAttribute("stroke", "#2D3748");
      box.setAttribute("stroke-width", "3");

      // Section Dividers
      const div1 = document.createElementNS(ns, "line");
      div1.setAttribute("x1", "150");
      div1.setAttribute("y1", "130");
      div1.setAttribute("x2", "150");
      div1.setAttribute("y2", "270");
      div1.setAttribute("stroke", "#CBD5E0");
      div1.setAttribute("stroke-width", "2");

      const div2 = document.createElementNS(ns, "line");
      div2.setAttribute("x1", "240");
      div2.setAttribute("y1", "130");
      div2.setAttribute("x2", "240");
      div2.setAttribute("y2", "270");
      div2.setAttribute("stroke", "#CBD5E0");
      div2.setAttribute("stroke-width", "2");

      // Filter Section ZigZag
      const filter = document.createElementNS(ns, "polyline");
      filter.setAttribute("points", "110,140 130,165 110,190 130,215 110,240 130,260");
      filter.setAttribute("fill", "none");
      filter.setAttribute("stroke", "#718096");
      filter.setAttribute("stroke-width", "3");

      // Coil Section Lines (Cooling/Heating)
      const coil = document.createElementNS(ns, "polyline");
      coil.setAttribute("points", "170,150 210,150 170,180 210,180 170,210 210,210 170,240 210,240");
      coil.setAttribute("fill", "none");
      coil.setAttribute("stroke", cols.nozzle);
      coil.setAttribute("stroke-width", "3");

      // Fan Blower Circle
      const fanCircle = document.createElementNS(ns, "circle");
      fanCircle.setAttribute("cx", "285");
      fanCircle.setAttribute("cy", "200");
      fanCircle.setAttribute("r", "32");
      fanCircle.setAttribute("fill", "#E2E8F0");
      fanCircle.setAttribute("stroke", "#2D3748");
      fanCircle.setAttribute("stroke-width", "2");

      const fanText = document.createElementNS(ns, "text");
      fanText.setAttribute("x", "285");
      fanText.setAttribute("y", "206");
      fanText.setAttribute("fill", "#2D3748");
      fanText.setAttribute("font-size", "18");
      fanText.setAttribute("font-weight", "bold");
      fanText.setAttribute("text-anchor", "middle");
      fanText.textContent = "FAN";

      g.appendChild(box);
      g.appendChild(div1);
      g.appendChild(div2);
      g.appendChild(filter);
      g.appendChild(coil);
      g.appendChild(fanCircle);
      g.appendChild(fanText);
      this.canvas.addElement(g);
    });

    // Air Filter Element Preset
    document.getElementById('preset-filter')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-filter");
      g.setAttribute("id", `filter_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#EDF2F7", "#4A5568");

      // Outer Frame
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "160");
      frame.setAttribute("y", "140");
      frame.setAttribute("width", "80");
      frame.setAttribute("height", "120");
      frame.setAttribute("rx", "2");
      frame.setAttribute("fill", cols.body);
      frame.setAttribute("stroke", cols.nozzle);
      frame.setAttribute("stroke-width", "3");

      // Pleated Media V-Pattern
      const pleats = document.createElementNS(ns, "polyline");
      pleats.setAttribute("points", "170,150 230,165 170,180 230,195 170,210 230,225 170,240 230,250");
      pleats.setAttribute("fill", "none");
      pleats.setAttribute("stroke", "#3182CE");
      pleats.setAttribute("stroke-width", "2");

      g.appendChild(frame);
      g.appendChild(pleats);
      this.canvas.addElement(g);
    });

    // Heater Coil Preset
    document.getElementById('preset-heater-coil')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-heater-coil");
      g.setAttribute("id", `heater_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E53E3E", "#EDF2F7");

      // Frame Sleeve Box
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "150");
      frame.setAttribute("y", "130");
      frame.setAttribute("width", "100");
      frame.setAttribute("height", "140");
      frame.setAttribute("rx", "3");
      frame.setAttribute("fill", cols.nozzle);
      frame.setAttribute("stroke", "#2D3748");
      frame.setAttribute("stroke-width", "3");

      // Flange Ribs
      const flgLeft = document.createElementNS(ns, "rect");
      flgLeft.setAttribute("x", "144");
      flgLeft.setAttribute("y", "125");
      flgLeft.setAttribute("width", "6");
      flgLeft.setAttribute("height", "150");
      flgLeft.setAttribute("fill", "#718096");
      flgLeft.setAttribute("stroke", "#1A202C");

      const flgRight = document.createElementNS(ns, "rect");
      flgRight.setAttribute("x", "250");
      flgRight.setAttribute("y", "125");
      flgRight.setAttribute("width", "6");
      flgRight.setAttribute("height", "150");
      flgRight.setAttribute("fill", "#718096");
      flgRight.setAttribute("stroke", "#1A202C");

      // Heating Coil Serpentine Loops
      const coil = document.createElementNS(ns, "polyline");
      coil.setAttribute("points", "170,148 230,148 170,178 230,178 170,208 230,208 170,238 230,238");
      coil.setAttribute("fill", "none");
      coil.setAttribute("stroke", cols.body);
      coil.setAttribute("stroke-width", "5");
      coil.setAttribute("stroke-linecap", "round");

      // Hot Water Supply/Return Stubs
      const stub = document.createElementNS(ns, "rect");
      stub.setAttribute("x", "194");
      stub.setAttribute("y", "110");
      stub.setAttribute("width", "12");
      stub.setAttribute("height", "20");
      stub.setAttribute("fill", cols.body);
      stub.setAttribute("stroke", "#1A202C");

      g.appendChild(flgLeft);
      g.appendChild(flgRight);
      g.appendChild(frame);
      g.appendChild(coil);
      g.appendChild(stub);
      this.canvas.addElement(g);
    });

    // Cooler Coil Preset
    document.getElementById('preset-cooler-coil')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-cooler-coil");
      g.setAttribute("id", `cooler_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#3182CE", "#EDF2F7");

      // Frame Sleeve Box
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "150");
      frame.setAttribute("y", "130");
      frame.setAttribute("width", "100");
      frame.setAttribute("height", "140");
      frame.setAttribute("rx", "3");
      frame.setAttribute("fill", cols.nozzle);
      frame.setAttribute("stroke", "#2D3748");
      frame.setAttribute("stroke-width", "3");

      // Flange Ribs
      const flgLeft = document.createElementNS(ns, "rect");
      flgLeft.setAttribute("x", "144");
      flgLeft.setAttribute("y", "125");
      flgLeft.setAttribute("width", "6");
      flgLeft.setAttribute("height", "150");
      flgLeft.setAttribute("fill", "#718096");
      flgLeft.setAttribute("stroke", "#1A202C");

      const flgRight = document.createElementNS(ns, "rect");
      flgRight.setAttribute("x", "250");
      flgRight.setAttribute("y", "125");
      flgRight.setAttribute("width", "6");
      flgRight.setAttribute("height", "150");
      flgRight.setAttribute("fill", "#718096");
      flgRight.setAttribute("stroke", "#1A202C");

      // Chilled Water Coil Serpentine Loops
      const coil = document.createElementNS(ns, "polyline");
      coil.setAttribute("points", "170,145 230,145 170,172 230,172 170,199 230,199 170,226 230,226");
      coil.setAttribute("fill", "none");
      coil.setAttribute("stroke", cols.body);
      coil.setAttribute("stroke-width", "5");
      coil.setAttribute("stroke-linecap", "round");

      // Condensate Drip Pan Tray
      const pan = document.createElementNS(ns, "polygon");
      pan.setAttribute("points", "152,255 248,255 242,267 158,267");
      pan.setAttribute("fill", "#63B3ED");
      pan.setAttribute("stroke", "#2B6CB0");
      pan.setAttribute("stroke-width", "1.5");

      // Chilled Water Stub
      const stub = document.createElementNS(ns, "rect");
      stub.setAttribute("x", "194");
      stub.setAttribute("y", "110");
      stub.setAttribute("width", "12");
      stub.setAttribute("height", "20");
      stub.setAttribute("fill", cols.body);
      stub.setAttribute("stroke", "#1A202C");

      g.appendChild(flgLeft);
      g.appendChild(flgRight);
      g.appendChild(frame);
      g.appendChild(coil);
      g.appendChild(pan);
      g.appendChild(stub);
      this.canvas.addElement(g);
    });

    // Bag Filter Preset
    document.getElementById('preset-bag-filter')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-bag-filter");
      g.setAttribute("id", `bagfilter_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#F7FAFC", "#718096");

      // Mounting Header Frame
      const header = document.createElementNS(ns, "rect");
      header.setAttribute("x", "120");
      header.setAttribute("y", "130");
      header.setAttribute("width", "35");
      header.setAttribute("height", "140");
      header.setAttribute("rx", "2");
      header.setAttribute("fill", cols.nozzle);
      header.setAttribute("stroke", "#1A202C");
      header.setAttribute("stroke-width", "3");

      // 3 Tapered Pocket Bags
      const bag1 = document.createElementNS(ns, "path");
      bag1.setAttribute("d", "M 155 138 C 220 138, 270 148, 270 153 C 270 158, 220 168, 155 168 Z");
      bag1.setAttribute("fill", cols.body);
      bag1.setAttribute("stroke", "#4A5568");
      bag1.setAttribute("stroke-width", "2");

      const bag2 = document.createElementNS(ns, "path");
      bag2.setAttribute("d", "M 155 175 C 220 175, 270 185, 270 190 C 270 195, 220 205, 155 205 Z");
      bag2.setAttribute("fill", cols.body);
      bag2.setAttribute("stroke", "#4A5568");
      bag2.setAttribute("stroke-width", "2");

      const bag3 = document.createElementNS(ns, "path");
      bag3.setAttribute("d", "M 155 212 C 220 212, 270 222, 270 227 C 270 232, 220 242, 155 242 Z");
      bag3.setAttribute("fill", cols.body);
      bag3.setAttribute("stroke", "#4A5568");
      bag3.setAttribute("stroke-width", "2");

      g.appendChild(bag1);
      g.appendChild(bag2);
      g.appendChild(bag3);
      g.appendChild(header);
      this.canvas.addElement(g);
    });

    // ==========================================
    // METERS & GAUGES LIBRARY PRESETS
    // ==========================================

    // Analog Pressure Gauge Preset
    document.getElementById('preset-gauge')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-gauge");
      g.setAttribute("id", `gauge_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#FFFFFF", "#E53E3E");

      // Metallic Bezel Outer Ring
      const bezel = document.createElementNS(ns, "circle");
      bezel.setAttribute("cx", "200");
      bezel.setAttribute("cy", "200");
      bezel.setAttribute("r", "50");
      bezel.setAttribute("fill", "#E2E8F0");
      bezel.setAttribute("stroke", "#1A202C");
      bezel.setAttribute("stroke-width", "3");

      // Dial Face
      const face = document.createElementNS(ns, "circle");
      face.setAttribute("cx", "200");
      face.setAttribute("cy", "200");
      face.setAttribute("r", "44");
      face.setAttribute("fill", cols.body);
      face.setAttribute("stroke", "#CBD5E0");
      face.setAttribute("stroke-width", "1");

      // Graduation Ticks
      for (let angle = -120; angle <= 120; angle += 30) {
        const rad = angle * Math.PI / 180;
        const x1 = 200 + 34 * Math.cos(rad);
        const y1 = 200 + 34 * Math.sin(rad);
        const x2 = 200 + 40 * Math.cos(rad);
        const y2 = 200 + 40 * Math.sin(rad);
        const tick = document.createElementNS(ns, "line");
        tick.setAttribute("x1", x1.toFixed(1));
        tick.setAttribute("y1", y1.toFixed(1));
        tick.setAttribute("x2", x2.toFixed(1));
        tick.setAttribute("y2", y2.toFixed(1));
        tick.setAttribute("stroke", "#2D3748");
        tick.setAttribute("stroke-width", "2");
        g.appendChild(tick);
      }

      // Unit Legend Text
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", "200");
      text.setAttribute("y", "230");
      text.setAttribute("fill", "#718096");
      text.setAttribute("font-size", "10");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("text-anchor", "middle");
      text.textContent = "PSI";

      // Pointer Needle
      const needle = document.createElementNS(ns, "polygon");
      needle.setAttribute("points", "197,202 203,202 225,175");
      needle.setAttribute("fill", cols.nozzle);
      needle.setAttribute("stroke", "#9B2C2C");
      needle.setAttribute("stroke-width", "1");

      // Center Hub Cap
      const hub = document.createElementNS(ns, "circle");
      hub.setAttribute("cx", "200");
      hub.setAttribute("cy", "200");
      hub.setAttribute("r", "6");
      hub.setAttribute("fill", "#2D3748");

      g.appendChild(bezel);
      g.appendChild(face);
      g.appendChild(text);
      g.appendChild(needle);
      g.appendChild(hub);
      this.canvas.addElement(g);
    });

    // Vertical Level / Temperature Thermometer Preset
    document.getElementById('preset-thermometer')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-thermometer");
      g.setAttribute("id", `thermometer_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E53E3E", "#FFFFFF");

      // Outer Frame
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "175");
      frame.setAttribute("y", "100");
      frame.setAttribute("width", "50");
      frame.setAttribute("height", "200");
      frame.setAttribute("rx", "10");
      frame.setAttribute("fill", "#EDF2F7");
      frame.setAttribute("stroke", "#2D3748");
      frame.setAttribute("stroke-width", "3");

      // Glass Tube
      const tube = document.createElementNS(ns, "rect");
      tube.setAttribute("x", "193");
      tube.setAttribute("y", "120");
      tube.setAttribute("width", "14");
      tube.setAttribute("height", "140");
      tube.setAttribute("rx", "7");
      tube.setAttribute("fill", cols.nozzle);
      tube.setAttribute("stroke", "#A0AEC0");
      tube.setAttribute("stroke-width", "1.5");

      // Fluid Column Fill
      const fluid = document.createElementNS(ns, "rect");
      fluid.setAttribute("x", "195");
      fluid.setAttribute("y", "170");
      fluid.setAttribute("width", "10");
      fluid.setAttribute("height", "90");
      fluid.setAttribute("rx", "5");
      fluid.setAttribute("fill", cols.body);

      // Bottom Fluid Bulb
      const bulb = document.createElementNS(ns, "circle");
      bulb.setAttribute("cx", "200");
      bulb.setAttribute("cy", "265");
      bulb.setAttribute("r", "14");
      bulb.setAttribute("fill", cols.body);
      bulb.setAttribute("stroke", "#9B2C2C");

      // Tick Scale Marks
      for (let y = 130; y <= 240; y += 22) {
        const tick = document.createElementNS(ns, "line");
        tick.setAttribute("x1", "180");
        tick.setAttribute("y1", y.toString());
        tick.setAttribute("x2", "190");
        tick.setAttribute("y2", y.toString());
        tick.setAttribute("stroke", "#4A5568");
        tick.setAttribute("stroke-width", "2");
        g.appendChild(tick);
      }

      g.appendChild(frame);
      g.appendChild(tube);
      g.appendChild(fluid);
      g.appendChild(bulb);
      this.canvas.addElement(g);
    });

    // Digital LCD Panel Meter Preset
    document.getElementById('preset-digital-meter')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-digital-meter");
      g.setAttribute("id", `digital_meter_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#48BB78", "#0D2B1D");

      // Bezel Enclosure
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "120");
      frame.setAttribute("y", "160");
      frame.setAttribute("width", "160");
      frame.setAttribute("height", "80");
      frame.setAttribute("rx", "6");
      frame.setAttribute("fill", "#1A202C");
      frame.setAttribute("stroke", "#4A5568");
      frame.setAttribute("stroke-width", "3");

      // LCD Screen Display
      const lcd = document.createElementNS(ns, "rect");
      lcd.setAttribute("x", "132");
      lcd.setAttribute("y", "172");
      lcd.setAttribute("width", "136");
      lcd.setAttribute("height", "56");
      lcd.setAttribute("rx", "4");
      lcd.setAttribute("fill", cols.nozzle);
      lcd.setAttribute("stroke", "#276749");
      lcd.setAttribute("stroke-width", "2");

      // Glowing Readout Digits
      const digits = document.createElementNS(ns, "text");
      digits.setAttribute("x", "225");
      digits.setAttribute("y", "210");
      digits.setAttribute("fill", cols.body);
      digits.setAttribute("font-family", "monospace, Courier, sans-serif");
      digits.setAttribute("font-size", "28");
      digits.setAttribute("font-weight", "bold");
      digits.setAttribute("text-anchor", "end");
      digits.textContent = "425.8";

      // Unit Tag
      const unit = document.createElementNS(ns, "text");
      unit.setAttribute("x", "258");
      unit.setAttribute("y", "210");
      unit.setAttribute("fill", "#A0AEC0");
      unit.setAttribute("font-size", "12");
      unit.setAttribute("font-weight", "bold");
      unit.setAttribute("text-anchor", "end");
      unit.textContent = "kW";

      g.appendChild(frame);
      g.appendChild(lcd);
      g.appendChild(digits);
      g.appendChild(unit);
      this.canvas.addElement(g);
    });

    // Inline Flowmeter Rotor Preset
    document.getElementById('preset-flowmeter')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-flowmeter");
      g.setAttribute("id", `flowmeter_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#3182CE", "#EBF8FF");

      // Transparent Sight Tube
      const tube = document.createElementNS(ns, "rect");
      tube.setAttribute("x", "120");
      tube.setAttribute("y", "170");
      tube.setAttribute("width", "160");
      tube.setAttribute("height", "60");
      tube.setAttribute("rx", "4");
      tube.setAttribute("fill", cols.nozzle);
      tube.setAttribute("stroke", cols.body);
      tube.setAttribute("stroke-width", "2");
      tube.setAttribute("opacity", "0.85");

      // Connection Flanges
      const flgLeft = document.createElementNS(ns, "rect");
      flgLeft.setAttribute("x", "112");
      flgLeft.setAttribute("y", "165");
      flgLeft.setAttribute("width", "8");
      flgLeft.setAttribute("height", "70");
      flgLeft.setAttribute("fill", "#718096");
      flgLeft.setAttribute("stroke", "#1A202C");

      const flgRight = document.createElementNS(ns, "rect");
      flgRight.setAttribute("x", "280");
      flgRight.setAttribute("y", "165");
      flgRight.setAttribute("width", "8");
      flgRight.setAttribute("height", "70");
      flgRight.setAttribute("fill", "#718096");
      flgRight.setAttribute("stroke", "#1A202C");

      // Rotor Hub & Blades
      const hub = document.createElementNS(ns, "circle");
      hub.setAttribute("cx", "200");
      hub.setAttribute("cy", "200");
      hub.setAttribute("r", "16");
      hub.setAttribute("fill", "#ED8936");
      hub.setAttribute("stroke", "#1A202C");
      hub.setAttribute("stroke-width", "2");

      const blade1 = document.createElementNS(ns, "line");
      blade1.setAttribute("x1", "200");
      blade1.setAttribute("y1", "175");
      blade1.setAttribute("x2", "200");
      blade1.setAttribute("y2", "225");
      blade1.setAttribute("stroke", "#1A202C");
      blade1.setAttribute("stroke-width", "3");

      const blade2 = document.createElementNS(ns, "line");
      blade2.setAttribute("x1", "175");
      blade2.setAttribute("y1", "200");
      blade2.setAttribute("x2", "225");
      blade2.setAttribute("y2", "200");
      blade2.setAttribute("stroke", "#1A202C");
      blade2.setAttribute("stroke-width", "3");

      // Top Transmitter Sensor Pod
      const pod = document.createElementNS(ns, "rect");
      pod.setAttribute("x", "185");
      pod.setAttribute("y", "135");
      pod.setAttribute("width", "30");
      pod.setAttribute("height", "35");
      pod.setAttribute("rx", "3");
      pod.setAttribute("fill", "#2D3748");
      pod.setAttribute("stroke", "#CBD5E0");

      g.appendChild(flgLeft);
      g.appendChild(flgRight);
      g.appendChild(tube);
      g.appendChild(blade1);
      g.appendChild(blade2);
      g.appendChild(hub);
      g.appendChild(pod);
      this.canvas.addElement(g);
    });

    // Watt / Power Meter Preset
    document.getElementById('preset-wattmeter')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-wattmeter");
      g.setAttribute("id", `wattmeter_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#F7FAFC", "#D69E2E");

      // Square Instrument Enclosure
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "140");
      frame.setAttribute("y", "140");
      frame.setAttribute("width", "120");
      frame.setAttribute("height", "120");
      frame.setAttribute("rx", "8");
      frame.setAttribute("fill", "#2D3748");
      frame.setAttribute("stroke", "#1A202C");
      frame.setAttribute("stroke-width", "3");

      // Meter Scale Window Arc Path
      const dialWin = document.createElementNS(ns, "path");
      dialWin.setAttribute("d", "M 152 210 A 50 50 0 0 1 248 210 L 240 230 L 160 230 Z");
      dialWin.setAttribute("fill", cols.body);
      dialWin.setAttribute("stroke", "#CBD5E0");
      dialWin.setAttribute("stroke-width", "1");

      // Dial Pointer Needle
      const needle = document.createElementNS(ns, "line");
      needle.setAttribute("x1", "200");
      needle.setAttribute("y1", "240");
      needle.setAttribute("x2", "222");
      needle.setAttribute("y2", "175");
      needle.setAttribute("stroke", cols.nozzle);
      needle.setAttribute("stroke-width", "3");
      needle.setAttribute("stroke-linecap", "round");

      // Label "kW"
      const lbl = document.createElementNS(ns, "text");
      lbl.setAttribute("x", "200");
      lbl.setAttribute("y", "252");
      lbl.setAttribute("fill", "#E2E8F0");
      lbl.setAttribute("font-size", "12");
      lbl.setAttribute("font-weight", "bold");
      lbl.setAttribute("text-anchor", "middle");
      lbl.textContent = "kW";

      g.appendChild(frame);
      g.appendChild(dialWin);
      g.appendChild(needle);
      g.appendChild(lbl);
      this.canvas.addElement(g);
    });

    // ==========================================
    // SENSORS LIBRARY PRESETS
    // ==========================================

    // Duct Temperature Sensor Preset
    document.getElementById('preset-duct-temp')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-duct-temp");
      g.setAttribute("id", `duct_temp_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#3182CE", "#E53E3E");

      // Circular Transmitter Head
      const head = document.createElementNS(ns, "circle");
      head.setAttribute("cx", "200");
      head.setAttribute("cy", "160");
      head.setAttribute("r", "26");
      head.setAttribute("fill", cols.body);
      head.setAttribute("stroke", "#1A202C");
      head.setAttribute("stroke-width", "3");

      const face = document.createElementNS(ns, "circle");
      face.setAttribute("cx", "200");
      face.setAttribute("cy", "160");
      face.setAttribute("r", "18");
      face.setAttribute("fill", "#E2E8F0");
      face.setAttribute("stroke", "#4A5568");

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "200");
      txt.setAttribute("y", "166");
      txt.setAttribute("fill", "#2D3748");
      txt.setAttribute("font-size", "16");
      txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "°C";

      // Duct Mounting Collar
      const collar = document.createElementNS(ns, "rect");
      collar.setAttribute("x", "185");
      collar.setAttribute("y", "186");
      collar.setAttribute("width", "30");
      collar.setAttribute("height", "10");
      collar.setAttribute("rx", "2");
      collar.setAttribute("fill", "#718096");
      collar.setAttribute("stroke", "#1A202C");

      // Insertion Probe Stem
      const stem = document.createElementNS(ns, "rect");
      stem.setAttribute("x", "197");
      stem.setAttribute("y", "196");
      stem.setAttribute("width", "6");
      stem.setAttribute("height", "70");
      stem.setAttribute("fill", "#A0AEC0");
      stem.setAttribute("stroke", "#2D3748");

      // Thermocouple Tip Bulb
      const bulb = document.createElementNS(ns, "circle");
      bulb.setAttribute("cx", "200");
      bulb.setAttribute("cy", "266");
      bulb.setAttribute("r", "5");
      bulb.setAttribute("fill", cols.nozzle);
      bulb.setAttribute("stroke", "#9B2C2C");

      g.appendChild(collar);
      g.appendChild(stem);
      g.appendChild(bulb);
      g.appendChild(head);
      g.appendChild(face);
      g.appendChild(txt);
      this.canvas.addElement(g);
    });

    // Duct Humidity Sensor Preset
    document.getElementById('preset-duct-humidity')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-duct-humidity");
      g.setAttribute("id", `duct_hum_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#38A169", "#3182CE");

      // Circular Transmitter Head
      const head = document.createElementNS(ns, "circle");
      head.setAttribute("cx", "200");
      head.setAttribute("cy", "160");
      head.setAttribute("r", "26");
      head.setAttribute("fill", cols.body);
      head.setAttribute("stroke", "#1A202C");
      head.setAttribute("stroke-width", "3");

      const face = document.createElementNS(ns, "circle");
      face.setAttribute("cx", "200");
      face.setAttribute("cy", "160");
      face.setAttribute("r", "18");
      face.setAttribute("fill", "#E2E8F0");
      face.setAttribute("stroke", "#4A5568");

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "200");
      txt.setAttribute("y", "165");
      txt.setAttribute("fill", "#276749");
      txt.setAttribute("font-size", "11");
      txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "%RH";

      // Duct Collar
      const collar = document.createElementNS(ns, "rect");
      collar.setAttribute("x", "185");
      collar.setAttribute("y", "186");
      collar.setAttribute("width", "30");
      collar.setAttribute("height", "10");
      collar.setAttribute("rx", "2");
      collar.setAttribute("fill", "#718096");
      collar.setAttribute("stroke", "#1A202C");

      // Insertion Probe Stem
      const stem = document.createElementNS(ns, "rect");
      stem.setAttribute("x", "197");
      stem.setAttribute("y", "196");
      stem.setAttribute("width", "6");
      stem.setAttribute("height", "58");
      stem.setAttribute("fill", "#A0AEC0");
      stem.setAttribute("stroke", "#2D3748");

      // Sintered Mesh Filter Tip
      const filterCap = document.createElementNS(ns, "rect");
      filterCap.setAttribute("x", "194");
      filterCap.setAttribute("y", "254");
      filterCap.setAttribute("width", "12");
      filterCap.setAttribute("height", "16");
      filterCap.setAttribute("rx", "2");
      filterCap.setAttribute("fill", cols.nozzle);
      filterCap.setAttribute("stroke", "#2D3748");
      filterCap.setAttribute("stroke-dasharray", "2,2");

      g.appendChild(collar);
      g.appendChild(stem);
      g.appendChild(filterCap);
      g.appendChild(head);
      g.appendChild(face);
      g.appendChild(txt);
      this.canvas.addElement(g);
    });

    // Duct Differential Pressure Transducer Preset
    document.getElementById('preset-duct-pressure')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-duct-pressure");
      g.setAttribute("id", `duct_press_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#2D3748", "#48BB78");

      // Enclosure Box
      const box = document.createElementNS(ns, "rect");
      box.setAttribute("x", "165");
      box.setAttribute("y", "140");
      box.setAttribute("width", "70");
      box.setAttribute("height", "50");
      box.setAttribute("rx", "5");
      box.setAttribute("fill", cols.body);
      box.setAttribute("stroke", "#1A202C");
      box.setAttribute("stroke-width", "3");

      // LCD Screen
      const lcd = document.createElementNS(ns, "rect");
      lcd.setAttribute("x", "175");
      lcd.setAttribute("y", "150");
      lcd.setAttribute("width", "50");
      lcd.setAttribute("height", "22");
      lcd.setAttribute("rx", "2");
      lcd.setAttribute("fill", "#0D2B1D");
      lcd.setAttribute("stroke", "#276749");

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "200");
      txt.setAttribute("y", "166");
      txt.setAttribute("fill", cols.nozzle);
      txt.setAttribute("font-size", "14");
      txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "ΔP";

      // High (+) & Low (-) Tube Lines
      const highPipe = document.createElementNS(ns, "rect");
      highPipe.setAttribute("x", "180");
      highPipe.setAttribute("y", "190");
      highPipe.setAttribute("width", "6");
      highPipe.setAttribute("height", "70");
      highPipe.setAttribute("fill", "#E53E3E");

      const lowPipe = document.createElementNS(ns, "rect");
      lowPipe.setAttribute("x", "214");
      lowPipe.setAttribute("y", "190");
      lowPipe.setAttribute("width", "6");
      lowPipe.setAttribute("height", "70");
      lowPipe.setAttribute("fill", "#3182CE");

      g.appendChild(highPipe);
      g.appendChild(lowPipe);
      g.appendChild(box);
      g.appendChild(lcd);
      g.appendChild(txt);
      this.canvas.addElement(g);
    });

    // Room Temperature Stat Preset
    document.getElementById('preset-room-temp')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-room-temp");
      g.setAttribute("id", `room_temp_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#F7FAFC", "#ED8936");

      // Wall Enclosure
      const box = document.createElementNS(ns, "rect");
      box.setAttribute("x", "165");
      box.setAttribute("y", "140");
      box.setAttribute("width", "70");
      box.setAttribute("height", "90");
      box.setAttribute("rx", "8");
      box.setAttribute("fill", cols.body);
      box.setAttribute("stroke", "#CBD5E0");
      box.setAttribute("stroke-width", "3");

      // Ventilation Slots (Airflow)
      for (let y = 148; y <= 156; y += 4) {
        const slot = document.createElementNS(ns, "line");
        slot.setAttribute("x1", "178");
        slot.setAttribute("y1", y.toString());
        slot.setAttribute("x2", "222");
        slot.setAttribute("y2", y.toString());
        slot.setAttribute("stroke", "#A0AEC0");
        slot.setAttribute("stroke-width", "2");
        g.appendChild(slot);
      }
      for (let y = 214; y <= 222; y += 4) {
        const slot = document.createElementNS(ns, "line");
        slot.setAttribute("x1", "178");
        slot.setAttribute("y1", y.toString());
        slot.setAttribute("x2", "222");
        slot.setAttribute("y2", y.toString());
        slot.setAttribute("stroke", "#A0AEC0");
        slot.setAttribute("stroke-width", "2");
        g.appendChild(slot);
      }

      // LCD Screen
      const lcd = document.createElementNS(ns, "rect");
      lcd.setAttribute("x", "175");
      lcd.setAttribute("y", "165");
      lcd.setAttribute("width", "50");
      lcd.setAttribute("height", "38");
      lcd.setAttribute("rx", "4");
      lcd.setAttribute("fill", "#1A202C");
      lcd.setAttribute("stroke", "#4A5568");

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "200");
      txt.setAttribute("y", "189");
      txt.setAttribute("fill", cols.nozzle);
      txt.setAttribute("font-family", "monospace, Courier, sans-serif");
      txt.setAttribute("font-size", "12");
      txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "21.5°C";

      g.appendChild(box);
      g.appendChild(lcd);
      g.appendChild(txt);
      this.canvas.addElement(g);
    });

    // Room Humidity Sensor Preset
    document.getElementById('preset-room-humidity')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-room-humidity");
      g.setAttribute("id", `room_hum_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#F7FAFC", "#4299E1");

      // Wall Enclosure
      const box = document.createElementNS(ns, "rect");
      box.setAttribute("x", "165");
      box.setAttribute("y", "140");
      box.setAttribute("width", "70");
      box.setAttribute("height", "90");
      box.setAttribute("rx", "8");
      box.setAttribute("fill", cols.body);
      box.setAttribute("stroke", "#CBD5E0");
      box.setAttribute("stroke-width", "3");

      // Ventilation Slots
      for (let y = 148; y <= 156; y += 4) {
        const slot = document.createElementNS(ns, "line");
        slot.setAttribute("x1", "178");
        slot.setAttribute("y1", y.toString());
        slot.setAttribute("x2", "222");
        slot.setAttribute("y2", y.toString());
        slot.setAttribute("stroke", "#A0AEC0");
        slot.setAttribute("stroke-width", "2");
        g.appendChild(slot);
      }
      for (let y = 214; y <= 222; y += 4) {
        const slot = document.createElementNS(ns, "line");
        slot.setAttribute("x1", "178");
        slot.setAttribute("y1", y.toString());
        slot.setAttribute("x2", "222");
        slot.setAttribute("y2", y.toString());
        slot.setAttribute("stroke", "#A0AEC0");
        slot.setAttribute("stroke-width", "2");
        g.appendChild(slot);
      }

      // LCD Screen
      const lcd = document.createElementNS(ns, "rect");
      lcd.setAttribute("x", "175");
      lcd.setAttribute("y", "165");
      lcd.setAttribute("width", "50");
      lcd.setAttribute("height", "38");
      lcd.setAttribute("rx", "4");
      lcd.setAttribute("fill", "#1A202C");
      lcd.setAttribute("stroke", "#4A5568");

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "200");
      txt.setAttribute("y", "189");
      txt.setAttribute("fill", cols.nozzle);
      txt.setAttribute("font-family", "monospace, Courier, sans-serif");
      txt.setAttribute("font-size", "12");
      txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "45%RH";

      g.appendChild(box);
      g.appendChild(lcd);
      g.appendChild(txt);
      this.canvas.addElement(g);
    });

    // Outdoor Solar Shield Temperature Sensor Preset
    document.getElementById('preset-outside-temp')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-outside-temp");
      g.setAttribute("id", `outside_temp_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#EDF2F7", "#E53E3E");

      // Wall/Mast Bracket Arm
      const arm = document.createElementNS(ns, "path");
      arm.setAttribute("d", "M 160 170 L 130 170 L 130 220 L 140 220");
      arm.setAttribute("fill", "none");
      arm.setAttribute("stroke", "#2D3748");
      arm.setAttribute("stroke-width", "4");

      // Core Sensor Stem
      const core = document.createElementNS(ns, "rect");
      core.setAttribute("x", "196");
      core.setAttribute("y", "136");
      core.setAttribute("width", "8");
      core.setAttribute("height", "70");
      core.setAttribute("fill", cols.nozzle);

      // Stacked Solar Radiation Shield Plates
      const plates = [
        "160,140 240,140 230,152 170,152",
        "160,156 240,156 230,168 170,168",
        "160,172 240,172 230,184 170,184",
        "160,188 240,188 230,200 170,200"
      ];

      g.appendChild(arm);
      g.appendChild(core);

      plates.forEach(pts => {
        const pl = document.createElementNS(ns, "polygon");
        pl.setAttribute("points", pts);
        pl.setAttribute("fill", cols.body);
        pl.setAttribute("stroke", "#4A5568");
        pl.setAttribute("stroke-width", "1.5");
        g.appendChild(pl);
      });

      this.canvas.addElement(g);
    });

    // Outdoor Weatherproof Humidity Sensor Preset
    document.getElementById('preset-outside-humidity')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-outside-humidity");
      g.setAttribute("id", `outside_hum_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#718096", "#3182CE");

      // Wall Bracket
      const arm = document.createElementNS(ns, "path");
      arm.setAttribute("d", "M 175 160 L 140 160 L 140 200");
      arm.setAttribute("fill", "none");
      arm.setAttribute("stroke", "#2D3748");
      arm.setAttribute("stroke-width", "4");

      // Weatherproof Housing Cap & Body
      const cap = document.createElementNS(ns, "rect");
      cap.setAttribute("x", "175");
      cap.setAttribute("y", "130");
      cap.setAttribute("width", "50");
      cap.setAttribute("height", "55");
      cap.setAttribute("rx", "4");
      cap.setAttribute("fill", cols.body);
      cap.setAttribute("stroke", "#1A202C");
      cap.setAttribute("stroke-width", "3");

      // Humidity Filter Probe Tip
      const tip = document.createElementNS(ns, "rect");
      tip.setAttribute("x", "186");
      tip.setAttribute("y", "185");
      tip.setAttribute("width", "28");
      tip.setAttribute("height", "45");
      tip.setAttribute("rx", "2");
      tip.setAttribute("fill", "#CBD5E0");
      tip.setAttribute("stroke", cols.nozzle);
      tip.setAttribute("stroke-width", "2");
      tip.setAttribute("stroke-dasharray", "3,2");

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "200");
      txt.setAttribute("y", "163");
      txt.setAttribute("fill", "#FFFFFF");
      txt.setAttribute("font-size", "12");
      txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "%RH";

      g.appendChild(arm);
      g.appendChild(tip);
      g.appendChild(cap);
      g.appendChild(txt);
      this.canvas.addElement(g);
    });

    // Outdoor UV Sensor Preset
    document.getElementById('preset-outside-uv')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-outside-uv");
      g.setAttribute("id", `outside_uv_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#4A5568", "#ECC94B");

      // Housing Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "170");
      body.setAttribute("y", "160");
      body.setAttribute("width", "60");
      body.setAttribute("height", "65");
      body.setAttribute("rx", "6");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#1A202C");
      body.setAttribute("stroke-width", "3");

      // Glass UV Photodiode Dome Window
      const dome = document.createElementNS(ns, "path");
      dome.setAttribute("d", "M 180 160 A 20 20 0 0 1 220 160 Z");
      dome.setAttribute("fill", cols.nozzle);
      dome.setAttribute("stroke", "#D69E2E");
      dome.setAttribute("stroke-width", "2");

      // UV Sun Rays
      const rays = [
        { x1: 200, y1: 130, x2: 200, y2: 136 },
        { x1: 178, y1: 138, x2: 183, y2: 143 },
        { x1: 222, y1: 138, x2: 217, y2: 143 }
      ];

      rays.forEach(r => {
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", r.x1.toString());
        line.setAttribute("y1", r.y1.toString());
        line.setAttribute("x2", r.x2.toString());
        line.setAttribute("y2", r.y2.toString());
        line.setAttribute("stroke", "#ECC94B");
        line.setAttribute("stroke-width", "2.5");
        line.setAttribute("stroke-linecap", "round");
        g.appendChild(line);
      });

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "200");
      txt.setAttribute("y", "198");
      txt.setAttribute("fill", "#FFFFFF");
      txt.setAttribute("font-size", "16");
      txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "UV";

      g.appendChild(body);
      g.appendChild(dome);
      g.appendChild(txt);
      this.canvas.addElement(g);
    });

    // ==========================================
    // FACILITIES LIBRARY PRESETS
    // ==========================================

    // Compass Rose Preset
    document.getElementById('preset-compass')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-compass");
      g.setAttribute("id", `compass_${Date.now().toString().slice(-4)}`);
      g.setAttribute("data-center-x", "200");
      g.setAttribute("data-center-y", "200");

      const cols = getSymbolColors("#FFFFFF", "#E53E3E");

      // Outer Dial Bezel
      const bezel = document.createElementNS(ns, "circle");
      bezel.setAttribute("cx", "200");
      bezel.setAttribute("cy", "200");
      bezel.setAttribute("r", "70");
      bezel.setAttribute("fill", cols.body);
      bezel.setAttribute("stroke", "#1A202C");
      bezel.setAttribute("stroke-width", "3");

      // Degree Graduation Ticks
      for (let angle = 0; angle < 360; angle += 10) {
        const rad = angle * Math.PI / 180;
        const len = (angle % 30 === 0) ? 8 : 4;
        const x1 = 200 + (68 - len) * Math.cos(rad);
        const y1 = 200 + (68 - len) * Math.sin(rad);
        const x2 = 200 + 68 * Math.cos(rad);
        const y2 = 200 + 68 * Math.sin(rad);
        const tick = document.createElementNS(ns, "line");
        tick.setAttribute("x1", x1.toFixed(1));
        tick.setAttribute("y1", y1.toFixed(1));
        tick.setAttribute("x2", x2.toFixed(1));
        tick.setAttribute("y2", y2.toFixed(1));
        tick.setAttribute("stroke", "#4A5568");
        tick.setAttribute("stroke-width", (angle % 90 === 0) ? "2" : "1");
        g.appendChild(tick);
      }

      // Intermediate Star Pointers (NE, SE, SW, NW)
      const interPts = [
        "200,200 245,155 216,168",
        "200,200 245,245 216,232",
        "200,200 155,245 184,232",
        "200,200 155,155 184,168"
      ];
      interPts.forEach(pts => {
        const star = document.createElementNS(ns, "polygon");
        star.setAttribute("points", pts);
        star.setAttribute("fill", "#CBD5E0");
        star.setAttribute("stroke", "#718096");
        star.setAttribute("stroke-width", "1");
        g.appendChild(star);
      });

      // East Pointer
      const eTop = document.createElementNS(ns, "polygon");
      eTop.setAttribute("points", "200,200 265,200 210,188");
      eTop.setAttribute("fill", "#A0AEC0");
      const eBtm = document.createElementNS(ns, "polygon");
      eBtm.setAttribute("points", "200,200 265,200 210,212");
      eBtm.setAttribute("fill", "#718096");

      // West Pointer
      const wTop = document.createElementNS(ns, "polygon");
      wTop.setAttribute("points", "200,200 135,200 190,188");
      wTop.setAttribute("fill", "#A0AEC0");
      const wBtm = document.createElementNS(ns, "polygon");
      wBtm.setAttribute("points", "200,200 135,200 190,212");
      wBtm.setAttribute("fill", "#718096");

      // South Pointer
      const sLeft = document.createElementNS(ns, "polygon");
      sLeft.setAttribute("points", "200,200 200,265 188,210");
      sLeft.setAttribute("fill", "#718096");
      const sRight = document.createElementNS(ns, "polygon");
      sRight.setAttribute("points", "200,200 200,265 212,210");
      sRight.setAttribute("fill", "#4A5568");

      // BOLD NORTH POINTER (Red / Dark Red)
      const nLeft = document.createElementNS(ns, "polygon");
      nLeft.setAttribute("points", "200,200 200,135 188,190");
      nLeft.setAttribute("fill", cols.nozzle);
      const nRight = document.createElementNS(ns, "polygon");
      nRight.setAttribute("points", "200,200 200,135 212,190");
      nRight.setAttribute("fill", "#C53030");

      // Cardinal Labels (N, S, E, W) - Symmetrically aligned with dominant-baseline="central"
      const lblN = document.createElementNS(ns, "text");
      lblN.setAttribute("x", "200");
      lblN.setAttribute("y", "116");
      lblN.setAttribute("fill", cols.nozzle);
      lblN.setAttribute("font-size", "18");
      lblN.setAttribute("font-weight", "bold");
      lblN.setAttribute("text-anchor", "middle");
      lblN.setAttribute("dominant-baseline", "central");
      lblN.textContent = "N";

      const lblS = document.createElementNS(ns, "text");
      lblS.setAttribute("x", "200");
      lblS.setAttribute("y", "284");
      lblS.setAttribute("fill", "#2D3748");
      lblS.setAttribute("font-size", "16");
      lblS.setAttribute("font-weight", "bold");
      lblS.setAttribute("text-anchor", "middle");
      lblS.setAttribute("dominant-baseline", "central");
      lblS.textContent = "S";

      const lblE = document.createElementNS(ns, "text");
      lblE.setAttribute("x", "284");
      lblE.setAttribute("y", "200");
      lblE.setAttribute("fill", "#2D3748");
      lblE.setAttribute("font-size", "16");
      lblE.setAttribute("font-weight", "bold");
      lblE.setAttribute("text-anchor", "middle");
      lblE.setAttribute("dominant-baseline", "central");
      lblE.textContent = "E";

      const lblW = document.createElementNS(ns, "text");
      lblW.setAttribute("x", "116");
      lblW.setAttribute("y", "200");
      lblW.setAttribute("fill", "#2D3748");
      lblW.setAttribute("font-size", "16");
      lblW.setAttribute("font-weight", "bold");
      lblW.setAttribute("text-anchor", "middle");
      lblW.setAttribute("dominant-baseline", "central");
      lblW.textContent = "W";

      // Intermediate Labels (NE, SE, SW, NW) - Positioned cleanly inside dial face
      const labelsInter = [
        { text: "NE", x: "238", y: "163" },
        { text: "SE", x: "238", y: "244" },
        { text: "SW", x: "162", y: "244" },
        { text: "NW", x: "162", y: "163" }
      ];

      // Center Pivot Pin
      const pivot = document.createElementNS(ns, "circle");
      pivot.setAttribute("cx", "200");
      pivot.setAttribute("cy", "200");
      pivot.setAttribute("r", "8");
      pivot.setAttribute("fill", "#ECC94B");
      pivot.setAttribute("stroke", "#1A202C");
      pivot.setAttribute("stroke-width", "2");

      g.appendChild(bezel);
      g.appendChild(eTop); g.appendChild(eBtm);
      g.appendChild(wTop); g.appendChild(wBtm);
      g.appendChild(sLeft); g.appendChild(sRight);
      g.appendChild(nLeft); g.appendChild(nRight);
      g.appendChild(pivot);
      g.appendChild(lblN); g.appendChild(lblS);
      g.appendChild(lblE); g.appendChild(lblW);

      labelsInter.forEach(l => {
        const txt = document.createElementNS(ns, "text");
        txt.setAttribute("x", l.x);
        txt.setAttribute("y", l.y);
        txt.setAttribute("fill", "#718096");
        txt.setAttribute("font-size", "11");
        txt.setAttribute("font-weight", "bold");
        txt.setAttribute("text-anchor", "middle");
        txt.textContent = l.text;
        g.appendChild(txt);
      });

      this.canvas.addElement(g);
    });

    // 2-Storey House Preset
    document.getElementById('preset-house')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-house");
      g.setAttribute("id", `house_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#EDF2F7", "#E53E3E");

      // Chimney
      const chim = document.createElementNS(ns, "rect");
      chim.setAttribute("x", "230");
      chim.setAttribute("y", "110");
      chim.setAttribute("width", "16");
      chim.setAttribute("height", "35");
      chim.setAttribute("fill", "#C53030");
      chim.setAttribute("stroke", "#1A202C");

      // Pitched Roof
      const roof = document.createElementNS(ns, "polygon");
      roof.setAttribute("points", "120,160 200,100 280,160");
      roof.setAttribute("fill", cols.nozzle);
      roof.setAttribute("stroke", "#1A202C");
      roof.setAttribute("stroke-width", "3");

      // House Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "130");
      body.setAttribute("y", "160");
      body.setAttribute("width", "140");
      body.setAttribute("height", "100");
      body.setAttribute("rx", "2");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#2D3748");
      body.setAttribute("stroke-width", "3");

      // 4 Windows
      const winCoords = [
        { x: 146, y: 175 }, { x: 226, y: 175 },
        { x: 146, y: 215 }, { x: 226, y: 215 }
      ];
      winCoords.forEach(w => {
        const win = document.createElementNS(ns, "rect");
        win.setAttribute("x", w.x.toString());
        win.setAttribute("y", w.y.toString());
        win.setAttribute("width", "28");
        win.setAttribute("height", "28");
        win.setAttribute("fill", "#EBF8FF");
        win.setAttribute("stroke", "#3182CE");
        win.setAttribute("stroke-width", "2");
        g.appendChild(win);
      });

      // Front Door
      const door = document.createElementNS(ns, "rect");
      door.setAttribute("x", "186");
      door.setAttribute("y", "212");
      door.setAttribute("width", "28");
      door.setAttribute("height", "48");
      door.setAttribute("rx", "2");
      door.setAttribute("fill", "#744210");
      door.setAttribute("stroke", "#1A202C");
      door.setAttribute("stroke-width", "2");

      g.appendChild(chim);
      g.appendChild(body);
      g.appendChild(roof);
      g.appendChild(door);
      this.canvas.addElement(g);
    });

    // Bungalow Preset
    document.getElementById('preset-bungalow')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-bungalow");
      g.setAttribute("id", `bungalow_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#EDF2F7", "#DD6B20");

      // Low Pitch Hip Roof
      const roof = document.createElementNS(ns, "polygon");
      roof.setAttribute("points", "95,175 140,130 260,130 305,175");
      roof.setAttribute("fill", cols.nozzle);
      roof.setAttribute("stroke", "#1A202C");
      roof.setAttribute("stroke-width", "3");

      // Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "110");
      body.setAttribute("y", "175");
      body.setAttribute("width", "180");
      body.setAttribute("height", "75");
      body.setAttribute("rx", "2");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#2D3748");
      body.setAttribute("stroke-width", "3");

      // Wide Windows
      const win1 = document.createElementNS(ns, "rect");
      win1.setAttribute("x", "125");
      win1.setAttribute("y", "190");
      win1.setAttribute("width", "45");
      win1.setAttribute("height", "32");
      win1.setAttribute("fill", "#EBF8FF");
      win1.setAttribute("stroke", "#3182CE");

      const win2 = document.createElementNS(ns, "rect");
      win2.setAttribute("x", "230");
      win2.setAttribute("y", "190");
      win2.setAttribute("width", "45");
      win2.setAttribute("height", "32");
      win2.setAttribute("fill", "#EBF8FF");
      win2.setAttribute("stroke", "#3182CE");

      // Door
      const door = document.createElementNS(ns, "rect");
      door.setAttribute("x", "187");
      door.setAttribute("y", "195");
      door.setAttribute("width", "26");
      door.setAttribute("height", "55");
      door.setAttribute("fill", "#744210");
      door.setAttribute("stroke", "#1A202C");

      g.appendChild(body);
      g.appendChild(roof);
      g.appendChild(win1);
      g.appendChild(win2);
      g.appendChild(door);
      this.canvas.addElement(g);
    });

    // Garage Preset
    document.getElementById('preset-garage')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-garage");
      g.setAttribute("id", `garage_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E2E8F0", "#4A5568");

      // Main Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "130");
      body.setAttribute("y", "150");
      body.setAttribute("width", "140");
      body.setAttribute("height", "100");
      body.setAttribute("rx", "2");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#2D3748");
      body.setAttribute("stroke-width", "3");

      // Flat Roof Trim
      const roof = document.createElementNS(ns, "rect");
      roof.setAttribute("x", "124");
      roof.setAttribute("y", "142");
      roof.setAttribute("width", "152");
      roof.setAttribute("height", "12");
      roof.setAttribute("rx", "2");
      roof.setAttribute("fill", cols.nozzle);
      roof.setAttribute("stroke", "#1A202C");
      roof.setAttribute("stroke-width", "2");

      // Roll-up Sectional Garage Door
      const door = document.createElementNS(ns, "rect");
      door.setAttribute("x", "150");
      door.setAttribute("y", "170");
      door.setAttribute("width", "100");
      door.setAttribute("height", "80");
      door.setAttribute("fill", "#CBD5E0");
      door.setAttribute("stroke", "#2D3748");
      door.setAttribute("stroke-width", "2");

      g.appendChild(body);
      g.appendChild(roof);
      g.appendChild(door);

      for (let y = 190; y <= 230; y += 20) {
        const seg = document.createElementNS(ns, "line");
        seg.setAttribute("x1", "150");
        seg.setAttribute("y1", y.toString());
        seg.setAttribute("x2", "250");
        seg.setAttribute("y2", y.toString());
        seg.setAttribute("stroke", "#718096");
        seg.setAttribute("stroke-width", "1.5");
        g.appendChild(seg);
      }

      this.canvas.addElement(g);
    });

    // Workshop Preset
    document.getElementById('preset-workshop')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-workshop");
      g.setAttribute("id", `workshop_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E2E8F0", "#4A5568");

      // Dual Saw-tooth Roof
      const roof = document.createElementNS(ns, "polygon");
      roof.setAttribute("points", "95,160 150,120 200,160 250,120 305,160");
      roof.setAttribute("fill", cols.nozzle);
      roof.setAttribute("stroke", "#1A202C");
      roof.setAttribute("stroke-width", "3");

      // Skylight Glazing Panels
      const sky1 = document.createElementNS(ns, "polygon");
      sky1.setAttribute("points", "150,120 185,148 185,160 150,160");
      sky1.setAttribute("fill", "#EBF8FF");
      sky1.setAttribute("stroke", "#3182CE");

      // Hall Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "100");
      body.setAttribute("y", "160");
      body.setAttribute("width", "200");
      body.setAttribute("height", "90");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#2D3748");
      body.setAttribute("stroke-width", "3");

      // Shutter Bay Door
      const door = document.createElementNS(ns, "rect");
      door.setAttribute("x", "130");
      door.setAttribute("y", "185");
      door.setAttribute("width", "60");
      door.setAttribute("height", "65");
      door.setAttribute("fill", "#CBD5E0");
      door.setAttribute("stroke", "#2D3748");

      g.appendChild(body);
      g.appendChild(roof);
      g.appendChild(sky1);
      g.appendChild(door);
      this.canvas.addElement(g);
    });

    // Greenhouse Preset
    document.getElementById('preset-greenhouse')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-greenhouse");
      g.setAttribute("id", `greenhouse_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#EBF8FF", "#38A169");

      // Glass Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "120");
      body.setAttribute("y", "170");
      body.setAttribute("width", "160");
      body.setAttribute("height", "80");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#3182CE");
      body.setAttribute("stroke-width", "2");

      // Glass Roof
      const roof = document.createElementNS(ns, "polygon");
      roof.setAttribute("points", "110,170 200,115 290,170");
      roof.setAttribute("fill", cols.body);
      roof.setAttribute("stroke", "#3182CE");
      roof.setAttribute("stroke-width", "2");

      // Potted Plants Greenery inside
      for (let x = 140; x <= 260; x += 40) {
        const plant = document.createElementNS(ns, "circle");
        plant.setAttribute("cx", x.toString());
        plant.setAttribute("cy", "230");
        plant.setAttribute("r", "12");
        plant.setAttribute("fill", cols.nozzle);
        g.appendChild(plant);
      }

      // Frame Mullions
      const m1 = document.createElementNS(ns, "line");
      m1.setAttribute("x1", "200"); m1.setAttribute("y1", "115");
      m1.setAttribute("x2", "200"); m1.setAttribute("y2", "250");
      m1.setAttribute("stroke", "#3182CE"); m1.setAttribute("stroke-width", "2");

      g.appendChild(body);
      g.appendChild(roof);
      g.appendChild(m1);
      this.canvas.addElement(g);
    });

    // Commercial Office Building Preset
    document.getElementById('preset-office')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-office");
      g.setAttribute("id", `office_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#2B6CB0", "#90CDF4");

      // High Building Block Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "130");
      body.setAttribute("y", "110");
      body.setAttribute("width", "140");
      body.setAttribute("height", "150");
      body.setAttribute("rx", "4");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#1A202C");
      body.setAttribute("stroke-width", "3");
      g.appendChild(body);

      // Window Grid Matrix (4 columns x 4 rows)
      for (let y = 126; y <= 195; y += 24) {
        for (let x = 146; x <= 234; x += 28) {
          const win = document.createElementNS(ns, "rect");
          win.setAttribute("x", x.toString());
          win.setAttribute("y", y.toString());
          win.setAttribute("width", "20");
          win.setAttribute("height", "16");
          win.setAttribute("rx", "1");
          win.setAttribute("fill", cols.nozzle);
          win.setAttribute("stroke", "#1A202C");
          win.setAttribute("stroke-width", "1.5");
          g.appendChild(win);
        }
      }

      // Entrance Canopy & Double Glass Doors
      const doorFrame = document.createElementNS(ns, "rect");
      doorFrame.setAttribute("x", "176");
      doorFrame.setAttribute("y", "225");
      doorFrame.setAttribute("width", "48");
      doorFrame.setAttribute("height", "35");
      doorFrame.setAttribute("fill", "#E2E8F0");
      doorFrame.setAttribute("stroke", "#1A202C");
      doorFrame.setAttribute("stroke-width", "2");

      const doorGlass1 = document.createElementNS(ns, "rect");
      doorGlass1.setAttribute("x", "180");
      doorGlass1.setAttribute("y", "232");
      doorGlass1.setAttribute("width", "18");
      doorGlass1.setAttribute("height", "28");
      doorGlass1.setAttribute("fill", "#EBF8FF");
      doorGlass1.setAttribute("stroke", "#3182CE");

      const doorGlass2 = document.createElementNS(ns, "rect");
      doorGlass2.setAttribute("x", "202");
      doorGlass2.setAttribute("y", "232");
      doorGlass2.setAttribute("width", "18");
      doorGlass2.setAttribute("height", "28");
      doorGlass2.setAttribute("fill", "#EBF8FF");
      doorGlass2.setAttribute("stroke", "#3182CE");

      g.appendChild(doorFrame);
      g.appendChild(doorGlass1);
      g.appendChild(doorGlass2);
      this.canvas.addElement(g);
    });

    // Tower Block High Rise Preset
    document.getElementById('preset-tower-block')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-tower-block");
      g.setAttribute("id", `tower_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#2D3748", "#ECC94B");

      // Antenna Spire
      const spire = document.createElementNS(ns, "line");
      spire.setAttribute("x1", "200"); spire.setAttribute("y1", "80");
      spire.setAttribute("x2", "200"); spire.setAttribute("y2", "50");
      spire.setAttribute("stroke", "#1A202C"); spire.setAttribute("stroke-width", "2.5");

      const beacon = document.createElementNS(ns, "circle");
      beacon.setAttribute("cx", "200"); beacon.setAttribute("cy", "50"); beacon.setAttribute("r", "4");
      beacon.setAttribute("fill", "#E53E3E");

      // Dark Grey Tower Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "140");
      body.setAttribute("y", "80");
      body.setAttribute("width", "120");
      body.setAttribute("height", "190");
      body.setAttribute("rx", "3");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#1A202C");
      body.setAttribute("stroke-width", "3");

      g.appendChild(spire);
      g.appendChild(beacon);
      g.appendChild(body);

      // Window Light Grid (4 columns x 7 rows)
      for (let y = 96; y <= 236; y += 22) {
        for (let x = 153; x <= 225; x += 24) {
          const win = document.createElementNS(ns, "rect");
          win.setAttribute("x", x.toString());
          win.setAttribute("y", y.toString());
          win.setAttribute("width", "16");
          win.setAttribute("height", "14");
          win.setAttribute("rx", "1");
          win.setAttribute("fill", ((x + y) % 3 === 0) ? cols.nozzle : "#90CDF4");
          win.setAttribute("stroke", "#1A202C");
          win.setAttribute("stroke-width", "1");
          g.appendChild(win);
        }
      }

      // Entrance Ground Door
      const entrance = document.createElementNS(ns, "rect");
      entrance.setAttribute("x", "185");
      entrance.setAttribute("y", "248");
      entrance.setAttribute("width", "30");
      entrance.setAttribute("height", "22");
      entrance.setAttribute("fill", "#E2E8F0");
      entrance.setAttribute("stroke", "#1A202C");
      g.appendChild(entrance);

      this.canvas.addElement(g);
    });

    // Industrial Factory Complex Preset
    document.getElementById('preset-factory')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-factory");
      g.setAttribute("id", `factory_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E2E8F0", "#4A5568");

      // Sawtooth Triple Industrial Roof
      const roof = document.createElementNS(ns, "polygon");
      roof.setAttribute("points", "85,160 125,125 150,160 190,125 215,160 255,125 285,160");
      roof.setAttribute("fill", cols.nozzle);
      roof.setAttribute("stroke", "#1A202C");
      roof.setAttribute("stroke-width", "3");

      // Main Factory Hall Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "90");
      body.setAttribute("y", "160");
      body.setAttribute("width", "195");
      body.setAttribute("height", "90");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#1A202C");
      body.setAttribute("stroke-width", "3");

      g.appendChild(body);
      g.appendChild(roof);
      // Loading Dock Bay Door & Windows
      const bayDoor = document.createElementNS(ns, "rect");
      bayDoor.setAttribute("x", "115");
      bayDoor.setAttribute("y", "185");
      bayDoor.setAttribute("width", "60");
      bayDoor.setAttribute("height", "65");
      bayDoor.setAttribute("fill", "#CBD5E0");
      bayDoor.setAttribute("stroke", "#2D3748");
      g.appendChild(bayDoor);

      for (let y = 200; y <= 235; y += 15) {
        const seg = document.createElementNS(ns, "line");
        seg.setAttribute("x1", "115"); seg.setAttribute("y1", y.toString());
        seg.setAttribute("x2", "175"); seg.setAttribute("y2", y.toString());
        seg.setAttribute("stroke", "#718096"); seg.setAttribute("stroke-width", "1.5");
        g.appendChild(seg);
      }

      // Clerestory Windows
      for (let x = 195; x <= 255; x += 30) {
        const win = document.createElementNS(ns, "rect");
        win.setAttribute("x", x.toString());
        win.setAttribute("y", "180");
        win.setAttribute("width", "20");
        win.setAttribute("height", "25");
        win.setAttribute("fill", "#EBF8FF");
        win.setAttribute("stroke", "#3182CE");
        g.appendChild(win);
      }

      this.canvas.addElement(g);
    });

    // Modern Retail Shop Preset
    document.getElementById('preset-new-shop')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-new-shop");
      g.setAttribute("id", `new_shop_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#EDF2F7", "#3182CE");

      // Shop Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "110");
      body.setAttribute("y", "140");
      body.setAttribute("width", "180");
      body.setAttribute("height", "110");
      body.setAttribute("rx", "4");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#1A202C");
      body.setAttribute("stroke-width", "3");
      g.appendChild(body);

      // Store Fascia Header Sign
      const fascia = document.createElementNS(ns, "rect");
      fascia.setAttribute("x", "115");
      fascia.setAttribute("y", "148");
      fascia.setAttribute("width", "170");
      fascia.setAttribute("height", "28");
      fascia.setAttribute("rx", "3");
      fascia.setAttribute("fill", cols.nozzle);
      fascia.setAttribute("stroke", "#1A202C");
      fascia.setAttribute("stroke-width", "2");

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "200");
      txt.setAttribute("y", "167");
      txt.setAttribute("fill", "#FFFFFF");
      txt.setAttribute("font-size", "13");
      txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "STORE";

      // Panoramic Plate-Glass Display Window
      const win = document.createElementNS(ns, "rect");
      win.setAttribute("x", "125");
      win.setAttribute("y", "185");
      win.setAttribute("width", "95");
      win.setAttribute("height", "55");
      win.setAttribute("rx", "2");
      win.setAttribute("fill", "#EBF8FF");
      win.setAttribute("stroke", "#3182CE");
      win.setAttribute("stroke-width", "2");

      // Display Pedestal inside
      const pedestal = document.createElementNS(ns, "rect");
      pedestal.setAttribute("x", "135");
      pedestal.setAttribute("y", "225");
      pedestal.setAttribute("width", "75");
      pedestal.setAttribute("height", "15");
      pedestal.setAttribute("fill", "#CBD5E0");

      // Entrance Glass Door
      const door = document.createElementNS(ns, "rect");
      door.setAttribute("x", "230");
      door.setAttribute("y", "185");
      door.setAttribute("width", "45");
      door.setAttribute("height", "55");
      door.setAttribute("fill", "#EBF8FF");
      door.setAttribute("stroke", "#1A202C");
      door.setAttribute("stroke-width", "2");

      const handle = document.createElementNS(ns, "line");
      handle.setAttribute("x1", "236"); handle.setAttribute("y1", "210");
      handle.setAttribute("x2", "236"); handle.setAttribute("y2", "220");
      handle.setAttribute("stroke", "#1A202C"); handle.setAttribute("stroke-width", "2.5");

      g.appendChild(fascia);
      g.appendChild(txt);
      g.appendChild(win);
      g.appendChild(pedestal);
      g.appendChild(door);
      g.appendChild(handle);
      this.canvas.addElement(g);
    });

    // Double-Fronted Vintage Shop Preset
    document.getElementById('preset-vintage-shop')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-vintage-shop");
      g.setAttribute("id", `vintage_shop_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#975A16", "#C53030");

      // Traditional Wooden/Brick Shopfront Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "100");
      body.setAttribute("y", "140");
      body.setAttribute("width", "200");
      body.setAttribute("height", "110");
      body.setAttribute("rx", "3");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#1A202C");
      body.setAttribute("stroke-width", "3");
      g.appendChild(body);

      // Vintage Fascia Header
      const fascia = document.createElementNS(ns, "rect");
      fascia.setAttribute("x", "105");
      fascia.setAttribute("y", "146");
      fascia.setAttribute("width", "190");
      fascia.setAttribute("height", "24");
      fascia.setAttribute("fill", "#2C5282");
      fascia.setAttribute("stroke", "#1A202C");
      fascia.setAttribute("stroke-width", "2");

      const txt = document.createElementNS(ns, "text");
      txt.setAttribute("x", "200");
      txt.setAttribute("y", "162");
      txt.setAttribute("fill", "#ECC94B");
      txt.setAttribute("font-family", "serif, Georgia, Times");
      txt.setAttribute("font-size", "11");
      txt.setAttribute("font-weight", "bold");
      txt.setAttribute("text-anchor", "middle");
      txt.textContent = "EST. 1912 BAKERY";

      // Striped Canvas Awning Valance
      for (let x = 100; x < 300; x += 20) {
        const stripe = document.createElementNS(ns, "rect");
        stripe.setAttribute("x", x.toString());
        stripe.setAttribute("y", "170");
        stripe.setAttribute("width", "10");
        stripe.setAttribute("height", "12");
        stripe.setAttribute("fill", (x % 40 === 0) ? cols.nozzle : "#FFF5F5");
        stripe.setAttribute("stroke", "#1A202C");
        g.appendChild(stripe);
      }

      // Twin Arched Display Windows (Left & Right)
      const winLeft = document.createElementNS(ns, "rect");
      winLeft.setAttribute("x", "112");
      winLeft.setAttribute("y", "184");
      winLeft.setAttribute("width", "64");
      winLeft.setAttribute("height", "56");
      winLeft.setAttribute("rx", "6");
      winLeft.setAttribute("fill", "#EBF8FF");
      winLeft.setAttribute("stroke", "#1A202C");
      winLeft.setAttribute("stroke-width", "2");

      const winRight = document.createElementNS(ns, "rect");
      winRight.setAttribute("x", "224");
      winRight.setAttribute("y", "184");
      winRight.setAttribute("width", "64");
      winRight.setAttribute("height", "56");
      winRight.setAttribute("rx", "6");
      winRight.setAttribute("fill", "#EBF8FF");
      winRight.setAttribute("stroke", "#1A202C");
      winRight.setAttribute("stroke-width", "2");

      // Center Recessed Double Wooden Entrance Door
      const door = document.createElementNS(ns, "rect");
      door.setAttribute("x", "184");
      door.setAttribute("y", "188");
      door.setAttribute("width", "32");
      door.setAttribute("height", "52");
      door.setAttribute("fill", "#4A5568");
      door.setAttribute("stroke", "#1A202C");

      g.appendChild(fascia);
      g.appendChild(txt);
      g.appendChild(winLeft);
      g.appendChild(winRight);
      g.appendChild(door);
      this.canvas.addElement(g);
    });

    // American Style Retro Diner Preset
    document.getElementById('preset-diner')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-diner");
      g.setAttribute("id", `diner_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#E2E8F0", "#E53E3E");

      // Overhead Neon Sign Oval Board
      const signBoard = document.createElementNS(ns, "rect");
      signBoard.setAttribute("x", "145");
      signBoard.setAttribute("y", "108");
      signBoard.setAttribute("width", "110");
      signBoard.setAttribute("height", "34");
      signBoard.setAttribute("rx", "17");
      signBoard.setAttribute("fill", "#1A202C");
      signBoard.setAttribute("stroke", cols.nozzle);
      signBoard.setAttribute("stroke-width", "2.5");

      const signTxt = document.createElementNS(ns, "text");
      signTxt.setAttribute("x", "200");
      signTxt.setAttribute("y", "130");
      signTxt.setAttribute("fill", "#ED64A6");
      signTxt.setAttribute("font-size", "15");
      signTxt.setAttribute("font-weight", "bold");
      signTxt.setAttribute("font-style", "italic");
      signTxt.setAttribute("text-anchor", "middle");
      signTxt.textContent = "DINER";

      // Red Neon Roof Trim
      const roofTrim = document.createElementNS(ns, "rect");
      roofTrim.setAttribute("x", "85");
      roofTrim.setAttribute("y", "144");
      roofTrim.setAttribute("width", "230");
      roofTrim.setAttribute("height", "12");
      roofTrim.setAttribute("rx", "6");
      roofTrim.setAttribute("fill", cols.nozzle);
      roofTrim.setAttribute("stroke", "#9B2C2C");
      roofTrim.setAttribute("stroke-width", "2");

      // Polished Stainless Steel / Chrome Streamlined Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "90");
      body.setAttribute("y", "150");
      body.setAttribute("width", "220");
      body.setAttribute("height", "100");
      body.setAttribute("rx", "20");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#1A202C");
      body.setAttribute("stroke-width", "3");

      // Horizontal Ribbon Window Line
      const ribbonWin = document.createElementNS(ns, "rect");
      ribbonWin.setAttribute("x", "105");
      ribbonWin.setAttribute("y", "168");
      ribbonWin.setAttribute("width", "190");
      ribbonWin.setAttribute("height", "36");
      ribbonWin.setAttribute("rx", "6");
      ribbonWin.setAttribute("fill", "#90CDF4");
      ribbonWin.setAttribute("stroke", "#2B6CB0");
      ribbonWin.setAttribute("stroke-width", "2");

      // Entrance Door
      const door = document.createElementNS(ns, "rect");
      door.setAttribute("x", "185");
      door.setAttribute("y", "190");
      door.setAttribute("width", "30");
      door.setAttribute("height", "55");
      door.setAttribute("fill", "#EBF8FF");
      door.setAttribute("stroke", "#1A202C");
      door.setAttribute("stroke-width", "2");

      g.appendChild(signBoard);
      g.appendChild(signTxt);
      g.appendChild(body);
      g.appendChild(roofTrim);
      g.appendChild(ribbonWin);
      g.appendChild(door);
      this.canvas.addElement(g);
    });

    // ==========================================
    // LANDSCAPE LIBRARY PRESETS
    // ==========================================

    // Deciduous Tree Preset
    document.getElementById('preset-tree')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-tree");
      g.setAttribute("id", `tree_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#38A169", "#744210");

      // Ground Shadow
      const shadow = document.createElementNS(ns, "ellipse");
      shadow.setAttribute("cx", "200"); shadow.setAttribute("cy", "260");
      shadow.setAttribute("rx", "45"); shadow.setAttribute("ry", "10");
      shadow.setAttribute("fill", "#CBD5E0"); shadow.setAttribute("opacity", "0.5");

      // Trunk
      const trunk = document.createElementNS(ns, "rect");
      trunk.setAttribute("x", "188"); trunk.setAttribute("y", "170");
      trunk.setAttribute("width", "24"); trunk.setAttribute("height", "90");
      trunk.setAttribute("rx", "4");
      trunk.setAttribute("fill", cols.nozzle);
      trunk.setAttribute("stroke", "#2D3748"); trunk.setAttribute("stroke-width", "2");

      // Canopy Lobes
      const canopyBase = document.createElementNS(ns, "circle");
      canopyBase.setAttribute("cx", "200"); canopyBase.setAttribute("cy", "140");
      canopyBase.setAttribute("r", "45");
      canopyBase.setAttribute("fill", cols.body);
      canopyBase.setAttribute("stroke", "#1C4532"); canopyBase.setAttribute("stroke-width", "2.5");

      const lobeLeft = document.createElementNS(ns, "circle");
      lobeLeft.setAttribute("cx", "175"); lobeLeft.setAttribute("cy", "145");
      lobeLeft.setAttribute("r", "32");
      lobeLeft.setAttribute("fill", "#276749"); lobeLeft.setAttribute("opacity", "0.9");

      const lobeTop = document.createElementNS(ns, "circle");
      lobeTop.setAttribute("cx", "200"); lobeTop.setAttribute("cy", "118");
      lobeTop.setAttribute("r", "32");
      lobeTop.setAttribute("fill", "#48BB78"); lobeTop.setAttribute("opacity", "0.9");

      const highlight = document.createElementNS(ns, "circle");
      highlight.setAttribute("cx", "188"); highlight.setAttribute("cy", "110");
      highlight.setAttribute("r", "16");
      highlight.setAttribute("fill", "#68D391"); highlight.setAttribute("opacity", "0.9");

      g.appendChild(shadow);
      g.appendChild(trunk);
      g.appendChild(canopyBase);
      g.appendChild(lobeLeft);
      g.appendChild(lobeTop);
      g.appendChild(highlight);
      this.canvas.addElement(g);
    });

    // Evergreen Pine Tree Preset
    document.getElementById('preset-pine-tree')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-pine-tree");
      g.setAttribute("id", `pine_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#276749", "#54381E");

      // Shadow
      const shadow = document.createElementNS(ns, "ellipse");
      shadow.setAttribute("cx", "200"); shadow.setAttribute("cy", "265");
      shadow.setAttribute("rx", "35"); shadow.setAttribute("ry", "8");
      shadow.setAttribute("fill", "#CBD5E0"); shadow.setAttribute("opacity", "0.5");

      // Trunk
      const trunk = document.createElementNS(ns, "rect");
      trunk.setAttribute("x", "192"); trunk.setAttribute("y", "210");
      trunk.setAttribute("width", "16"); trunk.setAttribute("height", "55");
      trunk.setAttribute("fill", cols.nozzle);
      trunk.setAttribute("stroke", "#1A202C"); trunk.setAttribute("stroke-width", "2");

      // 3 Tiered Conifer Tiers
      const tier1 = document.createElementNS(ns, "polygon");
      tier1.setAttribute("points", "130,220 200,150 270,220");
      tier1.setAttribute("fill", cols.body);
      tier1.setAttribute("stroke", "#1C4532"); tier1.setAttribute("stroke-width", "2.5");

      const tier2 = document.createElementNS(ns, "polygon");
      tier2.setAttribute("points", "145,175 200,115 255,175");
      tier2.setAttribute("fill", "#2F855A");
      tier2.setAttribute("stroke", "#1C4532"); tier2.setAttribute("stroke-width", "2.5");

      const tier3 = document.createElementNS(ns, "polygon");
      tier3.setAttribute("points", "160,130 200,75 240,130");
      tier3.setAttribute("fill", "#38A169");
      tier3.setAttribute("stroke", "#1C4532"); tier3.setAttribute("stroke-width", "2.5");

      g.appendChild(shadow);
      g.appendChild(trunk);
      g.appendChild(tier1);
      g.appendChild(tier2);
      g.appendChild(tier3);
      this.canvas.addElement(g);
    });

    // Shrub Preset
    document.getElementById('preset-shrub')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-shrub");
      g.setAttribute("id", `shrub_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#38A169", "#276749");

      // Shadow
      const shadow = document.createElementNS(ns, "ellipse");
      shadow.setAttribute("cx", "200"); shadow.setAttribute("cy", "235");
      shadow.setAttribute("rx", "50"); shadow.setAttribute("ry", "10");
      shadow.setAttribute("fill", "#CBD5E0"); shadow.setAttribute("opacity", "0.5");

      const bushLeft = document.createElementNS(ns, "circle");
      bushLeft.setAttribute("cx", "165"); bushLeft.setAttribute("cy", "195"); bushLeft.setAttribute("r", "30");
      bushLeft.setAttribute("fill", cols.nozzle); bushLeft.setAttribute("stroke", "#1C4532"); bushLeft.setAttribute("stroke-width", "2");

      const bushRight = document.createElementNS(ns, "circle");
      bushRight.setAttribute("cx", "235"); bushRight.setAttribute("cy", "195"); bushRight.setAttribute("r", "30");
      bushRight.setAttribute("fill", cols.nozzle); bushRight.setAttribute("stroke", "#1C4532"); bushRight.setAttribute("stroke-width", "2");

      const bushTop = document.createElementNS(ns, "circle");
      bushTop.setAttribute("cx", "200"); bushTop.setAttribute("cy", "180"); bushTop.setAttribute("r", "36");
      bushTop.setAttribute("fill", cols.body); bushTop.setAttribute("stroke", "#1C4532"); bushTop.setAttribute("stroke-width", "2.5");

      const highlight = document.createElementNS(ns, "circle");
      highlight.setAttribute("cx", "190"); highlight.setAttribute("cy", "168"); highlight.setAttribute("r", "18");
      highlight.setAttribute("fill", "#68D391"); highlight.setAttribute("opacity", "0.85");

      g.appendChild(shadow);
      g.appendChild(bushLeft);
      g.appendChild(bushRight);
      g.appendChild(bushTop);
      g.appendChild(highlight);
      this.canvas.addElement(g);
    });

    // Flower Bed Preset
    document.getElementById('preset-flower-bed')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-flower-bed");
      g.setAttribute("id", `flowerbed_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#54381E", "#E53E3E");

      // Soil Bed
      const bed = document.createElementNS(ns, "rect");
      bed.setAttribute("x", "100"); bed.setAttribute("y", "180");
      bed.setAttribute("width", "200"); bed.setAttribute("height", "55");
      bed.setAttribute("rx", "12");
      bed.setAttribute("fill", cols.body);
      bed.setAttribute("stroke", "#2D3748"); bed.setAttribute("stroke-width", "2.5");
      g.appendChild(bed);

      // Green Leaves & 5 Flowers
      const flowers = [
        { x: 125, y: 195, color: cols.nozzle },
        { x: 160, y: 190, color: "#9F7AEA" },
        { x: 200, y: 195, color: "#ECC94B" },
        { x: 240, y: 190, color: "#ED64A6" },
        { x: 275, y: 195, color: "#DD6B20" }
      ];

      flowers.forEach(f => {
        const leaf = document.createElementNS(ns, "circle");
        leaf.setAttribute("cx", f.x.toString()); leaf.setAttribute("cy", (f.y + 10).toString());
        leaf.setAttribute("r", "10"); leaf.setAttribute("fill", "#38A169");
        g.appendChild(leaf);

        const petal = document.createElementNS(ns, "circle");
        petal.setAttribute("cx", f.x.toString()); petal.setAttribute("cy", f.y.toString());
        petal.setAttribute("r", "9"); petal.setAttribute("fill", f.color);
        petal.setAttribute("stroke", "#1A202C"); petal.setAttribute("stroke-width", "1.5");
        g.appendChild(petal);

        const center = document.createElementNS(ns, "circle");
        center.setAttribute("cx", f.x.toString()); center.setAttribute("cy", f.y.toString());
        center.setAttribute("r", "3"); center.setAttribute("fill", "#FEFCBF");
        g.appendChild(center);
      });

      this.canvas.addElement(g);
    });

    // Wooden Fence Panel Preset
    document.getElementById('preset-fencing')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-fencing");
      g.setAttribute("id", `fence_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#F7FAFC", "#718096");

      // Horizontal Support Rails
      const railTop = document.createElementNS(ns, "rect");
      railTop.setAttribute("x", "90"); railTop.setAttribute("y", "165");
      railTop.setAttribute("width", "220"); railTop.setAttribute("height", "12");
      railTop.setAttribute("rx", "2"); railTop.setAttribute("fill", cols.nozzle);
      railTop.setAttribute("stroke", "#2D3748"); railTop.setAttribute("stroke-width", "2");

      const railBtm = document.createElementNS(ns, "rect");
      railBtm.setAttribute("x", "90"); railBtm.setAttribute("y", "215");
      railBtm.setAttribute("width", "220"); railBtm.setAttribute("height", "12");
      railBtm.setAttribute("rx", "2"); railBtm.setAttribute("fill", cols.nozzle);
      railBtm.setAttribute("stroke", "#2D3748"); railBtm.setAttribute("stroke-width", "2");

      g.appendChild(railTop);
      g.appendChild(railBtm);

      // 7 Vertical Picket Slats
      for (let x = 105; x <= 295; x += 30) {
        const picket = document.createElementNS(ns, "polygon");
        picket.setAttribute("points", `${x-10},240 ${x-10},150 ${x},138 ${x+10},150 ${x+10},240`);
        picket.setAttribute("fill", cols.body);
        picket.setAttribute("stroke", "#2D3748"); picket.setAttribute("stroke-width", "2");
        g.appendChild(picket);
      }

      this.canvas.addElement(g);
    });

    // Trellis Preset
    document.getElementById('preset-trellis')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-trellis");
      g.setAttribute("id", `trellis_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#975A16", "#38A169");

      // Frame
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "130"); frame.setAttribute("y", "120");
      frame.setAttribute("width", "140"); frame.setAttribute("height", "140");
      frame.setAttribute("rx", "4"); frame.setAttribute("fill", "none");
      frame.setAttribute("stroke", cols.body); frame.setAttribute("stroke-width", "4");
      g.appendChild(frame);

      // Lattice Grid
      for (let offset = -100; offset <= 100; offset += 30) {
        const l1 = document.createElementNS(ns, "line");
        l1.setAttribute("x1", (130 + offset).toString()); l1.setAttribute("y1", "120");
        l1.setAttribute("x2", (270 + offset).toString()); l1.setAttribute("y2", "260");
        l1.setAttribute("stroke", "#744210"); l1.setAttribute("stroke-width", "2");

        const l2 = document.createElementNS(ns, "line");
        l2.setAttribute("x1", (270 - offset).toString()); l2.setAttribute("y1", "120");
        l2.setAttribute("x2", (130 - offset).toString()); l2.setAttribute("y2", "260");
        l2.setAttribute("stroke", "#744210"); l2.setAttribute("stroke-width", "2");

        g.appendChild(l1);
        g.appendChild(l2);
      }

      // Climbing Vine Foliage & Buds
      const vineCoords = [
        { x: 145, y: 230 }, { x: 170, y: 190 }, { x: 195, y: 210 },
        { x: 220, y: 160 }, { x: 245, y: 180 }, { x: 200, y: 140 }
      ];
      vineCoords.forEach(v => {
        const leaf = document.createElementNS(ns, "circle");
        leaf.setAttribute("cx", v.x.toString()); leaf.setAttribute("cy", v.y.toString());
        leaf.setAttribute("r", "8"); leaf.setAttribute("fill", cols.nozzle);
        g.appendChild(leaf);
      });

      this.canvas.addElement(g);
    });

    // Brick Wall Preset
    document.getElementById('preset-brick-wall')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-brick-wall");
      g.setAttribute("id", `brick_wall_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#C53030", "#EDF2F7");

      // Wall Body
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", "100"); body.setAttribute("y", "140");
      body.setAttribute("width", "200"); body.setAttribute("height", "100");
      body.setAttribute("rx", "2");
      body.setAttribute("fill", cols.body);
      body.setAttribute("stroke", "#1A202C"); body.setAttribute("stroke-width", "3");

      // Coping Cap
      const cap = document.createElementNS(ns, "rect");
      cap.setAttribute("x", "94"); cap.setAttribute("y", "130");
      cap.setAttribute("width", "212"); cap.setAttribute("height", "14");
      cap.setAttribute("rx", "2");
      cap.setAttribute("fill", cols.nozzle);
      cap.setAttribute("stroke", "#1A202C"); cap.setAttribute("stroke-width", "2");

      g.appendChild(body);
      g.appendChild(cap);

      // Mortar Horizontal Lines
      for (let y = 165; y <= 215; y += 25) {
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", "100"); line.setAttribute("y1", y.toString());
        line.setAttribute("x2", "300"); line.setAttribute("y2", y.toString());
        line.setAttribute("stroke", "#CBD5E0"); line.setAttribute("stroke-width", "2");
        g.appendChild(line);
      }

      // Vertical Staggered Mortar Joints
      const rows = [
        { y1: 140, y2: 165, startX: 130 },
        { y1: 165, y2: 190, startX: 115 },
        { y1: 190, y2: 215, startX: 130 },
        { y1: 215, y2: 240, startX: 115 }
      ];

      rows.forEach(r => {
        for (let x = r.startX; x < 300; x += 35) {
          const joint = document.createElementNS(ns, "line");
          joint.setAttribute("x1", x.toString()); joint.setAttribute("y1", r.y1.toString());
          joint.setAttribute("x2", x.toString()); joint.setAttribute("y2", r.y2.toString());
          joint.setAttribute("stroke", "#CBD5E0"); joint.setAttribute("stroke-width", "2");
          g.appendChild(joint);
        }
      });

      this.canvas.addElement(g);
    });

    // Garden Pond Preset
    document.getElementById('preset-pond')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-pond");
      g.setAttribute("id", `pond_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#3182CE", "#38A169");

      // Water Basin Body
      const basin = document.createElementNS(ns, "path");
      basin.setAttribute("d", "M 120 180 C 100 130, 220 120, 280 150 C 310 180, 270 240, 200 245 C 130 250, 100 210, 120 180 Z");
      basin.setAttribute("fill", cols.body);
      basin.setAttribute("stroke", "#1A202C"); basin.setAttribute("stroke-width", "3");

      // Water Ripple
      const ripple = document.createElementNS(ns, "path");
      ripple.setAttribute("d", "M 140 185 C 150 170, 210 160, 240 180");
      ripple.setAttribute("fill", "none");
      ripple.setAttribute("stroke", "#90CDF4"); ripple.setAttribute("stroke-width", "2");

      g.appendChild(basin);
      g.appendChild(ripple);

      // Floating Lily Pads
      const lilyPads = [
        { x: 150, y: 170, r: 12 },
        { x: 230, y: 170, r: 14 },
        { x: 190, y: 215, r: 11 }
      ];

      lilyPads.forEach((lp, idx) => {
        const pad = document.createElementNS(ns, "circle");
        pad.setAttribute("cx", lp.x.toString()); pad.setAttribute("cy", lp.y.toString());
        pad.setAttribute("r", lp.r.toString());
        pad.setAttribute("fill", cols.nozzle); pad.setAttribute("stroke", "#1C4532");
        g.appendChild(pad);

        if (idx === 1) {
          const lotus = document.createElementNS(ns, "circle");
          lotus.setAttribute("cx", lp.x.toString()); lotus.setAttribute("cy", lp.y.toString());
          lotus.setAttribute("r", "6"); lotus.setAttribute("fill", "#ED64A6");
          g.appendChild(lotus);
        }
      });

      this.canvas.addElement(g);
    });

    // Block Paving Preset
    document.getElementById('preset-block-paving')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-block-paving");
      g.setAttribute("id", `paving_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#A0AEC0", "#DD6B20");

      // Base Area
      const base = document.createElementNS(ns, "rect");
      base.setAttribute("x", "110"); base.setAttribute("y", "130");
      base.setAttribute("width", "180"); base.setAttribute("height", "130");
      base.setAttribute("rx", "4");
      base.setAttribute("fill", cols.body);
      base.setAttribute("stroke", "#1A202C"); base.setAttribute("stroke-width", "3");
      g.appendChild(base);

      // Interlocking Block Pavers
      for (let y = 135; y <= 235; y += 24) {
        for (let x = 115; x <= 265; x += 38) {
          const shiftX = ((y / 24) % 2 === 0) ? 0 : 19;
          const paver = document.createElementNS(ns, "rect");
          paver.setAttribute("x", (x + shiftX).toString());
          paver.setAttribute("y", y.toString());
          paver.setAttribute("width", "34");
          paver.setAttribute("height", "20");
          paver.setAttribute("rx", "1");
          paver.setAttribute("fill", ((x + y) % 5 === 0) ? cols.nozzle : "#CBD5E0");
          paver.setAttribute("stroke", "#2D3748"); paver.setAttribute("stroke-width", "1.5");
          g.appendChild(paver);
        }
      }

      this.canvas.addElement(g);
    });

    // Manicured Hedge Preset
    document.getElementById('preset-hedge')?.addEventListener('click', () => {
      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      g.setAttribute("class", "scada-symbol-hedge");
      g.setAttribute("id", `hedge_${Date.now().toString().slice(-4)}`);

      const cols = getSymbolColors("#276749", "#38A169");

      // Shadow
      const shadow = document.createElementNS(ns, "ellipse");
      shadow.setAttribute("cx", "200"); shadow.setAttribute("cy", "240");
      shadow.setAttribute("rx", "85"); shadow.setAttribute("ry", "10");
      shadow.setAttribute("fill", "#CBD5E0"); shadow.setAttribute("opacity", "0.5");

      // Manicured Hedge Body
      const hedge = document.createElementNS(ns, "rect");
      hedge.setAttribute("x", "110"); hedge.setAttribute("y", "150");
      hedge.setAttribute("width", "180"); hedge.setAttribute("height", "85");
      hedge.setAttribute("rx", "18");
      hedge.setAttribute("fill", cols.body);
      hedge.setAttribute("stroke", "#1C4532"); hedge.setAttribute("stroke-width", "3");

      // Leafy Top Highlight
      const highlight = document.createElementNS(ns, "rect");
      highlight.setAttribute("x", "116"); highlight.setAttribute("y", "154");
      highlight.setAttribute("width", "168"); highlight.setAttribute("height", "25");
      highlight.setAttribute("rx", "12");
      highlight.setAttribute("fill", cols.nozzle); highlight.setAttribute("opacity", "0.85");

      g.appendChild(shadow);
      g.appendChild(hedge);
      g.appendChild(highlight);
      this.canvas.addElement(g);
    });
  }
}

function generatePolygonPoints(cx, cy, rx, ry, sides) {
  const pts = [];
  const s = Math.max(3, sides);
  for (let i = 0; i < s; i++) {
    const angle = (i * 2 * Math.PI / s) - (Math.PI / 2);
    const px = Math.round((cx + rx * Math.cos(angle)) * 10) / 10;
    const py = Math.round((cy + ry * Math.sin(angle)) * 10) / 10;
    pts.push(`${px},${py}`);
  }
  return pts.join(' ');
}

function generateStarPoints(cx, cy, rx, ry, points, innerRatio = 0.4) {
  const pts = [];
  const p = Math.max(3, points);
  const totalPoints = p * 2;
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i * Math.PI / p) - (Math.PI / 2);
    const rX = (i % 2 === 0) ? rx : rx * innerRatio;
    const rY = (i % 2 === 0) ? ry : ry * innerRatio;
    const px = Math.round((cx + rX * Math.cos(angle)) * 10) / 10;
    const py = Math.round((cy + rY * Math.sin(angle)) * 10) / 10;
    pts.push(`${px},${py}`);
  }
  return pts.join(' ');
}

function getStarParameters(el) {
  const pointsStr = (el.getAttribute('points') || '').trim();
  const rawCoords = pointsStr.split(/\s+|,/).map(Number).filter(n => !isNaN(n));

  if (rawCoords.length < 6) {
    const bbox = el.getBBox();
    return {
      cx: bbox.x + bbox.width / 2,
      cy: bbox.y + bbox.height / 2,
      rx: bbox.width / 2,
      ry: bbox.height / 2
    };
  }

  let sumX = 0, sumY = 0;
  const count = rawCoords.length / 2;
  const evenDists = [];

  for (let i = 0; i < rawCoords.length; i += 2) {
    sumX += rawCoords[i];
    sumY += rawCoords[i + 1];
  }

  const cx = sumX / count;
  const cy = sumY / count;

  for (let i = 0; i < rawCoords.length; i += 4) {
    const dx = rawCoords[i] - cx;
    const dy = rawCoords[i + 1] - cy;
    evenDists.push(Math.hypot(dx, dy));
  }

  const maxDist = Math.max(...evenDists);
  const rx = (maxDist > 0) ? maxDist : (el.getBBox().width / 2);
  const ry = rx;

  return { cx, cy, rx, ry };
}
