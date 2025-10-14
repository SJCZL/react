// js/textbox-snapshot/manager.js
// Snapshot manager for textboxes marked with data-snap-id
// Keybindings (Mac Option = Alt):
// - Option + S : save snapshot
// - Option + Backspace : delete current snapshot (no confirmation)
// - Shift + Option + S : export snapshot history as JSON (downloads file)
// - Option + ArrowLeft / ArrowRight : switch between snapshots
//
// To make an element snapshotable, add attribute: data-snap-id="your-id"
// Example: <textarea data-snap-id="prompt-1"></textarea>

const TbSnapshot = (() => {
  const states = new WeakMap();
  let activeEl = null;
  let overlayEl = null;
  let badgeAttr = 'data-snap-id';

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleString();
    } catch (e) {
      return new Date(ts).toISOString();
    }
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.className = 'tb-snapshot-overlay';
    overlayEl.innerHTML = '<div class="tb-snapshot-message"></div><div class="tb-snapshot-meta"></div>';
    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  let overlayTimeout = null;
  function showOverlay(message, meta) {
    const el = ensureOverlay();
    el.querySelector('.tb-snapshot-message').textContent = message || '';
    el.querySelector('.tb-snapshot-meta').textContent = meta || '';
    el.style.display = 'flex';
    if (overlayTimeout) clearTimeout(overlayTimeout);
    overlayTimeout = setTimeout(() => {
      el.style.display = 'none';
    }, 2500);
  }

  function initElement(el) {
    if (!el || !(el instanceof HTMLElement)) return;
    if (!el.hasAttribute(badgeAttr)) return;
    if (states.has(el)) return;

    const id = el.getAttribute(badgeAttr) || `snap-${Math.random().toString(36).slice(2,9)}`;
    const state = {
      id,
      snapshots: [],
      lastEditedValue: el.value || '',
      lastEditedAt: Date.now(),
      activeIndex: null // null means viewing metasnapshot (current editing)
    };
    states.set(el, state);

    // Create a dedicated DOM badge per element so textareas/inputs that don't
    // support ::after (replaced elements) still show a badge. Position the
    // badge relative to the element's parent and keep it in sync on resize.
    try {
      const parent = el.parentElement || document.body;
      // ensure parent can be a positioning context
      const prevPos = getComputedStyle(parent).position;
      if (prevPos === 'static' || !prevPos) parent.style.position = 'relative';

      // Avoid creating duplicate badge for the same element
      const existing = parent.querySelector(`.tb-snapshot-badge[data-snap-for="${id}"]`);
      if (!existing) {
        const badge = document.createElement('span');
        badge.className = 'tb-snapshot-badge';
        badge.title = 'Snapshot enabled';
        badge.textContent = 'S';
        badge.setAttribute('aria-hidden', 'true');
        badge.setAttribute('data-snap-for', id);
        badge.style.userSelect = 'none';
        badge.style.position = 'absolute';
        badge.style.pointerEvents = 'none';
        badge.style.zIndex = 2;

        // basic position; will be adjusted by positionBadge()
        badge.style.right = '6px';
        badge.style.top = (el.offsetTop + 6) + 'px';

        parent.appendChild(badge);

        const positionBadge = () => {
          try {
            // compute offset relative to parent
            const parentRect = parent.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            // position at the element's top-right corner within parent
            const top = elRect.top - parentRect.top + 6;
            const right = Math.max(6, parentRect.right - elRect.right + 6);
            badge.style.top = `${top}px`;
            badge.style.right = `${right}px`;
          } catch (err) {
            // ignore positioning errors
          }
        };

        // initial position
        positionBadge();

        // Reposition on resize/scroll and when the element resizes
        const ro = (window.ResizeObserver) ? new ResizeObserver(positionBadge) : null;
        try { ro && ro.observe(el); } catch (e) {}
        window.addEventListener('resize', positionBadge, { passive: true });
        window.addEventListener('scroll', positionBadge, true);
      }
    } catch (e) {}

    function onFocus() {
      activeEl = el;
      state.lastEditedValue = el.value;
      state.lastEditedAt = Date.now();
      // when focusing, activeIndex remains the same; if null show metasnapshot
    }

    function onInput(e) {
      // Ignore synthetic input events dispatched by snapshot switching so
      // the "latest edit" (lastEditedValue/lastEditedAt) isn't overwritten.
      if (e && e.isSnapshot) return;
      state.lastEditedValue = el.value;
      state.lastEditedAt = Date.now();
    }

    function onBlur() {
      // keep activeEl reference only if it's the same element
      if (activeEl === el) activeEl = null;
    }

    el.addEventListener('focus', onFocus);
    el.addEventListener('input', onInput);
    el.addEventListener('blur', onBlur);
  }

  /**
   * Dispatch a synthetic input event on an element so listeners that react to
   * user input (e.g. views keeping overlays/validation in sync) will run.
   * Mark the event with `isSnapshot=true` so internal snapshot bookkeeping
   * (lastEditedValue) can ignore it.
   */
  function _dispatchInputEvent(el) {
    if (!el) return;
    try {
      const evt = new Event('input', { bubbles: true, cancelable: true });
      // mark synthetic event so real input tracking can ignore it
      try { evt.isSnapshot = true; } catch (e) {}
      el.dispatchEvent(evt);
    } catch (e) {
      try {
        const evt = document.createEvent('Event');
        evt.initEvent('input', true, true);
        try { evt.isSnapshot = true; } catch (err) {}
        el.dispatchEvent(evt);
      } catch (err) {
        // give up silently if dispatch fails
      }
    }
  }

  function findSnapshotStateForActive() {
    if (!activeEl) return null;
    return states.get(activeEl) || null;
  }

  function saveSnapshotForActive() {
    const st = findSnapshotStateForActive();
    if (!st) {
      showOverlay('No snapshotable textbox focused');
      return;
    }
    const text = activeEl.value;
    const now = Date.now();
    st.snapshots.push({ text, time: now });
    st.activeIndex = st.snapshots.length - 1;
    showOverlay('Snapshot saved', formatTime(now));
  }

  function deleteSnapshotForActive() {
    const st = findSnapshotStateForActive();
    if (!st || st.snapshots.length === 0) {
      showOverlay('No snapshots to delete');
      return;
    }
    // If activeIndex is null (metasnapshot), delete the last saved snapshot
    let idx = st.activeIndex;
    if (idx === null) idx = st.snapshots.length - 1;
    const removed = st.snapshots.splice(idx, 1)[0];
    // adjust activeIndex
    if (st.snapshots.length === 0) {
      st.activeIndex = null;
      // restore metasnapshot value
      if (activeEl) {
        activeEl.value = st.lastEditedValue;
        _dispatchInputEvent(activeEl);
      }
    } else {
      const newIndex = Math.min(idx, st.snapshots.length - 1);
      st.activeIndex = newIndex;
      const snap = st.snapshots[st.activeIndex];
      if (activeEl && snap) {
        activeEl.value = snap.text;
        _dispatchInputEvent(activeEl);
      }
    }
    showOverlay('Snapshot deleted', removed ? formatTime(removed.time) : '');
  }

  function exportSnapshotsForActive() {
    const st = findSnapshotStateForActive();
    if (!st) {
      showOverlay('No snapshotable textbox focused');
      return;
    }
    const payload = {
      id: st.id,
      exportedAt: new Date().toISOString(),
      snapshots: st.snapshots.map(s => ({ text: s.text, time: new Date(s.time).toISOString() })),
      meta: {
        lastEditedValue: st.lastEditedValue,
        lastEditedAt: new Date(st.lastEditedAt).toISOString()
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshots-${st.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showOverlay('Exported snapshots', `${st.snapshots.length} items`);
  }

  function switchSnapshotForActive(direction) {
    const st = findSnapshotStateForActive();
    if (!st) {
      showOverlay('No snapshotable textbox focused');
      return;
    }
    // direction: -1 for left, +1 for right
    // We treat metasnapshot as index === null, which logically sits at position st.snapshots.length
    const maxPos = st.snapshots.length; // metasnapshot position
    let pos;
    if (st.activeIndex === null) {
      pos = maxPos;
    } else {
      pos = st.activeIndex;
    }
    pos += direction;
    if (pos < 0) pos = 0;
    if (pos > maxPos) pos = maxPos;

    if (pos === maxPos) {
      // metasnapshot
      st.activeIndex = null;
      if (activeEl) {
        activeEl.value = st.lastEditedValue;
        _dispatchInputEvent(activeEl);
        showOverlay('Switched to latest edit', formatTime(st.lastEditedAt));
      }
    } else {
      st.activeIndex = pos;
      const snap = st.snapshots[pos];
      if (activeEl && snap) {
        activeEl.value = snap.text;
        _dispatchInputEvent(activeEl);
        showOverlay('Switched snapshot', formatTime(snap.time));
      }
    }
  }

  function globalKeyHandler(e) {
    // Only act on Alt (Option) based combos, prefer focused snapshotable element
    if (!e.altKey) return;
    // find focused element
    const el = document.activeElement;
    if (!el) return;
    if (!el.hasAttribute || !el.hasAttribute(badgeAttr)) return;
 
    // Use physical key codes (e.code) to avoid layout/language differences.
    const code = e.code;
 
    // Save: Alt + S (physical KeyS)
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey && code === 'KeyS') {
      e.preventDefault();
      activeEl = el;
      saveSnapshotForActive();
      return;
    }
 
    // Export: Shift + Alt + S (physical KeyS)
    if (e.shiftKey && code === 'KeyS') {
      e.preventDefault();
      activeEl = el;
      exportSnapshotsForActive();
      return;
    }
 
    // Delete: Alt + Backspace (physical Backspace)
    if (!e.shiftKey && code === 'Backspace') {
      e.preventDefault();
      activeEl = el;
      deleteSnapshotForActive();
      return;
    }
 
    // Left/Right navigation (physical Arrow keys)
    if (!e.shiftKey && (code === 'ArrowLeft' || code === 'ArrowRight')) {
      e.preventDefault();
      activeEl = el;
      const dir = code === 'ArrowLeft' ? -1 : 1;
      switchSnapshotForActive(dir);
      return;
    }
  }

  function scanAndInit() {
    const els = Array.from(document.querySelectorAll(`[${badgeAttr}]`));
    els.forEach(initElement);
  }

  function observeMutations() {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === badgeAttr) {
          if (m.target && m.target instanceof HTMLElement) initElement(m.target);
        }
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach(n => {
            if (n instanceof HTMLElement) {
              if (n.hasAttribute && n.hasAttribute(badgeAttr)) initElement(n);
              n.querySelectorAll && n.querySelectorAll(`[${badgeAttr}]`) && n.querySelectorAll(`[${badgeAttr}]`).forEach(initElement);
            }
          });
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [badgeAttr] });
  }

  function install() {
    scanAndInit();
    observeMutations();
    document.addEventListener('keydown', globalKeyHandler, true);
    // create overlay (hidden)
    ensureOverlay();
  }

  // auto-install on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }

  return {
    _states: states, // for debugging
    _getState(el) { return states.get(el); }
  };
})();

export default TbSnapshot;