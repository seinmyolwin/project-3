import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return 'FILE_NOT_FOUND';
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

const releaseDir = path.resolve(process.cwd(), 'release');
const exePath = path.join(releaseDir, 'KaraokePS5CommerceHub.exe');
const nodeBinPath = path.join(releaseDir, 'bin', 'node.exe');
const wasmPath = path.join(releaseDir, 'dist', 'sql-wasm.wasm');
const wasmBinPath = path.join(releaseDir, 'bin', 'sql-wasm.wasm');

console.log('================================================================');
console.log('PHASE 23.3A — RELEASE ARTIFACT SHA-256 HASHES');
console.log('================================================================');
console.log('KaraokePS5CommerceHub.exe:', hashFile(exePath));
console.log('bin/node.exe:', hashFile(nodeBinPath));
console.log('dist/sql-wasm.wasm:', hashFile(wasmPath));
console.log('bin/sql-wasm.wasm:', hashFile(wasmBinPath));
console.log('================================================================');
