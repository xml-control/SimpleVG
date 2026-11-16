/**
 * SimpleVG - Universal Coordinate & Attribute Transform Engine
 * Scaling, dragging, and resizing for Rect, Ellipse, Line, Text, Polyline, Path, Polygons, and Groups
 */

class SvgCanvas {
  constructor(svgElement, stageGroup, selectionLayer, defsElement) {
    this.svg = svgElement;
    this.stage = stageGroup;
    this.selectionLayer = selectionLayer;
    this.defs = defsElement;
    this.tracingLayer = document.getElementById('tracing-layer');

    this.traceState = {
      dataUrl: null,
      naturalWidth: 0,
      naturalHeight: 0,
      opacity: 0.5,
      scale: 1.0,
      posX: 0,
      posY: 0,
      visible: true,
      includeInExport: false
    };

    this.width = 500;
    this.height = 500;
    this.zoom = 1.0;

    this.gridSize = 10;
    this.snapToGrid = true;
    this.showGrid = true;

    this.selectedElements = [];
    this.clipboard = [];
    this.pasteOffsetCount = 0;
    this.activeTool = 'select';

    this.isDraggingShape = false;
    this.isResizing = false;
    this.activeHandle = null;

    this.dragStartX = 0;
    this.dragStartY = 0;
    this.initialBBox = null;
    this.initialAttrState = [];

    this.undoStack = [];
    this.redoStack = [];
    this.isRestoringState = false;

    this.onSelectionChange = null;
    this.onCanvasModified = null;

    this.init();
  }

  init() {
    this.setupViewportTransform();
    this.bindEvents();
    this.updateRulers();
    this.updateCenterLines();
    this.loadUserSettings();
    this.saveState();
  }

  setupViewportTransform() {
    this.svg.setAttribute('width', this.width);
    this.svg.setAttribute('height', this.height);
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    
    const info = document.getElementById('canvas-size-info');
    if (info) info.innerText = `Canvas: ${this.width} × ${this.height} px`;
    document.querySelectorAll('.canvas-dim-label').forEach(el => {
      el.textContent = `${this.width} × ${this.height}`;
    });

    this.updateRulers();
    this.updateCenterLines();
  }

  setCenterlineColor(color) {
    if (!color) return;
    this.centerlineColor = color;
    const lines = document.querySelectorAll('#canvas-center-lines line');
    lines.forEach(l => {
      l.setAttribute('stroke', color);
      l.style.stroke = color;
    });
    this.saveUserSettings();
  }

  updateCenterLines() {
    const group = document.getElementById('canvas-center-lines');
    const vLine = document.getElementById('center-line-v');
    const hLine = document.getElementById('center-line-h');
    const midX = this.width / 2;
    const midY = this.height / 2;

    const chkShow = document.getElementById('chk-show-centerline');
    const isExplicitlyEnabled = chkShow ? chkShow.checked : true;

    if (group) {
      group.style.display = isExplicitlyEnabled ? '' : 'none';
    }

    const activeColor = this.centerlineColor || document.getElementById('canvas-centerline-color')?.value || '#CBD5E0';

    if (vLine) {
      vLine.setAttribute('x1', midX);
      vLine.setAttribute('x2', midX);
      vLine.setAttribute('y1', 0);
      vLine.setAttribute('y2', this.height);
      vLine.setAttribute('stroke', activeColor);
      vLine.style.stroke = activeColor;
    }
    if (hLine) {
      hLine.setAttribute('y1', midY);
      hLine.setAttribute('y2', midY);
      hLine.setAttribute('x1', 0);
      hLine.setAttribute('x2', this.width);
      hLine.setAttribute('stroke', activeColor);
      hLine.style.stroke = activeColor;
    }
  }

  saveUserSettings() {
    try {
      const settings = {
        canvasWidth: parseInt(document.getElementById('canvas-prop-w')?.value || '500', 10),
        canvasHeight: parseInt(document.getElementById('canvas-prop-h')?.value || '500', 10),
        gridSize: parseInt(document.getElementById('canvas-prop-grid')?.value || '10', 10),
        showCenterlines: document.getElementById('chk-show-centerline')?.checked !== false,
        centerlineColor: document.getElementById('canvas-centerline-color')?.value || '#CBD5E0',
        defaultFill: document.getElementById('canvas-default-fill')?.value || '#3182CE',
        defaultStroke: document.getElementById('canvas-default-stroke')?.value || '#2D3748',
        defaultStrokeWidth: parseInt(document.getElementById('canvas-default-stroke-width')?.value || '2', 10),
        isaGrayOnDrop: document.getElementById('chk-isa-gray-on-drop')?.checked || false,
        showRulers: !document.getElementById('canvas-artboard-container')?.classList.contains('rulers-hidden'),
        showGrid: document.getElementById('btn-toggle-grid')?.classList.contains('active'),
        snapToGrid: document.getElementById('btn-toggle-snap')?.classList.contains('active')
      };
      localStorage.setItem('simplevg_user_settings', JSON.stringify(settings));
    } catch (err) {
      console.warn("Could not save user settings to localStorage", err);
    }
  }

  loadUserSettings() {
    try {
      const raw = localStorage.getItem('simplevg_user_settings');
      if (!raw) return;
      const settings = JSON.parse(raw);

      if (settings.canvasWidth && settings.canvasHeight) {
        this.width = settings.canvasWidth;
        this.height = settings.canvasHeight;
        this.setupViewportTransform();
        const wInput = document.getElementById('canvas-prop-w');
        const hInput = document.getElementById('canvas-prop-h');
        if (wInput) wInput.value = settings.canvasWidth;
        if (hInput) hInput.value = settings.canvasHeight;
      }

      if (settings.gridSize) {
        this.updateGridPattern(settings.gridSize);
        const gridInput = document.getElementById('canvas-prop-grid');
        if (gridInput) gridInput.value = settings.gridSize;
      }

      if (settings.showCenterlines !== undefined) {
        const chkShow = document.getElementById('chk-show-centerline');
        if (chkShow) chkShow.checked = settings.showCenterlines;
        this.updateCenterLines();
      }

      if (settings.centerlineColor) {
        this.setCenterlineColor(settings.centerlineColor);
        const chip = document.getElementById('canvas-centerline-color-chip');
        const label = document.getElementById('canvas-centerline-color-label');
        const input = document.getElementById('canvas-centerline-color');
        if (chip) chip.style.background = settings.centerlineColor;
        if (label) label.textContent = settings.centerlineColor.toUpperCase();
        if (input) input.value = settings.centerlineColor;
      }

      if (settings.defaultFill) {
        const chip = document.getElementById('canvas-default-fill-chip');
        const label = document.getElementById('canvas-default-fill-label');
        const input = document.getElementById('canvas-default-fill');
        if (chip) chip.style.background = settings.defaultFill;
        if (label) label.textContent = settings.defaultFill.toUpperCase();
        if (input) input.value = settings.defaultFill;
      }

      if (settings.defaultStroke) {
        const chip = document.getElementById('canvas-default-stroke-chip');
        const label = document.getElementById('canvas-default-stroke-label');
        const input = document.getElementById('canvas-default-stroke');
        if (chip) chip.style.background = settings.defaultStroke;
        if (label) label.textContent = settings.defaultStroke.toUpperCase();
        if (input) input.value = settings.defaultStroke;
      }

      if (settings.defaultStrokeWidth !== undefined) {
        const strokeWidthInput = document.getElementById('canvas-default-stroke-width');
        if (strokeWidthInput) strokeWidthInput.value = settings.defaultStrokeWidth;
      }

      if (settings.isaGrayOnDrop !== undefined) {
        const chkIsa = document.getElementById('chk-isa-gray-on-drop');
        if (chkIsa) chkIsa.checked = settings.isaGrayOnDrop;
      }

      if (settings.showRulers !== undefined) {
        this.setRulers(settings.showRulers);
        const btnRuler = document.getElementById('btn-toggle-rulers');
        if (btnRuler) btnRuler.classList.toggle('active', settings.showRulers);
      }

      if (settings.showGrid !== undefined) {
        this.showGrid = settings.showGrid;
        const gridBg = document.getElementById('canvas-grid-bg');
        if (gridBg) gridBg.style.display = settings.showGrid ? 'block' : 'none';
        const btnGrid = document.getElementById('btn-toggle-grid');
        if (btnGrid) btnGrid.classList.toggle('active', settings.showGrid);
      }

      if (settings.snapToGrid !== undefined) {
        this.snapToGrid = settings.snapToGrid;
        const btnSnap = document.getElementById('btn-toggle-snap');
        if (btnSnap) btnSnap.classList.toggle('active', settings.snapToGrid);
      }
    } catch (err) {
      console.warn("Could not load user settings from localStorage", err);
    }
  }

