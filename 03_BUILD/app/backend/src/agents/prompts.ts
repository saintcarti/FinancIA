import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resuelve a 03_BUILD/prompts/<file>.md
function loadPrompt(name: string): string {
  const candidates = [
    path.resolve(__dirname, '../../../../prompts', `${name}.md`),
    path.resolve(__dirname, '../../prompts', `${name}.md`),
    path.resolve(process.cwd(), 'prompts', `${name}.md`),
    path.resolve(process.cwd(), '../../prompts', `${name}.md`)
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
