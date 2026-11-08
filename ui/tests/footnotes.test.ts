import { afterEach, expect, it } from 'vitest';
import { Editor, ExtensionsKit } from '@halo-dev/richtext-editor';
import { createContainerExtensions } from '../src/editor/nodes';
import { mountFootnotes } from '../src/frontend/footnotes';

afterEach(() => { document.body.innerHTML = ''; });
it('keeps footnote bodies as native blocks and round trips references and nested rich content', () => {
  const e = new Editor({ extensions: [ExtensionsKit, ...createContainerExtensions()], content: {
    type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '引用' }, { type: 'rcFootnoteRef', attrs: { key: 'alpha' } }] },
      { type: 'rcFootnote', attrs: { key: 'alpha' }, content: [
        { type: 'paragraph', content: [{ type: 'text', text: '第一段' }] },
        { type: 'rcHint', content: [{ type: 'paragraph', content: [{ type: 'text', text: '嵌套' }] }] },
      ] },
    ],
  } });
  const html = e.getHTML();
  expect(html).toContain('data-rc-footnote-ref');
  expect(html).toContain('data-rc-footnote=');
  e.commands.setContent(html);
  expect(e.getJSON().content?.[1].content?.[1].type).toBe('rcHint');
  expect((e.getJSON().content?.[0].content?.[1] as any)?.attrs?.key).toBe('alpha');
  e.destroy();
});
it('numbers by first reference, supports repeated refs and safe keys, and is idempotent', () => {
  document.body.innerHTML = `<article>
    <p><span data-rc-footnote-ref="v1" data-rc-key="b"></span><span data-rc-footnote-ref="v1" data-rc-key="a"></span><span data-rc-footnote-ref="v1" data-rc-key="b"></span><span data-rc-footnote-ref="v1" data-rc-key="missing"></span></p>
    <aside data-rc-footnote="v1" data-rc-key="a"><p>A</p></aside>
    <aside data-rc-footnote="v1" data-rc-key="b"><p>B</p><p>第二段</p></aside>
  </article>`;
  mountFootnotes(document);
  mountFootnotes(document);
  const refs = [...document.querySelectorAll('[data-rc-footnote-ref] a')];
  expect(refs.map(r => r.textContent)).toEqual(['[1]', '[2]', '[1]']);
  const notes = document.querySelectorAll('[data-rc-footnotes-list] > aside');
  expect(notes).toHaveLength(2);
  expect(notes[0].getAttribute('data-rc-key')).toBe('b');
  expect(notes[0].querySelectorAll('[role="doc-backlink"]')).toHaveLength(2);
  for (const ref of refs) expect(document.getElementById(ref.getAttribute('href')!.slice(1))).not.toBeNull();
  expect(document.querySelector('[data-rc-key="missing"]')?.textContent).toContain('?');
});
it('keeps the first definition stable after earlier footnotes have moved into the generated list', () => {
  document.body.innerHTML = `<article>
    <p><span data-rc-footnote-ref="v1" data-rc-key="alpha"></span></p>
    <aside data-rc-footnote="v1" data-rc-key="alpha"><p>主定义</p></aside>
    <aside data-rc-footnote="v1" data-rc-key="alpha"><p>重复定义</p></aside>
  </article>`;
  mountFootnotes(document);
  mountFootnotes(document);
  mountFootnotes(document);
  const notes = document.querySelectorAll('[data-rc-footnotes-list] > aside');
  expect(notes).toHaveLength(1);
  expect(notes[0].textContent).toContain('主定义');
  expect(notes[0].textContent).not.toContain('重复定义');
  const duplicate = [...document.querySelectorAll<HTMLElement>('[data-rc-footnote]')]
    .find(element => element.textContent?.includes('重复定义'));
  expect(duplicate?.hasAttribute('hidden')).toBe(true);
  expect(duplicate?.getAttribute('aria-hidden')).toBe('true');
});
it('isolates articles and leaves editor DOM untouched', () => {
  document.body.innerHTML = `<div class="ProseMirror"><p><span data-rc-footnote-ref="v1" data-rc-key="a"></span></p><aside data-rc-footnote="v1" data-rc-key="a"><p>编辑</p></aside></div>`;
  const before = document.body.innerHTML;
  mountFootnotes(document);
  expect(document.body.innerHTML).toBe(before);
});
it('keeps identical keys in separate articles independent', () => {
  document.body.innerHTML = `<article id="one"><p><span data-rc-footnote-ref="v1" data-rc-key="same"></span></p><aside data-rc-footnote="v1" data-rc-key="same"><p>甲</p></aside></article>
    <article id="two"><p><span data-rc-footnote-ref="v1" data-rc-key="same"></span></p><aside data-rc-footnote="v1" data-rc-key="same"><p>乙</p></aside></article>`;
  mountFootnotes(document);
  expect(document.querySelectorAll('[data-rc-footnotes-list]')).toHaveLength(2);
  expect(document.querySelectorAll('[data-rc-footnotes-list] [data-rc-footnote]')).toHaveLength(2);
  expect(document.querySelector('#one [data-rc-footnotes-list]')?.textContent).toContain('甲');
  expect(document.querySelector('#two [data-rc-footnotes-list]')?.textContent).toContain('乙');
});

it('places endnotes after the last body block and before reactions and comments without an article element', () => {
  document.body.innerHTML = `<main><div><div class="post-content">
    <p>正文<span data-rc-footnote-ref="v1" data-rc-key="a"></span></p>
    <aside data-rc-footnote="v1" data-rc-key="a"><p>说明</p></aside>
    <p id="last">结论</p>
  </div><div id="reactions">评价</div><div id="comments">评论</div></div></main><footer>页脚</footer>`;
  mountFootnotes(document);
  mountFootnotes(document);
  expect(document.querySelector('.post-content')?.lastElementChild?.matches('[data-rc-footnotes-list]')).toBe(true);
  expect(document.querySelector('#last')?.nextElementSibling?.matches('[data-rc-footnotes-list]')).toBe(true);
  expect(document.body.lastElementChild?.tagName).toBe('FOOTER');
});

it('previews note text on hover and keyboard focus without cloning IDs or backlink controls', () => {
  document.body.innerHTML = `<article><div><p><span data-rc-footnote-ref="v1" data-rc-key="a"></span></p>
    <aside data-rc-footnote="v1" data-rc-key="a"><p id="source">第一段</p><p>第二段</p></aside></div><footer>页脚</footer></article>`;
  mountFootnotes(document);
  const link = document.querySelector<HTMLAnchorElement>('[role="doc-noteref"]')!;
  link.dispatchEvent(new Event('pointerenter'));
  expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('第一段\n第二段');
  expect(document.querySelectorAll('#source')).toHaveLength(1);
  link.dispatchEvent(new Event('pointerleave'));
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  link.focus();
  expect(link.getAttribute('aria-describedby')).toBe(document.querySelector('[role="tooltip"]')?.id);
  link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
});
