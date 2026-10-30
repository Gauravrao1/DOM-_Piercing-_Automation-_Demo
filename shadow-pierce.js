// Q3 - DOM automation strategy that survives CLOSED roots and per-reload obfuscated class names.
//
// This is intentionally separate from accessibility-tree automation. It inspects the DOM and
// must not be used when the task requires AX/UIA/NSAccessibility/AT-SPI evidence only.
//
// IDEA
//  1. Closed roots cannot be reached via element.shadowRoot. So BEFORE any app script runs (page.addInitScript),
//     wrap Element.prototype.attachShadow and keep every created root (open OR closed) in a WeakMap<host, root>.
//  2. Traverse the composed tree recursively using that WeakMap. Never use class names (they regenerate on reload).
//  3. Identify the target by stable DOM semantics: element tag + data-qa-* attribute.
//  4. Return a live element handle so the test can dispatch real events (or compute its bounding box for mouse input).

// ---- Injected before app scripts ----
const INIT_SCRIPT = `
(() => {
  const roots = new WeakMap();
  window.__closedRoots = roots;                       // exposed to the page-under-test fixture only for the demo
  const orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const root = orig.call(this, init);
    roots.set(this, root);                            // capture open AND closed roots
    return root;
  };
  // Depth-first search through every shadow boundary. Pure semantics - no class, no id, no absolute XPath.
  window.__piercer = {
    find(predicate, start = document) {
      const stack = [start];
      while (stack.length) {
        const node = stack.pop();
        const kids = node.children ? Array.from(node.children) : [];
        for (const el of kids) {
          if (predicate(el)) return el;
          stack.push(el);
          const sr = roots.get(el) || el.shadowRoot;  // closed (captured) first, then open
          if (sr) stack.push(sr);
        }
        if (node.nodeType === 11 /* ShadowRoot */) for (const el of Array.from(node.children)) { if (predicate(el)) return el; stack.push(el); const sr = roots.get(el) || el.shadowRoot; if (sr) stack.push(sr); }
      }
      return null;
    },
    findAll(predicate, start = document, out = []) {
      const walk = (node) => {
        for (const el of Array.from(node.children || [])) {
          if (predicate(el)) out.push(el);
          const sr = roots.get(el) || el.shadowRoot;
          if (sr) walk(sr);
          walk(el);
        }
      };
      walk(start); return out;
    },
  };
})();
`;

// Convenience: locate the "Authorize Ledger Funds" button purely by semantics.
const FIND_TARGET = `
(() => window.__piercer.find((el) =>
    el.tagName === 'BUTTON' &&
    el.getAttribute('data-qa-state') === 'unlocked-token'))()
`;

module.exports = { INIT_SCRIPT, FIND_TARGET };
