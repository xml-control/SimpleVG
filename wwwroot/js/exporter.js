/**
 * SimpleVG - Exporter & Source Code Drawer Controller
 * Live 2-way XML synchronization, file loading, VB.NET backend integration
 */

class ExporterModule {
  constructor(canvasInstance) {
    this.canvas = canvasInstance;
    this.textarea = document.getElementById('svg-xml-editor');

    this.init();
  }

  init() {
    this.bindDrawerEvents();
    this.bindFileOperations();

    // Update XML live on canvas change
    this.canvas.onCanvasModified = () => {
      this.canvas.saveState();
      this.updateXmlTextarea();
    };
  }

  updateXmlTextarea() {
    if (!this.textarea) return;

    // Clone stage to avoid mutating live stage
    const stageClone = this.canvas.stage.cloneNode(true);

    const svgWrapper = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgWrapper.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svgWrapper.setAttribute("width", this.canvas.width);
    svgWrapper.setAttribute("height", this.canvas.height);
    svgWrapper.setAttribute("viewBox", `0 0 ${this.canvas.width} ${this.canvas.height}`);

    // Build clean defs (only include defs referenced in stage elements)
    const stageHTML = stageClone.innerHTML;
    const cleanDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    Array.from(this.canvas.defs.children).forEach(defItem => {
      const id = defItem.getAttribute('id');
      // Skip grid pattern
      if (id === 'grid-pattern') return;

      // Only include def if referenced in stage HTML (url(#id))
      if (id && stageHTML.includes(`url(#${id})`)) {
        cleanDefs.appendChild(defItem.cloneNode(true));
      }
    });

    if (cleanDefs.children.length > 0) {
      svgWrapper.appendChild(cleanDefs);
    }

    // Include reference tracing image layer if user enabled "Include in SVG/PNG Export"
    if (this.canvas.traceState && this.canvas.traceState.includeInExport && this.canvas.tracingLayer) {
      const traceClone = this.canvas.tracingLayer.cloneNode(true);
      if (traceClone.children.length > 0) {
        svgWrapper.appendChild(traceClone);
      }
    }

    // Append stage elements and strip redundant/default attributes
    Array.from(stageClone.children).forEach(child => {
      const clone = child.cloneNode(true);
      
      // Clean up default attributes across child elements
      const cleanNode = (node) => {
        if (node.getAttribute && node.getAttribute('stroke') === 'none') {
          node.removeAttribute('stroke');
        }
        if (node.getAttribute && node.getAttribute('rx') === '0') {
          node.removeAttribute('rx');
        }
        if (node.getAttribute && node.getAttribute('ry') === '0') {
          node.removeAttribute('ry');
        }
        if (node.getAttribute && node.getAttribute('opacity') === '1') {
          node.removeAttribute('opacity');
        }
        if (node.children) {
          Array.from(node.children).forEach(cleanNode);
        }
      };

      cleanNode(clone);
      svgWrapper.appendChild(clone);
    });

    this.textarea.value = svgWrapper.outerHTML;
  }

  bindDrawerEvents() {
    // Collapse/Expand drawer
    const drawer = document.getElementById('bottom-drawer');
    const toggleBtn = document.getElementById('btn-toggle-drawer');
    toggleBtn?.addEventListener('click', () => {
      drawer.classList.toggle('collapsed');
      toggleBtn.innerText = drawer.classList.contains('collapsed') ? 'Expand ▲' : 'Collapse ▼';
    });

    // Function to parse XML text and update canvas stage
    const applyXmlToCanvas = () => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.textarea.value, "image/svg+xml");
        const newSvg = doc.querySelector('svg');

        // Half-typed or invalid XML: leave the canvas as it is until the code parses again
        if (doc.querySelector('parsererror')) return;

