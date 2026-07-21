// Tests for the README chart generator: it must produce valid Mermaid even
// when all data is zero (degenerate axis), and reflect real values otherwise.
// Run: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Normalize CRLF -> LF so assertions are line-ending agnostic (Windows checkouts).
const readme = readFileSync(join(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n');

test('README contains the chart markers and a mermaid block', () => {
  assert.match(readme, /<!-- CHART:BEGIN -->/);
  assert.match(readme, /<!-- CHART:END -->/);
  assert.match(readme, /```mermaid\n\s*xychart-beta/);
});

test('README chart y-axis is a valid non-degenerate range', () => {
  const m = readme.match(/y-axis\s+"[^"]*"\s+(-?\d+)\s+-->\s+(-?\d+)/);
  assert.ok(m, 'y-axis range not found in chart');
  const [, lo, hi] = m.map(Number);
  assert.ok(hi > lo, `y-axis must be non-degenerate, got ${lo} --> ${hi}`);
});

test('README chart has two data-series lines and an x-axis', () => {
  assert.match(readme, /x-axis \[/);
  const lines = readme.match(/^\s*line \[/gm) ?? [];
  assert.equal(lines.length, 2, 'expected exactly two series (FII, DII)');
});
