import type { PMNode } from '@halo-dev/richtext-editor';

const cache = new WeakMap<PMNode, { key: string; name: string; label: string }[]>();

export function footnoteOptions(doc: PMNode) {
  const cached = cache.get(doc);
  if (cached) return cached;
  const byKey = new Map<string, { key: string; name: string; label: string }>();
  doc.descendants(node => {
    const { key, name } = node.attrs;
    if (node.type.name !== 'rcFootnote' || !key || byKey.has(key)) return;
    const alias = name?.trim() || `脚注 ${byKey.size + 1}`;
    byKey.set(key, { key, name: alias, label: alias });
  });
  const options = [...byKey.values()];
  const counts = new Map<string, number>();
  for (const { name } of options) counts.set(name, (counts.get(name) ?? 0) + 1);
  options.forEach((option, i) => {
    if (counts.get(option.name)! > 1) option.label = `${option.name}（脚注 ${i + 1}）`;
  });
  cache.set(doc, options);
  return options;
}
