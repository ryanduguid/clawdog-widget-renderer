// test_render_csv_uploader.spec.mjs — The GL Detail CSV uploader specifically
// renders all required fields per its schema.
//
// Lessons honoured:
//   #38 — schema file on disk is the authoritative source; load it from disk, not paraphrase

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { installDomMock } from './_test_helpers.mjs';

// Install DOM mock BEFORE importing render.js. Do NOT uninstall — node:test
// runs tests asynchronously after module load.
installDomMock();
const { renderFormFromSchema } = await import('../src/render.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '../src/widgets/gl-detail-csv-uploader/schema.json');
const manifestPath = path.resolve(here, '../src/widgets/gl-detail-csv-uploader/widget.json');

const schemaText = await readFile(schemaPath, 'utf8');
const schema = JSON.parse(schemaText);
const manifestText = await readFile(manifestPath, 'utf8');
const manifest = JSON.parse(manifestText);

test('GL Detail schema declares all four expected properties', () => {
  assert.equal(schema.type, 'object');
  const keys = Object.keys(schema.properties);
  assert.deepEqual(
    keys.sort(),
    ['dryRun', 'entityId', 'glDetailCsv', 'periodUri'].sort()
  );
});

test('GL Detail schema marks the three load-bearing fields as required', () => {
  assert.deepEqual(
    schema.required.sort(),
    ['entityId', 'glDetailCsv', 'periodUri'].sort()
  );
});

test('renderFormFromSchema(GL-Detail schema) produces a form with all four fields', () => {
  const { form } = renderFormFromSchema(schema, null);
  const fields = form.children.filter(c => c.className === 'cw-field');
  const names = fields.map(f => f.dataset.name).sort();
  assert.deepEqual(names, ['dryRun', 'entityId', 'glDetailCsv', 'periodUri'].sort());
});

test('GL Detail glDetailCsv field renders as file input with CSV accept', () => {
  const { form } = renderFormFromSchema(schema, null);
  const field = form.children.find(c => c.dataset && c.dataset.name === 'glDetailCsv');
  const input = field.children.find(c => c.tagName === 'INPUT');
  assert.equal(input.type, 'file');
  assert.equal(input.accept, '.csv,text/csv');
  assert.equal(input.required, true);
});

test('GL Detail periodUri field renders as select with the six FY URN options', () => {
  const { form } = renderFormFromSchema(schema, null);
  const field = form.children.find(c => c.dataset && c.dataset.name === 'periodUri');
  const select = field.children.find(c => c.tagName === 'SELECT');
  assert.ok(select, 'expected <select> for periodUri');
  assert.equal(select.children.length, 6);
  const values = select.children.map(o => o.value);
  assert.ok(values.includes('urn:sbrm:period:au:fy2026'));
  assert.ok(values.includes('urn:sbrm:period:uk:fy2026'));
});

test('GL Detail dryRun field renders as checkbox and is NOT required', () => {
  const { form } = renderFormFromSchema(schema, null);
  const field = form.children.find(c => c.dataset && c.dataset.name === 'dryRun');
  const input = field.children.find(c => c.tagName === 'INPUT');
  assert.equal(input.type, 'checkbox');
  assert.equal(input.required, false);
});

test('widget.json carries name + version + schema_ref + calc_api_url', () => {
  assert.equal(manifest.name, 'gl-detail-csv-uploader');
  assert.ok(/^\d+\.\d+\.\d+$/.test(manifest.version), 'semver-shaped version');
  assert.equal(manifest.schema_ref, './schema.json');
  assert.ok(manifest.calc_api_url, 'calc_api_url present');
  assert.equal(manifest.license, 'Apache-2.0');
});

