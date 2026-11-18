// shared/motion.js - Zero-Dependency Vanilla WAAPI & FLIP Motion Engine for Sri Nathi Operations Portal

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia(REDUCED_QUERY).matches;
  } catch (_) {
    return false;
  }
}

export function animateCountUps(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const els = root.querySelectorAll('[data-count-to]');
  const reduced = prefersReducedMotion();

  els.forEach(el => {
    if (el.dataset.snCounted === '1') return;
    el.dataset.snCounted = '1';

    const target = parseFloat(el.dataset.countTo || '0');
    const prefix = el.dataset.countPrefix || '';
    const suffix = el.dataset.countSuffix || '';
    const format = el.dataset.countFormat || 'int'; // 'int' | 'inr' | 'pct'

    const formatVal = (val) => {
      if (format === 'inr') {
        try {
          return `${prefix}${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(val))}${suffix}`;
        } catch (_) {
          return `${prefix}Rs. ${Math.round(val).toLocaleString('en-IN')}${suffix}`;
        }
      }
      if (format === 'pct') {
        return `${prefix}${Math.round(val)}%${suffix}`;
      }
      return `${prefix}${Math.round(val).toLocaleString('en-IN')}${suffix}`;
    };

    if (reduced || !isFinite(target) || target === 0) {
      el.textContent = formatVal(isFinite(target) ? target : 0);
      return;
    }

    const duration = 520;
    const start = performance.now();
    const tick = (now) => {
      if (!el.isConnected) return;
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatVal(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = formatVal(target);
    };
    requestAnimationFrame(tick);
  });
}

// Track last segmented indicator box by group key so it morphs smoothly even across re-renders
const segMemory = (typeof window !== 'undefined')
  ? (window._snSegRectMemory = window._snSegRectMemory || new Map())
  : new Map();

export function syncSegmentedCapsules(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const groups = root.querySelectorAll('.sn-cal-segmented, .pos-channel-segmented, [data-sn-segmented]');
  const reduced = prefersReducedMotion();

  groups.forEach((group, idx) => {
    const active = group.querySelector('.active');
    if (!active || typeof group.getBoundingClientRect !== 'function') return;
    const groupKey = group.dataset.segGroup || group.id || `${group.className}-${idx}`;

    // Ensure group is positioning context
    const cs = window.getComputedStyle ? window.getComputedStyle(group) : null;
    if (cs && cs.position === 'static') group.style.position = 'relative';

    let thumb = group.querySelector(':scope > .sn-seg-thumb');
    if (!thumb) {
      thumb = document.createElement('span');
      thumb.className = 'sn-seg-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      group.insertBefore(thumb, group.firstChild);
    }

    const gRect = group.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    if (!gRect.width || !aRect.width) return;

    const toLeft = aRect.left - gRect.left + group.scrollLeft;
    const toTop = aRect.top - gRect.top;
    const toW = aRect.width;
    const toH = aRect.height;

    const prev = segMemory.get(groupKey);
    segMemory.set(groupKey, { left: toLeft, top: toTop, width: toW, height: toH });

    thumb.style.width = `${toW}px`;
    thumb.style.height = `${toH}px`;
    thumb.style.top = `${toTop}px`;
    thumb.style.transform = `translate3d(${toLeft}px, 0, 0)`;

    if (!reduced && prev && (Math.abs(prev.left - toLeft) > 1 || Math.abs(prev.width - toW) > 1) && typeof thumb.animate === 'function') {
      thumb.animate([
        { width: `${prev.width}px`, transform: `translate3d(${prev.left}px, 0, 0)` },
        { width: `${toW}px`, transform: `translate3d(${toLeft}px, 0, 0)` }
      ], {
        duration: 280,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
      });
    }
  });
}

export function captureFlipPositions(root = document, selector = '[data-flip-id]', attr = 'data-flip-id') {
  const map = new Map();
  if (!root || typeof root.querySelectorAll !== 'function') return map;
  root.querySelectorAll(selector).forEach(el => {
    const id = el.getAttribute(attr);
    if (!id) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      map.set(id, { rect, stage: el.getAttribute('data-stage') || '' });
    }
  });
  return map;
}

export function playFlipTransitions(root = document, prevMap, selector = '[data-flip-id]', attr = 'data-flip-id') {
  if (!root || !prevMap || typeof root.querySelectorAll !== 'function') return;
  if (prefersReducedMotion()) return;

  root.querySelectorAll(selector).forEach((el, idx) => {
    const id = el.getAttribute(attr);
    if (!id || typeof el.animate !== 'function') return;
    const nextRect = el.getBoundingClientRect();
    const prev = prevMap.get(id);

    if (!prev) {
      el.animate([
        { opacity: 0, transform: 'translate3d(0, 12px, 0) scale(0.97)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
      ], {
        duration: 320,
        delay: Math.min(idx * 24, 180),
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both'
      });
      return;
    }

    const dx = prev.rect.left - nextRect.left;
    const dy = prev.rect.top - nextRect.top;
    const stageChanged = prev.stage && (el.getAttribute('data-stage') || '') !== prev.stage;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !stageChanged) return;

    el.animate([
      {
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(${stageChanged ? 1.03 : 1})`,
        boxShadow: stageChanged ? '0 14px 32px rgba(13, 148, 136, 0.28)' : undefined
      },
      {
        transform: 'translate3d(0, 0, 0) scale(1)'
      }
    ], {
      duration: stageChanged ? 420 : 340,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
    });
  });
}

export function animateSvgPaths(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const reduced = prefersReducedMotion();
  root.querySelectorAll('.sn-svg-draw').forEach((path, idx) => {
    if (path.dataset.snDrawn === '1') return;
    path.dataset.snDrawn = '1';
    try {
      const len = typeof path.getTotalLength === 'function' ? path.getTotalLength() : 280;
      if (reduced || !len) return;
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      if (typeof path.animate === 'function') {
        path.animate([
          { strokeDashoffset: len },
          { strokeDashoffset: 0 }
        ], {
          duration: 650,
          delay: Math.min(idx * 65, 260),
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards'
        });
      } else {
        path.style.transition = 'stroke-dashoffset 0.65s cubic-bezier(0.22, 1, 0.36, 1)';
        requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });
      }
    } catch (_) {}
  });
}

export function crystallize(root = document, selector = '.sn-crystallize') {
  if (!root || typeof root.querySelectorAll !== 'function' || prefersReducedMotion()) return;
  const els = root.querySelectorAll(selector);
  els.forEach((el, idx) => {
    if (el.dataset.snCrystal === '1' || typeof el.animate !== 'function') return;
    el.dataset.snCrystal = '1';
    el.animate([
      { opacity: 0, transform: 'translate3d(0, 10px, 0) scale(0.988)', filter: 'blur(4px)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)', filter: 'blur(0px)' }
    ], {
      duration: 360,
      delay: Math.min(idx * 28, 220),
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both'
    });
  });
}

export function hydrateMotionSurface(root = document) {
  requestAnimationFrame(() => {
    animateCountUps(root);
    syncSegmentedCapsules(root);
    animateSvgPaths(root);
    crystallize(root);
  });
}

if (typeof window !== 'undefined') {
  window.SNMotion = {
    prefersReducedMotion,
    animateCountUps,
    syncSegmentedCapsules,
    captureFlipPositions,
    playFlipTransitions,
    animateSvgPaths,
    crystallize,
    hydrateMotionSurface
  };
}
