import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, expect, it } from 'vitest';

let css = '';

beforeAll(() => {
  const script = [
    "import { build } from 'vite';",
    "const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, emptyOutDir: false, minify: false, cssMinify: false, lib: { entry: 'src/frontend/index.ts', formats: ['es'], fileName: 'frontend' } } });",
    "let css = '';",
    "for (const output of result) {",
    "  if (!output.output) continue;",
    "  for (const asset of output.output) {",
    "    if (asset.type === 'asset' && asset.fileName.endsWith('.css')) css += asset.source;",
    "  }",
    "}",
    "console.log('__CSS__' + JSON.stringify(css));",
  ].join('\n');
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const match = stdout.match(/__CSS__(.*)/);
  if (!match) throw new Error('Vite build did not return CSS');
  css = JSON.parse(match[1]) as string;
}, 30000);

afterAll(() => {
  document.body.replaceChildren();
  document.head.querySelectorAll('[data-test-css]').forEach((node) => node.remove());
});

function injectStyles() {
  if (document.head.querySelector('[data-test-css="frontend-bundle"]')) return;
  const stylesheet = document.createElement('style');
  stylesheet.dataset.testCss = 'frontend-bundle';
  stylesheet.textContent = css;
  document.head.append(stylesheet);
}

it('scopes Reveal CSS to plugin decks without changing other presentations, overlays, or document roots', () => {
  document.body.innerHTML = [
    '<div class="reveal"><div class="slides"><section>Existing presentation</section></div></div>',
    '<div class="r-overlay">Existing overlay</div>',
    '<div class="reveal-viewport">Existing viewport</div>',
    '<div data-rc-slides="v1" class="rc-slides rc-slides--light">',
    '  <div class="rc-slides__deck">',
    '    <div class="rc-slides__engine reveal reveal-viewport"><div class="slides"><section></section></div><aside class="controls"></aside></div>',
    '    <div class="rc-slides__content"><div class="reveal"><div class="slides"><section>Third party content</section></div></div></div>',
    '  </div>',
    '</div>',
  ].join('\n');
  const externalNodes = [
    document.documentElement,
    document.body,
    ...Array.from(document.querySelectorAll('body > .reveal, body > .reveal .slides, body > .r-overlay, body > .reveal-viewport, .rc-slides__content .reveal, .rc-slides__content .slides')),
  ];
  const properties = ['position', 'display', 'overflow', 'height', 'line-height', '--r-controls-spacing', '--r-overlay-header-height', '--rc-slide-bg'];
  const snapshot = (node: Element) => properties.map((property) => getComputedStyle(node).getPropertyValue(property));
  const before = externalNodes.map(snapshot);
  injectStyles();

  expect(css.length).toBeGreaterThan(0);
  expect(externalNodes.map(snapshot)).toEqual(before);
  const engineStyle = getComputedStyle(document.querySelector('.rc-slides__engine')!);
  expect(engineStyle.position).toBe('absolute');
  expect(engineStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(getComputedStyle(document.querySelector('.rc-slides__engine > .slides')!).position).toBe('absolute');
  expect(getComputedStyle(document.querySelector('.rc-slides__engine > .controls')!).position).toBe('absolute');
  expect(getComputedStyle(document.querySelector('.rc-slides__engine')!).getPropertyValue('--r-controls-spacing')).toBe('12px');
  expect(getComputedStyle(document.querySelector('.rc-slides')!).getPropertyValue('--rc-slide-bg')).toBe('#ffffff');
});

it('keeps generated footnote layout inside the plugin list and aligns nested rich content', () => {
  document.body.innerHTML = [
    '<aside class="rc-footnote" data-rc-footnote="v1"><p>Unmanaged footnote-shaped content</p></aside>',
    '<section class="article-body">',
    '  <p>Body <span data-rc-footnote-ref="v1"><a href="#rc-fn-1">1</a></span></p>',
    '  <section data-rc-footnotes-list>',
    '    <h2 class="rc-footnotes__title">Footnotes</h2>',
    '    <aside id="rc-fn-1" class="rc-footnote" data-rc-footnote="v1">',
    '      <span data-rc-footnote-generated="number">1.</span>',
    '      <p>Paragraph one</p>',
    '      <p>Paragraph two</p>',
    '      <div data-rc-hint="v1" class="rc-hint"><p>Nested hint</p></div>',
    '      <span data-rc-footnote-generated="backlinks"><a href="#rc-fnref-1">↩</a></span>',
    '    </aside>',
    '  </section>',
    '</section>',
  ].join('\n');
  injectStyles();

  const outside = document.querySelector('body > [data-rc-footnote="v1"]')!;
  const definition = document.querySelector('[data-rc-footnotes-list] > [data-rc-footnote="v1"]')!;
  const paragraphs = definition.querySelectorAll('p');

  expect(getComputedStyle(outside).display).toBe('block');
  expect(getComputedStyle(outside).gridTemplateColumns).toBe('');
  expect(getComputedStyle(definition).display).toBe('grid');
  expect(getComputedStyle(paragraphs[0]).gridColumn).toBe('2');
  expect(getComputedStyle(paragraphs[1]).gridColumn).toBe('2');
  expect(getComputedStyle(definition.querySelector('[data-rc-hint]')!).gridColumn).toBe('2');
});
