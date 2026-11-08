import { Fragment, TextSelection, closeHistory, type JSONContent, type Editor as VueEditor, type PMNode } from '@halo-dev/richtext-editor';
import { footnoteOptions } from './footnote-options';

export interface ContainerHit { pos: number; node: any }

function freshId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function text(value: unknown, fallback = '', limit = 180): string {
  const s = typeof value === 'string' ? value : fallback;
  return s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit);
}
function bool(value: unknown, fallback = false): boolean {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return fallback;
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}
function effectiveValue(tab: any): string {
  return text(tab.attrs?.value) || text(tab.attrs?.title);
}
function nodeAt(editor: VueEditor, pos: number) {
  return pos >= 0 && pos <= editor.state.doc.content.size ? editor.state.doc.nodeAt(pos) : null;
}
export function ancestorPos(editor: VueEditor, pos: number, typeName: string): number {
  const $pos = editor.state.doc.resolve(Math.max(0, pos));
  for (let depth = $pos.depth; depth >= 0; depth--) {
    if ($pos.node(depth).type.name === typeName) return $pos.before(depth);
  }
  return -1;
}
export function nearestContainer(state: any, typeName: string): ContainerHit | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === typeName) return { pos: $from.before(depth), node };
  }
  return null;
}
function dispatch(editor: VueEditor, tr: VueEditor['state']['tr']): boolean {
  if (!tr.docChanged && !tr.selectionSet) return false;
  editor.view.dispatch(closeHistory(tr));
  return true;
}

// Reordering replaces the sibling range, so ordinary position mapping loses the
// text selection inside it. Follow each endpoint within its surviving tab or page.
function preserveReorderedSelection(editor: VueEditor, tr: VueEditor['state']['tr'], from: number, to: number) {
  const selection = editor.state.selection;
  if (!(selection instanceof TextSelection)) return;
  function resolve(endpoint: typeof selection.$anchor) {
    if (endpoint.pos <= from || endpoint.pos >= to) return tr.mapping.map(endpoint.pos);
    for (let depth = endpoint.depth; depth > 0; depth--) {
      const oldPos = endpoint.before(depth);
      if (oldPos < from) break;
      const node = endpoint.node(depth);
      if (node.type.name !== 'rcTab' && node.type.name !== 'rcSlide') continue;
      let movedPos: number | undefined;
      tr.doc.nodesBetween(from, to, (candidate, pos) => {
        if (candidate === node) movedPos = pos;
        return movedPos === undefined;
      });
      if (movedPos !== undefined) return movedPos + endpoint.pos - oldPos;
    }
    return tr.mapping.map(endpoint.pos);
  }
  tr.setSelection(TextSelection.between(tr.doc.resolve(resolve(selection.$anchor)), tr.doc.resolve(resolve(selection.$head))));
}
function syncConflict(children: readonly any[]): string | null {
  const seen = new Set<string>();
  let conflict: string | null = null;
  children.forEach((tab: any, index: number) => {
    const value = effectiveValue(tab);
    if (!value) return;
    if (seen.has(value)) conflict ||= value;
    seen.add(value);
  });
  return conflict;
}

export function addTab(editor: VueEditor, tabsPos: number): boolean {
  const tabs = nodeAt(editor, tabsPos);
  if (!tabs || tabs.type.name !== 'rcTabs') return false;
  const schema = editor.state.schema;
  const usedValues = new Set(tabs.content.content.flatMap(tab => [text(tab.attrs.title), effectiveValue(tab)]));
  let number = tabs.childCount + 1;
  while (usedValues.has(`标签页 ${number}`)) number++;
  const tab = schema.nodes.rcTab.create(
    { id: freshId('tab'), title: `标签页 ${number}`, value: '' },
    schema.nodes.paragraph.create(),
  );
  const at = tabsPos + tabs.nodeSize - 1;
  return dispatch(editor, editor.state.tr.insert(at, tab));
}

export function removeItem(editor: VueEditor, itemPos: number, confirmed = false): boolean {
  const item = nodeAt(editor, itemPos);
  if (!item || !['rcTab', 'rcSlide'].includes(item.type.name) || !confirmed) return false;
  const parentName = item.type.name === 'rcTab' ? 'rcTabs' : 'rcGroup';
  const parentPos = ancestorPos(editor, itemPos, parentName);
  const parent = nodeAt(editor, parentPos);
  if (!parent || parent.childCount <= 1) return false;
  const index = parent.content.content.indexOf(item);
  if (index < 0) return false;
  const tr = editor.state.tr.delete(itemPos, itemPos + item.nodeSize);
  if (item.type.name === 'rcTab' && parent.attrs.defaultId === item.attrs.id) {
    const next = index === 0 ? parent.child(1) : parent.child(0);
    tr.setNodeMarkup(parentPos, null, { ...parent.attrs, defaultId: next.attrs.id });
  }
  return dispatch(editor, tr);
}

