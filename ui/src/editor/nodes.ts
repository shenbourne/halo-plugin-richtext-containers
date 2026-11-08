import {
  Extension,
  Node,
  Plugin,
  PluginKey,
  VueNodeViewRenderer,
  type AnyExtension,
  type VueEditor,
} from '@halo-dev/richtext-editor';
import { createHint, createSlides, createTabs } from './model';
import { insertContainer, insertFootnote, insertFootnoteReference } from './commands';
import RcTabs from './views/RcTabs.vue';
import RcTab from './views/RcTab.vue';
import RcSlides from './views/RcSlides.vue';
import RcGroup from './views/RcGroup.vue';
import RcSlide from './views/RcSlide.vue';
import RcHint from './views/RcHint.vue';
import RcFootnote from './views/RcFootnote.vue';
import RcFootnoteRef from './views/RcFootnoteRef.vue';
import ToolboxItem from './views/ToolboxItem.vue';
import ContainerIcon from './views/ContainerIcon.vue';
import FootnoteIcon from './views/FootnoteIcon.vue';
import './style.css';

const KINDS = ['important','info','note','tip','warning','caution','details'] as const;
const THEMES = ['auto','light','dark'] as const;
function syncChoices() {
  return {
    default: [],
    parseHTML(el: HTMLElement) {
      try {
        const list: unknown = JSON.parse(el.getAttribute('data-rc-sync-choices') ?? '[]');
        return Array.isArray(list) ? [...new Set(list.map(item => safeText(item).trim()).filter(Boolean))] : [];
      } catch { return []; }
    },
    renderHTML: (attrs: Record<string, unknown>) => Array.isArray(attrs.syncChoices) && attrs.syncChoices.length
      ? { 'data-rc-sync-choices': JSON.stringify(attrs.syncChoices) } : {},
  };
}
const TRANSITIONS = ['none','slide','fade'] as const;

function safeText(value: unknown, fallback = '', limit = 180): string {
  const s = typeof value === 'string' ? value : fallback;
  return s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit);
}
function safeBool(value: unknown, fallback = false): boolean {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return fallback;
}
function safeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}
function attr(name: string, key: string, def: unknown, parse: (el: HTMLElement) => unknown = () => undefined) {
  return {
    default: def,
    parseHTML: (el: HTMLElement) => parse(el),
    renderHTML: (attrs: Record<string, unknown>) => ({ [`data-rc-${name}`]: String(attrs[key]) }),
  };
}

const RcTabsNode = Node.create({
  name: 'rcTabs',
  group: 'block',
  content: 'rcTab+',
  isolating: true,
  addAttributes() {
    return {
      id: attr('id', 'id', '', el => safeText(el.getAttribute('data-rc-id'))),
      defaultId: attr('default', 'defaultId', '', el => safeText(el.getAttribute('data-rc-default'))),
      sync: attr('sync', 'sync', '', el => safeText(el.getAttribute('data-rc-sync'))),
      syncChoices: syncChoices(),
      value: attr('value', 'value', '', el => safeText(el.getAttribute('data-rc-value'))),
    };
  },
  parseHTML() { return [{ tag: 'div[data-rc-tabs]', getAttrs: el => (el as HTMLElement).getAttribute('data-rc-tabs') === 'v1' ? {} : false }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { ...HTMLAttributes, 'data-rc-tabs': 'v1' }, 0]; },
  addNodeView() { return VueNodeViewRenderer(RcTabs); },
});

const RcTabNode = Node.create({
  name: 'rcTab',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return {
      id: attr('id', 'id', '', el => safeText(el.getAttribute('data-rc-id'))),
      title: attr('title', 'title', '', el => safeText(el.getAttribute('data-rc-title'))),
      value: attr('value', 'value', '', el => safeText(el.getAttribute('data-rc-value'))),
      syncChoices: syncChoices(),
    };
  },
  parseHTML() { return [{ tag: 'div[data-rc-tab]', getAttrs: el => (el as HTMLElement).getAttribute('data-rc-tab') === 'v1' ? {} : false }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { ...HTMLAttributes, 'data-rc-tab': 'v1' }, 0]; },
  addNodeView() { return VueNodeViewRenderer(RcTab); },
});

