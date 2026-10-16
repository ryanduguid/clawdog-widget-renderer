// render.js — JSON Schema → HTML form renderer (vanilla JS, no framework)
//
// Public surface:
//   renderFormFromSchema(schema, container) → {form, getValues, setValues}
//     - schema:    parsed JSON Schema object describing the input shape
//     - container: HTMLElement to mount the form into (typically a <div>)
//     - returns:   {form: HTMLFormElement, getValues: () => object, setValues: (v) => void}
//
// Supported schema constructs (Lesson #31 — what we need for the first widget,
// not a general-purpose JSON-Schema renderer; expand opportunistically as widgets demand):
//   - type: "object" with properties: {...}
//   - field types: string, number, boolean
//   - string formats: "date" → <input type="date">
//   - string with `contentMediaType: "text/csv"` → <input type="file" accept=".csv,text/csv">
//   - enum lists → <select>
//   - required: [...]
//   - title (per-field) → <label>
//   - description (per-field) → small help text
//
// Lessons honoured:
//   #31 — minimal renderer that supports today's one widget; no premature generality.
//   #36 — the renderer is the bridge layer; it knows nothing about FBT or GL Detail
//         specifics. Widget-specific logic lives in handler.js.

const FIELD_TYPE_BY_FORMAT = {
  date: 'date',
  email: 'email',
  uri: 'url',
};

let fieldSequence = 0;

function inputElementForProperty(prop) {
  let input;

  if (prop.enum && Array.isArray(prop.enum)) {
    input = document.createElement('select');
    for (const v of prop.enum) {
      const opt = document.createElement('option');
      opt.value = String(v);
      opt.textContent = String(v);
      input.appendChild(opt);
    }
  } else if (
    prop.type === 'string'
    && prop.contentMediaType
    && prop.contentMediaType.startsWith('text/csv')
  ) {
    input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
  } else if (prop.type === 'string' && prop.format && FIELD_TYPE_BY_FORMAT[prop.format]) {
    input = document.createElement('input');
    input.type = FIELD_TYPE_BY_FORMAT[prop.format];
  } else if (prop.type === 'number' || prop.type === 'integer') {
    input = document.createElement('input');
    input.type = 'number';
    input.step = prop.type === 'integer' ? '1' : 'any';
    if (typeof prop.minimum === 'number') input.min = String(prop.minimum);
    if (typeof prop.maximum === 'number') input.max = String(prop.maximum);
  } else if (prop.type === 'boolean') {
    input = document.createElement('input');
    input.type = 'checkbox';
  } else {
    // default: text input
    input = document.createElement('input');
    input.type = 'text';
  }

  return input;
}

function fieldElementForProperty(name, prop, required) {
  const wrapper = document.createElement('div');
  wrapper.className = 'cw-field';
  wrapper.dataset.name = name;

  const label = document.createElement('label');
  label.textContent = prop.title || name;
  if (required) {
    const star = document.createElement('span');
    star.className = 'cw-required';
    star.textContent = ' *';
    label.appendChild(star);
  }
  wrapper.appendChild(label);

  const input = inputElementForProperty(prop);
  input.id = `cw-field-${++fieldSequence}`;
  label.htmlFor = input.id;
  input.name = name;
  if (required && prop.type !== 'boolean') input.required = true;

  wrapper.appendChild(input);

  if (prop.description) {
    const help = document.createElement('small');
    help.className = 'cw-help';
    help.textContent = prop.description;
    wrapper.appendChild(help);
  }

  return wrapper;
}

function renderFormFromSchema(schema, container) {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    throw new Error('renderFormFromSchema: expected JSON Schema with type:"object" and properties');
  }

  const requiredSet = new Set(Array.isArray(schema.required) ? schema.required : []);

  const form = document.createElement('form');
  const append = form.appendChild.bind(form);
  const controls = new Map();
  form.className = 'cw-form';
  form.noValidate = false;

  if (schema.title) {
    const heading = document.createElement('h2');
    heading.className = 'cw-form-title';
    heading.textContent = schema.title;
    append(heading);
  }
  if (schema.description) {
    const desc = document.createElement('p');
    desc.className = 'cw-form-description';
    desc.textContent = schema.description;
    append(desc);
  }

  for (const [name, prop] of Object.entries(schema.properties)) {
    const field = fieldElementForProperty(name, prop, requiredSet.has(name));
    controls.set(name, field.querySelector('input') || field.querySelector('select'));
    append(field);
  }

  const submitWrap = document.createElement('div');
  submitWrap.className = 'cw-submit';
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit';
  submitWrap.appendChild(submitBtn);
  append(submitWrap);

  if (container) container.appendChild(form);

  function getValues() {
    const entries = [];
    for (const [name, prop] of Object.entries(schema.properties)) {
      const el = controls.get(name);
      if (!el) continue;
      let value;
      if (el.type === 'checkbox') {
        value = el.checked;
      } else if (prop.type === 'boolean') {
        value = el.value === 'true';
      } else if (el.type === 'file') {
        value = el.files && el.files.length ? el.files[0] : null;
      } else if (prop.type === 'number' || prop.type === 'integer') {
        value = el.value === '' ? null : Number(el.value);
      } else {
        value = el.value;
      }
      entries.push([name, value]);
    }
    return Object.fromEntries(entries);
  }

  function setValues(values) {
    if (!values || typeof values !== 'object') return;
    for (const [name, v] of Object.entries(values)) {
      const el = controls.get(name);
      if (!el) continue;
      if (el.type === 'checkbox') {
        el.checked = Boolean(v);
      } else if (el.type === 'file') {
        // can't programmatically set file inputs; skip
      } else if (v == null) {
        el.value = '';
      } else {
        el.value = String(v);
      }
    }
  }

  return { form, getValues, setValues };
}

// Export for both browser <script type="module"> and node test runner
export { renderFormFromSchema, fieldElementForProperty };
