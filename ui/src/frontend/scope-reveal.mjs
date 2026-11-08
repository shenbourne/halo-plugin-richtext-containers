import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vite/package.json'));
const postcss = viteRequire('postcss');
const input = readFileSync(new URL('../../node_modules/reveal.js/dist/reveal.css', import.meta.url), 'utf8');
const root = postcss.parse(input);
const engine = '[data-rc-slides="v1"] > .rc-slides__deck > .rc-slides__engine';
const keyframes = new Map();

root.walkAtRules((rule) => {
  if (!rule.name.endsWith('keyframes')) return;
  const scopedName = `rc-reveal-${rule.params}`;
  keyframes.set(rule.params, scopedName);
  rule.params = scopedName;
});

root.walkDecls((declaration) => {
  if (!declaration.prop.startsWith('animation')) return;
  for (const [name, scopedName] of keyframes) {
    declaration.value = declaration.value.replace(new RegExp(`(^|[\\s,])${name}(?=[\\s,]|$)`, 'g'), `$1${scopedName}`);
  }
});

root.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
  const selectors = rule.selectors.flatMap((selector) => {
    if (/(^|[\s>+~,(])(html|body)(?=[.#:[\s>+~]|$)/.test(selector)) return [];
    let scoped = selector
      .replace(/\.reveal-viewport(?![\w-])/g, `${engine}.reveal-viewport`)
      .replace(/\.reveal(?![\w-])/g, `${engine}.reveal`);
    if (scoped === selector) scoped = `${engine} ${selector}`;
    return [scoped];
  });
  if (selectors.length === 0) rule.remove();
  else rule.selectors = selectors;
});

writeFileSync(
  new URL('./reveal-scoped.css', import.meta.url),
  `/* reveal.js 5.2.1 base styles, mechanically scoped to this plugin's isolated engine. */\n${root.toString()}\n`,
);