  updateRulers() {
    const topSvg = document.getElementById('ruler-top-svg');
    const leftSvg = document.getElementById('ruler-left-svg');
    if (!topSvg || !leftSvg) return;

    topSvg.setAttribute('width', this.width + 30);
    topSvg.setAttribute('height', '24');
    topSvg.setAttribute('viewBox', `0 0 ${this.width + 30} 24`);

    leftSvg.setAttribute('width', '24');
    leftSvg.setAttribute('height', this.height + 30);
    leftSvg.setAttribute('viewBox', `0 0 24 ${this.height + 30}`);

    const ns = "http://www.w3.org/2000/svg";
    topSvg.innerHTML = '';
    leftSvg.innerHTML = '';

    const step = 50;
    const subStep = 10;

    // Top horizontal ruler
    for (let x = 0; x <= this.width; x += subStep) {
      const isMajor = x % step === 0;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", x);
      line.setAttribute("y1", isMajor ? 6 : 14);
      line.setAttribute("x2", x);
      line.setAttribute("y2", 24);
      line.setAttribute("stroke", "var(--text-muted)");
      line.setAttribute("stroke-width", isMajor ? "1" : "0.5");
      topSvg.appendChild(line);

      if (isMajor) {
        const text = document.createElementNS(ns, "text");
        if (x === 0) {
          text.setAttribute("x", x + 3);
        } else {
          text.setAttribute("x", x - 3);
          text.setAttribute("text-anchor", "end");
        }
        text.setAttribute("y", 12);
        text.setAttribute("fill", "var(--text-muted)");
        text.setAttribute("font-size", "9");
        text.setAttribute("font-family", "sans-serif");
        text.textContent = x;
        topSvg.appendChild(text);
      }
    }

    // Left vertical ruler
    for (let y = 0; y <= this.height; y += subStep) {
      const isMajor = y % step === 0;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", isMajor ? 12 : 17);
      line.setAttribute("y1", y);
      line.setAttribute("x2", 24);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "var(--text-muted)");
      line.setAttribute("stroke-width", isMajor ? "1" : "0.5");
      leftSvg.appendChild(line);

      if (isMajor && y > 0) {
        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", "1");
        text.setAttribute("y", y - 2);
        text.setAttribute("fill", "var(--text-muted)");
        text.setAttribute("font-size", "8");
        text.setAttribute("font-family", "sans-serif");
        text.textContent = y;
        leftSvg.appendChild(text);
      }
    }
  }

  setRulers(show) {
    const artboard = document.getElementById('canvas-artboard-container');
    if (artboard) {
      if (show) {
        artboard.classList.remove('rulers-hidden');
      } else {
        artboard.classList.add('rulers-hidden');
      }
    }
  }

  setZoom(level) {
    this.zoom = Math.max(0.2, Math.min(5.0, level));
    const artboard = document.getElementById('canvas-artboard-container');
    const scrollPad = document.querySelector('.canvas-scroll-pad');

    if (artboard) {
      artboard.style.transform = `scale(${this.zoom})`;
      artboard.style.transformOrigin = `center center`;
    }

    if (scrollPad) {
      const artboardW = (this.width + 24) * this.zoom;
      const artboardH = (this.height + 24) * this.zoom;
      scrollPad.style.minWidth = `${artboardW + 160}px`;
      scrollPad.style.minHeight = `${artboardH + 160}px`;
    }

    const zoomText = document.getElementById('zoom-level');
    if (zoomText) zoomText.innerText = `${Math.round(this.zoom * 100)}%`;
  }

  centerCanvas() {
    const wrapper = document.getElementById('canvas-workspace-wrapper');
    if (wrapper) {
      const scrollX = (wrapper.scrollWidth - wrapper.clientWidth) / 2;
      const scrollY = (wrapper.scrollHeight - wrapper.clientHeight) / 2;
      wrapper.scrollLeft = Math.max(0, scrollX);
      wrapper.scrollTop = Math.max(0, scrollY);
    }
  }

  setCanvasSize(w, h) {
    this.width = parseInt(w, 10);
    this.height = parseInt(h, 10);
    this.setupViewportTransform();

    const info = document.getElementById('canvas-size-info');
    if (info) info.innerText = `Canvas: ${this.width} × ${this.height} px`;
    document.querySelectorAll('.canvas-dim-label').forEach(el => {
      el.textContent = `${this.width} × ${this.height}`;
    });

    const wInput = document.getElementById('canvas-prop-w');
    const hInput = document.getElementById('canvas-prop-h');
    if (wInput && parseInt(wInput.value, 10) !== this.width) wInput.value = this.width;
    if (hInput && parseInt(hInput.value, 10) !== this.height) hInput.value = this.height;

    if (this.onCanvasModified) this.onCanvasModified();
  }

  setGrid(show, snap, size) {
    this.showGrid = show;
    this.snapToGrid = snap;
    if (size) this.gridSize = size;

    const bgRect = document.getElementById('canvas-grid-bg');
    if (bgRect) {
      bgRect.style.display = this.showGrid ? 'block' : 'none';
    }

    const pattern = document.getElementById('grid-pattern');
    if (pattern && size) {
      pattern.setAttribute('width', size);
      pattern.setAttribute('height', size);
      const path = pattern.querySelector('path');
      if (path) path.setAttribute('d', `M ${size} 0 L 0 0 0 ${size}`);
      const circle = pattern.querySelector('circle');
      if (circle) {
        circle.setAttribute('cx', size);
        circle.setAttribute('cy', size);
      }
    }
  }

  snap(val) {
    if (!this.snapToGrid) return val;
    return Math.round(val / this.gridSize) * this.gridSize;
  }

  getPointerCoords(evt) {
    const rect = this.svg.getBoundingClientRect();
    const clientX = evt.clientX || (evt.touches && evt.touches[0].clientX) || 0;
    const clientY = evt.clientY || (evt.touches && evt.touches[0].clientY) || 0;

    let x = (clientX - rect.left) / this.zoom;
    let y = (clientY - rect.top) / this.zoom;

    x = Math.max(0, Math.min(this.width, x));
    y = Math.max(0, Math.min(this.height, y));

    return { x, y };
  }

  getLocalPointerCoords(el, stageCoords) {
    const transform = el.getAttribute('transform');
    if (!transform) return { x: stageCoords.x, y: stageCoords.y };

    try {
      const ctm = el.getCTM();
      if (ctm) {
        const pt = this.svg.createSVGPoint();
        pt.x = stageCoords.x;
        pt.y = stageCoords.y;
        const localPt = pt.matrixTransform(ctm.inverse());
        return { x: localPt.x, y: localPt.y };
      }
    } catch (e) {}

    return { x: stageCoords.x, y: stageCoords.y };
  }

  bindEvents() {
    this.svg.addEventListener('mousemove', (e) => {
      const coords = this.getPointerCoords(e);
      const coordsInfo = document.getElementById('mouse-coords');
      if (coordsInfo) {
        coordsInfo.innerText = `X: ${Math.round(coords.x)}, Y: ${Math.round(coords.y)}`;
      }

      if (this.isDraggingShape) {
        this.handleShapeDrag(coords);
      } else if (this.isResizing) {
        if (this.activeHandle === 'pivot') {
          this.handlePivotDrag(coords);
        } else if (this.activeHandle === 'rotate') {
          this.handleRotateDrag(coords);
        } else if (this.activeHandle === 'path-node') {
          this.handlePathNodeDrag(coords);
        } else {
          this.handleResizeDrag(coords);
        }
      }
    });

    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.panScrollLeft = 0;
    this.panScrollTop = 0;

    const wrapper = document.getElementById('canvas-workspace-wrapper');

    this.svg.addEventListener('mousedown', (e) => {
      if (this.activeTool === 'pan' && wrapper) {
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.panScrollLeft = wrapper.scrollLeft;
        this.panScrollTop = wrapper.scrollTop;
        this.svg.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }

      if (this.activeTool !== 'select') return;

      const coords = this.getPointerCoords(e);

      // Handle resize click
      if (e.target.dataset && e.target.dataset.handle) {
        e.stopPropagation();
        this.isResizing = true;
        this.activeHandle = e.target.dataset.handle;
        this.dragStartX = coords.x;
        this.dragStartY = coords.y;
        if (this.selectedElements[0]) {
          this.initialBBox = this.getElementStageBBox(this.selectedElements[0]);
          this.captureInitialState(this.selectedElements[0]);
          if (this.activeHandle === 'path-node') {
            this.activePathNode = {
              el: this.selectedElements[0],
              cmdIndex: parseInt(e.target.dataset.cmdIndex, 10),
              pointType: e.target.dataset.pointType,
              initialCmds: this.parsePathD(this.selectedElements[0].getAttribute('d'))
            };
          }
        }
        return;
      }

      // Shape selection click
      let targetShape = e.target;
      while (targetShape && targetShape.parentNode !== this.stage && targetShape !== this.svg) {
        targetShape = targetShape.parentNode;
      }

      if (targetShape && targetShape.parentNode === this.stage) {
        e.stopPropagation();
        this.selectElement(targetShape, e.shiftKey);
        this.isDraggingShape = true;
        this.dragStartX = coords.x;
        this.dragStartY = coords.y;
        this.captureInitialState(targetShape);
        return;
      }

      if (e.target === this.svg || e.target.id === 'canvas-grid-bg') {
        if (!e.shiftKey) this.clearSelection();
        this.isSelectingMarquee = true;
        this.marqueeStartX = coords.x;
        this.marqueeStartY = coords.y;
        this.createMarqueeRect(coords.x, coords.y);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning && wrapper) {
        const dx = e.clientX - this.panStartX;
        const dy = e.clientY - this.panStartY;
        wrapper.scrollLeft = this.panScrollLeft - dx;
        wrapper.scrollTop = this.panScrollTop - dy;
        return;
      }

      if (this.isSelectingMarquee && this.marqueeRect) {
        const coords = this.getPointerCoords(e);
        const x = Math.min(coords.x, this.marqueeStartX);
        const y = Math.min(coords.y, this.marqueeStartY);
        const w = Math.abs(coords.x - this.marqueeStartX);
        const h = Math.abs(coords.y - this.marqueeStartY);
        this.marqueeRect.setAttribute('x', x);
        this.marqueeRect.setAttribute('y', y);
        this.marqueeRect.setAttribute('width', w);
        this.marqueeRect.setAttribute('height', h);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.svg.style.cursor = 'grab';
      }
      if (this.isSelectingMarquee && this.marqueeRect) {
        this.isSelectingMarquee = false;
        const mX = parseFloat(this.marqueeRect.getAttribute('x'));
        const mY = parseFloat(this.marqueeRect.getAttribute('y'));
        const mW = parseFloat(this.marqueeRect.getAttribute('width'));
        const mH = parseFloat(this.marqueeRect.getAttribute('height'));

        this.marqueeRect.remove();
        this.marqueeRect = null;

        if (mW > 4 || mH > 4) {
          const children = Array.from(this.stage.children);
          children.forEach(child => {
            if (child.id === 'canvas-grid-bg') return;
            const bbox = child.getBBox();
            // Check bounding box intersection
            if (bbox.x + bbox.width >= mX && bbox.x <= mX + mW &&
                bbox.y + bbox.height >= mY && bbox.y <= mY + mH) {
              this.selectElement(child, true);
            }
          });
        }
      }
      if (this.isDraggingShape || this.isResizing) {
        this.isDraggingShape = false;
        this.isResizing = false;
        this.activeHandle = null;
        this.updateSelectionHandles();
        this.notifyCanvasModified();
      }
    });

    this.svg.addEventListener('dblclick', (e) => {
      if (e.target.dataset && e.target.dataset.handle === 'pivot') {
        e.stopPropagation();
        this.selectedElements.forEach(el => this.resetPivot(el));
      }
    });
  }

  createMarqueeRect(x, y) {
    const ns = "http://www.w3.org/2000/svg";
    this.marqueeRect = document.createElementNS(ns, "rect");
    this.marqueeRect.setAttribute("x", x);
    this.marqueeRect.setAttribute("y", y);
    this.marqueeRect.setAttribute("width", 0);
    this.marqueeRect.setAttribute("height", 0);
    this.marqueeRect.setAttribute("fill", "rgba(49, 130, 206, 0.15)");
    this.marqueeRect.setAttribute("stroke", "#3182CE");
    this.marqueeRect.setAttribute("stroke-width", "1");
    this.marqueeRect.setAttribute("stroke-dasharray", "3,3");
    this.selectionLayer.appendChild(this.marqueeRect);
  }

  captureInitialState(rootEl) {
    this.initialAttrState = [];
    const transformAttr = rootEl.getAttribute('transform') || '';
    this.isGroupTransform = (rootEl.tagName.toLowerCase() === 'g' || transformAttr.length > 0);

    let localBBox = { x: 0, y: 0, width: 100, height: 100 };
    try {
      localBBox = rootEl.getBBox();
    } catch (e) {}

    const stageBBox = this.getElementStageBBox(rootEl);

    let tx = 0, ty = 0, sx = 1, sy = 1;
    const matchTranslate = transformAttr.match(/translate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*))?\)/i);
    if (matchTranslate) {
      tx = parseFloat(matchTranslate[1]);
      ty = matchTranslate[2] !== undefined ? parseFloat(matchTranslate[2]) : tx;
    }
    const matchScale = transformAttr.match(/scale\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*))?\)/i);
    if (matchScale) {
      sx = parseFloat(matchScale[1]);
      sy = matchScale[2] !== undefined ? parseFloat(matchScale[2]) : sx;
    }

    this.groupTransformState = {
      localBBox,
      initialTx: tx,
      initialTy: ty,
      initialSx: sx,
      initialSy: sy,
      stageTopX: stageBBox.x,
      stageTopY: stageBBox.y,
      stageW: stageBBox.width,
      stageH: stageBBox.height
    };

    const elementsToRecord = (this.selectedElements && this.selectedElements.length > 0)
      ? this.selectedElements
      : [rootEl];

    elementsToRecord.forEach(item => {
      const tag = item.tagName.toLowerCase();
      let state = { el: item, tag };

      const itemTransform = item.getAttribute('transform') || '';
      let itemTx = 0, itemTy = 0, itemSx = 1, itemSy = 1;
      const mTr = itemTransform.match(/^\s*translate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*))?\)/i);
      if (mTr) {
        itemTx = parseFloat(mTr[1]);
        itemTy = mTr[2] !== undefined ? parseFloat(mTr[2]) : itemTx;
      }
      const mSc = itemTransform.match(/scale\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*))?\)/i);
      if (mSc) {
        itemSx = parseFloat(mSc[1]);
        itemSy = mSc[2] !== undefined ? parseFloat(mSc[2]) : itemSx;
      }
      state.initialTx = itemTx;
      state.initialTy = itemTy;
      state.initialSx = itemSx;
      state.initialSy = itemSy;
      state.initialTransform = itemTransform;

      // Capture pivot point & initial drag angle for fixed rotation
      const pivot = this.getStagePivotPoint(item);
      state.px = pivot.px;
      state.py = pivot.py;
      state.startRad = Math.atan2(this.dragStartY - pivot.py, this.dragStartX - pivot.px);

      const rotMatch = itemTransform.match(/^\s*rotate\(\s*(-?\d+\.?\d*)/i);
      state.initialDeg = rotMatch ? parseFloat(rotMatch[1]) : 0;

      if (tag === 'rect' || tag === 'text') {
        state.x = parseFloat(item.getAttribute('x') || 0);
        state.y = parseFloat(item.getAttribute('y') || 0);
        state.w = parseFloat(item.getAttribute('width') || 0);
        state.h = parseFloat(item.getAttribute('height') || 0);
        state.fontSize = parseFloat(item.getAttribute('font-size') || 20);
      } else if (tag === 'ellipse' || tag === 'circle') {
        state.cx = parseFloat(item.getAttribute('cx') || 0);
        state.cy = parseFloat(item.getAttribute('cy') || 0);
        state.rx = parseFloat(item.getAttribute('rx') || 0);
        state.ry = parseFloat(item.getAttribute('ry') || 0);
        state.r = parseFloat(item.getAttribute('r') || 0);
      } else if (tag === 'line') {
        state.x1 = parseFloat(item.getAttribute('x1') || 0);
        state.y1 = parseFloat(item.getAttribute('y1') || 0);
        state.x2 = parseFloat(item.getAttribute('x2') || 0);
        state.y2 = parseFloat(item.getAttribute('y2') || 0);
      } else if (tag === 'polyline' || tag === 'polygon') {
        state.points = item.getAttribute('points') || '';
      } else if (tag === 'path') {
        state.d = item.getAttribute('d') || '';
      }
      this.initialAttrState.push(state);
    });
  }

  handleShapeDrag(coords) {
    const dx = this.snap(coords.x - this.dragStartX);
    const dy = this.snap(coords.y - this.dragStartY);

    this.initialAttrState.forEach(st => {
      const item = st.el;
      let transform = item.getAttribute('transform');
      if (st.tag === 'g' || (transform !== null && transform.trim() !== '')) {
        const newTx = st.initialTx + dx;
        const newTy = st.initialTy + dy;

        transform = transform || '';
        if (/^\s*translate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*))?\)/i.test(transform)) {
          transform = transform.replace(/^\s*translate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*))?\)/i, `translate(${newTx.toFixed(2)}, ${newTy.toFixed(2)})`);
        } else if (transform.trim() !== '') {
          transform = `translate(${newTx.toFixed(2)}, ${newTy.toFixed(2)}) ${transform}`;
        } else {
          transform = `translate(${newTx.toFixed(2)}, ${newTy.toFixed(2)})`;
        }
        item.setAttribute('transform', transform);
      } else {
        if (st.tag === 'rect' || st.tag === 'text') {
          item.setAttribute('x', st.x + dx);
          item.setAttribute('y', st.y + dy);
        } else if (st.tag === 'ellipse' || st.tag === 'circle') {
          item.setAttribute('cx', st.cx + dx);
          item.setAttribute('cy', st.cy + dy);
        } else if (st.tag === 'line') {
          item.setAttribute('x1', st.x1 + dx);
          item.setAttribute('y1', st.y1 + dy);
          item.setAttribute('x2', st.x2 + dx);
          item.setAttribute('y2', st.y2 + dy);
        } else if (st.tag === 'polyline' || st.tag === 'polygon') {
          const origPoints = st.points.trim().split(/\s+|,/);
          let newPoints = [];
          for (let i = 0; i < origPoints.length; i += 2) {
            if (origPoints[i] !== undefined && origPoints[i+1] !== undefined) {
              const px = parseFloat(origPoints[i]) + dx;
              const py = parseFloat(origPoints[i+1]) + dy;
              newPoints.push(`${px},${py}`);
            }
          }
          item.setAttribute('points', newPoints.join(' '));
        } else if (st.tag === 'path') {
          item.setAttribute('d', this.offsetPathData(st.d, dx, dy));
        }
      }
    });

    this.updateSelectionHandles();
    if (this.onCanvasModified) this.onCanvasModified();
  }

  offsetPathData(d, dx, dy) {
    return d.replace(/([MLCA])\s*([^MLCA]+)/gi, (match, cmd, argsStr) => {
      const nums = argsStr.trim().split(/[\s,]+/).map(Number);
      const upperCmd = cmd.toUpperCase();

      if (upperCmd === 'M' || upperCmd === 'L') {
        if (nums.length >= 2) {
          return `${cmd} ${nums[0] + dx} ${nums[1] + dy}`;
        }
      } else if (upperCmd === 'C') {
        if (nums.length >= 6) {
          return `${cmd} ${nums[0] + dx} ${nums[1] + dy} ${nums[2] + dx} ${nums[3] + dy} ${nums[4] + dx} ${nums[5] + dy}`;
        }
      } else if (upperCmd === 'A') {
        if (nums.length >= 7) {
          return `${cmd} ${nums[0]} ${nums[1]} ${nums[2]} ${nums[3]} ${nums[4]} ${nums[5] + dx} ${nums[6] + dy}`;
        }
      }
      return match;
    });
  }

  moveElement(rootEl, dx, dy) {
    let transform = rootEl.getAttribute('transform');
    if (transform) {
      if (/^\s*translate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*))?\)/i.test(transform)) {
        transform = transform.replace(/^\s*translate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*))?\)/i, (m, tx, ty) => {
          const curTx = parseFloat(tx);
          const curTy = ty !== undefined ? parseFloat(ty) : curTx;
          return `translate(${(curTx + dx).toFixed(2)}, ${(curTy + dy).toFixed(2)})`;
        });
      } else {
        transform = `translate(${dx.toFixed(2)}, ${dy.toFixed(2)}) ${transform}`;
      }
      rootEl.setAttribute('transform', transform);
      return;
    }

    const moveItem = (item) => {
      const tag = item.tagName.toLowerCase();
      if (tag === 'rect' || tag === 'text') {
        const x = parseFloat(item.getAttribute('x') || 0);
        const y = parseFloat(item.getAttribute('y') || 0);
        item.setAttribute('x', x + dx);
        item.setAttribute('y', y + dy);
      } else if (tag === 'ellipse' || tag === 'circle') {
        const cx = parseFloat(item.getAttribute('cx') || 0);
        const cy = parseFloat(item.getAttribute('cy') || 0);
        item.setAttribute('cx', cx + dx);
        item.setAttribute('cy', cy + dy);
      } else if (tag === 'line') {
        const x1 = parseFloat(item.getAttribute('x1') || 0);
        const y1 = parseFloat(item.getAttribute('y1') || 0);
        const x2 = parseFloat(item.getAttribute('x2') || 0);
        const y2 = parseFloat(item.getAttribute('y2') || 0);
        item.setAttribute('x1', x1 + dx);
        item.setAttribute('y1', y1 + dy);
        item.setAttribute('x2', x2 + dx);
        item.setAttribute('y2', y2 + dy);
      } else if (tag === 'polyline' || tag === 'polygon') {
        const origPoints = (item.getAttribute('points') || '').trim().split(/\s+|,/);
        let newPoints = [];
        for (let i = 0; i < origPoints.length; i += 2) {
          if (origPoints[i] !== undefined && origPoints[i+1] !== undefined) {
            const px = parseFloat(origPoints[i]) + dx;
            const py = parseFloat(origPoints[i+1]) + dy;
            newPoints.push(`${px},${py}`);
          }
        }
        item.setAttribute('points', newPoints.join(' '));
      } else if (tag === 'path') {
        const origD = item.getAttribute('d') || '';
        item.setAttribute('d', this.offsetPathData(origD, dx, dy));
      }
    };

    if (rootEl.tagName.toLowerCase() === 'g') {
      const descendants = rootEl.querySelectorAll('*');
      descendants.forEach(desc => moveItem(desc));
    } else {
      moveItem(rootEl);
    }
  }

  nudgeSelected(dx, dy) {
    if (this.selectedElements.length === 0) return;
    this.selectedElements.forEach(el => {
      this.moveElement(el, dx, dy);
    });
    this.updateSelectionHandles();
    this.notifyCanvasModified();
  }

  handleResizeDrag(coords) {
    if (!this.selectedElements[0] || !this.initialBBox) return;

    const rootEl = this.selectedElements[0];
    const origBBox = this.initialBBox;
    const handle = this.activeHandle;

    if (handle === 'line-p1' || handle === 'line-p2') {
      const targetCoords = this.getLocalPointerCoords(rootEl, coords);
      const curX = this.snap(targetCoords.x);
      const curY = this.snap(targetCoords.y);

      if (handle === 'line-p1') {
        rootEl.setAttribute('x1', curX);
        rootEl.setAttribute('y1', curY);
      } else {
        rootEl.setAttribute('x2', curX);
        rootEl.setAttribute('y2', curY);
      }
      this.updateSelectionHandles();
      if (this.onCanvasModified) this.onCanvasModified();
      return;
    }

    if (this.isGroupTransform && this.groupTransformState) {
      const st = this.groupTransformState;
      const curX = this.snap(coords.x);
      const curY = this.snap(coords.y);

      let topX = st.stageTopX;
      let topY = st.stageTopY;
      let stageW = st.stageW;
      let stageH = st.stageH;

      let newW = stageW;
      let newH = stageH;

      const minDimGroup = (st.localBBox.width === 0 || st.localBBox.height === 0) ? 0 : 10;

      if (handle.includes('e')) newW = Math.max(minDimGroup, curX - topX);
      if (handle.includes('s')) newH = Math.max(minDimGroup, curY - topY);
      if (handle.includes('w')) {
        newW = Math.max(minDimGroup, (topX + stageW) - curX);
        topX = (topX + stageW) - newW;
      }
      if (handle.includes('n')) {
        newH = Math.max(minDimGroup, (topY + stageH) - curY);
        topY = (topY + stageH) - newH;
      }

      const newScaleX = (st.initialSx >= 0 ? 1 : -1) * (st.localBBox.width > 0 ? newW / st.localBBox.width : 1);
      const newScaleY = (st.initialSy >= 0 ? 1 : -1) * (st.localBBox.height > 0 ? newH / st.localBBox.height : 1);

      const newTx = newScaleX >= 0
        ? (topX - st.localBBox.x * newScaleX)
        : ((topX + newW) - st.localBBox.x * newScaleX);

      const newTy = newScaleY >= 0
        ? (topY - st.localBBox.y * newScaleY)
        : ((topY + newH) - st.localBBox.y * newScaleY);

      rootEl.setAttribute('transform', `translate(${newTx.toFixed(2)}, ${newTy.toFixed(2)}) scale(${newScaleX.toFixed(4)}, ${newScaleY.toFixed(4)})`);
      this.updateSelectionHandles();
      if (this.onCanvasModified) this.onCanvasModified();
      return;
    }

    let targetCoords = { x: coords.x, y: coords.y };

    // Un-rotate pointer coords into local space if element is rotated
    const transform = rootEl.getAttribute('transform');
    let deg = 0;
    if (transform && transform.includes('rotate')) {
      const match = transform.match(/rotate\(\s*(-?\d+\.?\d*)\s*(?:,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*))?\)/);
      if (match) {
        deg = parseFloat(match[1]);
        const cx = match[2] !== undefined ? parseFloat(match[2]) : (origBBox.x + origBBox.width / 2);
        const cy = match[3] !== undefined ? parseFloat(match[3]) : (origBBox.y + origBBox.height / 2);

        const rad = -deg * Math.PI / 180;
        const dx = coords.x - cx;
        const dy = coords.y - cy;
        targetCoords.x = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
        targetCoords.y = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
      }
    }

    const curX = this.snap(targetCoords.x);
    const curY = this.snap(targetCoords.y);

    let newX = origBBox.x;
    let newY = origBBox.y;
    let newW = origBBox.width;
    let newH = origBBox.height;

    const is1D = (rootEl.tagName.toLowerCase() === 'line' || rootEl.tagName.toLowerCase() === 'polyline' || rootEl.tagName.toLowerCase() === 'path');
    const minDim = is1D ? 0 : 10;

    if (handle.includes('e')) newW = Math.max(minDim, curX - origBBox.x);
    if (handle.includes('s')) newH = Math.max(minDim, curY - origBBox.y);
    if (handle.includes('w')) {
      const diffX = origBBox.x - curX;
      newW = Math.max(minDim, origBBox.width + diffX);
      newX = curX;
    }
    if (handle.includes('n')) {
      const diffY = origBBox.y - curY;
      newH = Math.max(minDim, origBBox.height + diffY);
      newY = curY;
    }

    const scaleX = origBBox.width > 0 ? newW / origBBox.width : 1;
    const scaleY = origBBox.height > 0 ? newH / origBBox.height : 1;

    this.initialAttrState.forEach(st => {
      const item = st.el;
      if (st.tag === 'rect') {
        const relX = st.x - origBBox.x;
        const relY = st.y - origBBox.y;
        item.setAttribute('x', newX + relX * scaleX);
        item.setAttribute('y', newY + relY * scaleY);
        if (st.w) item.setAttribute('width', st.w * scaleX);
        if (st.h) item.setAttribute('height', st.h * scaleY);
      } else if (st.tag === 'text') {
        const relX = st.x - origBBox.x;
        const relY = st.y - origBBox.y;
        item.setAttribute('x', newX + relX * scaleX);
        item.setAttribute('y', newY + relY * scaleY);
        const newFontSize = Math.max(8, Math.round(st.fontSize * Math.mean([scaleX, scaleY])));
        item.setAttribute('font-size', newFontSize);
      } else if (st.tag === 'ellipse' || st.tag === 'circle') {
        const relCX = st.cx - origBBox.x;
        const relCY = st.cy - origBBox.y;
        item.setAttribute('cx', newX + relCX * scaleX);
        item.setAttribute('cy', newY + relCY * scaleY);
        if (st.rx) item.setAttribute('rx', st.rx * scaleX);
        if (st.ry) item.setAttribute('ry', st.ry * scaleY);
        if (st.r) {
          const avgScale = (scaleX + scaleY) / 2;
          item.setAttribute('r', st.r * avgScale);
        }
      } else if (st.tag === 'line') {
        const relX1 = st.x1 - origBBox.x;
        const relY1 = st.y1 - origBBox.y;
        const relX2 = st.x2 - origBBox.x;
        const relY2 = st.y2 - origBBox.y;

        if (origBBox.height === 0 && (handle.includes('n') || handle.includes('s'))) {
          // Horizontal line: dragging n/s expands line vertically into a diagonal
          if (handle.includes('s')) {
            item.setAttribute('y2', curY);
          } else {
            item.setAttribute('y1', curY);
          }
        } else if (origBBox.width === 0 && (handle.includes('e') || handle.includes('w'))) {
          // Vertical line: dragging e/w expands line horizontally into a diagonal
          if (handle.includes('e')) {
            item.setAttribute('x2', curX);
          } else {
            item.setAttribute('x1', curX);
          }
        } else {
          item.setAttribute('x1', newX + relX1 * scaleX);
          item.setAttribute('y1', newY + relY1 * scaleY);
          item.setAttribute('x2', newX + relX2 * scaleX);
          item.setAttribute('y2', newY + relY2 * scaleY);
        }
      } else if (st.tag === 'polyline' || st.tag === 'polygon') {
        const origPoints = st.points.trim().split(/\s+|,/);
        let newPoints = [];
        for (let i = 0; i < origPoints.length; i += 2) {
          if (origPoints[i] !== undefined && origPoints[i+1] !== undefined) {
            const relPX = parseFloat(origPoints[i]) - origBBox.x;
            const relPY = parseFloat(origPoints[i+1]) - origBBox.y;
            const px = newX + relPX * scaleX;
            const py = newY + relPY * scaleY;
            newPoints.push(`${px},${py}`);
          }
        }
        item.setAttribute('points', newPoints.join(' '));
      } else if (st.tag === 'path') {
        const newD = st.d.replace(/([MLCA])\s*([^MLCA]+)/gi, (match, cmd, argsStr) => {
          const nums = argsStr.trim().split(/[\s,]+/).map(Number);
          const upperCmd = cmd.toUpperCase();
          if (upperCmd === 'M' || upperCmd === 'L') {
            if (nums.length >= 2) {
              const relPX = nums[0] - origBBox.x;
              const relPY = nums[1] - origBBox.y;
              return `${cmd} ${newX + relPX * scaleX} ${newY + relPY * scaleY}`;
            }
          } else if (upperCmd === 'C') {
            if (nums.length >= 6) {
              // C cp1x cp1y cp2x cp2y endx endy
              const rel1X = nums[0] - origBBox.x;
              const rel1Y = nums[1] - origBBox.y;
              const rel2X = nums[2] - origBBox.x;
              const rel2Y = nums[3] - origBBox.y;
              const relEndX = nums[4] - origBBox.x;
              const relEndY = nums[5] - origBBox.y;
              return `${cmd} ${newX + rel1X * scaleX} ${newY + rel1Y * scaleY} ${newX + rel2X * scaleX} ${newY + rel2Y * scaleY} ${newX + relEndX * scaleX} ${newY + relEndY * scaleY}`;
            }
          } else if (upperCmd === 'A') {
            if (nums.length >= 7) {
              const [rx, ry, rot, laf, sf, px, py] = nums;
              const relPX = px - origBBox.x;
              const relPY = py - origBBox.y;
              return `${cmd} ${rx * scaleX} ${ry * scaleY} ${rot} ${laf} ${sf} ${newX + relPX * scaleX} ${newY + relPY * scaleY}`;
            }
          }
          return match;
        });
        item.setAttribute('d', newD);
      }
    });

    // Update rotation transform origin center point if rotated during resize
    if (this.selectedElements[0]) {
      const rootEl = this.selectedElements[0];
      const transform = rootEl.getAttribute('transform');
      if (transform && transform.includes('rotate')) {
        const match = transform.match(/rotate\(\s*(-?\d+\.?\d*)/);
        if (match) {
          const deg = parseFloat(match[1]);
          const bbox = rootEl.getBBox();
          const cx = bbox.x + bbox.width / 2;
          const cy = bbox.y + bbox.height / 2;
          rootEl.setAttribute('transform', `rotate(${deg}, ${cx}, ${cy})`);
        }
      }
    }
    this.updateSelectionHandles();
  }

  getPivotPoint(el) {
    let bbox = { x: 0, y: 0, width: 100, height: 100 };
    try {
      bbox = el.getBBox();
    } catch (e) {}

    let localCenterX = bbox.x + bbox.width / 2;
    let localCenterY = bbox.y + bbox.height / 2;

    if (el.getAttribute('data-center-x') !== null && el.getAttribute('data-center-y') !== null) {
      localCenterX = parseFloat(el.getAttribute('data-center-x'));
      localCenterY = parseFloat(el.getAttribute('data-center-y'));
    }

    let px = localCenterX;
    let py = localCenterY;

    if (el.dataset.pivotOffX !== undefined && el.dataset.pivotOffY !== undefined) {
      px = localCenterX + parseFloat(el.dataset.pivotOffX);
      py = localCenterY + parseFloat(el.dataset.pivotOffY);
    }

    return { px, py, centerX: localCenterX, centerY: localCenterY };
  }

  getStagePivotPoint(el) {
    const stageBBox = this.getElementStageBBox(el);
    let stageCenterX = stageBBox.x + stageBBox.width / 2;
    let stageCenterY = stageBBox.y + stageBBox.height / 2;

    if (el.getAttribute('data-center-x') !== null && el.getAttribute('data-center-y') !== null) {
      const transformAttr = el.getAttribute('transform') || '';
      let tx = 0, ty = 0;
      const matchTranslate = transformAttr.match(/translate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*))?\)/);
      if (matchTranslate) {
        tx = parseFloat(matchTranslate[1]);
        ty = matchTranslate[2] !== undefined ? parseFloat(matchTranslate[2]) : tx;
      }
      stageCenterX = tx + parseFloat(el.getAttribute('data-center-x'));
      stageCenterY = ty + parseFloat(el.getAttribute('data-center-y'));
    }

    let px = stageCenterX;
    let py = stageCenterY;

    if (el.dataset.pivotOffX !== undefined && el.dataset.pivotOffY !== undefined) {
      px = stageCenterX + parseFloat(el.dataset.pivotOffX);
      py = stageCenterY + parseFloat(el.dataset.pivotOffY);
    }

    return { px, py, centerX: stageCenterX, centerY: stageCenterY };
  }

  handlePivotDrag(coords) {
    if (!this.selectedElements || this.selectedElements.length === 0) return;
    const curX = this.snap(coords.x);
    const curY = this.snap(coords.y);

    this.selectedElements.forEach(el => {
      const stageBBox = this.getElementStageBBox(el);
      const stageCenterX = stageBBox.x + stageBBox.width / 2;
      const stageCenterY = stageBBox.y + stageBBox.height / 2;

      el.dataset.pivotOffX = (curX - stageCenterX).toFixed(1);
      el.dataset.pivotOffY = (curY - stageCenterY).toFixed(1);
      delete el.dataset.pivotX;
      delete el.dataset.pivotY;
    });

    this.updateSelectionHandles();
    if (this.onCanvasModified) this.onCanvasModified();
  }

  resetPivot(el) {
    if (!el) return;
    delete el.dataset.pivotOffX;
    delete el.dataset.pivotOffY;
    delete el.dataset.pivotX;
    delete el.dataset.pivotY;
    this.updateSelectionHandles();
    if (this.onCanvasModified) this.onCanvasModified();
  }

  handleRotateDrag(coords) {
    if (!this.selectedElements || this.selectedElements.length === 0) return;

    this.initialAttrState.forEach(st => {
      const item = st.el;
      if (st.px === undefined || st.py === undefined) return;

      const radCurrent = Math.atan2(coords.y - st.py, coords.x - st.px);
      let deltaDeg = Math.round((radCurrent - st.startRad) * (180 / Math.PI));

      let newDeg = Math.round((st.initialDeg + deltaDeg) % 360);
      if (newDeg < 0) newDeg += 360;

      let transform = st.initialTransform || '';
      if (/^\s*rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i.test(transform)) {
        transform = transform.replace(/^\s*rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i, `rotate(${newDeg}, ${st.px.toFixed(1)}, ${st.py.toFixed(1)})`);
      } else {
        transform = transform ? `rotate(${newDeg}, ${st.px.toFixed(1)}, ${st.py.toFixed(1)}) ${transform}` : `rotate(${newDeg}, ${st.px.toFixed(1)}, ${st.py.toFixed(1)})`;
      }
      item.setAttribute('transform', transform.trim());
    });

    this.updateSelectionHandles();
    if (this.onCanvasModified) this.onCanvasModified();
  }

  setElementRotation(el, deg) {
    if (!el) return;
    let transform = el.getAttribute('transform') || '';
    const { px, py } = this.getStagePivotPoint(el);

    if (deg !== 0) {
      const rotStr = `rotate(${deg}, ${px.toFixed(1)}, ${py.toFixed(1)})`;
      if (/rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i.test(transform)) {
        transform = transform.replace(/rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i, rotStr);
      } else {
        transform = transform ? `${rotStr} ${transform}` : rotStr;
      }
      el.setAttribute('transform', transform.trim());
    } else {
      if (/rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i.test(transform)) {
        transform = transform.replace(/rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i, '').trim();
        if (transform) {
          el.setAttribute('transform', transform);
        } else {
          el.removeAttribute('transform');
        }
      }
    }
  }

  createRadialArray(count = 8, totalAngle = 360, pivotMode = 'pivot') {
    if (!this.selectedElements || this.selectedElements.length === 0) {
      alert("Please select one or more shapes to create a radial pattern.");
      return;
    }

    const clones = [];
    const stepAngle = totalAngle / count;

    this.selectedElements.forEach(original => {
      const bbox = original.getBBox();
      let { px, py } = this.getStagePivotPoint(original);

      if (pivotMode === 'canvas') {
        px = this.width / 2;
        py = this.height / 2;
      } else if (pivotMode === 'bottom') {
        px = bbox.x + bbox.width / 2;
        py = bbox.y + bbox.height;
      }

      px = Math.round(px * 10) / 10;
      py = Math.round(py * 10) / 10;

      for (let i = 1; i < count; i++) {
        const clone = original.cloneNode(true);
        if (clone.id) {
          clone.id = `${clone.id}_radial_${i}_${Date.now().toString().slice(-4)}`;
        }

        const addedAngle = stepAngle * i;
        let transform = clone.getAttribute('transform') || '';

        const rotateMatch = transform.match(/rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i);
        if (rotateMatch) {
          const currentDeg = parseFloat(rotateMatch[1]);
          let newDeg = Math.round((currentDeg + addedAngle) % 360);
          transform = transform.replace(/rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i, `rotate(${newDeg}, ${px}, ${py})`);
        } else {
          let newDeg = Math.round(addedAngle % 360);
          transform = transform ? `${transform} rotate(${newDeg}, ${px}, ${py})` : `rotate(${newDeg}, ${px}, ${py})`;
        }

        clone.setAttribute('transform', transform.trim());
        this.stage.appendChild(clone);
        clones.push(clone);
      }
    });

    clones.forEach(c => this.selectElement(c, true));
    this.notifyCanvasModified();
  }

  selectElement(el, addToSelection = false) {
    if (!el) {
      this.clearSelection();
      return;
    }

    if (!addToSelection) {
      this.selectedElements = [el];
    } else if (!this.selectedElements.includes(el)) {
      this.selectedElements.push(el);
    }

    this.updateSelectionHandles();
    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedElements);
    }
  }

  clearSelection() {
    this.selectedElements = [];
    this.selectionLayer.innerHTML = '';
    this.updateSelectionCountUI();
    if (this.onSelectionChange) {
      this.onSelectionChange([]);
    }
  }

  updateSelectionCountUI() {
    const count = this.selectedElements ? this.selectedElements.length : 0;

    const countEl = document.getElementById('selection-count');
    if (countEl) {
      if (count === 0) {
        countEl.textContent = 'Selected: None (0)';
        countEl.style.color = '#A0AEC0';
      } else if (count === 1) {
        const tag = this.selectedElements[0].tagName.toLowerCase();
        countEl.textContent = `Selected: 1 item (${tag})`;
        countEl.style.color = '#3182CE';
      } else {
        countEl.textContent = `Selected: ${count} items`;
        countEl.style.color = '#2B6CB0';
      }
    }

    const badgeEl = document.getElementById('inspector-selection-badge');
    if (badgeEl) {
      if (count === 0) {
        badgeEl.textContent = '0 Selected';
        badgeEl.style.background = '#EDF2F7';
        badgeEl.style.color = '#4A5568';
      } else if (count === 1) {
        badgeEl.textContent = '1 Selected';
        badgeEl.style.background = '#EBF8FF';
        badgeEl.style.color = '#2B6CB0';
      } else {
        badgeEl.textContent = `${count} Selected`;
        badgeEl.style.background = '#C3DAFE';
        badgeEl.style.color = '#2C5282';
      }
    }
  }

  updateSelectionHandles() {
    this.selectionLayer.innerHTML = '';
    this.updateSelectionCountUI();
    if (this.selectedElements.length === 0) return;

    this.selectedElements.forEach(el => {
      const bbox = this.getElementStageBBox(el);

      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", bbox.x - 2);
      rect.setAttribute("y", bbox.y - 2);
      rect.setAttribute("width", Math.max(10, bbox.width + 4));
      rect.setAttribute("height", Math.max(10, bbox.height + 4));
      rect.setAttribute("fill", "none");
      rect.setAttribute("stroke", "#3182ce");
      rect.setAttribute("stroke-width", "1.5");
      rect.setAttribute("stroke-dasharray", "4,3");
      rect.style.pointerEvents = "none";
      group.appendChild(rect);

      const handlePositions = [
        { x: bbox.x - 5, y: bbox.y - 5, type: 'nw', cursor: 'nwse-resize' },
        { x: bbox.x + bbox.width - 5, y: bbox.y - 5, type: 'ne', cursor: 'nesw-resize' },
        { x: bbox.x + bbox.width - 5, y: bbox.y + bbox.height - 5, type: 'se', cursor: 'nwse-resize' },
        { x: bbox.x - 5, y: bbox.y + bbox.height - 5, type: 'sw', cursor: 'nesw-resize' }
      ];

      handlePositions.forEach(h => {
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        handle.setAttribute("x", h.x);
        handle.setAttribute("y", h.y);
        handle.setAttribute("width", 10);
        handle.setAttribute("height", 10);
        handle.setAttribute("fill", "#ffffff");
        handle.setAttribute("stroke", "#3182ce");
        handle.setAttribute("stroke-width", "1.5");
        handle.style.pointerEvents = "all";
        handle.style.cursor = h.cursor;
        handle.dataset.handle = h.type;
        group.appendChild(handle);
      });

      // Render Direct Endpoint Handles for Lines & Arrow Lines
      if (el.tagName.toLowerCase() === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') || 0);
        const y1 = parseFloat(el.getAttribute('y1') || 0);
        const x2 = parseFloat(el.getAttribute('x2') || 0);
        const y2 = parseFloat(el.getAttribute('y2') || 0);

        const p1 = this.getStagePoint(el, x1, y1);
        const p2 = this.getStagePoint(el, x2, y2);

        const lineHandles = [
          { cx: p1.x, cy: p1.y, type: 'line-p1' },
          { cx: p2.x, cy: p2.y, type: 'line-p2' }
        ];

        lineHandles.forEach(h => {
          const handleCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          handleCircle.setAttribute("cx", h.cx);
          handleCircle.setAttribute("cy", h.cy);
          handleCircle.setAttribute("r", "6");
          handleCircle.setAttribute("fill", "#ffffff");
          handleCircle.setAttribute("stroke", "#3182ce");
          handleCircle.setAttribute("stroke-width", "2.5");
          handleCircle.style.pointerEvents = "all";
          handleCircle.style.cursor = "crosshair";
          handleCircle.dataset.handle = h.type;
          group.appendChild(handleCircle);
        });
      }

      // Render Top Rotation Handle Stalk & Circle
      const rotStalk = document.createElementNS("http://www.w3.org/2000/svg", "line");
      rotStalk.setAttribute("x1", bbox.x + bbox.width / 2);
      rotStalk.setAttribute("y1", bbox.y - 2);
      rotStalk.setAttribute("x2", bbox.x + bbox.width / 2);
      rotStalk.setAttribute("y2", bbox.y - 22);
      rotStalk.setAttribute("stroke", "#3182ce");
      rotStalk.setAttribute("stroke-width", "1.5");
      rotStalk.setAttribute("stroke-dasharray", "2,2");
      group.appendChild(rotStalk);

      const rotHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      rotHandle.setAttribute("cx", bbox.x + bbox.width / 2);
      rotHandle.setAttribute("cy", bbox.y - 22);
      rotHandle.setAttribute("r", "6");
      rotHandle.setAttribute("fill", "#3182ce");
      rotHandle.setAttribute("stroke", "#ffffff");
      rotHandle.setAttribute("stroke-width", "1.5");
      rotHandle.style.pointerEvents = "all";
      rotHandle.style.cursor = "grab";
      rotHandle.dataset.handle = "rotate";
      group.appendChild(rotHandle);

      // Calculate & Render Draggable Pivot Target (⨁)
      const stagePivot = this.getStagePivotPoint(el);
      const px = stagePivot.px;
      const py = stagePivot.py;
      const centerX = stagePivot.centerX;
      const centerY = stagePivot.centerY;

      if (Math.abs(px - centerX) > 1 || Math.abs(py - centerY) > 1) {
        const armLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        armLine.setAttribute("x1", centerX); armLine.setAttribute("y1", centerY);
        armLine.setAttribute("x2", px); armLine.setAttribute("y2", py);
        armLine.setAttribute("stroke", "#ED8936");
        armLine.setAttribute("stroke-width", "1.5");
        armLine.setAttribute("stroke-dasharray", "3,3");
        armLine.style.pointerEvents = "none";
        group.appendChild(armLine);
      }

      const pivotGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      pivotGroup.dataset.handle = "pivot";
      pivotGroup.style.pointerEvents = "all";
      pivotGroup.style.cursor = "move";

      const pivotCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pivotCircle.setAttribute("cx", px);
      pivotCircle.setAttribute("cy", py);
      pivotCircle.setAttribute("r", "9");
      pivotCircle.setAttribute("fill", "rgba(237, 137, 54, 0.25)");
      pivotCircle.setAttribute("stroke", "#ED8936");
      pivotCircle.setAttribute("stroke-width", "2");
      pivotCircle.dataset.handle = "pivot";
      pivotGroup.appendChild(pivotCircle);

      const pivotHL = document.createElementNS("http://www.w3.org/2000/svg", "line");
      pivotHL.setAttribute("x1", px - 12); pivotHL.setAttribute("y1", py);
      pivotHL.setAttribute("x2", px + 12); pivotHL.setAttribute("y2", py);
      pivotHL.setAttribute("stroke", "#ED8936"); pivotHL.setAttribute("stroke-width", "1.5");
      pivotHL.dataset.handle = "pivot";
      pivotGroup.appendChild(pivotHL);

      const pivotVL = document.createElementNS("http://www.w3.org/2000/svg", "line");
      pivotVL.setAttribute("x1", px); pivotVL.setAttribute("y1", py - 12);
      pivotVL.setAttribute("x2", px); pivotVL.setAttribute("y2", py + 12);
      pivotVL.setAttribute("stroke", "#ED8936"); pivotVL.setAttribute("stroke-width", "1.5");
      pivotVL.dataset.handle = "pivot";
      pivotGroup.appendChild(pivotVL);

      const pivotDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pivotDot.setAttribute("cx", px); pivotDot.setAttribute("cy", py);
      pivotDot.setAttribute("r", "2.5"); pivotDot.setAttribute("fill", "#ED8936");
      pivotDot.dataset.handle = "pivot";
      pivotGroup.appendChild(pivotDot);

      group.appendChild(pivotGroup);

      // Render Bézier curve handle points if path contains C commands
      if (el.tagName.toLowerCase() === 'path') {
        const d = el.getAttribute('d') || '';
        const cmds = this.parsePathD(d);
        if (cmds.length > 0) {
          let lastX = 0, lastY = 0;
          cmds.forEach((item, idx) => {
            const upper = item.cmd.toUpperCase();
            if (upper === 'M' && item.args.length >= 2) {
              lastX = item.args[0]; lastY = item.args[1];

              const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              c.setAttribute("cx", lastX); c.setAttribute("cy", lastY); c.setAttribute("r", "5");
              c.setAttribute("fill", "#805AD5"); c.setAttribute("stroke", "#FFFFFF"); c.setAttribute("stroke-width", "1.5");
              c.dataset.handle = "path-node";
              c.dataset.cmdIndex = idx;
              c.dataset.pointType = "anchor";
              c.style.cursor = "move";
              group.appendChild(c);
            } else if (upper === 'C' && item.args.length >= 6) {
              const [cp1x, cp1y, cp2x, cp2y, x, y] = item.args;

              const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
              l1.setAttribute("x1", lastX); l1.setAttribute("y1", lastY);
              l1.setAttribute("x2", cp1x); l1.setAttribute("y2", cp1y);
              l1.setAttribute("stroke", "#805AD5"); l1.setAttribute("stroke-width", "1.5"); l1.setAttribute("stroke-dasharray", "3,3");
              l1.style.pointerEvents = "none";
              group.appendChild(l1);

              const dot1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              dot1.setAttribute("cx", cp1x); dot1.setAttribute("cy", cp1y); dot1.setAttribute("r", "4");
              dot1.setAttribute("fill", "#D6BCFA"); dot1.setAttribute("stroke", "#805AD5"); dot1.setAttribute("stroke-width", "1.5");
              dot1.dataset.handle = "path-node";
              dot1.dataset.cmdIndex = idx;
              dot1.dataset.pointType = "cp1";
              dot1.style.cursor = "move";
              group.appendChild(dot1);

              const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
              l2.setAttribute("x1", x); l2.setAttribute("y1", y);
              l2.setAttribute("x2", cp2x); l2.setAttribute("y2", cp2y);
              l2.setAttribute("stroke", "#805AD5"); l2.setAttribute("stroke-width", "1.5"); l2.setAttribute("stroke-dasharray", "3,3");
              l2.style.pointerEvents = "none";
              group.appendChild(l2);

              const dot2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              dot2.setAttribute("cx", cp2x); dot2.setAttribute("cy", cp2y); dot2.setAttribute("r", "4");
              dot2.setAttribute("fill", "#D6BCFA"); dot2.setAttribute("stroke", "#805AD5"); dot2.setAttribute("stroke-width", "1.5");
              dot2.dataset.handle = "path-node";
              dot2.dataset.cmdIndex = idx;
              dot2.dataset.pointType = "cp2";
              dot2.style.cursor = "move";
              group.appendChild(dot2);

              const anchor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              anchor.setAttribute("cx", x); anchor.setAttribute("cy", y); anchor.setAttribute("r", "5");
              anchor.setAttribute("fill", "#805AD5"); anchor.setAttribute("stroke", "#FFFFFF"); anchor.setAttribute("stroke-width", "1.5");
              anchor.dataset.handle = "path-node";
              anchor.dataset.cmdIndex = idx;
              anchor.dataset.pointType = "anchor";
              anchor.style.cursor = "move";
              group.appendChild(anchor);

              lastX = x; lastY = y;
            }
          });
        }
      }

      this.selectionLayer.appendChild(group);
    });
  }

  notifyCanvasModified() {
    this.saveState();
    if (this.onCanvasModified) this.onCanvasModified();
  }

  saveState() {
    if (this.isRestoringState) return;
    const currentSnapshot = this.stage.innerHTML;
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === currentSnapshot) {
      return;
    }
    this.undoStack.push(currentSnapshot);
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    this.updateUndoRedoUI();
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    this.isRestoringState = true;
    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);
    const previousState = this.undoStack[this.undoStack.length - 1];
    this.stage.innerHTML = previousState || '';
    this.clearSelection();
    this.isRestoringState = false;
    if (this.onCanvasModified) this.onCanvasModified();
    this.updateUndoRedoUI();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.isRestoringState = true;
    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);
    this.stage.innerHTML = nextState;
    this.clearSelection();
    this.isRestoringState = false;
    if (this.onCanvasModified) this.onCanvasModified();
    this.updateUndoRedoUI();
  }

  updateUndoRedoUI() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = this.undoStack.length <= 1;
    if (btnRedo) btnRedo.disabled = this.redoStack.length === 0;
  }

  addElement(el) {
    this.stage.appendChild(el);
    this.selectElement(el);
    this.notifyCanvasModified();
  }

  selectAll() {
    this.clearSelection();
    const children = Array.from(this.stage.children);
    children.forEach(child => {
      if (child.id !== 'canvas-grid-bg') {
        this.selectElement(child, true);
      }
    });
  }

  groupSelected() {
    if (this.selectedElements.length < 2) return;
    const ns = "http://www.w3.org/2000/svg";
    const group = document.createElementNS(ns, "g");
    group.setAttribute("id", `group_${Date.now().toString().slice(-4)}`);

    // Insert group before the first selected element
    this.stage.insertBefore(group, this.selectedElements[0]);

    this.selectedElements.forEach(el => {
      group.appendChild(el);
    });

    this.selectElement(group);
    this.notifyCanvasModified();
  }

  ungroupSelected() {
    const newSelection = [];
    this.selectedElements.forEach(el => {
      if (el.tagName.toLowerCase() === 'g') {
        const parent = el.parentNode;
        const groupTransform = el.getAttribute('transform') || '';
        const children = Array.from(el.children);
        children.forEach(child => {
          if (groupTransform.trim() !== '') {
            const childTransform = child.getAttribute('transform') || '';
            const combinedTransform = (groupTransform + ' ' + childTransform).trim();
            child.setAttribute('transform', combinedTransform);
          }
          parent.insertBefore(child, el);
          newSelection.push(child);
        });
        el.remove();
      } else {
        newSelection.push(el);
      }
    });

    this.selectedElements = [];
    newSelection.forEach(item => this.selectElement(item, true));
    this.notifyCanvasModified();
  }

  joinSelectedPaths() {
    if (this.selectedElements.length === 0) return;

    const targetElements = [];
    this.selectedElements.forEach(el => {
      if (el.tagName.toLowerCase() === 'g') {
        Array.from(el.children).forEach(child => targetElements.push(child));
      } else {
        targetElements.push(el);
      }
    });

    if (targetElements.length < 2) return;

    const convertToPathD = (el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'path') {
        return (el.getAttribute('d') || '').trim();
      } else if (tag === 'line') {
        const x1 = el.getAttribute('x1') || 0;
        const y1 = el.getAttribute('y1') || 0;
        const x2 = el.getAttribute('x2') || 0;
        const y2 = el.getAttribute('y2') || 0;
        return `M ${x1} ${y1} L ${x2} ${y2}`;
      } else if (tag === 'polyline') {
        const pts = (el.getAttribute('points') || '').trim().split(/\s+|,/);
        if (pts.length < 4) return '';
        let d = `M ${pts[0]} ${pts[1]}`;
        for (let i = 2; i < pts.length; i += 2) {
          if (pts[i] !== undefined && pts[i+1] !== undefined) {
            d += ` L ${pts[i]} ${pts[i+1]}`;
          }
        }
        return d;
      } else if (tag === 'polygon') {
        const pts = (el.getAttribute('points') || '').trim().split(/\s+|,/);
        if (pts.length < 4) return '';
        let d = `M ${pts[0]} ${pts[1]}`;
        for (let i = 2; i < pts.length; i += 2) {
          if (pts[i] !== undefined && pts[i+1] !== undefined) {
            d += ` L ${pts[i]} ${pts[i+1]}`;
          }
        }
        return d + ' Z';
      }
      return '';
    };

    let combinedD = '';
    targetElements.forEach((el, index) => {
      let d = convertToPathD(el);
      if (!d) return;

      d = d.replace(/\s*Z\s*$/i, '');

      if (index === 0) {
        combinedD = d;
      } else {
        if (/^\s*M\s+/i.test(d)) {
          d = d.replace(/^\s*M\s+/i, 'L ');
        }
        combinedD += ' ' + d;
      }
    });

    if (!combinedD) return;
    combinedD += ' Z';

    const firstEl = targetElements[0];
    const ns = "http://www.w3.org/2000/svg";
    const joinedPath = document.createElementNS(ns, "path");
    joinedPath.setAttribute("id", `path_joined_${Date.now().toString().slice(-4)}`);
    joinedPath.setAttribute("d", combinedD);

    const fill = firstEl.getAttribute("fill") || "#3182CE";
    const stroke = firstEl.getAttribute("stroke") || "#2B6CB0";
    const strokeWidth = firstEl.getAttribute("stroke-width") || "2";
    const opacity = firstEl.getAttribute("opacity") || "1";

    joinedPath.setAttribute("fill", fill);
    joinedPath.setAttribute("stroke", stroke);
    joinedPath.setAttribute("stroke-width", strokeWidth);
    joinedPath.setAttribute("opacity", opacity);

    const insertRef = this.selectedElements[0];
    insertRef.parentNode.insertBefore(joinedPath, insertRef);

    this.selectedElements.forEach(el => el.remove());
    this.clearSelection();
    this.selectElement(joinedPath);
    this.notifyCanvasModified();
  }

  removeSelected() {
    this.selectedElements.forEach(el => el.remove());
    this.clearSelection();
    this.notifyCanvasModified();
  }

  copySelected() {
    if (!this.selectedElements || this.selectedElements.length === 0) return;
    this.clipboard = this.selectedElements.map(el => el.cloneNode(true));
    this.pasteOffsetCount = 0;
  }

  paste() {
    if (!this.clipboard || this.clipboard.length === 0) return;

    this.pasteOffsetCount = (this.pasteOffsetCount || 0) + 1;
    const offset = 20 * this.pasteOffsetCount;

    this.clearSelection();

    const updateIds = (el) => {
      if (el.id) {
        el.id = `${el.id}_copy_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000)}`;
      }
      Array.from(el.children).forEach(child => updateIds(child));
    };

    this.clipboard.forEach(item => {
      const clone = item.cloneNode(true);
      updateIds(clone);
      this.translateElement(clone, offset, offset);
      this.stage.appendChild(clone);
      this.selectElement(clone, true);
    });

    if (this.onCanvasModified) this.onCanvasModified();
  }

  translateElement(el, dx, dy) {
    const tag = el.tagName.toLowerCase();

    let transform = el.getAttribute('transform');
    if (transform) {
      if (transform.includes('translate')) {
        transform = transform.replace(/translate\(\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*)\s*\)/i, (m, tx, ty) => {
          return `translate(${parseFloat(tx) + dx}, ${parseFloat(ty) + dy})`;
        });
      }
      if (transform.includes('rotate')) {
        transform = transform.replace(/rotate\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\)/i, (m, deg, cx, cy) => {
          return `rotate(${deg}, ${parseFloat(cx) + dx}, ${parseFloat(cy) + dy})`;
        });
      }
      el.setAttribute('transform', transform);
    }

    if (tag === 'g') {
      Array.from(el.children).forEach(child => this.translateElement(child, dx, dy));
    } else if (tag === 'rect' || tag === 'text') {
      const x = parseFloat(el.getAttribute('x') || 0) + dx;
      const y = parseFloat(el.getAttribute('y') || 0) + dy;
      el.setAttribute('x', x);
      el.setAttribute('y', y);
    } else if (tag === 'ellipse' || tag === 'circle') {
      const cx = parseFloat(el.getAttribute('cx') || 0) + dx;
      const cy = parseFloat(el.getAttribute('cy') || 0) + dy;
      el.setAttribute('cx', cx);
      el.setAttribute('cy', cy);
    } else if (tag === 'line') {
      const x1 = parseFloat(el.getAttribute('x1') || 0) + dx;
      const y1 = parseFloat(el.getAttribute('y1') || 0) + dy;
      const x2 = parseFloat(el.getAttribute('x2') || 0) + dx;
      const y2 = parseFloat(el.getAttribute('y2') || 0) + dy;
      el.setAttribute('x1', x1);
      el.setAttribute('y1', y1);
      el.setAttribute('x2', x2);
      el.setAttribute('y2', y2);
    } else if (tag === 'polyline' || tag === 'polygon') {
      const origPoints = (el.getAttribute('points') || '').trim().split(/\s+|,/);
      let newPoints = [];
      for (let i = 0; i < origPoints.length; i += 2) {
        if (origPoints[i] !== undefined && origPoints[i+1] !== undefined && origPoints[i] !== '') {
          const px = parseFloat(origPoints[i]) + dx;
          const py = parseFloat(origPoints[i+1]) + dy;
          newPoints.push(`${px},${py}`);
        }
      }
      el.setAttribute('points', newPoints.join(' '));
    } else if (tag === 'path') {
      const d = el.getAttribute('d') || '';
      const newD = d.replace(/([MLCA])\s*([^MLCA]+)/gi, (match, cmd, argsStr) => {
        const nums = argsStr.trim().split(/[\s,]+/).map(Number);
        const upperCmd = cmd.toUpperCase();
        if (upperCmd === 'M' || upperCmd === 'L') {
          if (nums.length >= 2) {
            return `${cmd} ${nums[0] + dx} ${nums[1] + dy}`;
          }
        } else if (upperCmd === 'C') {
          if (nums.length >= 6) {
            return `${cmd} ${nums[0] + dx} ${nums[1] + dy} ${nums[2] + dx} ${nums[3] + dy} ${nums[4] + dx} ${nums[5] + dy}`;
          }
        } else if (upperCmd === 'A') {
          if (nums.length >= 7) {
            const [rx, ry, rot, laf, sf, px, py] = nums;
            return `${cmd} ${rx} ${ry} ${rot} ${laf} ${sf} ${px + dx} ${py + dy}`;
          }
        }
        return match;
      });
      el.setAttribute('d', newD);
    }
  }

  bringToFront() {
    if (this.selectedElements.length === 0) return;
    this.selectedElements.forEach(el => {
      this.stage.appendChild(el);
    });
    this.updateSelectionHandles();
    this.notifyCanvasModified();
  }

  bringForward() {
    if (this.selectedElements.length === 0) return;
    this.selectedElements.forEach(el => {
      const next = el.nextElementSibling;
      if (next) {
        this.stage.insertBefore(next, el);
      }
    });
    this.updateSelectionHandles();
    this.notifyCanvasModified();
  }

  sendBackward() {
    if (this.selectedElements.length === 0) return;
    this.selectedElements.forEach(el => {
      const prev = el.previousElementSibling;
      if (prev && prev.id !== 'canvas-grid-bg') {
        this.stage.insertBefore(el, prev);
      }
    });
    this.updateSelectionHandles();
    this.notifyCanvasModified();
  }

  sendToBack() {
    if (this.selectedElements.length === 0) return;
    const firstChild = this.stage.firstElementChild;
    this.selectedElements.forEach(el => {
      if (firstChild && firstChild !== el) {
        const insertTarget = firstChild.id === 'canvas-grid-bg' ? firstChild.nextElementSibling : firstChild;
        if (insertTarget) {
          this.stage.insertBefore(el, insertTarget);
        }
      }
    });
    this.updateSelectionHandles();
    this.notifyCanvasModified();
  }

  getStagePoint(el, localX, localY) {
    const transformAttr = el.getAttribute('transform');
    if (!transformAttr) return { x: localX, y: localY };

    try {
      const ctm = el.getCTM();
      const stageCTM = this.stage.getCTM();
      if (ctm && stageCTM) {
        const pt = this.svg.createSVGPoint();
        pt.x = localX;
        pt.y = localY;
        const matrix = stageCTM.inverse().multiply(ctm);
        const stagePt = pt.matrixTransform(matrix);
        return { x: stagePt.x, y: stagePt.y };
      }
    } catch (e) {}

    return { x: localX, y: localY };
  }

  getElementStageBBox(el) {
    let b = { x: 0, y: 0, width: 100, height: 100 };
    try {
      b = el.getBBox();
    } catch (e) {}

    const transformAttr = el.getAttribute('transform') || '';
    if (!transformAttr) return b;

    const corners = [
      this.getStagePoint(el, b.x, b.y),
      this.getStagePoint(el, b.x + b.width, b.y),
      this.getStagePoint(el, b.x + b.width, b.y + b.height),
      this.getStagePoint(el, b.x, b.y + b.height)
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    corners.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  alignSelected(dir) {
    if (this.selectedElements.length === 0) return;

    let refX, refY, refW, refH;

    if (this.selectedElements.length === 1) {
      // Single element: align relative to 500x500 canvas artboard
      refX = 0; refY = 0; refW = this.width; refH = this.height;
    } else {
      // Multiple elements: align relative to selection union bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.selectedElements.forEach(el => {
        const b = this.getElementStageBBox(el);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      });
      refX = minX; refY = minY; refW = maxX - minX; refH = maxY - minY;
    }

    this.selectedElements.forEach(el => {
      const b = this.getElementStageBBox(el);
      let targetX = b.x;
      let targetY = b.y;

      switch (dir) {
        case 'left': targetX = refX; break;
        case 'center': targetX = refX + (refW - b.width) / 2; break;
        case 'right': targetX = refX + refW - b.width; break;
        case 'top': targetY = refY; break;
        case 'middle': targetY = refY + (refH - b.height) / 2; break;
        case 'bottom': targetY = refY + refH - b.height; break;
      }

      const dx = targetX - b.x;
      const dy = targetY - b.y;

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        this.moveElement(el, dx, dy);
      }
    });

    this.updateSelectionHandles();
    this.notifyCanvasModified();
  }

  rotateSelected(deltaAngle) {
    if (!this.selectedElements || this.selectedElements.length === 0) return;

    this.selectedElements.forEach(el => {
      const b = this.getElementStageBBox(el);
      const cx = Math.round((b.x + b.width / 2) * 10) / 10;
      const cy = Math.round((b.y + b.height / 2) * 10) / 10;

      let transform = el.getAttribute('transform') || '';
      let currentDeg = 0;

      const rotateMatch = transform.match(/rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i);
      if (rotateMatch) {
        currentDeg = parseFloat(rotateMatch[1]);
        let newDeg = (currentDeg + deltaAngle) % 360;
        if (newDeg < 0) newDeg += 360;
        newDeg = Math.round(newDeg);

        transform = transform.replace(/rotate\(\s*(-?\d+\.?\d*)\s*(?:[\s,]\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*))?\)/i, `rotate(${newDeg}, ${cx}, ${cy})`);
      } else {
        let newDeg = (deltaAngle) % 360;
        if (newDeg < 0) newDeg += 360;
        newDeg = Math.round(newDeg);

        transform = transform ? `${transform} rotate(${newDeg}, ${cx}, ${cy})` : `rotate(${newDeg}, ${cx}, ${cy})`;
      }

      el.setAttribute('transform', transform.trim());
    });

    this.updateSelectionHandles();
    this.notifyCanvasModified();
  }

  getSelectionBBox() {
    if (!this.selectedElements || this.selectedElements.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.selectedElements.forEach(el => {
      const b = this.getElementStageBBox(el);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + b.height > maxY) maxY = b.y + b.height;
    });
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  flipSelected(direction = 'horizontal', duplicate = false, mode = 'center') {
    if (!this.selectedElements || this.selectedElements.length === 0) return;

    const b = this.getSelectionBBox();
    if (!b) return;

    const cx = Math.round((b.x + b.width / 2) * 10) / 10;
    const cy = Math.round((b.y + b.height / 2) * 10) / 10;

    let targetElements = [...this.selectedElements];

    if (duplicate) {
      this.clearSelection();
      const updateIds = (el) => {
        if (el.id) {
          el.id = `${el.id}_mirror_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000)}`;
        }
        Array.from(el.children).forEach(child => updateIds(child));
      };
      targetElements = targetElements.map(item => {
        const clone = item.cloneNode(true);
        updateIds(clone);
        this.stage.appendChild(clone);
        this.selectElement(clone, true);
        return clone;
      });
    }

    let pivotX = cx;
    let pivotY = cy;

    if (mode === 'edge' || direction === 'right' || direction === 'left' || direction === 'bottom' || direction === 'top') {
      if (direction === 'right') pivotX = b.x + b.width;
      else if (direction === 'left') pivotX = b.x;
      else if (direction === 'bottom') pivotY = b.y + b.height;
      else if (direction === 'top') pivotY = b.y;
    }

    const isHoriz = (direction === 'horizontal' || direction === 'left' || direction === 'right');

    targetElements.forEach(el => {
      let transform = el.getAttribute('transform') || '';

      const flipStr = isHoriz
        ? `translate(${2 * pivotX}, 0) scale(-1, 1)`
        : `translate(0, ${2 * pivotY}) scale(1, -1)`;

      el.setAttribute('transform', transform ? `${flipStr} ${transform}` : flipStr);
    });

    this.updateSelectionHandles();
    this.notifyCanvasModified();
  }

  setTraceImage(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
      this.traceState.dataUrl = dataUrl;
      this.traceState.naturalWidth = img.naturalWidth || 300;
      this.traceState.naturalHeight = img.naturalHeight || 300;
      this.updateTraceImage();
      if (callback) callback();
    };
    img.onerror = () => {
      alert("Failed to load image file.");
    };
    img.src = dataUrl;
  }

  removeTraceImage() {
    this.traceState.dataUrl = null;
    this.traceState.naturalWidth = 0;
    this.traceState.naturalHeight = 0;
    this.updateTraceImage();
  }

  updateTraceImage() {
    if (!this.tracingLayer) {
      this.tracingLayer = document.getElementById('tracing-layer');
    }
    if (!this.tracingLayer) return;

    let imgEl = this.tracingLayer.querySelector('image');
    if (!this.traceState.dataUrl || !this.traceState.visible) {
      if (imgEl) imgEl.style.display = 'none';
      return;
    }

    if (!imgEl) {
      imgEl = document.createElementNS("http://www.w3.org/2000/svg", "image");
      imgEl.setAttribute("pointer-events", "none");
      imgEl.setAttribute("preserveAspectRatio", "none");
      this.tracingLayer.appendChild(imgEl);
    }

    const w = this.traceState.naturalWidth * this.traceState.scale;
    const h = this.traceState.naturalHeight * this.traceState.scale;

    imgEl.style.display = 'inline';
    imgEl.setAttributeNS("http://www.w3.org/1999/xlink", "href", this.traceState.dataUrl);
    imgEl.setAttribute("href", this.traceState.dataUrl);
    imgEl.setAttribute("x", this.traceState.posX);
    imgEl.setAttribute("y", this.traceState.posY);
    imgEl.setAttribute("width", w);
    imgEl.setAttribute("height", h);
    imgEl.setAttribute("opacity", this.traceState.opacity);
  }

  parsePathD(d) {
    const cmds = [];
    if (!d) return cmds;
    const regex = /([a-zA-Z])\s*([^a-zA-Z]*)/g;
    let match;
    while ((match = regex.exec(d)) !== null) {
      const cmd = match[1];
      const rawArgs = match[2].trim().split(/[\s,]+/).filter(s => s.length > 0).map(Number);
      if (cmd.toUpperCase() === 'M') {
        if (rawArgs.length >= 2) {
          cmds.push({ cmd, args: [rawArgs[0], rawArgs[1]] });
          for (let i = 2; i + 1 < rawArgs.length; i += 2) {
            cmds.push({ cmd: 'L', args: [rawArgs[i], rawArgs[i+1]] });
          }
        }
      } else if (cmd.toUpperCase() === 'C') {
        for (let i = 0; i + 5 < rawArgs.length; i += 6) {
          cmds.push({ cmd, args: rawArgs.slice(i, i + 6) });
        }
      } else if (cmd.toUpperCase() === 'L') {
        for (let i = 0; i + 1 < rawArgs.length; i += 2) {
          cmds.push({ cmd, args: rawArgs.slice(i, i + 2) });
        }
      } else {
        cmds.push({ cmd, args: rawArgs });
      }
    }
    return cmds;
  }

  handlePathNodeDrag(coords) {
    if (!this.activePathNode || !this.activePathNode.el) return;

    const { el, cmdIndex, pointType, initialCmds } = this.activePathNode;
    const dx = coords.x - this.dragStartX;
    const dy = coords.y - this.dragStartY;

    const cmds = initialCmds.map(c => ({ cmd: c.cmd, args: [...c.args] }));

    if (cmdIndex >= 0 && cmdIndex < cmds.length) {
      const item = cmds[cmdIndex];

      if (pointType === 'anchor') {
        if (item.cmd.toUpperCase() === 'M') {
          item.args[0] += dx;
          item.args[1] += dy;
          if (cmds.length > 1 && cmds[1].cmd.toUpperCase() === 'C') {
            cmds[1].args[0] += dx;
            cmds[1].args[1] += dy;
          }
        } else if (item.cmd.toUpperCase() === 'C') {
          item.args[4] += dx;
          item.args[5] += dy;
          item.args[2] += dx;
          item.args[3] += dy;
          if (cmdIndex + 1 < cmds.length && cmds[cmdIndex + 1].cmd.toUpperCase() === 'C') {
            cmds[cmdIndex + 1].args[0] += dx;
            cmds[cmdIndex + 1].args[1] += dy;
          }
        }
      } else if (pointType === 'cp1' && item.cmd.toUpperCase() === 'C') {
        item.args[0] += dx;
        item.args[1] += dy;
      } else if (pointType === 'cp2' && item.cmd.toUpperCase() === 'C') {
        item.args[2] += dx;
        item.args[3] += dy;
      }
    }

    const newD = cmds.map(c => `${c.cmd} ${c.args.join(' ')}`).join(' ');
    el.setAttribute('d', newD);
    this.updateSelectionHandles();
    if (this.onCanvasModified) this.onCanvasModified();
  }
}

// Math helper for scaling text font-size symmetrically
Math.mean = function(array) {
  return array.reduce((a, b) => a + b, 0) / array.length;
};
