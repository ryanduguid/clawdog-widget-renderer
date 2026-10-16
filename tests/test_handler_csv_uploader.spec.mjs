import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleSubmit, POST_MESSAGE_TYPE } from '../widgets/gl-detail-csv-uploader/handler.js';

const manifest = { name: 'gl-detail-csv-uploader', calc_api_url: 'https://calculator.invalid/submit' };

function fixture(t, referrer = 'https://host.example/embed') {
  const sent = [];
  for (const [name, value] of Object.entries({
    window: { parent: { postMessage: (...args) => sent.push(args) } },
    document: { referrer },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    t.after(() => previous
      ? Object.defineProperty(globalThis, name, previous)
      : Reflect.deleteProperty(globalThis, name));
  }
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true, status: 201, text: async () => '{"value":"synthetic"}',
  }));
  return sent;
}

test('successful JSON response retains the envelope and exact HTTPS origin', async t => {
  const sent = fixture(t, 'https://HOST.example:443/embed?origin=https://other.invalid');
  const result = await handleSubmit({}, manifest);
  assert.deepEqual(result, { ok: true, status: 201, body: { value: 'synthetic' } });
  assert.deepEqual(sent, [[{ type: POST_MESSAGE_TYPE, widget: manifest.name, result }, 'https://host.example']]);
});

test('HTTP error text retains its representation and non-default HTTP port', async t => {
  const sent = fixture(t, 'http://host.example:8123/embed');
  const body = '<script>synthetic</script>\ninvalid input';
  fetch.mock.mockImplementation(async () => ({ ok: false, status: 422, text: async () => body }));
  const result = await handleSubmit({}, manifest);
  assert.deepEqual(result, { ok: false, status: 422, body });
  assert.deepEqual(sent, [[{ type: POST_MESSAGE_TYPE, widget: manifest.name, result }, 'http://host.example:8123']]);
});

test('rejected fetch sends the existing error shape to the captured origin', async t => {
  const sent = fixture(t);
  fetch.mock.mockImplementation(async () => { throw new Error('synthetic network error'); });
  const result = await handleSubmit({}, manifest);
  assert.deepEqual(result, { ok: false, error: 'synthetic network error' });
  assert.deepEqual(sent, [[{ type: POST_MESSAGE_TYPE, widget: manifest.name, result }, 'https://host.example']]);
});

for (const referrer of ['', 'null', '/relative', 'invalid', 'data:text/plain,origin',
  'file:///example', 'about:blank', 'blob:https://host.example/id', 'javascript:alert(1)']) {
  test(`unusable referrer ${JSON.stringify(referrer)} omits notification`, async t => {
    const sent = fixture(t, referrer);
    const result = await handleSubmit({}, { ...manifest, parentOrigin: 'https://injected.invalid' });
    assert.equal(result.ok, true);
    assert.deepEqual(sent, []);
  });
}

test('missing referrer also omits error notifications', async t => {
  const sent = fixture(t, '');
  fetch.mock.mockImplementation(async () => { throw new Error('synthetic network error'); });
  assert.deepEqual(await handleSubmit({}, manifest), { ok: false, error: 'synthetic network error' });
  assert.deepEqual(sent, []);
});

test('standalone submission returns its result without notifying itself', async t => {
  const sent = fixture(t);
  window.parent = window;
  assert.equal((await handleSubmit({}, manifest)).ok, true);
  assert.deepEqual(sent, []);
});

test('unavailable document referrer does not prevent submission', async t => {
  const sent = fixture(t);
  Object.defineProperty(document, 'referrer', { get() { throw new Error('unavailable'); } });
  assert.equal((await handleSubmit({}, manifest)).ok, true);
  assert.deepEqual(sent, []);
});

test('recipient is captured before the asynchronous request', async t => {
  const sent = fixture(t);
  fetch.mock.mockImplementation(async () => {
    document.referrer = 'https://later.invalid/embed';
    await Promise.resolve();
    return { ok: true, status: 200, text: async () => 'synthetic text' };
  });
  await handleSubmit({}, manifest);
  assert.equal(sent[0][1], 'https://host.example');
});

test('notification exceptions preserve the submission result', async t => {
  fixture(t);
  window.parent.postMessage = () => { throw new Error('notification unavailable'); };
  assert.deepEqual(await handleSubmit({}, manifest), { ok: true, status: 201, body: { value: 'synthetic' } });
});

test('multipart fields, file and boolean encoding retain their mapping', async t => {
  fixture(t);
  const file = new File(['synthetic CSV\n'], 'synthetic.csv', { type: 'text/csv' });
  for (const dryRun of [true, false]) {
    await handleSubmit({ entityId: 'synthetic-entity', periodUri: 'synthetic-period', glDetailCsv: file, dryRun }, manifest);
    const [url, options] = fetch.mock.calls.at(-1).arguments;
    assert.equal(url, manifest.calc_api_url);
    assert.equal(options.method, 'POST');
    assert.deepEqual([...options.body.keys()], ['entity_id', 'period_uri', 'gl_detail_csv', 'dry_run']);
    assert.equal(options.body.get('entity_id'), 'synthetic-entity');
    assert.equal(options.body.get('period_uri'), 'synthetic-period');
    assert.equal(options.body.get('gl_detail_csv'), file);
    assert.equal(options.body.get('dry_run'), String(dryRun));
  }
});

test('missing API URL keeps the manifest guard and does not fetch', async t => {
  const sent = fixture(t);
  assert.deepEqual(await handleSubmit({}, {}), { ok: false, error: 'widget.json missing calc_api_url' });
  assert.equal(fetch.mock.calls.length, 0);
  assert.deepEqual(sent, []);
});
