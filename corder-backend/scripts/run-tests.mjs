#!/usr/bin/env node
/**
 * Backend Unit Test Runner (Node 20 built-in `node:test`)
 * Compiles TypeScript sources + tests to `./dist-test` via `tsconfig.test.json`
 * and executes all discovered `*.spec.js` and `*.test.js` files.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distTestDir = join(rootDir, 'dist-test');
const tscBin = join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');

rmSync(distTestDir, { recursive: true, force: true });

const compileResult = spawnSync(
  process.execPath,
  [tscBin, '-p', join(rootDir, 'tsconfig.test.json')],
  { cwd: rootDir, stdio: 'inherit' },
);

if (compileResult.status !== 0) {
  process.exit(compileResult.status ?? 1);
}

function collectTestFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(fullPath, acc);
    } else if (entry.isFile() && /\.(spec|test)\.js$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

const filters = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
let testFiles = collectTestFiles(distTestDir).sort();

if (filters.length > 0) {
  testFiles = testFiles.filter((file) =>
    filters.some((f) => file.toLowerCase().includes(f.toLowerCase())),
  );
}

if (testFiles.length === 0) {
  console.log('No test files matched in dist-test.');
  process.exit(0);
}

const testResult = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'test' },
});

process.exit(testResult.status ?? 1);
