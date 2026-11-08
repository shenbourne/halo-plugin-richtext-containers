import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { EditorContent, ExtensionsKit, VueEditor } from '@halo-dev/richtext-editor';
import { createContainerExtensions } from '../src/editor/nodes';

const editors: VueEditor[] = [];
const apps: App[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
  apps.splice(0).reverse().forEach(app => app.unmount());
  editors.splice(0).forEach(editor => editor.destroy());
  hosts.splice(0).forEach(host => host.remove());
});
async function fixture() {
  const editor = new VueEditor({ extensions: [ExtensionsKit, ...createContainerExtensions()], content: '<p>起点</p>' });
  editors.push(editor);
  const host = document.createElement('div'); document.body.append(host); hosts.push(host);
  const app = createApp({ render: () => h(EditorContent, { editor }) }); apps.push(app); app.mount(host);
  await nextTick();
  return { editor, host };
}
async function clickToolbox(editor: VueEditor, index: number) {
  const extension = editor.extensionManager.extensions.find(extension => extension.name === 'rcContainersMenus')!;
  const item = extension.options.getToolboxItems({ editor })[index];
  const host = document.createElement('div'); document.body.append(host); hosts.push(host);
  const app = createApp({ render: () => h(item.component, item.props) }); apps.push(app); app.mount(host);
  host.querySelector<HTMLButtonElement>('button')!.click();
  await nextTick();
}

describe('real Vue NodeViews on the current Halo editor', () => {
  it.each([[0, 'rcTabs', '.rc-tabs', 'rcTab'], [1, 'rcSlides', '.rc-slides', 'rcSlide'], [2, 'rcHint', '.rc-hint', 'rcHint'], [3, 'rcFootnote', '.rc-footnote', 'rcFootnote']])('toolbox %s click inserts an editable body without another editor', async (index, root, selector, body) => {
    const { editor, host } = await fixture();
    await clickToolbox(editor, Number(index));
    expect(host.querySelectorAll('.tiptap')).toHaveLength(1);
    expect(host.querySelector(`${selector} [data-node-view-content] p`)).not.toBeNull();
    expect(host.querySelector(`${selector} .rc-meta`)?.getAttribute('contenteditable')).toBe('false');
    let bodyStart = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === body) bodyStart = pos + 2;
    });
    expect(bodyStart).toBeGreaterThan(0);
    editor.commands.setTextSelection(bodyStart);
    expect(editor.getJSON().content?.some(node => node.type === root)).toBe(true);
    editor.commands.insertContent('正文');
    expect(host.textContent).toContain('正文');
    editor.commands.undo();
    expect(editor.getText()).not.toContain('正文');
  });
  it('inserts inline at the end of a heading, creates the body below, and selects repeated references by alias', async () => {
    const { editor, host } = await fixture();
    editor.commands.setContent('<h2>Lagrange方程建模</h2><p>后续正文</p>');
    editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize - 1);
    await clickToolbox(editor, 3);
    expect(host.querySelector('.rc-footnote')).not.toBeNull();
    expect(host.querySelector('.rc-footnote-ref')).not.toBeNull();
    expect(editor.state.doc.child(0).lastChild?.type.name).toBe('rcFootnoteRef');
    expect(editor.state.doc.child(1).type.name).toBe('rcFootnote');
    expect(editor.state.doc.child(2).textContent).toBe('后续正文');
    const key = editor.state.doc.child(1).attrs.key;
    const alias = host.querySelector<HTMLInputElement>('.rc-footnote > .rc-meta input')!;
    alias.value = '建模说明'; alias.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(editor.state.doc.child(1).attrs.key).toBe(key);
    expect(host.querySelector('.rc-footnote-ref select')?.textContent).toContain('建模说明');
    expect(host.textContent).not.toContain(key);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    await clickToolbox(editor, 4);
    expect(editor.state.doc.childCount).toBe(3);
    expect(editor.state.doc.lastChild?.lastChild?.type.name).toBe('rcFootnoteRef');
    const repeatedReference = [...host.querySelectorAll<HTMLSelectElement>('.rc-footnote-ref select')].find(select => select.value === '')!;
    repeatedReference.value = key;
    repeatedReference.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    let references = 0;
    editor.state.doc.descendants(node => { if (node.type.name === 'rcFootnoteRef' && node.attrs.key === key) references++; });
    expect(references).toBe(2);
    const html = editor.getHTML();
    editor.commands.setContent(html);
    expect(editor.state.doc.child(1).attrs.name).toBe('建模说明');
    expect(editor.state.doc.lastChild?.lastChild?.attrs.key).toBe(key);
  });
  it('adds tabs from UI and restores rejected metadata with a visible error', async () => {
    const { editor, host } = await fixture();
    await clickToolbox(editor, 0);
    async function click(label: string) {
      const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label') === label);
      expect(button).toBeDefined();
      button!.click();
      await nextTick();
    }
    await click('同步组：不同步');
    await click('添加同步组');
    const sync = host.querySelector<HTMLInputElement>('input[aria-label="添加同步组"]')!;
    sync.value = 'os'; sync.dispatchEvent(new Event('input', { bubbles: true }));
    sync.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nextTick();
    expect(host.querySelector('[aria-label="同步组：os"]')).not.toBeNull();
    await click('编辑 os');
    const rename = host.querySelector<HTMLInputElement>('input[aria-label="编辑同步组"]')!;
    rename.value = 'discard'; rename.dispatchEvent(new Event('input', { bubbles: true }));
    rename.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(host.querySelector('[aria-label="编辑 os"]')).not.toBeNull();
    const titles = host.querySelectorAll<HTMLInputElement>('.rc-tab .rc-meta label:first-of-type input');
    titles[1].value = '标签页 1'; titles[1].dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(titles[1].value).toBe('标签页 2');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('重复');
    const add = host.querySelector<HTMLButtonElement>('button[aria-label="添加标签页"]')!;
    add.click(); await nextTick();
    expect(host.querySelectorAll('.rc-tab')).toHaveLength(3);
  });
  it('keeps a single default and persists editable synchronization choices across HTML reload', async () => {
    const { editor, host } = await fixture();
    await clickToolbox(editor, 0);
    const checks = () => [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(checks().map(input => input.checked)).toEqual([true, false]);
    checks()[1].click(); await nextTick();
    expect(checks().map(input => input.checked)).toEqual([false, true]);
    expect(host.textContent).not.toContain('· 默认');
    async function click(label: string) {
      host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click();
      await nextTick();
    }
    await click('同步值：标签页 1');
    await click('添加同步值');
    expect(host.querySelector<HTMLInputElement>('input[aria-label="添加同步值"]')?.value).toBe('标签页 1');
    await click('保存');
    await click('编辑 标签页 1');
    const input = host.querySelector<HTMLInputElement>('input[aria-label="编辑同步值"]')!;
    input.value = 'linux'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await click('保存');
    await click('添加同步值');
    await click('保存');
    const html = editor.getHTML();
    editor.commands.setContent(html);
    await nextTick();
    expect(checks().map(input => input.checked)).toEqual([false, true]);
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="同步值：标签页 1"]')!;
    if (trigger.getAttribute('aria-expanded') !== 'true') await click('同步值：标签页 1');
    expect(host.querySelector('[aria-label="编辑 linux"]')).not.toBeNull();
    await click('删除 标签页 1');
    expect(host.querySelector('[aria-label="编辑 标签页 1"]')).toBeNull();
    expect(host.querySelector('button[aria-label="同步值：标签页 1"]')).not.toBeNull();
  });
});