        if (newSvg) {
          // Temporarily disable onCanvasModified listener during reload to avoid feedback loop
          const savedCallback = this.canvas.onCanvasModified;
          this.canvas.onCanvasModified = null;

          this.canvas.stage.innerHTML = '';

          Array.from(newSvg.children).forEach(child => {
            if (child.tagName.toLowerCase() === 'defs') {
              // Copy over defs
              Array.from(child.children).forEach(defItem => {
                const existing = document.getElementById(defItem.id);
                if (!existing) {
                  this.canvas.defs.appendChild(defItem.cloneNode(true));
                }
              });
            } else {
              this.canvas.stage.appendChild(child.cloneNode(true));
            }
          });

          this.canvas.clearSelection();
          this.canvas.saveState();
          this.canvas.onCanvasModified = savedCallback;
        }
      } catch (err) {
        console.error("Invalid SVG XML typed into drawer", err);
      }
    };

    // Listen on both 'change' (blur/enter) and live 'input' typing with 400ms debounce
    let debounceTimer = null;
    this.textarea?.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyXmlToCanvas, 400);
    });

    this.textarea?.addEventListener('change', applyXmlToCanvas);

    // VB.NET Backend API call: Clean & Format XML
    document.getElementById('btn-format-xml')?.addEventListener('click', async () => {
      if (!this.textarea.value) return;

      try {
        const response = await fetch('/api/svg/clean', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xmlContent: this.textarea.value })
        });
        const data = await response.json();
        if (data.success && data.formattedXml) {
          this.textarea.value = data.formattedXml;
        }
      } catch (err) {
        console.warn("Backend VB.NET clean API offline, formatting locally", err);
      }
    });

    // Find Selected Element in XML Source Code Button
    document.getElementById('btn-find-selected-xml')?.addEventListener('click', () => {
      this.findSelectedInXml();
    });

    // Copy to clipboard
    document.getElementById('btn-copy-xml')?.addEventListener('click', () => {
      this.textarea.select();
      navigator.clipboard.writeText(this.textarea.value);
      alert("SVG XML copied to clipboard!");
    });
  }

  findSelectedInXml() {
    if (!this.canvas.selectedElements || this.canvas.selectedElements.length === 0) {
      alert("Please select a shape or symbol on the canvas first.");
      return;
    }

    // Expand bottom drawer if collapsed
    const drawer = document.getElementById('bottom-drawer');
    if (drawer && drawer.classList.contains('collapsed')) {
      drawer.classList.remove('collapsed');
      const toggleBtn = document.getElementById('btn-toggle-drawer');
      if (toggleBtn) toggleBtn.textContent = 'Collapse ▼';
    }

    // Refresh XML source in textarea
    this.updateXmlTextarea();

    const selectedEl = this.canvas.selectedElements[0];
    const elId = selectedEl.getAttribute('id');
    const dataTag = selectedEl.getAttribute('data-tag');
    const className = selectedEl.getAttribute('class');

    const xmlText = this.textarea.value;
    let matchIndex = -1;

    const dAttr = selectedEl.getAttribute('d');
    const pointsAttr = selectedEl.getAttribute('points');

    // Search strategies in order of specificity
    if (elId && xmlText.includes(`id="${elId}"`)) {
      matchIndex = xmlText.indexOf(`id="${elId}"`);
    } else if (dataTag && xmlText.includes(`data-tag="${dataTag}"`)) {
      matchIndex = xmlText.indexOf(`data-tag="${dataTag}"`);
    } else if (className && xmlText.includes(`class="${className}"`)) {
      matchIndex = xmlText.indexOf(`class="${className}"`);
    } else if (dAttr && xmlText.includes(dAttr.substring(0, 15))) {
      matchIndex = xmlText.indexOf(dAttr.substring(0, 15));
    } else if (pointsAttr && xmlText.includes(pointsAttr.substring(0, 15))) {
      matchIndex = xmlText.indexOf(pointsAttr.substring(0, 15));
    }

    if (matchIndex === -1) {
      // Fallback: search for tag name (e.g. <rect, <circle, <polygon, <path, <g)
      const tagName = selectedEl.tagName.toLowerCase();
      matchIndex = xmlText.indexOf(`<${tagName}`);
    }

    if (matchIndex !== -1) {
      // Locate enclosing tag boundaries: backward '<' and forward '>'
      const startPos = xmlText.lastIndexOf('<', matchIndex);
      if (startPos !== -1) {
        let endPos = xmlText.indexOf('>', matchIndex);
        if (endPos !== -1) endPos += 1;
        else endPos = matchIndex + 20;

        // Focus & highlight matching XML segment in textarea
        this.textarea.focus();
        this.textarea.setSelectionRange(startPos, endPos);

        // Scroll textarea to center the highlighted line vertically in the box
        const textBefore = xmlText.substring(0, startPos);
        const lineNumber = textBefore.split('\n').length;
        const totalLines = Math.max(1, xmlText.split('\n').length);
        const lineHeight = this.textarea.scrollHeight / totalLines;
        const linePixelTop = (lineNumber - 1) * lineHeight;
        const containerHalfHeight = this.textarea.clientHeight / 2;

        this.textarea.scrollTop = Math.max(0, linePixelTop - containerHalfHeight);
      }
    } else {
      alert("Could not locate the selected element in the XML source code.");
    }
  }

  bindFileOperations() {
    // New Canvas Button
    document.getElementById('btn-new')?.addEventListener('click', () => {
      if (this.canvas.stage.children.length > 0) {
        const confirmNew = confirm("Start a new blank canvas?\n\nUnsaved artwork on the canvas will be cleared. Click 'OK' to cleanse the canvas or 'Cancel' to save your SVG first.");
        if (!confirmNew) return;
      }

      this.canvas.stage.innerHTML = '';
      this.canvas.clearSelection();
      this.canvas.setZoom(1.5);
      setTimeout(() => this.canvas.centerCanvas(), 50);
      this.updateXmlTextarea();
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    });

    // SVG Export Modal
    const svgModal = document.getElementById('svg-modal');
    const svgPaddingGroup = document.getElementById('svg-padding-group');
    document.querySelectorAll('input[name="svg-bounds-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (svgPaddingGroup) {
          svgPaddingGroup.style.display = (e.target.value === 'extents' || e.target.value === 'selected') ? 'block' : 'none';
        }
      });
    });

    document.getElementById('btn-save-svg')?.addEventListener('click', () => {
      if (svgModal) svgModal.style.display = 'flex';
    });

    const closeSvgModal = () => {
      if (svgModal) svgModal.style.display = 'none';
    };
    document.getElementById('svg-modal-close')?.addEventListener('click', closeSvgModal);
    document.getElementById('svg-modal-cancel')?.addEventListener('click', closeSvgModal);

    document.getElementById('svg-modal-download')?.addEventListener('click', () => {
      const boundsType = Array.from(document.getElementsByName('svg-bounds-type')).find(r => r.checked)?.value || 'canvas';
      const pad = Math.max(0, parseInt(document.getElementById('svg-padding-input')?.value || '10', 10));

      const result = this.getExportAreaAndDoc(boundsType, pad);
      if (!result) return;

      closeSvgModal();

      const blob = new Blob([result.svgEl.outerHTML], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = (boundsType === 'selected') ? `scada_symbol_selected_${result.sourceW}x${result.sourceH}.svg`
                     : (boundsType === 'extents') ? `scada_symbol_tight_${result.sourceW}x${result.sourceH}.svg`
                     : 'scada_symbol.svg';
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Open SVG File
    const fileInput = document.getElementById('file-input-svg');
    document.getElementById('btn-open')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const rawXml = evt.target.result;
        this.openSvgContent(rawXml);
      };
      reader.readAsText(file);
    });

    // Import External SVG into Current Canvas
    const importFileInput = document.getElementById('file-input-import-svg');
    document.getElementById('btn-import')?.addEventListener('click', () => {
      importFileInput?.click();
    });

    importFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const xml = this.sanitizeSvgXml(evt.target.result);
        this.importSvgContent(xml);
        importFileInput.value = '';
      };
      reader.readAsText(file);
    });

    // PNG Export Options Modal & Rendering
    const modal = document.getElementById('png-modal');
    const customColorGroup = document.getElementById('png-custom-color-group');
    const pngPaddingGroup = document.getElementById('png-padding-group');
    const bgRadioButtons = document.getElementsByName('png-bg-type');

    document.querySelectorAll('input[name="png-bg-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (customColorGroup) {
          customColorGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        }
      });
    });

    document.querySelectorAll('input[name="png-bounds-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (pngPaddingGroup) {
          pngPaddingGroup.style.display = (e.target.value === 'extents' || e.target.value === 'selected') ? 'block' : 'none';
        }
      });
    });

    // Open Modal
    document.getElementById('btn-export-png')?.addEventListener('click', () => {
      if (modal) modal.style.display = 'flex';
    });

    // Close Modal
    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };
    document.getElementById('png-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('png-modal-cancel')?.addEventListener('click', closeModal);

    // Render & Download PNG with selected options
    document.getElementById('png-modal-download')?.addEventListener('click', () => {
      const bgType = Array.from(bgRadioButtons).find(r => r.checked)?.value || 'transparent';
      const boundsType = Array.from(document.getElementsByName('png-bounds-type')).find(r => r.checked)?.value || 'canvas';
      const pad = Math.max(0, parseInt(document.getElementById('png-padding-input')?.value || '10', 10));
      const scaleMultiplier = parseFloat(document.getElementById('png-scale-select')?.value || '1');
      const customHex = document.getElementById('png-bg-custom-color')?.value || '#ffffff';

      const result = this.getExportAreaAndDoc(boundsType, pad);
      if (!result) return;

      closeModal();

      const targetW = Math.round(result.sourceW * scaleMultiplier);
      const targetH = Math.round(result.sourceH * scaleMultiplier);

      const svgString = result.svgEl.outerHTML;
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        // Draw background if not transparent
        if (bgType === 'white') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetW, targetH);
        } else if (bgType === 'dark') {
          ctx.fillStyle = '#1A202C';
          ctx.fillRect(0, 0, targetW, targetH);
        } else if (bgType === 'custom') {
          ctx.fillStyle = customHex;
          ctx.fillRect(0, 0, targetW, targetH);
        }

        // Draw cropped source area to target canvas
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        const filename = (boundsType === 'selected') ? `scada_symbol_selected_${targetW}x${targetH}.png` : `scada_symbol_${targetW}x${targetH}.png`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      };

      img.src = url;
    });
  }

  getExportAreaAndDoc(boundsType, pad = 10) {
    if (boundsType === 'selected') {
      if (!this.canvas.selectedElements || this.canvas.selectedElements.length === 0) {
        alert("No elements are currently selected. Please select one or more shapes on the canvas to export selected entities.");
        return null;
      }
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(this.textarea.value, "image/svg+xml");
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return null;

    let sourceX = 0;
    let sourceY = 0;
    let sourceW = this.canvas.width;
    let sourceH = this.canvas.height;

    if (boundsType === 'extents' && this.canvas.stage.children.length > 0) {
      const stageBBox = this.canvas.stage.getBBox();
      if (stageBBox.width > 0 && stageBBox.height > 0) {
        sourceX = Math.max(0, Math.floor(stageBBox.x - pad));
        sourceY = Math.max(0, Math.floor(stageBBox.y - pad));
        sourceW = Math.ceil(stageBBox.width + pad * 2);
        sourceH = Math.ceil(stageBBox.height + pad * 2);
      }
    } else if (boundsType === 'selected') {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const selectedIds = new Set();

      this.canvas.selectedElements.forEach(el => {
        if (el.id) selectedIds.add(el.id);

        const b = this.canvas.getElementStageBBox(el);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      });

      if (minX !== Infinity) {
        sourceX = Math.max(0, Math.floor(minX - pad));
        sourceY = Math.max(0, Math.floor(minY - pad));
        sourceW = Math.ceil((maxX - minX) + pad * 2);
        sourceH = Math.ceil((maxY - minY) + pad * 2);
      }

      // Strip non-selected stage elements from exported DOM
      const stage = doc.querySelector('#svg-stage') || svgEl;
      const children = Array.from(stage.children);
      children.forEach(child => {
        if (child.id !== 'canvas-grid-bg' && child.tagName.toLowerCase() !== 'defs') {
          if (!selectedIds.has(child.id)) {
            child.remove();
          }
        }
      });
    }

    svgEl.setAttribute("width", sourceW);
    svgEl.setAttribute("height", sourceH);
    svgEl.setAttribute("viewBox", `${sourceX} ${sourceY} ${sourceW} ${sourceH}`);

    return { doc, svgEl, sourceX, sourceY, sourceW, sourceH };
  }

  sanitizeSvgXml(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') return xmlString;
    
    // Replace any xmlns="..." attribute on the <svg> element with standard SVG namespace
    let sanitized = xmlString.replace(/<svg([^>]*?)xmlns\s*=\s*["'][^"']*["']/gi, (match, p1) => {
      return `<svg${p1}xmlns="http://www.w3.org/2000/svg"`;
    });

    if (!/<svg[^>]*xmlns=/i.test(sanitized)) {
      sanitized = sanitized.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    return sanitized;
  }

  getCorrectSvgTagName(tagName) {
    if (!tagName) return 'g';
    const tagMap = {
      'lineargradient': 'linearGradient',
      'radialgradient': 'radialGradient',
      'clippath': 'clipPath',
      'foreignobject': 'foreignObject',
      'animatetransform': 'animateTransform',
      'animatemotion': 'animateMotion',
      'fegaussianblur': 'feGaussianBlur',
      'fedropshadow': 'feDropShadow',
      'fecolormatrix': 'feColorMatrix',
      'fecomponenttransfer': 'feComponentTransfer',
      'fecomposite': 'feComposite',
      'feblend': 'feBlend',
      'fedisplacementmap': 'feDisplacementMap',
      'feflood': 'feFlood',
      'fefunca': 'feFuncA',
      'fefuncb': 'feFuncB',
      'fefuncg': 'feFuncG',
      'fefuncr': 'feFuncR',
      'feimage': 'feImage',
      'femerge': 'feMerge',
      'femergenode': 'feMergeNode',
      'femorphology': 'feMorphology',
      'feoffset': 'feOffset',
      'fepointlight': 'fePointLight',
      'fespecularlighting': 'feSpecularLighting',
      'fespotlight': 'feSpotLight',
      'fetile': 'feTile',
      'feturbulence': 'feTurbulence'
    };
    const lower = tagName.toLowerCase();
    return tagMap[lower] || (tagName.includes(':') ? tagName : lower);
  }

  cloneToSvgNamespace(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.nodeValue);
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      return document.createComment(node.nodeValue);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const ns = "http://www.w3.org/2000/svg";
      const correctTag = this.getCorrectSvgTagName(node.tagName);
      const newEl = document.createElementNS(ns, correctTag);
      Array.from(node.attributes).forEach(attr => {
        if (attr.name.toLowerCase() !== 'xmlns') {
          newEl.setAttribute(attr.name, attr.value);
        }
      });
      Array.from(node.childNodes).forEach(child => {
        const clonedChild = this.cloneToSvgNamespace(child);
        if (clonedChild) newEl.appendChild(clonedChild);
      });
      return newEl;
    }
    return null;
  }

  tryAutoFixSvg(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') return xmlString;
    let fixed = xmlString.trim();

    // 1. Fix mangled root tag names like <dfsvg>, <dssvg>, <mysvg> -> <svg>
    fixed = fixed.replace(/<[a-z0-9_-]*svg\b/gi, '<svg');
    fixed = fixed.replace(/<\/[a-z0-9_-]*svg>/gi, '</svg>');

    // 2. Fix missing opening <svg> tag
    if (!/<svg\b/i.test(fixed)) {
      fixed = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">\n' + fixed;
    }

    // 3. Fix missing closing </svg> tag
    if (!/<\/svg>/i.test(fixed)) {
      fixed += '\n</g>\n</svg>';
    }

    return this.sanitizeSvgXml(fixed);
  }

  showSvgErrorModal(errorMsg, rawXml, onAutoFixCallback, isRetry = false) {
    const modal = document.getElementById('svg-error-modal');
    const logContainer = document.getElementById('svg-error-log-details');
    const closeBtn = document.getElementById('svg-error-modal-close');
    const dismissBtn = document.getElementById('svg-error-modal-dismiss');
    const autoFixBtn = document.getElementById('svg-error-modal-autofix');

    const messagePrefix = isRetry ? "⚠️ Auto-Fix attempted, but syntax errors persist:\n\n" : "";
    if (logContainer) logContainer.textContent = messagePrefix + errorMsg;
    if (modal) modal.style.display = 'flex';

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (dismissBtn) dismissBtn.onclick = closeModal;
    if (autoFixBtn) {
      autoFixBtn.onclick = () => {
        closeModal();
        if (onAutoFixCallback) {
          const fixed = this.tryAutoFixSvg(rawXml);
          onAutoFixCallback(fixed, true);
        }
      };
    }
  }

  parseSvgDocument(xmlString, onAutoFixCallback, isRetry = false) {
    const sanitized = this.sanitizeSvgXml(xmlString);
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, 'image/svg+xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      const detail = parserError.textContent || 'Malformed or incomplete XML tags.';
      this.showSvgErrorModal(detail, xmlString, onAutoFixCallback, isRetry);
      return null;
    }

    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      this.showSvgErrorModal("No <svg> root element found in file.", xmlString, onAutoFixCallback, isRetry);
      return null;
    }

    return { doc, svgEl };
  }

  openSvgContent(xmlString, isRetry = false) {
    try {
      const parsed = this.parseSvgDocument(xmlString, (fixedXml, retryFlag) => this.openSvgContent(fixedXml, retryFlag), isRetry);
      if (!parsed) return;
      const { svgEl } = parsed;

      this.canvas.stage.innerHTML = '';
      this.canvas.clearSelection();

      // Clean up previous user-imported defs (preserve built-in grid, markers, and scada presets)
      const builtInIds = new Set(['grid-pattern', 'marker-arrow-end', 'marker-arrow-start', 'marker-circle', 'marker-diamond', 'scada-metal-pipe', 'scada-led-ok', 'scada-led-alarm']);

      if (this.canvas.defs) {
        Array.from(this.canvas.defs.children).forEach(child => {
          if (child.id && !builtInIds.has(child.id)) {
            child.remove();
          }
        });

        // Copy <defs> contents from opened SVG
        const newDefs = svgEl.querySelectorAll('defs > *');
        newDefs.forEach(defNode => {
          if (defNode.id) {
            const existing = this.canvas.defs.querySelector(`#${defNode.id}`);
            if (existing && !builtInIds.has(defNode.id)) {
              existing.remove();
            }
          }
          const importedNode = this.cloneToSvgNamespace(defNode);
          if (importedNode) this.canvas.defs.appendChild(importedNode);
        });
      }

      // Copy top-level vector children to stage
      Array.from(svgEl.childNodes).forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE && child.nodeName.toLowerCase() !== 'defs' && child.id !== 'canvas-grid-bg') {
          const importedChild = this.cloneToSvgNamespace(child);
          if (importedChild) this.canvas.stage.appendChild(importedChild);
        }
      });

      // Parse SVG artboard dimensions & viewBox
      let newW = 500;
      let newH = 500;

      const viewBoxAttr = svgEl.getAttribute('viewBox');
      if (viewBoxAttr) {
        const parts = viewBoxAttr.trim().split(/[\s,]+/);
        if (parts.length === 4) {
          const vbW = parseFloat(parts[2]);
          const vbH = parseFloat(parts[3]);
          if (!isNaN(vbW) && vbW > 0) newW = vbW;
          if (!isNaN(vbH) && vbH > 0) newH = vbH;
        }
      }

      const wAttr = svgEl.getAttribute('width');
      const hAttr = svgEl.getAttribute('height');
      if (wAttr && !wAttr.endsWith('%')) {
        const parsedW = parseFloat(wAttr);
        if (!isNaN(parsedW) && parsedW > 0) newW = parsedW;
      }
      if (hAttr && !hAttr.endsWith('%')) {
        const parsedH = parseFloat(hAttr);
        if (!isNaN(parsedH) && parsedH > 0) newH = parsedH;
      }

      this.canvas.setCanvasSize(newW, newH);

      this.updateXmlTextarea();
      if (this.canvas.onCanvasModified) this.canvas.onCanvasModified();
    } catch (err) {
      this.showSvgErrorModal(err.message || 'Error parsing SVG file.', xmlString, (fixedXml, retryFlag) => this.openSvgContent(fixedXml, retryFlag), isRetry);
    }
  }

  namespaceImportedDefs(svgEl) {
    if (!svgEl) return;
    const uid = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

    // 1. Collect all defs elements that have an ID
    const defElements = svgEl.querySelectorAll('defs [id]');
    const idMap = new Map();

    defElements.forEach(el => {
      const oldId = el.getAttribute('id');
      if (oldId) {
        const newId = `${oldId}_${uid}`;
        idMap.set(oldId, newId);
        el.setAttribute('id', newId);
      }
    });

    if (idMap.size === 0) return;

    // 2. Helper to replace url(#oldId) with url(#newId)
    const updateUrlRefs = (str) => {
      if (!str || typeof str !== 'string') return str;
      let updated = str;
      idMap.forEach((newId, oldId) => {
        const regex = new RegExp(`url\\(\\s*['"]?#${oldId}['"]?\\s*\\)`, 'g');
        updated = updated.replace(regex, `url(#${newId})`);
      });
      return updated;
    };

    // 3. Update all elements in the imported SVG (defs and body)
    const allNodes = svgEl.querySelectorAll('*');
    allNodes.forEach(node => {
      Array.from(node.attributes).forEach(attr => {
        if (attr.value && attr.value.includes('url(#')) {
          const newVal = updateUrlRefs(attr.value);
          if (newVal !== attr.value) {
            node.setAttribute(attr.name, newVal);
          }
        }
      });
    });
  }

  importSvgContent(xmlString, isRetry = false) {
    try {
      const parsed = this.parseSvgDocument(xmlString, (fixedXml, retryFlag) => this.importSvgContent(fixedXml, retryFlag), isRetry);
      if (!parsed) return;
      const { doc, svgEl } = parsed;

      // Namespace imported defs to prevent ID collisions with existing canvas gradients
      this.namespaceImportedDefs(svgEl);

      const ns = "http://www.w3.org/2000/svg";

      // 1. Copy any <defs> contents into canvas defs (gradients, patterns, markers)
      if (this.canvas.defs) {
        const newDefs = svgEl.querySelectorAll('defs > *');
        newDefs.forEach(defNode => {
          const importedNode = this.cloneToSvgNamespace(defNode);
          if (importedNode) this.canvas.defs.appendChild(importedNode);
        });
      }

      // 2. Wrap imported SVG elements in a single group
      const importedGroup = document.createElementNS(ns, 'g');
      importedGroup.setAttribute('id', `imported_svg_${Date.now().toString().slice(-4)}`);
      importedGroup.setAttribute('class', 'imported-svg-group');

      // Copy child elements (excluding <defs>) into importedGroup
      Array.from(svgEl.childNodes).forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE && child.nodeName.toLowerCase() !== 'defs') {
          const importedChild = this.cloneToSvgNamespace(child);
          if (importedChild) importedGroup.appendChild(importedChild);
        }
      });

      if (importedGroup.childNodes.length === 0) {
        alert('No importable vector elements found in the SVG file.');
        return;
      }

      // 3. Add to canvas temporarily to measure bounding box
      this.canvas.addElement(importedGroup);

      // Measure bounding box of the imported content
      let bbox = { x: 0, y: 0, width: 100, height: 100 };
      try {
        bbox = importedGroup.getBBox();
      } catch (e) {}

      // If bounding box is oversized (> 350px), scale down proportionally to fit canvas
      const maxDim = 350;
      let scale = 1.0;
      if (bbox.width > maxDim || bbox.height > maxDim) {
        scale = Math.min(maxDim / bbox.width, maxDim / bbox.height);
      }

      // Center the imported graphic smoothly in the middle of the current canvas
      const canvasW = this.canvas.width;
      const canvasH = this.canvas.height;
      const targetCenterX = canvasW / 2;
      const targetCenterY = canvasH / 2;
      const currentCenterX = bbox.x + bbox.width / 2;
      const currentCenterY = bbox.y + bbox.height / 2;

      const translateX = targetCenterX - (currentCenterX * scale);
      const translateY = targetCenterY - (currentCenterY * scale);

      if (Math.abs(scale - 1.0) > 0.001 || Math.abs(translateX) > 0.1 || Math.abs(translateY) > 0.1) {
        importedGroup.setAttribute('transform', `translate(${translateX.toFixed(2)}, ${translateY.toFixed(2)}) scale(${scale.toFixed(4)})`);
      }

      // 4. Select imported group with 8-point handles
      this.canvas.selectElement(importedGroup);
    } catch (err) {
      console.error('Error importing SVG:', err);
      alert('Failed to import SVG file.');
    }
  }
}
