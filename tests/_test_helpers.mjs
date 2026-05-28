// _test_helpers.mjs — Minimal DOM-mock for node-test-runner.
//
// We avoid pulling jsdom (Lesson #31 — defer premature deps; one widget today).
// Instead we mock just the DOM surface render.js touches:
//   - document.createElement(tagName) → {tagName, children, attributes, dataset, etc}
//   - element.appendChild(child) / .name / .value / .type / .checked / etc
//   - HTMLFormElement.elements.namedItem(name)
//
// This is enough to assert form-shape from the renderer's output.

function createElement(tagName) {
  const el = {
    tagName: tagName.toUpperCase(),
    children: [],
    childNodes: [],
    attributes: {},
    dataset: {},
    style: {},
    _listeners: {},
    textContent: '',
    className: '',
    htmlFor: undefined,
    type: undefined,
    name: undefined,
    id: undefined,
    value: '',
    checked: false,
    files: null,
    required: false,
    noValidate: false,
    accept: undefined,
    step: undefined,
    min: undefined,
    max: undefined,
  };

  el.appendChild = function (child) {
    el.children.push(child);
    el.childNodes.push(child);
    child._parent = el;
    return child;
  };

  el.querySelector = function (selector) {
    // very minimal: support 'tag' and '#id' and '.class' and 'tag[name="x"]'
    return findFirst(el, selector);
  };

  el.querySelectorAll = function (selector) {
    return findAll(el, selector);
  };

  el.addEventListener = function (name, handler) {
    if (!el._listeners[name]) el._listeners[name] = [];
    el._listeners[name].push(handler);
  };

  el.removeEventListener = function (name, handler) {
    if (!el._listeners[name]) return;
    el._listeners[name] = el._listeners[name].filter(h => h !== handler);
  };

  // For <form>, also expose .elements.namedItem
  if (el.tagName === 'FORM') {
    el.elements = {
      namedItem: function (name) {
        return findFirstByName(el, name);
      },
    };
  }

  return el;
}

function findFirst(root, selector) {
  const all = findAll(root, selector);
  return all[0] || null;
}

function findAll(root, selector) {
  const results = [];
  function walk(node) {
    if (!node) return;
    if (matches(node, selector)) results.push(node);
    for (const c of (node.children || [])) walk(c);
  }
  walk(root);
  return results;
}

function matches(node, selector) {
  if (!node || !node.tagName) return false;
  // ID selector
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  // Class selector
  if (selector.startsWith('.')) {
    return (node.className || '').split(/\s+/).includes(selector.slice(1));
  }
  // tag[name="x"] form
  const m = selector.match(/^(\w+)\[name="([^"]+)"\]$/);
  if (m) {
    return node.tagName === m[1].toUpperCase() && node.name === m[2];
  }
  // tag selector
  return node.tagName === selector.toUpperCase();
}

function findFirstByName(root, name) {
  function walk(node) {
    if (!node) return null;
    if (node.name === name && (node.tagName === 'INPUT' || node.tagName === 'SELECT' || node.tagName === 'TEXTAREA')) {
      return node;
    }
    for (const c of (node.children || [])) {
      const found = walk(c);
      if (found) return found;
    }
    return null;
  }
  return walk(root);
}

function installDomMock() {
  globalThis.document = {
    createElement,
  };
  return { createElement };
}

function uninstallDomMock() {
  delete globalThis.document;
}

export { createElement, installDomMock, uninstallDomMock, findFirstByName };
