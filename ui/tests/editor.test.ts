import { afterEach, describe, expect, it } from 'vitest';
import { Editor, ExtensionsKit } from '@halo-dev/richtext-editor';
import { createContainerExtensions } from '../src/editor/nodes';
import { createHint, createSlides, createTabs } from '../src/editor/model';
import { addTab, removeItem, removeGroup, moveItem, addSlide, moveSlideToGroup, updateMetadata, nearestContainer, insertContainer } from '../src/editor/commands';

const editors: Editor[] = [];
function editor(content: any[]) {
  const e = new Editor({ extensions: [ExtensionsKit, ...createContainerExtensions()], content: { type: 'doc', content } });
  editors.push(e); return e;
}
function positions(e: Editor, name: string) {
  const result: number[] = [];
  e.state.doc.descendants((node, pos) => { if (node.type.name === name) result.push(pos); });
  return result;
}
afterEach(() => editors.splice(0).forEach(e => e.destroy()));

describe('native container transactions', () => {
  it('adds, moves and deletes tabs, repairs default and protects the last body', () => {
    const e = editor([createTabs()]);
    expect(addTab(e, 0)).toBe(true);
    expect(e.state.doc.firstChild!.childCount).toBe(3);
    const id = e.state.doc.firstChild!.firstChild!.attrs.id;
    expect(moveItem(e, positions(e, 'rcTab')[0], 1)).toBe(true);
    expect(e.state.doc.firstChild!.child(1).attrs.id).toBe(id);
    expect(removeItem(e, positions(e, 'rcTab')[1], true)).toBe(true);
    expect(e.state.doc.firstChild!.attrs.defaultId).toBe(e.state.doc.firstChild!.firstChild!.attrs.id);
    expect(removeItem(e, positions(e, 'rcTab')[0], true)).toBe(true);
    expect(removeItem(e, positions(e, 'rcTab')[0], true)).toBe(false);
  });
  it('rejects synchronization conflicts atomically and metadata is undoable', () => {
    const e = editor([createTabs()]);
    const p = positions(e, 'rcTab');
    expect(updateMetadata(e, p[0], { title: 'Linux' })).toBe(true);
    expect(updateMetadata(e, p[1], { title: 'Linux' })).toBe(true);
    expect(updateMetadata(e, 0, { sync: 'os' })).toBe(false);
    expect(e.state.doc.firstChild!.attrs.sync).toBe('');
    expect(updateMetadata(e, p[1], { title: 'Windows' })).toBe(true);
    expect(updateMetadata(e, 0, { sync: 'os' })).toBe(true);
    e.commands.undo();
    expect(e.state.doc.firstChild!.attrs.sync).toBe('');
    e.commands.redo();
    expect(e.state.doc.firstChild!.attrs.sync).toBe('os');
  });
  it('uses exact nested positions', () => {
    const outer = createTabs();
    outer.content![0].content = [createTabs(), createHint()];
    const e = editor([outer]);
    const inner = positions(e, 'rcTabs')[1];
    expect(addTab(e, inner)).toBe(true);
    expect(e.state.doc.firstChild!.childCount).toBe(2);
    expect(e.state.doc.nodeAt(inner)!.childCount).toBe(3);
    e.commands.setTextSelection(inner + 3);
    expect(nearestContainer(e.state, 'rcTabs')?.pos).toBe(inner);
  });
  it('keeps the caret in its paragraph and does not request scrolling during container edits', () => {
    const e = editor([{ type: 'paragraph', content: [{ type: 'text', text: '开头' }] }]);
    const transactions: boolean[] = [];
    e.on('transaction', ({ transaction }) => transactions.push(transaction.scrolledIntoView));
    e.commands.setTextSelection(3);
    expect(insertContainer(e, createTabs)).toBe(true);
    expect(e.state.selection.$from.parent.textContent).toBe('开头');
    expect(e.state.selection.$from.parentOffset).toBe(2);
    const first = positions(e, 'rcTab')[0];
    e.commands.insertContentAt(first + 2, '编辑中的文字', { updateSelection: false });
    e.commands.setTextSelection(first + 4);
    const assertCaret = () => {
      expect(e.state.selection.$from.parent.textContent).toBe('编辑中的文字');
      expect(e.state.selection.$from.parentOffset).toBe(2);
    };
    expect(addTab(e, positions(e, 'rcTabs')[0])).toBe(true);
    assertCaret();
    expect(moveItem(e, first, 1)).toBe(true);
    assertCaret();
    expect(removeItem(e, positions(e, 'rcTab')[0], true)).toBe(true);
    assertCaret();
    expect(transactions).not.toContain(true);
  });
  it('creates horizontal and vertical pages and moves complete bodies across groups', () => {
    const e = editor([createSlides()]);
    expect(addSlide(e, 0, 'horizontal')).toBe(true);
    const groups = positions(e, 'rcGroup');
    expect(addSlide(e, groups[0], 'vertical')).toBe(true);
    const pages = positions(e, 'rcSlide');
    expect(updateMetadata(e, pages[1], { title: '保留标题' })).toBe(true);
    expect(moveSlideToGroup(e, pages[1], 1)).toBe(true);
    expect(e.state.doc.firstChild!.child(0).childCount).toBe(1);
    expect(e.state.doc.firstChild!.child(1).childCount).toBe(2);
    expect(e.state.doc.firstChild!.child(1).lastChild!.attrs.title).toBe('保留标题');
    expect(moveSlideToGroup(e, positions(e, 'rcSlide')[0], 1)).toBe(true);
    expect(e.state.doc.firstChild!.childCount).toBe(1);
  });
  it('deduplicates pasted stable IDs and maps defaults to the pasted items; undo stays coherent', () => {
    const tabs = createTabs();
    const e = editor([tabs]);
    e.commands.insertContentAt(e.state.doc.content.size, tabs);
    const ids: string[] = [];
    e.state.doc.descendants(n => { if (n.type.name.startsWith('rc')) ids.push(n.attrs.id); });
    expect(new Set(ids).size).toBe(ids.length);
    const copy = e.state.doc.child(1);
    expect(copy.attrs.defaultId).toBe(copy.firstChild!.attrs.id);
    expect(e.state.doc.firstChild!.attrs.defaultId).toBe(e.state.doc.firstChild!.firstChild!.attrs.id);
    e.commands.undo();
    expect(positions(e, 'rcTabs')).toHaveLength(1);
    e.commands.redo();
    expect(positions(e, 'rcTabs')).toHaveLength(2);
  });
  it('moves and deletes a whole horizontal group with native undo', () => {
    const e = editor([createSlides()]);
    addSlide(e, 0, 'horizontal');
    let groups = positions(e, 'rcGroup');
    const id = e.state.doc.nodeAt(groups[0])!.attrs.id;
    expect(moveItem(e, groups[0], 1)).toBe(true);
    groups = positions(e, 'rcGroup');
    expect(e.state.doc.nodeAt(groups[1])!.attrs.id).toBe(id);
    expect(removeGroup(e, groups[1], false)).toBe(false);
    expect(removeGroup(e, groups[1], true)).toBe(true);
    expect(positions(e, 'rcGroup')).toHaveLength(1);
    e.commands.undo();
    expect(positions(e, 'rcGroup')).toHaveLength(2);
  });
  it('adds a nonconflicting title after deleting a middle synchronized tab', () => {
    const e = editor([createTabs()]);
    updateMetadata(e, 0, { sync: 'os' });
    addTab(e, 0);
    removeItem(e, positions(e, 'rcTab')[1], true);
    addTab(e, 0);
    const titles: string[] = [];
    e.state.doc.firstChild!.forEach(node => titles.push(node.attrs.title));
    expect(new Set(titles).size).toBe(3);
  });
  it('rejects an explicit effective-value conflict and an invalid default atomically', () => {
    const e = editor([createTabs()]);
    updateMetadata(e, 0, { sync: 'os' });
    expect(updateMetadata(e, positions(e, 'rcTab')[1], { value: '标签页 1' })).toBe(false);
    expect(updateMetadata(e, 0, { defaultId: 'missing' })).toBe(false);
  });
  it('increments new tab candidates past existing titles and explicit sync values', () => {
    const e = editor([createTabs()]);
    const p = positions(e, 'rcTab');
    expect(updateMetadata(e, p[1], { title: '标签页 3' })).toBe(true);
    expect(updateMetadata(e, 0, { sync: 'os' })).toBe(true);
    expect(addTab(e, 0)).toBe(true);
    expect(e.state.doc.firstChild!.lastChild!.attrs.title).toBe('标签页 4');
    expect(updateMetadata(e, p[1], { value: '标签页 5' })).toBe(true);
    expect(addTab(e, 0)).toBe(true);
    expect(e.state.doc.firstChild!.lastChild!.attrs.title).toBe('标签页 6');

    const other = editor([createTabs()]);
    expect(updateMetadata(other, positions(other, 'rcTab')[1], { title: '标签页 3', value: 'other' })).toBe(true);
    expect(updateMetadata(other, 0, { sync: 'os' })).toBe(true);
    expect(addTab(other, 0)).toBe(true);
    expect(other.state.doc.firstChild!.lastChild!.attrs.title).toBe('标签页 4');
    other.commands.undo();
    expect(other.state.doc.firstChild!.childCount).toBe(2);
  });
});
