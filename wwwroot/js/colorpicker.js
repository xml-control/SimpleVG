/**
 * SimpleVG Custom Color Picker Popover Module
 * SCADA-style color picker with 48 Basic Swatches, HEX, and RGB Sliders
 */

class ColorPickerPopover {
  constructor() {
    this.popoverEl = null;
    this.activeTrigger = null;
    this.activeTarget = null; // 'fill' or 'stroke'
    this.currentColor = '#3182CE';
    this.originalColor = '#3182CE';
    this.onApplyCallback = null;
    this.onLiveCallback = null;
    this.isOpen = false;

    this.init();
  }

  init() {
    this.createPopoverElement();
    
    // Close popover when clicking outside
    window.addEventListener('mousedown', (e) => {
      if (!this.isOpen) return;
      if (this.popoverEl && !this.popoverEl.contains(e.target) && this.activeTrigger && !this.activeTrigger.contains(e.target)) {
        this.close(false);
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close(false);
      }
    });
  }

  createPopoverElement() {
    const pop = document.createElement('div');
    pop.className = 'color-picker-popover hidden';
    pop.id = 'scada-color-popover';

    pop.innerHTML = `
      <div class="color-picker-section-label">BASIC COLORS</div>
      <div class="color-picker-grid" id="color-swatch-grid"></div>

      <div class="color-picker-preview-row">
        <div class="color-picker-preview-swatch" id="cp-preview-chip"></div>
        <div class="color-picker-hex-wrap">
          <label class="color-picker-field-label">HEX</label>
          <input type="text" id="cp-hex-input" class="color-picker-hex-input" value="#3182CE">
        </div>
      </div>

      <button type="button" id="cp-more-btn" class="color-picker-more-btn">
        <span id="cp-more-chevron" class="color-picker-more-chevron">▼</span> More options
      </button>

      <div class="color-picker-expanded" id="cp-expanded-rgb">
        <div class="color-picker-slider-row">
          <span class="color-picker-slider-label r">R</span>
          <input type="range" id="cp-rgb-r" min="0" max="255" value="49" class="color-picker-slider">
          <span class="color-picker-slider-val" id="cp-val-r">49</span>
        </div>
        <div class="color-picker-slider-row">
          <span class="color-picker-slider-label g">G</span>
          <input type="range" id="cp-rgb-g" min="0" max="255" value="130" class="color-picker-slider">
          <span class="color-picker-slider-val" id="cp-val-g">130</span>
        </div>
        <div class="color-picker-slider-row">
          <span class="color-picker-slider-label b">B</span>
          <input type="range" id="cp-rgb-b" min="0" max="255" value="206" class="color-picker-slider">
          <span class="color-picker-slider-val" id="cp-val-b">206</span>
        </div>
      </div>

      <div class="color-picker-actions">
        <button type="button" id="cp-btn-cancel" class="cp-action-btn cancel">Cancel</button>
        <button type="button" id="cp-btn-ok" class="cp-action-btn ok">OK</button>
      </div>
    `;

    document.body.appendChild(pop);
    this.popoverEl = pop;

    this.buildSwatches();
    this.bindEvents();
  }

