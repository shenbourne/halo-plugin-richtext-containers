import type { JSONContent } from '@halo-dev/richtext-editor';
function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
export function createTabs(): JSONContent {
  const first = id('tab'); const second = id('tab');
  return {
    type: 'rcTabs',
    attrs: { id: id('tabs'), defaultId: first, sync: '', value: '' },
    content: [
      { type: 'rcTab', attrs: { id: first, title: '标签页 1', value: '' }, content: [{ type: 'paragraph' }] },
      { type: 'rcTab', attrs: { id: second, title: '标签页 2', value: '' }, content: [{ type: 'paragraph' }] },
    ],
  };
}
export function createSlides(): JSONContent {
  const slide = id('slide'); const group = id('group');
  return {
    type: 'rcSlides',
    attrs: { id: id('slides'), theme: 'auto', transition: 'slide', numbers: true, progress: false, controls: true },
    content: [{ type: 'rcGroup', attrs: { id: group }, content: [{ type: 'rcSlide', attrs: { id: slide, title: '' }, content: [{ type: 'paragraph' }] }] }],
  };
}
export function createHint(): JSONContent {
  return { type: 'rcHint', attrs: { id: id('hint'), title: '', kind: 'info', open: false }, content: [{ type: 'paragraph' }] };
}
export function createFootnote(): JSONContent {
  const key = id('note');
  return {
    type: 'rcFootnote',
    attrs: { id: id('footnote'), key },
    content: [{ type: 'paragraph' }],
  };
}
export function createFootnoteReference(key = id('note')): JSONContent {
  return { type: 'rcFootnoteRef', attrs: { key } };
}
export function validateTabSync(tabs: JSONContent): string | null {
  if (!tabs.attrs?.sync) return null;
  const seen = new Set<string>();
  for (const tab of tabs.content ?? []) {
    const effective = tab.attrs?.value || tab.attrs?.title || '';
    if (!effective) continue;
    if (seen.has(effective)) return effective;
    seen.add(effective);
  }
  return null;
}