const RcSlidesNode = Node.create({
  name: 'rcSlides',
  group: 'block',
  content: 'rcGroup+',
  isolating: true,
  addAttributes() {
    return {
      id: attr('id', 'id', '', el => safeText(el.getAttribute('data-rc-id'))),
      theme: attr('theme', 'theme', 'auto', el => safeEnum(el.getAttribute('data-rc-theme'), THEMES, 'auto')),
      transition: attr('transition', 'transition', 'slide', el => safeEnum(el.getAttribute('data-rc-transition'), TRANSITIONS, 'slide')),
      numbers: attr('numbers', 'numbers', true, el => safeBool(el.getAttribute('data-rc-numbers'), true)),
      progress: attr('progress', 'progress', false, el => safeBool(el.getAttribute('data-rc-progress'), false)),
      controls: attr('controls', 'controls', true, el => safeBool(el.getAttribute('data-rc-controls'), true)),
    };
  },
  parseHTML() { return [{ tag: 'div[data-rc-slides]', getAttrs: el => (el as HTMLElement).getAttribute('data-rc-slides') === 'v1' ? {} : false }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { ...HTMLAttributes, 'data-rc-slides': 'v1' }, 0]; },
  addNodeView() { return VueNodeViewRenderer(RcSlides); },
});

const RcGroupNode = Node.create({
  name: 'rcGroup',
  content: 'rcSlide+',
  isolating: true,
  addAttributes() { return { id: attr('id', 'id', '', el => safeText(el.getAttribute('data-rc-id'))) }; },
  parseHTML() { return [{ tag: 'div[data-rc-group]', getAttrs: el => (el as HTMLElement).getAttribute('data-rc-group') === 'v1' ? {} : false }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { ...HTMLAttributes, 'data-rc-group': 'v1' }, 0]; },
  addNodeView() { return VueNodeViewRenderer(RcGroup); },
});

const RcSlideNode = Node.create({
  name: 'rcSlide',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return {
      id: attr('id', 'id', '', el => safeText(el.getAttribute('data-rc-id'))),
      title: attr('title', 'title', '', el => safeText(el.getAttribute('data-rc-title'))),
    };
  },
  parseHTML() { return [{ tag: 'div[data-rc-slide]', getAttrs: el => (el as HTMLElement).getAttribute('data-rc-slide') === 'v1' ? {} : false }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { ...HTMLAttributes, 'data-rc-slide': 'v1' }, 0]; },
  addNodeView() { return VueNodeViewRenderer(RcSlide); },
});

const RcHintNode = Node.create({
  name: 'rcHint',
  group: 'block',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return {
      id: attr('id', 'id', '', el => safeText(el.getAttribute('data-rc-id'))),
      title: attr('title', 'title', '', el => safeText(el.getAttribute('data-rc-title'))),
      kind: attr('kind', 'kind', 'info', el => safeEnum(el.getAttribute('data-rc-kind'), KINDS, 'info')),
      open: attr('open', 'open', false, el => safeBool(el.getAttribute('data-rc-open'), false)),
    };
  },
  parseHTML() { return [{ tag: 'aside[data-rc-hint]', getAttrs: el => (el as HTMLElement).getAttribute('data-rc-hint') === 'v1' ? {} : false }]; },
  renderHTML({ HTMLAttributes }) { return ['aside', { ...HTMLAttributes, 'data-rc-hint': 'v1' }, 0]; },
  addNodeView() { return VueNodeViewRenderer(RcHint); },
});

const RcFootnoteRefNode = Node.create({
  name: 'rcFootnoteRef',
  priority: 1000,
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  addAttributes() {
    return { key: attr('key', 'key', '', el => safeText(el.getAttribute('data-rc-key'), '', 96)) };
  },
  parseHTML() {
    return [{ tag: 'span[data-rc-footnote-ref]', getAttrs: el => (el as HTMLElement).getAttribute('data-rc-footnote-ref') === 'v1' ? {} : false }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, 'data-rc-footnote-ref': 'v1' }];
  },
  addNodeView() { return VueNodeViewRenderer(RcFootnoteRef); },
});

const RcFootnoteNode = Node.create({
  name: 'rcFootnote',
  group: 'block',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return {
      id: attr('id', 'id', '', el => safeText(el.getAttribute('data-rc-id'))),
      key: attr('key', 'key', '', el => safeText(el.getAttribute('data-rc-key'), '', 96)),
      name: {
        default: '',
        parseHTML: (el: HTMLElement) => safeText(el.getAttribute('data-rc-name'), '', 96),
        renderHTML: (attrs: Record<string, unknown>) => attrs.name ? { 'data-rc-name': attrs.name } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'aside[data-rc-footnote]', getAttrs: el => (el as HTMLElement).getAttribute('data-rc-footnote') === 'v1' ? {} : false }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', { ...HTMLAttributes, 'data-rc-footnote': 'v1' }, 0];
  },
  addNodeView() { return VueNodeViewRenderer(RcFootnote); },
});