  generateSwatches() {
    const swatches = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#3A414E', '#4B5563', '#FFFFFF', '#000000'];
    const lightnesses = [72, 56, 40, 24];
    lightnesses.forEach(l => {
      for (let col = 0; col < 8; col++) {
        const hue = col * 45;
        swatches.push(this.hslToHex(hue, 65, l));
      }
    });
    swatches.push('#FFFFFF', '#CBD5E1', '#94A3B8', '#64748B', '#475569', '#334155', '#1E293B', '#000000');
    return swatches;
  }

  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
  }

  buildSwatches() {
    const grid = document.getElementById('color-swatch-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const swatches = this.generateSwatches();

    swatches.forEach(hex => {
      const sw = document.createElement('div');
      sw.className = 'color-picker-swatch';
      sw.style.background = hex;
      sw.title = hex;
      sw.addEventListener('click', () => {
        this.updateFromHex(hex);
        if (this.onLiveCallback) this.onLiveCallback(this.currentColor);
      });
      grid.appendChild(sw);
    });
  }

  bindEvents() {
    const hexInput = document.getElementById('cp-hex-input');
    const rSlider = document.getElementById('cp-rgb-r');
    const gSlider = document.getElementById('cp-rgb-g');
    const bSlider = document.getElementById('cp-rgb-b');
    const moreBtn = document.getElementById('cp-more-btn');
    const expandedRGB = document.getElementById('cp-expanded-rgb');
    const chevron = document.getElementById('cp-more-chevron');
    const btnOk = document.getElementById('cp-btn-ok');
    const btnCancel = document.getElementById('cp-btn-cancel');

    moreBtn?.addEventListener('click', () => {
      const isShow = expandedRGB.classList.toggle('show');
      if (chevron) chevron.textContent = isShow ? '▲' : '▼';
    });

    hexInput?.addEventListener('input', () => {
      let val = hexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        this.updateFromHex(val, false);
        if (this.onLiveCallback) this.onLiveCallback(this.currentColor);
      }
    });

    const onRgbInput = () => {
      const r = parseInt(rSlider.value, 10);
      const g = parseInt(gSlider.value, 10);
      const b = parseInt(bSlider.value, 10);
      const hex = this.rgbToHex(r, g, b);
      this.updateFromHex(hex, true, false);
      if (this.onLiveCallback) this.onLiveCallback(this.currentColor);
    };

    rSlider?.addEventListener('input', onRgbInput);
    gSlider?.addEventListener('input', onRgbInput);
    bSlider?.addEventListener('input', onRgbInput);

    btnOk?.addEventListener('click', () => this.close(true));
    btnCancel?.addEventListener('click', () => this.close(false));
  }

  normalizeHex(hex) {
    if (!hex || hex === 'none' || hex === 'transparent') return '#3182CE';
    if (hex.startsWith('#')) {
      if (hex.length === 4) {
        return ('#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]).toUpperCase();
      }
      return hex.toUpperCase();
    }
    const match = hex.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (match) {
      return this.rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    }
    return '#3182CE';
  }

  hexToRgb(hex) {
    const clean = this.normalizeHex(hex).replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return { r, g, b };
  }

  rgbToHex(r, g, b) {
    const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  updateFromHex(hex, syncHexInput = true, syncSliders = true) {
    this.currentColor = this.normalizeHex(hex);
    
    const chip = document.getElementById('cp-preview-chip');
    if (chip) chip.style.background = this.currentColor;

    if (syncHexInput) {
      const hexInput = document.getElementById('cp-hex-input');
      if (hexInput) hexInput.value = this.currentColor;
    }

    const { r, g, b } = this.hexToRgb(this.currentColor);
    
    if (syncSliders) {
      const rSlider = document.getElementById('cp-rgb-r');
      const gSlider = document.getElementById('cp-rgb-g');
      const bSlider = document.getElementById('cp-rgb-b');
      if (rSlider) rSlider.value = r;
      if (gSlider) gSlider.value = g;
      if (bSlider) bSlider.value = b;
    }

    document.getElementById('cp-val-r').textContent = r;
    document.getElementById('cp-val-g').textContent = g;
    document.getElementById('cp-val-b').textContent = b;
  }

  open(triggerElement, initialHex, onLive, onApply) {
    this.activeTrigger = triggerElement;
    this.currentColor = this.normalizeHex(initialHex);
    this.originalColor = this.currentColor;
    this.onLiveCallback = onLive;
    this.onApplyCallback = onApply;

    // Reset expanded RGB section to collapsed state by default
    const expandedRGB = document.getElementById('cp-expanded-rgb');
    const chevron = document.getElementById('cp-more-chevron');
    if (expandedRGB) expandedRGB.classList.remove('show');
    if (chevron) chevron.textContent = '▼';

    this.updateFromHex(this.currentColor);

    // Position popover relative to trigger element
    const rect = triggerElement.getBoundingClientRect();
    const popW = 270;
    const popH = 340;

    let left = rect.left - popW + rect.width;
    if (left < 10) left = rect.left;
    let top = rect.bottom + 6;

    if (top + popH > window.innerHeight) {
      top = Math.max(10, rect.top - popH - 6);
    }

    this.popoverEl.style.left = `${left}px`;
    this.popoverEl.style.top = `${top}px`;
    this.popoverEl.classList.remove('hidden');
    this.isOpen = true;
  }

  close(apply = true) {
    if (!this.isOpen) return;
    this.popoverEl.classList.add('hidden');
    this.isOpen = false;

    if (apply) {
      if (this.onApplyCallback) this.onApplyCallback(this.currentColor);
    } else {
      // Revert live changes
      if (this.onLiveCallback) this.onLiveCallback(this.originalColor);
    }
  }
}

// Global instance
window.colorPickerPopover = new ColorPickerPopover();
