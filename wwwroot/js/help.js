/**
 * SimpleVG Help System Manager
 * In-app Markdown help viewer
 */

class HelpSystem {
  constructor() {
    this.panel = document.getElementById('helpPanel');
    this.nav = document.getElementById('helpNav');
    this.content = document.getElementById('helpContent');
    this.search = document.getElementById('helpSearch');
    this.closeBtn = document.getElementById('btnHelpClose');
    this.helpBtn = document.getElementById('btn-help');
    this.resizeHandle = document.getElementById('helpResizeHandle');

    this.manifest = null;
    this.activeItem = null;

    this.init();
  }

  init() {
    this.helpBtn?.addEventListener('click', () => this.openHelp('Welcome'));
    this.closeBtn?.addEventListener('click', () => this.closeHelp());
    this.search?.addEventListener('input', () => this.filterNav(this.search.value));

    // Global F1 key handler for Help
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        this.openHelp('Welcome');
      }
    });

    this.initDragResize();
  }

  async loadManifest(forceRefresh = true) {
    if (this.manifest && !forceRefresh) return this.manifest;
    try {
      const resp = await fetch('help/helpdocs.json?v=' + Date.now(), { cache: 'no-store' });
      this.manifest = await resp.json();
    } catch (e) {
      console.warn('Failed to load help manifest:', e);
      this.manifest = [];
    }
    return this.manifest;
  }

  buildNav(data) {
    if (!this.nav) return;
    this.nav.innerHTML = '';
    data.forEach(sec => {
      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'help-nav-section';
      sectionHeader.textContent = sec.section;
      this.nav.appendChild(sectionHeader);

      sec.topics.forEach(topic => {
        const item = document.createElement('div');
        item.className = 'help-nav-item';
        item.textContent = topic.title;
        item.dataset.file = topic.file.replace(/\.md$/i, '');
        item.dataset.title = topic.title;
        item.addEventListener('click', () => this.loadTopic(item));
        this.nav.appendChild(item);
      });
    });
  }

  async openHelp(topicSlug = 'Welcome') {
    if (!this.panel) return;
    this.panel.classList.remove('hidden');
    const data = await this.loadManifest(true);
    this.buildNav(data);

    const target = this.nav.querySelector(`.help-nav-item[data-file="${topicSlug}"]`) ||
                   this.nav.querySelector('.help-nav-item');
    if (target) {
      this.loadTopic(target);
    }
  }

  closeHelp() {
    this.panel?.classList.add('hidden');
  }

  async loadTopic(item) {
    if (this.activeItem) this.activeItem.classList.remove('active');
    item.classList.add('active');
    this.activeItem = item;

    const fileSlug = item.dataset.file;
    try {
      const resp = await fetch(`help/${fileSlug}.md?v=` + Date.now(), { cache: 'no-store' });
      if (!resp.ok) throw new Error('Topic file not found');
      const mdText = await resp.text();
      this.renderMarkdown(mdText);
    } catch (err) {
      this.content.innerHTML = `<div class="help-error"><h3>Topic Not Found</h3><p>Unable to load topic: ${fileSlug}.md</p></div>`;
    }
  }

  filterNav(query) {
    const q = query.toLowerCase().trim();
    this.nav.querySelectorAll('.help-nav-item').forEach(item => {
      const match = !q || item.dataset.title.toLowerCase().includes(q);
      item.classList.toggle('hidden', !match);
    });
  }

  renderMarkdown(mdText) {
    if (!this.content) return;

    // Parse Markdown to HTML
    let html = this.parseMarkdownToHtml(mdText);
    this.content.innerHTML = html;

    // Route internal markdown links (.md) through loadTopic
    this.content.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.endsWith('.md')) {
        const slug = href.replace(/\.md$/i, '');
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const target = this.nav.querySelector(`.help-nav-item[data-file="${slug}"]`);
          if (target) {
            this.loadTopic(target);
          } else {
            this.openHelp(slug);
          }
        });
      } else if (href.startsWith('http')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  parseMarkdownToHtml(md) {
    let lines = md.split('\n');
    let out = [];
    let inCode = false;
    let codeBuffer = [];
    let inTable = false;
    let tableRows = [];

    const flushTable = () => {
      if (!inTable) return;
      if (tableRows.length > 0) {
        let tHtml = '<table class="help-table"><thead>';
        let headers = tableRows[0];
        tHtml += '<tr>' + headers.map(c => `<th>${this.formatInline(c.trim())}</th>`).join('') + '</tr></thead><tbody>';
        for (let i = 1; i < tableRows.length; i++) {
          if (i === 1 && tableRows[i][0].includes('---')) continue; // separator row
          tHtml += '<tr>' + tableRows[i].map(c => `<td>${this.formatInline(c.trim())}</td>`).join('') + '</tr>';
        }
        tHtml += '</tbody></table>';
        out.push(tHtml);
      }
      tableRows = [];
      inTable = false;
    };

    let inUl = false;
    let inOl = false;

    const flushList = () => {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Code blocks
      if (line.trim().startsWith('```')) {
        flushList();
        if (inCode) {
          out.push(`<pre class="help-codeblock"><code>${this.escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
          codeBuffer = [];
          inCode = false;
        } else {
          flushTable();
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeBuffer.push(line);
        continue;
      }

      // Tables
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        flushList();
        inTable = true;
        let cols = line.trim().slice(1, -1).split('|');
        tableRows.push(cols);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Alerts / Callouts
      if (line.trim().startsWith('> [!NOTE]') || line.trim().startsWith('> [!TIP]') || line.trim().startsWith('> [!IMPORTANT]') || line.trim().startsWith('> [!WARNING]')) {
        flushList();
        let type = 'note';
        if (line.includes('TIP')) type = 'tip';
        if (line.includes('IMPORTANT')) type = 'important';
        if (line.includes('WARNING')) type = 'warning';

        let alertContent = [];
        i++;
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          alertContent.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        i--;
        out.push(`<div class="help-alert alert-${type}"><strong>${type.toUpperCase()}</strong>: ${this.formatInline(alertContent.join(' '))}</div>`);
        continue;
      }

      // Unordered lists (- )
      if (line.trim().startsWith('- ')) {
        if (inOl) { flushList(); }
        if (!inUl) { out.push('<ul class="help-ul">'); inUl = true; }
        out.push(`<li>${this.formatInline(line.trim().slice(2))}</li>`);
        continue;
      }

      // Ordered lists (1. )
      if (/^\d+\.\s/.test(line.trim())) {
        if (inUl) { flushList(); }
        if (!inOl) { out.push('<ol class="help-ol">'); inOl = true; }
        out.push(`<li>${this.formatInline(line.trim().replace(/^\d+\.\s/, ''))}</li>`);
        continue;
      }

      // Non-list line -> flush open lists
      flushList();

      // Headings
      if (line.startsWith('# ')) {
        out.push(`<h1>${this.formatInline(line.slice(2))}</h1>`);
      } else if (line.startsWith('## ')) {
        out.push(`<h2>${this.formatInline(line.slice(3))}</h2>`);
      } else if (line.startsWith('### ')) {
        out.push(`<h3>${this.formatInline(line.slice(4))}</h3>`);
      } else if (line.startsWith('---')) {
        out.push('<hr class="help-hr">');
      } else if (line.trim() === '') {
        out.push('<div class="help-spacer"></div>');
      } else {
        out.push(`<p>${this.formatInline(line)}</p>`);
      }
    }

    flushList();
    flushTable();
    return out.join('\n');
  }

  formatInline(str) {
    return str
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  initDragResize() {
    if (!this.resizeHandle || !this.panel) return;
    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    this.resizeHandle.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startWidth = this.panel.offsetWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = startX - e.clientX;
      const newWidth = Math.max(320, Math.min(900, startWidth + dx));
      this.panel.style.width = `${newWidth}px`;
    });

    window.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }
}

// Initialize Help System when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.helpSystem = new HelpSystem();
});