function normalizeIds(doc: any) {
  const seen = new Set<string>();
  const reserved = new Set<string>();
  const changes = new Map<number, string>();
  doc.descendants((node: any) => { if (node.type.name.startsWith('rc')) reserved.add(node.attrs.id); });
  doc.descendants((node: any, pos: number) => {
    if (!node.type.name.startsWith('rc') || node.attrs.id === undefined) return true;
    const old = safeText(node.attrs.id);
    let next = old || `${node.type.name}-${pos}`;
    if (seen.has(next)) {
      const base = `${next}-copy`;
      next = base;
      let suffix = 1;
      while (seen.has(next) || reserved.has(next)) next = `${base}-${++suffix}`;
    }
    seen.add(next);
    if (next !== node.attrs.id) changes.set(pos, next);
    return true;
  });
  return changes;
}

const StableIds = Extension.create({
  name: 'rcContainersStableIds',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('rcContainersStableIds'),
      appendTransaction(transactions, _oldState, newState) {
        if (!transactions.some((tr: any) => tr.docChanged)) return null;
        const changes = normalizeIds(newState.doc);
        const tr = newState.tr;
        for (const [pos, id] of changes) {
          const node = tr.doc.nodeAt(pos);
          if (node) tr.setNodeMarkup(pos, null, { ...node.attrs, id });
        }
        newState.doc.descendants((node: any, pos: number) => {
          if (node.type.name !== 'rcTabs') return;
          let defaultId: string | undefined;
          node.forEach((child: any, offset: number) => {
            if (defaultId === undefined && child.attrs.id === node.attrs.defaultId) defaultId = changes.get(pos + 1 + offset) ?? child.attrs.id;
          });
          defaultId ??= changes.get(pos + 1) ?? node.firstChild?.attrs.id;
          const current = tr.doc.nodeAt(pos);
          if (current && defaultId !== current.attrs.defaultId) tr.setNodeMarkup(pos, null, { ...current.attrs, defaultId });
        });
        return tr.docChanged ? tr : null;
      },
    })];
  },
});

const Menus = Extension.create({
  name: 'rcContainersMenus',
  addOptions() {
    return {
      getToolboxItems({ editor }: { editor: VueEditor }) {
        return [
          { priority: 300, component: ToolboxItem, props: { editor, icon: ContainerIcon, title: '选项卡', action: () => insertContainer(editor, createTabs) } },
          { priority: 301, component: ToolboxItem, props: { editor, icon: ContainerIcon, title: '幻灯片', action: () => insertContainer(editor, createSlides) } },
          { priority: 302, component: ToolboxItem, props: { editor, icon: ContainerIcon, title: '提示容器', action: () => insertContainer(editor, createHint) } },
          { priority: 303, component: ToolboxItem, props: { editor, icon: FootnoteIcon, title: '脚注', action: () => insertFootnote(editor) } },
          { priority: 304, component: ToolboxItem, props: { editor, icon: FootnoteIcon, title: '脚注引用', action: () => insertFootnoteReference(editor) } },
        ];
      },
      getCommandMenuItems() {
        return [
          { priority: 300, icon: ContainerIcon, title: '选项卡容器', keywords: ['tabs', 'xuanxiangka', '选项卡'], command: ({ editor, range }: any) => insertContainer(editor, createTabs, range) },
          { priority: 301, icon: ContainerIcon, title: '幻灯片容器', keywords: ['slides', 'huandengpian', '幻灯片'], command: ({ editor, range }: any) => insertContainer(editor, createSlides, range) },
          { priority: 302, icon: ContainerIcon, title: '提示容器', keywords: ['hint', 'tishi', '提示'], command: ({ editor, range }: any) => insertContainer(editor, createHint, range) },
          { priority: 303, icon: FootnoteIcon, title: '脚注', keywords: ['footnote', 'jiaozhu', '脚注'], command: ({ editor, range }: any) => insertFootnote(editor, range) },
          { priority: 304, icon: FootnoteIcon, title: '脚注引用', keywords: ['footnote reference', 'jiaozhu yinyong', '脚注引用'], command: ({ editor, range }: any) => insertFootnoteReference(editor, undefined, range) },
        ];
      },
    };
  },
});

export function createContainerExtensions(): AnyExtension[] {
  return [RcTabsNode, RcTabNode, RcSlidesNode, RcGroupNode, RcSlideNode, RcHintNode, RcFootnoteNode, RcFootnoteRefNode, StableIds, Menus];
}
