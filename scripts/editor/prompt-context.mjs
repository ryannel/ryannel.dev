/**
 * Claude Code `UserPromptSubmit` hook (see .claude/settings.json).
 *
 * The in-browser editor records where the cursor is in .astro/editor-context.json.
 * This prints that as a short note on every prompt, so "expand this paragraph"
 * means the paragraph the cursor is actually in. Prints nothing when the
 * editor has not been used recently, and never fails the prompt.
 */
import { readFileSync, statSync } from 'node:fs';

const FILE = '.astro/editor-context.json';
const FRESH_MS = 30 * 60 * 1000;

try {
  if (Date.now() - statSync(FILE).mtimeMs > FRESH_MS) process.exit(0);
  const ctx = JSON.parse(readFileSync(FILE, 'utf8'));
  const lines = [`Editor context: the note ${ctx.file} is open in the browser editor.`];
  if (ctx.block) {
    lines.push(`Cursor is in the block starting at line ${ctx.block.line}: “${ctx.block.text}”`);
  }
  if (ctx.section) {
    lines.push(
      `That block is the heading of the section “${ctx.section.title}”, lines ${ctx.section.from}–${ctx.section.to}; “this section” means those lines.`,
    );
  }
  if (ctx.selection) lines.push(`Selected text: “${ctx.selection}”`);
  lines.push('"This" or "here" in the prompt refers to that block unless it says otherwise.');
  // The `{/* … */}` comments in the note: things left for Claude to pick up.
  if (ctx.notes?.length) {
    lines.push('Notes left in the file for you:');
    for (const note of ctx.notes) lines.push(`  line ${note.line}: “${note.text}”`);
  }
  console.log(lines.join('\n'));
} catch {
  // No context file, or unreadable: say nothing.
}
