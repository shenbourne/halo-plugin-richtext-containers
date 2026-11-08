import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { patchRevealLifecycle } from '../tooling/reveal-lifecycle';
const require = createRequire(import.meta.url);
describe('pinned Reveal lifecycle patch', () => {
  it('owns the upstream scroll timer and clears it before the early destroy return', () => {
    const source = readFileSync(require.resolve('reveal.js/js/reveal.js'), 'utf8');
    const patched = patchRevealLifecycle(source);
    expect(patched).toContain('let rcScrollPreventionTimer;');
    expect(patched).toContain('rcScrollPreventionTimer = setInterval(');
    expect(patched.indexOf('clearInterval( rcScrollPreventionTimer )')).toBeLessThan(patched.indexOf('if( ready === false ) return;'));
    expect(patched.match(/clearInterval\( rcScrollPreventionTimer \)/g)).toHaveLength(1);
  });
  it('fails closed if the pinned upstream implementation changes', () => {
    expect(() => patchRevealLifecycle('export default function() {}')).toThrow();
  });
});