export function moveItem(editor: VueEditor, itemPos: number, direction: -1 | 1): boolean {
  const item = nodeAt(editor, itemPos);
  if (!item || !['rcTab', 'rcSlide', 'rcGroup'].includes(item.type.name)) return false;
  const parentName = item.type.name === 'rcTab' ? 'rcTabs' : item.type.name === 'rcGroup' ? 'rcSlides' : 'rcGroup';
  const parentPos = ancestorPos(editor, itemPos, parentName);
  const parent = nodeAt(editor, parentPos);
  if (!parent) return false;
  const index = parent.content.content.indexOf(item);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= parent.childCount) return false;
  const children = parent.content.content.slice();
  children.splice(target, 0, children.splice(index, 1)[0]);
  const from = parentPos + 1;
  const to = parentPos + parent.nodeSize - 1;
  const tr = editor.state.tr.replaceWith(from, to, Fragment.fromArray(children));
  preserveReorderedSelection(editor, tr, from, to);
  return dispatch(editor, tr);
}

export function addSlide(editor: VueEditor, pos: number, mode: 'horizontal' | 'vertical'): boolean {
  const target = nodeAt(editor, pos);
  const schema = editor.state.schema;
  if (!target) return false;
  if (mode === 'horizontal') {
    if (target.type.name !== 'rcGroup' && target.type.name !== 'rcSlides') return false;
    const slide = schema.nodes.rcSlide.create({ id: freshId('slide'), title: '' }, schema.nodes.paragraph.create());
    const group = schema.nodes.rcGroup.create({ id: freshId('group') }, slide);
    const at = target.type.name === 'rcGroup' ? pos + target.nodeSize : pos + target.nodeSize - 1;
    return dispatch(editor, editor.state.tr.insert(at, group));
  }
  const groupPos = target.type.name === 'rcGroup' ? pos : ancestorPos(editor, pos, 'rcGroup');
  const group = nodeAt(editor, groupPos);
  if (!group || group.type.name !== 'rcGroup') return false;
  const slide = schema.nodes.rcSlide.create(
    { id: freshId('slide'), title: `第 ${group.childCount + 1} 页` },
    schema.nodes.paragraph.create(),
  );
  return dispatch(editor, editor.state.tr.insert(groupPos + group.nodeSize - 1, slide));
}

export function moveSlideToGroup(editor: VueEditor, slidePos: number, groupIndex: number): boolean {
  const slide = nodeAt(editor, slidePos);
  if (!slide || slide.type.name !== 'rcSlide') return false;
  const rootPos = ancestorPos(editor, slidePos, 'rcSlides');
  const root = nodeAt(editor, rootPos);
  if (!root || groupIndex < 0 || groupIndex >= root.childCount) return false;
  const sourcePos = ancestorPos(editor, slidePos, 'rcGroup');
  const source = nodeAt(editor, sourcePos);
  if (!source) return false;
  const sourceChildren = source.content.content.filter((child: PMNode) => child !== slide);
  const groups = root.content.content.slice();
  const sourceIndex = groups.indexOf(source);
  const target = groups[groupIndex];
  if (!source || source === target) return false;
  if (sourceChildren.length) groups[sourceIndex] = source.copy(Fragment.fromArray(sourceChildren));
  groups[groupIndex] = target.copy(Fragment.fromArray([...target.content.content, slide]));
  if (!sourceChildren.length) groups.splice(sourceIndex, 1);
  const from = rootPos + 1;
  const to = rootPos + root.nodeSize - 1;
  const tr = editor.state.tr.replaceWith(from, to, Fragment.fromArray(groups));
  preserveReorderedSelection(editor, tr, from, to);
  return dispatch(editor, tr);
}

export function updateMetadata(editor: VueEditor, pos: number, attrs: Record<string, unknown>): boolean {
  const node = nodeAt(editor, pos);
  if (!node) return false;
  const name = node.type.name;
  const next = { ...node.attrs, ...attrs };
  if (name === 'rcTabs') {
    next.sync = text(next.sync);
    next.value = text(next.value);
    if (next.sync && syncConflict(node.content.content)) return false;
    if (!node.content.content.some(child => child.attrs.id === next.defaultId)) return false;
  } else if (name === 'rcTab') {
    next.title = text(next.title);
    next.value = text(next.value);
    const rootPos = ancestorPos(editor, pos, 'rcTabs');
    const root = nodeAt(editor, rootPos);
    const index = root ? root.content.content.indexOf(node) : -1;
    if (root && text(root.attrs.sync) && syncConflict(root.content.content.map((child, i) => i === index ? { attrs: next } : child))) return false;
  } else if (name === 'rcHint') {
    next.title = text(next.title);
    next.kind = oneOf(next.kind, ['important','info','note','tip','warning','caution','details'] as const, 'info');
    next.open = next.kind === 'details' ? bool(next.open) : false;
  } else if (name === 'rcFootnote' || name === 'rcFootnoteRef') {
    next.key = text(next.key, '', 96);
    if (name === 'rcFootnote') next.name = text(next.name, '', 96).trim();
  } else if (name === 'rcSlide') {
    next.title = text(next.title);
  } else if (name === 'rcSlides') {
    next.theme = oneOf(next.theme, ['auto','light','dark'] as const, 'auto');
    next.transition = oneOf(next.transition, ['none','slide','fade'] as const, 'slide');
    next.numbers = bool(next.numbers, true);
    next.progress = bool(next.progress, false);
    next.controls = bool(next.controls, true);
  }
  return dispatch(editor, editor.state.tr.setNodeMarkup(pos, null, next));
}

