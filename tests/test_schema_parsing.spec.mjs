// test_schema_parsing.spec.mjs — Given a JSON Schema, the renderer produces the
// expected form-field topology.
//
// Lessons honoured:
//   #41 — every code-shape claim in this test maps to a render.js predicate that
//         exists in source as of mc05-2026-05-28; do not paraphrase the renderer.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installDomMock } from './_test_helpers.mjs';

// Install DOM mock BEFORE importing render.js (which uses document.createElement
// at call time, not import time). Do NOT uninstall — node:test executes tests
// asynchronously after the module loads, so any synchronous uninstall here would
// remove the mock before tests fire.
installDomMock();
const { renderFormFromSchema } = await import('../render.js');

test('renderFormFromSchema rejects non-object schemas', () => {
  assert.throws(
    () => renderFormFromSchema({ type: 'string' }, null),
    /expected JSON Schema with type:"object"/
  );
  assert.throws(
    () => renderFormFromSchema(null, null),
    /expected JSON Schema with type:"object"/
  );
});

test('renderFormFromSchema produces a <form> element with title + description', () => {
  const schema = {
    type: 'object',
    title: 'Test Form',
    description: 'A test',
    properties: { name: { type: 'string', title: 'Name' } },
  };
  const { form } = renderFormFromSchema(schema, null);
  assert.equal(form.tagName, 'FORM');

  const heading = form.children.find(c => c.tagName === 'H2');
  assert.ok(heading, 'expected <h2> form-title');
  assert.equal(heading.textContent, 'Test Form');

  const desc = form.children.find(c => c.tagName === 'P');
  assert.ok(desc, 'expected <p> form-description');
  assert.equal(desc.textContent, 'A test');
});

test('renderFormFromSchema renders one field per property', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      age: { type: 'integer', title: 'Age' },
      active: { type: 'boolean', title: 'Active' },
    },
  };
  const { form } = renderFormFromSchema(schema, null);
  const fields = form.children.filter(c => c.className === 'cw-field');
  assert.equal(fields.length, 3);
  assert.deepEqual(fields.map(f => f.dataset.name), ['name', 'age', 'active']);
});

test('renderFormFromSchema marks required fields with required + asterisk', () => {
  const schema = {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', title: 'Name' },
      nickname: { type: 'string', title: 'Nickname' },
    },
  };
  const { form } = renderFormFromSchema(schema, null);
  const nameField = form.children.find(c => c.dataset && c.dataset.name === 'name');
  const input = nameField.children.find(c => c.tagName === 'INPUT');
  assert.equal(input.required, true);

  const label = nameField.children.find(c => c.tagName === 'LABEL');
  const star = label.children.find(c => c.tagName === 'SPAN' && c.className === 'cw-required');
  assert.ok(star, 'expected required asterisk span');
});

test('renderFormFromSchema maps string format=date → input type=date', () => {
  const schema = {
    type: 'object',
    properties: { dob: { type: 'string', format: 'date', title: 'DOB' } },
  };
  const { form } = renderFormFromSchema(schema, null);
  const field = form.children.find(c => c.dataset && c.dataset.name === 'dob');
  const input = field.children.find(c => c.tagName === 'INPUT');
  assert.equal(input.type, 'date');
});

test('renderFormFromSchema maps contentMediaType=text/csv → input type=file', () => {
  const schema = {
    type: 'object',
    properties: {
      csv: { type: 'string', contentMediaType: 'text/csv', title: 'CSV' },
    },
  };
  const { form } = renderFormFromSchema(schema, null);
  const field = form.children.find(c => c.dataset && c.dataset.name === 'csv');
  const input = field.children.find(c => c.tagName === 'INPUT');
  assert.equal(input.type, 'file');
  assert.equal(input.accept, '.csv,text/csv');
});

test('renderFormFromSchema maps enum → <select> with options', () => {
  const schema = {
    type: 'object',
    properties: {
      choice: { type: 'string', enum: ['a', 'b', 'c'], title: 'Choice' },
    },
  };
  const { form } = renderFormFromSchema(schema, null);
  const field = form.children.find(c => c.dataset && c.dataset.name === 'choice');
  const select = field.children.find(c => c.tagName === 'SELECT');
  assert.ok(select, 'expected <select>');
  assert.equal(select.children.length, 3);
  assert.deepEqual(select.children.map(o => o.value), ['a', 'b', 'c']);
});

test('renderFormFromSchema maps boolean → checkbox', () => {
  const schema = {
    type: 'object',
    properties: { agreed: { type: 'boolean', title: 'Agreed' } },
  };
  const { form } = renderFormFromSchema(schema, null);
  const field = form.children.find(c => c.dataset && c.dataset.name === 'agreed');
  const input = field.children.find(c => c.tagName === 'INPUT');
  assert.equal(input.type, 'checkbox');
});

test('number fields allow decimals and integer fields retain whole-number steps', () => {
  const schema = {
    type: 'object',
    properties: { amount: { type: 'number' }, count: { type: 'integer' } },
  };
  const { form, setValues, getValues } = renderFormFromSchema(schema, null);
  assert.equal(form.elements.namedItem('amount').step, 'any');
  assert.equal(form.elements.namedItem('count').step, '1');
  setValues({ amount: 10.25, count: 2 });
  assert.deepEqual(getValues(), { amount: 10.25, count: 2 });
});

test('a required boolean can be false', () => {
  const schema = {
    type: 'object',
    required: ['active'],
    properties: { active: { type: 'boolean' } },
  };
  const { form, setValues, getValues } = renderFormFromSchema(schema, null);
  setValues({ active: false });
  assert.notEqual(form.elements.namedItem('active').required, true);
  assert.deepEqual(getValues(), { active: false });
});

test('boolean enum values remain booleans', () => {
  const schema = {
    type: 'object',
    properties: { active: { type: 'boolean', enum: [true, false] } },
  };
  const { setValues, getValues } = renderFormFromSchema(schema, null);
  for (const active of [false, true]) {
    setValues({ active });
    assert.deepEqual(getValues(), { active });
  }
});

test('renderFormFromSchema adds a submit button', () => {
  const schema = { type: 'object', properties: { x: { type: 'string' } } };
  const { form } = renderFormFromSchema(schema, null);
  const submitWrap = form.children.find(c => c.className === 'cw-submit');
  assert.ok(submitWrap, 'expected submit wrapper');
  const button = submitWrap.children.find(c => c.tagName === 'BUTTON');
  assert.ok(button, 'expected submit button');
  assert.equal(button.type, 'submit');
});

test('getValues + setValues round-trips object data', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      age: { type: 'integer', title: 'Age' },
      active: { type: 'boolean', title: 'Active' },
    },
  };
  const { setValues, getValues } = renderFormFromSchema(schema, null);
  setValues({ name: 'Bluey', age: 7, active: true });
  const out = getValues();
  assert.equal(out.name, 'Bluey');
  assert.equal(out.age, 7);
  assert.equal(out.active, true);
});

