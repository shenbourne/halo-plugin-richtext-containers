// Reveal 5.2.1 does not dispose its private scroll-prevention interval.
// Patch only the pinned upstream source while building; no global timer hooks.
export function patchRevealLifecycle(source: string): string {
  const replacements = [
    ['const Reveal = {};', 'const Reveal = {};\n\tlet rcScrollPreventionTimer;'],
    ['function setupScrollPrevention() {', 'function setupScrollPrevention() {'],
    ['setInterval( () => {', 'rcScrollPreventionTimer = setInterval( () => {'],
    ['function destroy() {', 'function destroy() {\n\t\tclearInterval( rcScrollPreventionTimer );\n\t\trcScrollPreventionTimer = undefined;'],
  ];
  if (!source.includes("export const VERSION = '5.2.1'")) throw new Error('Review the Reveal lifecycle patch for this version');
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error(`Reveal lifecycle patch anchor changed: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}
