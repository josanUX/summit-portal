import { loadStyle, getConfig } from '../../scripts/ak.js';
import {
  parseVisibilityRows,
  renderStats,
  renderPlatforms,
  renderPanel,
  renderGap,
  renderCta,
  renderInsight,
} from './rav-core.js';

/**
 * Move every Visibility gap + Key insight row to sit directly above the first CTA
 * (e.g. "Discover Adobe LLM…") so the flex pair is never split by the CTA in the sheet.
 * @param {Array<{ type: string, cells: Element[] }>} rows
 * @returns {typeof rows}
 */
function reorderGapInsightBeforeCta(rows) {
  const without = rows.filter((r) => r.type !== 'gap' && r.type !== 'insight');
  const ctaIdx = without.findIndex((r) => r.type === 'cta');
  if (ctaIdx === -1) {
    return rows;
  }

  const tagged = rows
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => r.type === 'gap' || r.type === 'insight');
  if (tagged.length === 0) {
    return rows;
  }

  const typeOrder = { gap: 0, insight: 1 };
  const ordered = [...tagged]
    .sort((a, b) => {
      const ta = typeOrder[a.r.type] ?? 99;
      const tb = typeOrder[b.r.type] ?? 99;
      if (ta !== tb) return ta - tb;
      return a.index - b.index;
    })
    .map(({ r }) => r);

  return [...without.slice(0, ctaIdx), ...ordered, ...without.slice(ctaIdx)];
}

/**
 * Performance insights shell: section head + panels outer.
 * The following report-scores block is moved into panels outer in decorate().
 * @param {string} sectionTitleText
 * @returns {HTMLDivElement}
 */
function buildEmptyVisibilityShell(sectionTitleText) {
  const shell = document.createElement('div');
  shell.className = 'report-ai-visibility rav-empty-shell';

  const sectionHead = document.createElement('div');
  sectionHead.className = 'rav-section-head';
  const sectionTitle = document.createElement('h2');
  sectionTitle.className = 'rav-section-title';
  sectionTitle.textContent = sectionTitleText;
  sectionHead.append(sectionTitle);

  const container = document.createElement('div');
  container.className = 'rav-container';

  const panelsOuter = document.createElement('div');
  panelsOuter.className = 'rav-panels-outer';

  container.append(sectionHead, panelsOuter);
  shell.append(container);
  return shell;
}

// ── Main decorator ──────────────────────────────────────────────────────────

export default async function decorate(block) {
  const rows = reorderGapInsightBeforeCta(parseVisibilityRows(block));

  const sectionHead = document.createElement('div');
  sectionHead.className = 'rav-section-head';
  const sectionTitle = document.createElement('h2');
  sectionTitle.className = 'rav-section-title';
  sectionTitle.textContent = 'LLM visibility';
  sectionHead.append(sectionTitle);

  const container = document.createElement('div');
  container.className = 'rav-container';

  /** @type {HTMLDivElement | null} */
  let panelsOuterHost = null;

  let i = 0;
  while (i < rows.length) {
    const { type } = rows[i];

    if (type === 'stats') {
      const group = [];
      while (i < rows.length && rows[i].type === 'stats') { group.push(rows[i]); i += 1; }
      container.append(renderStats(group));
    } else if (type === 'platforms') {
      sectionHead.append(renderPlatforms(rows[i]));
      i += 1;
    } else if (type === 'headline' || type === 'comparison') {
      const panelsOuter = document.createElement('div');
      panelsOuter.className = 'rav-panels-outer';
      const panelWrap = document.createElement('div');
      panelWrap.className = 'rav-panels';
      while (i < rows.length && (rows[i].type === 'headline' || rows[i].type === 'comparison')) {
        panelWrap.append(renderPanel(rows[i]));
        i += 1;
      }
      panelsOuter.append(panelWrap);
      container.append(panelsOuter);
      panelsOuterHost = panelsOuter;
    } else if (type === 'gap') {
      const flex = document.createElement('div');
      flex.className = 'rav-gap-insight-flex';
      flex.append(renderGap(rows[i]));
      i += 1;
      if (i < rows.length && rows[i].type === 'insight') {
        flex.append(renderInsight(rows[i]));
        i += 1;
      }
      (panelsOuterHost ?? container).append(flex);
    } else if (type === 'cta') {
      container.append(renderCta(rows[i]));
      i += 1;
    } else if (type === 'insight') {
      const flex = document.createElement('div');
      flex.className = 'rav-gap-insight-flex';
      flex.append(renderInsight(rows[i]));
      i += 1;
      (panelsOuterHost ?? container).append(flex);
    } else {
      i += 1;
    }
  }

  container.prepend(sectionHead);

  await loadStyle(`${getConfig().codeBase}/blocks/report-ai-visibility/report-ai-visibility.css`);

  block.textContent = '';
  block.append(container);

  const performanceShell = buildEmptyVisibilityShell('Performance insights');
  block.after(performanceShell);

  const perfPanelsOuter = performanceShell.querySelector('.rav-panels-outer');
  if (perfPanelsOuter) {
    let sib = performanceShell.nextElementSibling;
    while (sib) {
      const { nextElementSibling } = sib;
      if (sib.classList.contains('report-scores')) {
        perfPanelsOuter.prepend(sib);
        break;
      }
      sib = nextElementSibling;
    }
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('rav-animate');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  observer.observe(block);
  observer.observe(performanceShell);
}
