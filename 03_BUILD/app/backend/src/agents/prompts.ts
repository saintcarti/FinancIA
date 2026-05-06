import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resuelve a backend/prompts/<file>.md (ubicación estándar tras refactor de deploy).
// También cubre rutas legacy y dist/.
function loadPrompt(name: string): string {
  const candidates = [
    path.resolve(__dirname, '../../prompts', `${name}.md`),         // dev (tsx) → src/agents → backend/prompts
    path.resolve(__dirname, '../../../prompts', `${name}.md`),      // build (tsc) → dist/agents → backend/prompts
    path.resolve(process.cwd(), 'prompts', `${name}.md`),           // cwd = backend
    path.resolve(process.cwd(), '03_BUILD/app/backend/prompts', `${name}.md`), // cwd = repo root (Railway)
    path.resolve(__dirname, '../../../../prompts', `${name}.md`),   // legacy: 03_BUILD/prompts
    path.resolve(process.cwd(), '../../prompts', `${name}.md`)      // legacy
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      return raw.replace(/^---[\s\S]*?---\n/, '').trim();
    }
  }
  throw new Error(`prompt not found: ${name}`);
}

const cache = new Map<string, string>();
export function prompt(name: 'system_qa' | 'system_video_script' | 'system_classifier'): string {
  if (!cache.has(name)) cache.set(name, loadPrompt(name));
  return cache.get(name)!;
}
