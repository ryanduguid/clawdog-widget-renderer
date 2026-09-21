import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('npm package includes the renderer and GL Detail widget assets', () => {
  const output = execSync('npm pack --dry-run --json --ignore-scripts', {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    encoding: 'utf8',
  });
  const [pkg] = JSON.parse(output);
  const files = new Set(pkg.files.map(file => file.path));
  const requiredFiles = [
    '.nojekyll',
    'index.html',
    'render.js',
    'widgets/gl-detail-csv-uploader/index.html',
    'widgets/gl-detail-csv-uploader/handler.js',
    'widgets/gl-detail-csv-uploader/schema.json',
    'widgets/gl-detail-csv-uploader/widget.json',
    'README.md',
    'LICENSE',
    'package.json',
  ];
  assert.deepEqual(
    requiredFiles.filter(file => !files.has(file)),
    [],
    'required files are missing from the npm package',
  );
});
