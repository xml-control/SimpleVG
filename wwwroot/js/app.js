/**
 * SimpleVG - App Main Coordinator
 * Theme Manager, Keyboard Shortcuts, and Module Initializer
 */

document.addEventListener('DOMContentLoaded', () => {
  // SVG Canvas Elements
  const svgCanvasEl = document.getElementById('svg-canvas');
  const stageGroupEl = document.getElementById('svg-stage');
  const selectionLayerEl = document.getElementById('selection-layer');
  const defsEl = document.getElementById('svg-defs');

  // Initialize Core Engines
  const gradients = new GradientManager(defsEl);
  const canvas = new SvgCanvas(svgCanvasEl, stageGroupEl, selectionLayerEl, defsEl);
  const tools = new ToolManager(canvas, gradients);
  const inspector = new InspectorPanel(canvas, gradients);
  const exporter = new ExporterModule(canvas);

  // Default to 150% zoom and center canvas nicely in scroll viewport on startup
  canvas.setZoom(1.5);
  setTimeout(() => canvas.centerCanvas(), 50);
  setTimeout(() => canvas.centerCanvas(), 250);

  window.addEventListener('resize', () => {
    canvas.centerCanvas();
  });

  // Initialize default empty XML drawer
  exporter.updateXmlTextarea();

  // Theme Manager (Light Theme default, Dark toggleable)
  const themeToggleBtn = document.getElementById('theme-toggle');
  let currentTheme = localStorage.getItem('simplevg_theme') || 'light';

  const applyTheme = (theme) => {
    currentTheme = theme;
    document.body.className = `${theme}-theme`;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('simplevg_theme', theme);
  };

  applyTheme(currentTheme);

  themeToggleBtn?.addEventListener('click', () => {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
  });

  // View Controls (Grid, Snap & Ruler)
  const gridBtn = document.getElementById('btn-toggle-grid');
  const snapBtn = document.getElementById('btn-toggle-snap');
  const rulerBtn = document.getElementById('btn-toggle-ruler');

  gridBtn?.addEventListener('click', () => {
    gridBtn.classList.toggle('active');
    canvas.setGrid(gridBtn.classList.contains('active'), snapBtn.classList.contains('active'));
    canvas.saveUserSettings();
  });

  snapBtn?.addEventListener('click', () => {
    snapBtn.classList.toggle('active');
    canvas.setGrid(gridBtn.classList.contains('active'), snapBtn.classList.contains('active'));
    canvas.saveUserSettings();
  });

  rulerBtn?.addEventListener('click', () => {
    rulerBtn.classList.toggle('active');
    canvas.setRulers(rulerBtn.classList.contains('active'));
    canvas.saveUserSettings();
  });

  // Canvas Settings & ISA-101 Gray Auto-Save Listeners
  document.getElementById('chk-show-centerline')?.addEventListener('change', () => {
    canvas.updateCenterLines();
    canvas.saveUserSettings();
  });
  document.getElementById('chk-isa-gray-on-drop')?.addEventListener('change', () => canvas.saveUserSettings());
  document.getElementById('canvas-prop-w')?.addEventListener('change', () => canvas.saveUserSettings());
  document.getElementById('canvas-prop-h')?.addEventListener('change', () => canvas.saveUserSettings());
  document.getElementById('canvas-prop-grid')?.addEventListener('change', () => canvas.saveUserSettings());
  document.getElementById('canvas-default-stroke-width')?.addEventListener('change', () => canvas.saveUserSettings());

  // Zoom Controls
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => canvas.setZoom(canvas.zoom + 0.15));
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => canvas.setZoom(canvas.zoom - 0.15));
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => canvas.setZoom(1.0));

  document.querySelectorAll('.btn-fast-zoom').forEach(btn => {
    btn.addEventListener('click', () => {
      const zoomLevel = parseFloat(btn.dataset.zoom);
      canvas.setZoom(zoomLevel);
    });
  });

  // Undo / Redo Buttons
  document.getElementById('btn-undo')?.addEventListener('click', () => canvas.undo());
  document.getElementById('btn-redo')?.addEventListener('click', () => canvas.redo());

  // Group / Ungroup & Copy / Paste Buttons
  document.getElementById('btn-copy')?.addEventListener('click', () => canvas.copySelected());
  document.getElementById('btn-paste')?.addEventListener('click', () => canvas.paste());
  document.getElementById('btn-group')?.addEventListener('click', () => canvas.groupSelected());
  document.getElementById('btn-ungroup')?.addEventListener('click', () => canvas.ungroupSelected());

  // Format Menu Dropdown Toggle & Items
  const btnFormatMenu = document.getElementById('btn-format-menu');
  const formatDropdown = document.getElementById('format-dropdown-menu');

  btnFormatMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
    formatDropdown?.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (formatDropdown && !formatDropdown.contains(e.target) && e.target !== btnFormatMenu) {
      formatDropdown.classList.add('hidden');
    }
  });

  formatDropdown?.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      formatDropdown.classList.add('hidden');
    });
  });

  // Layer Z-Order Buttons (Front, Up, Down, Back)
  document.getElementById('btn-layer-to-front')?.addEventListener('click', () => canvas.bringToFront());
  document.getElementById('btn-layer-forward')?.addEventListener('click', () => canvas.bringForward());
  document.getElementById('btn-layer-backward')?.addEventListener('click', () => canvas.sendBackward());
  document.getElementById('btn-layer-to-back')?.addEventListener('click', () => canvas.sendToBack());

  // Object Alignment Buttons (Left, Center, Right, Top, Middle, Bottom)
  document.getElementById('btn-align-left')?.addEventListener('click', () => canvas.alignSelected('left'));
  document.getElementById('btn-align-center')?.addEventListener('click', () => canvas.alignSelected('center'));
  document.getElementById('btn-align-right')?.addEventListener('click', () => canvas.alignSelected('right'));
  document.getElementById('btn-align-top')?.addEventListener('click', () => canvas.alignSelected('top'));
  document.getElementById('btn-align-middle')?.addEventListener('click', () => canvas.alignSelected('middle'));
  document.getElementById('btn-align-bottom')?.addEventListener('click', () => canvas.alignSelected('bottom'));

  // Radial Array Options Modal
  const radialModal = document.getElementById('radial-array-modal');
  const openRadialModal = () => {
    if (!canvas.selectedElements || canvas.selectedElements.length === 0) {
      alert("Please select one or more shapes on the canvas first.");
      return;
    }
    if (radialModal) radialModal.style.display = 'flex';
  };
  const closeRadialModal = () => {
    if (radialModal) radialModal.style.display = 'none';
  };

  document.getElementById('btn-radial-array')?.addEventListener('click', openRadialModal);
  document.getElementById('radial-array-modal-close')?.addEventListener('click', closeRadialModal);
  document.getElementById('radial-array-modal-cancel')?.addEventListener('click', closeRadialModal);

  document.getElementById('radial-array-modal-apply')?.addEventListener('click', () => {
    const count = parseInt(document.getElementById('radial-count-input')?.value || '8', 10);
    const totalAngle = parseFloat(document.getElementById('radial-angle-input')?.value || '360');
    const pivotMode = document.getElementById('radial-pivot-select')?.value || 'pivot';

    closeRadialModal();
    canvas.createRadialArray(count, totalAngle, pivotMode);
  });

  // Mirror / Symmetry Duplicate Modal Event Listeners
  const mirrorModal = document.getElementById('mirror-modal');
  const openMirrorModal = () => {
    if (!canvas.selectedElements || canvas.selectedElements.length === 0) return;
    if (mirrorModal) mirrorModal.style.display = 'flex';
  };
  const closeMirrorModal = () => {
    if (mirrorModal) mirrorModal.style.display = 'none';
  };

  document.getElementById('btn-mirror-modal')?.addEventListener('click', openMirrorModal);
  document.getElementById('mirror-modal-close')?.addEventListener('click', closeMirrorModal);
  document.getElementById('mirror-modal-cancel')?.addEventListener('click', closeMirrorModal);

  document.getElementById('mirror-modal-apply')?.addEventListener('click', () => {
    const dir = document.getElementById('mirror-direction-select')?.value || 'right';
    const keepOriginal = document.getElementById('mirror-keep-original')?.checked ?? true;

    closeMirrorModal();
    canvas.flipSelected(dir, keepOriginal, (dir === 'horizontal' || dir === 'vertical') ? 'center' : 'edge');
  });

  document.getElementById('btn-flip-horiz')?.addEventListener('click', () => canvas.flipSelected('horizontal', false));
  document.getElementById('btn-flip-vert')?.addEventListener('click', () => canvas.flipSelected('vertical', false));
  document.getElementById('btn-join-paths')?.addEventListener('click', () => canvas.joinSelectedPaths());

  document.getElementById('btn-quick-flip-h')?.addEventListener('click', () => canvas.flipSelected('horizontal', false));
  document.getElementById('btn-quick-flip-v')?.addEventListener('click', () => canvas.flipSelected('vertical', false));

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    // Ctrl + Shift + F: Find Selected Element in XML Source Code
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      exporter.findSelectedInXml();
    }

    // Escape key to clear selection & reset tool to select
    if (e.key === 'Escape' || e.key === 'Esc') {
      canvas.clearSelection();
      if (tools) tools.setActiveTool('select');
    }

    // Delete key to remove selection
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
      canvas.removeSelected();
    }

    // Arrow Key Nudging for selected shape(s)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isInputActive) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : (canvas.snapToGrid ? 10 : 1);
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;

      canvas.nudgeSelected(dx, dy);
    }


    // Ctrl/Cmd Shortcuts
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (!isInputActive) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            canvas.redo();
          } else {
            canvas.undo();
          }
        } else if (key === 'y') {
          e.preventDefault();
          canvas.redo();
        } else if (key === 'a') {
          e.preventDefault();
          canvas.selectAll();
        } else if (key === 'c') {
          e.preventDefault();
          canvas.copySelected();
        } else if (key === 'v') {
          e.preventDefault();
          if (e.shiftKey) {
            canvas.flipSelected('vertical', false);
          } else {
            canvas.paste();
          }
        } else if (key === 'h') {
          if (e.shiftKey) {
            e.preventDefault();
            canvas.flipSelected('horizontal', false);
          }
        } else if (key === 'g') {
          e.preventDefault();
          if (e.shiftKey) {
            canvas.ungroupSelected();
          } else {
            canvas.groupSelected();
          }
        } else if (key === 'j') {
          e.preventDefault();
          canvas.joinSelectedPaths();
        } else if (key === 'r') {
          e.preventDefault();
          canvas.rotateSelected(15);
        } else if (key === 'u') {
          e.preventDefault();
          canvas.rotateSelected(-15);
        } else if (key === 'd') {
          if (e.shiftKey) {
            e.preventDefault();
            openRadialModal();
          }
        }
      }
      return;
    }

    // Tool shortcuts (only without Ctrl/Cmd modifiers)
    if (!isInputActive) {
      switch (e.key.toLowerCase()) {
        case 'v': tools.setActiveTool('select'); break;
        case 'r': tools.setActiveTool('rect'); break;
        case 'c': tools.setActiveTool('circle'); break;
        case 'l': tools.setActiveTool('line'); break;
        case 'a': tools.setActiveTool('arc'); break;
        case 'p': tools.setActiveTool('polygon'); break;
        case 's': tools.setActiveTool('star'); break;
        case 'w': tools.setActiveTool('arrow'); break;
        case 'b': tools.setActiveTool('bezier'); break;
        case 't': tools.setActiveTool('text'); break;
      }
    }
  });

  console.log("SimpleVG SCADA Studio Initialized Successfully.");
});
