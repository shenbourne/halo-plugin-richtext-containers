import { afterEach, describe, expect, it } from 'vitest';
import { Editor, ExtensionsKit, Node } from '@halo-dev/richtext-editor';
import { createContainerExtensions } from '../src/editor/nodes';
import { createHint, createSlides, createTabs } from '../src/editor/model';

const editors: Editor[] = [];
const probe = Node.create({ name: 'thirdPartyProbe', group: 'block', atom: true,
  addAttributes: () => ({ token: { default: 'retained' } }),
  parseHTML: () => [{ tag: 'div[data-probe]' }], renderHTML: () => ['div', { 'data-probe': 'yes' }],
});
function editor(content: any) {
  const e = new Editor({ extensions: [ExtensionsKit, probe, ...createContainerExtensions()], content });
  editors.push(e); return e;
}
afterEach(() => editors.splice(0).forEach(e => e.destroy()));
describe('native block schema and canonical safe HTML', () => {
  it('round-trips third-party blocks and mutually nested containers without cloned controls', () => {
    const tabs = createTabs();
    const slides = createSlides();
    const hint = createHint();
    hint.content = [{ type: 'paragraph', content: [{ type: 'text', text: '<script> & 正文' }] }, { type: 'thirdPartyProbe' }];
    slides.content![0].content![0].content = [hint];
    slides.content![0].content![0].attrs!.title = '<img src=x onerror=alert(1)>';
    tabs.content![0].content = [slides];
    const e = editor({ type: 'doc', content: [tabs] });
    const html = e.getHTML();
    expect(html).toContain('data-rc-tabs="v1"');
    expect(html).toMatch(/data-rc-default="tab-[^"]+"/);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('data-rc-generated');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    expect(parsed.querySelector('img')).toBeNull();
    expect(html).toContain('<img src=x onerror=alert(1)>');
    const restored = editor(html);
    // Halo's own paragraph lineHeight normalizes null to an empty style on HTML parse.
    const normalize = (value: unknown) => JSON.parse(JSON.stringify(value, (key, item) => key === 'lineHeight' && item == null ? '' : item));
    expect(normalize(restored.getJSON())).toEqual(normalize(e.getJSON()));
  });
  it('coerces hostile or malformed metadata to valid typed defaults', () => {
    const e = editor('<aside data-rc-hint="v1" data-rc-kind="script" data-rc-open="false" onclick="alert(1)"><p>原文</p></aside><div data-rc-slides="v1" data-rc-theme="bad" data-rc-transition="bad" data-rc-controls="false"><div data-rc-group="v1"><div data-rc-slide="v1"><p>页</p></div></div></div>');
    expect(e.state.doc.child(0).attrs.kind).toBe('info');
    expect(e.state.doc.child(0).attrs.open).toBe(false);
    expect(e.state.doc.child(1).attrs.theme).toBe('auto');
    expect(e.state.doc.child(1).attrs.transition).toBe('slide');
    expect(e.state.doc.child(1).attrs.controls).toBe(false);
    expect(e.getHTML()).not.toContain('onclick');
  });
});