export function removeNode(editor: VueEditor, pos: number): boolean {
  const node = nodeAt(editor, pos);
  if (!node) return false;
  return dispatch(editor, editor.state.tr.delete(pos, pos + node.nodeSize));
}

export function insertContainer(editor: VueEditor, factory: () => JSONContent, range?: { from: number; to: number }): boolean {
  const { selection } = editor.state;
  const target = range ?? { from: selection.from, to: selection.to };
  return editor.chain().insertContentAt(target, factory(), { updateSelection: false }).command(({ tr }) => {
    if (!range && selection instanceof TextSelection && selection.empty) {
      const { $from } = selection;
      if ($from.depth > 0 && $from.parentOffset > 0) {
        const blockPos = tr.mapping.map($from.before(), -1);
        const block = tr.doc.nodeAt(blockPos);
        const offset = $from.parentOffset;
        if (block?.type === $from.parent.type && block.content.size >= offset
          && block.content.cut(0, offset).eq($from.parent.content.cut(0, offset))) {
          tr.setSelection(TextSelection.create(tr.doc, blockPos + 1 + offset));
        }
      }
    }
    return true;
  }).run();
}

function footnoteTarget(editor: VueEditor, range?: { from: number; to: number }) {
  const { doc, schema, selection } = editor.state;
  // A normal insertion keeps selected text. Only slash commands replace their query.
  const { from, to } = range ?? { from: selection.to, to: selection.to };
  if (from < 0 || to < from || to > doc.content.size) return;
  const start = doc.resolve(from);
  const end = doc.resolve(to);
  if (!start.sameParent(end) || !start.parent.inlineContent
    || !start.parent.canReplaceWith(start.index(), end.index(), schema.nodes.rcFootnoteRef)) return;
  return { from, to, start };
}

export function insertFootnoteReference(editor: VueEditor, key = '', range?: { from: number; to: number }): boolean {
  const target = footnoteTarget(editor, range);
  if (!target) return false;
  const tr = editor.state.tr.replaceWith(target.from, target.to, editor.state.schema.nodes.rcFootnoteRef.create({ key }));
  tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(target.to)));
  return dispatch(editor, tr);
}

export function insertFootnote(editor: VueEditor, range?: { from: number; to: number }): boolean {
  const key = freshId('note');
  const target = footnoteTarget(editor, range);
  if (!target) return false;
  const { schema, doc } = editor.state;
  const { start } = target;
  const type = schema.nodes.rcFootnote;
  let depth = start.depth;
  while (depth > 0) {
    const index = start.indexAfter(depth - 1);
    if (start.node(depth - 1).canReplaceWith(index, index, type)) break;
    depth--;
  }
  if (depth === 0) return false;
  const names = new Set(footnoteOptions(doc).map(option => option.name));
  let number = names.size + 1;
  while (names.has(`脚注 ${number}`)) number++;
  const definition = type.create({ id: freshId('footnote'), key, name: `脚注 ${number}` }, schema.nodes.paragraph.create());
  const tr = editor.state.tr.replaceWith(target.from, target.to, schema.nodes.rcFootnoteRef.create({ key }));
  const caret = tr.mapping.map(target.to);
  const at = tr.mapping.map(start.after(depth));
  tr.insert(at, definition);
  tr.setSelection(TextSelection.create(tr.doc, caret));
  return dispatch(editor, tr);
}

export function itemLocation(editor: VueEditor, pos: number): { index: number; count: number } {
  if (pos < 0 || pos > editor.state.doc.content.size) return { index: -1, count: 0 };
  const $pos = editor.state.doc.resolve(pos);
  return { index: $pos.index(), count: $pos.parent.childCount };
}

export function removeGroup(editor: VueEditor, pos: number, confirmed = false): boolean {
  const group = nodeAt(editor, pos);
  if (!group || group.type.name !== 'rcGroup' || !confirmed || itemLocation(editor, pos).count <= 1) return false;
  return dispatch(editor, editor.state.tr.delete(pos, pos + group.nodeSize));
}
