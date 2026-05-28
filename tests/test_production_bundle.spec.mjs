// test_production_bundle.spec.mjs — SR #12 (Production Resolver Shape Assertions)
// sibling at the JS / widget-deployment layer.
//
// Asserts that the live deployed widget URL serves the expected files with the
// expected content shape. Lesson #40 honour: hermetic green without production-
// bundle green is pre-broken.
//
// This test fires against the *deployed* URL, not against local files. It is
// CI-only by default (the OPT_IN env var). For PR 1 it asserts that:
//   - /clawdog-widget-renderer/                                         → 200, contains <h1>
//   - /clawdog-widget-renderer/widgets/gl-detail-csv-uploader/         → 200, contains <form-mount>
//   - /clawdog-widget-renderer/widgets/gl-detail-csv-uploader/widget.json → 200, valid JSON
//   - /clawdog-widget-renderer/widgets/gl-detail-csv-uploader/schema.json → 200, valid JSON
//
// Tri-state per SR #8:
//   - 🟢 GREEN: all checks pass
//   - 🔴 LOGIC DRIFT: one or more deployed files diverge from spec
//   - 🟡 INFRA BROKEN: HTTPS fetch fails, DNS unresolvable, timeout — HALT.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.WIDGET_RENDERER_BASE_URL
  || 'https://www.lodgeit.org/clawdog-widget-renderer';

const SHOULD_RUN = process.env.RUN_PRODUCTION_BUNDLE_TEST === '1';

if (!SHOULD_RUN) {
  test('production-bundle tests SKIPPED (set RUN_PRODUCTION_BUNDLE_TEST=1)', { skip: true }, () => {});
} else {
  test('GET / returns 200 with <h1>', async () => {
    const resp = await fetch(`${BASE_URL}/`);
    assert.equal(resp.status, 200, `expected 200 at ${BASE_URL}/`);
    const text = await resp.text();
    assert.match(text, /<h1[^>]*>/, 'expected <h1> in index');
  });

  test('GET /widgets/gl-detail-csv-uploader/ returns 200 with form mount', async () => {
    const url = `${BASE_URL}/widgets/gl-detail-csv-uploader/`;
    const resp = await fetch(url);
    assert.equal(resp.status, 200, `expected 200 at ${url}`);
    const text = await resp.text();
    assert.match(text, /id="cw-widget-mount"/, 'expected #cw-widget-mount in widget index');
  });

  test('GET .../widget.json returns 200 + valid manifest', async () => {
    const url = `${BASE_URL}/widgets/gl-detail-csv-uploader/widget.json`;
    const resp = await fetch(url);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.name, 'gl-detail-csv-uploader');
    assert.ok(body.version, 'version present');
    assert.equal(body.license, 'Apache-2.0');
  });

  test('GET .../schema.json returns 200 + valid JSON Schema', async () => {
    const url = `${BASE_URL}/widgets/gl-detail-csv-uploader/schema.json`;
    const resp = await fetch(url);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.type, 'object');
    assert.ok(body.properties, 'properties present');
    assert.ok(body.required, 'required present');
  });
}
