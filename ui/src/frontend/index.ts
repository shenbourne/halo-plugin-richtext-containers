import Reveal from 'reveal.js';
import './reveal-scoped.css';
import './style.css';
import '../steps.css';
import { dismissDetachedFootnotePreview, mountFootnotes } from './footnotes';

const ROOT_SELECTOR = '[data-rc-tabs="v1"], [data-rc-slides="v1"], [data-rc-hint="v1"]';
const EDITOR_SELECTOR = '.tiptap, .ProseMirror';

let generatedId = 0;

interface TabItem {
  panel: HTMLElement;
  button: HTMLButtonElement;
  id: string;
  value: string;
}

interface TabController {
  root: HTMLElement;
  items: TabItem[];
  sync: string;
  article: Element | Document;
  activate(index: number, options?: { focus?: boolean; broadcast?: boolean }): void;
  activateValue(value: string): void;
}

interface RevealInstance {
  initialize(): Promise<unknown>;
  configure(options: Record<string, unknown>): void;
  layout(): void;
  destroy(): void;
  on(name: string, listener: (event: { indexh?: number; indexv?: number }) => void): void;
  left(): void;
  right(): void;
  up(): void;
  down(): void;
  next(): void;
  slide(horizontalIndex?: number, verticalIndex?: number): void;
  getHorizontalSlides(): HTMLElement[];
}

interface SlideState {
  root: HTMLElement;
  deck: HTMLElement;
  engine: HTMLElement;
  instance: RevealInstance;
  groups: Array<{ group: HTMLElement; slides: HTMLElement[] }>;
  onFullscreenChange: () => void;
}

const mountedTabs = new WeakSet<HTMLElement>();
const mountedHints = new WeakSet<HTMLElement>();
const slideStates = new WeakMap<HTMLElement, SlideState>();
const articleSyncGroups = new WeakMap<Element | Document, Map<string, Set<TabController>>>();

const hintTitles: Record<string, string> = {
  important: '重要',
  info: '信息',
  note: '注释',
  tip: '提示',
  warning: '注意',
  caution: '警告',
  details: '详情',
};

function directChildren(parent: Element, selector: string): HTMLElement[] {
  return Array.from(parent.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.matches(selector),
  );
}

function rootsWithin(root: ParentNode): HTMLElement[] {
  const roots: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches(ROOT_SELECTOR)) roots.push(root);
  if ('querySelectorAll' in root) {
    roots.push(...Array.from(root.querySelectorAll<HTMLElement>(ROOT_SELECTOR)));
  }
  return roots.filter((candidate, index) => roots.indexOf(candidate) === index);
}

function isInsideEditor(element: Element): boolean {
  return Boolean(element.closest(EDITOR_SELECTOR));
}

function safeBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function articleFor(element: Element): Element | Document {
  return element.closest('article, [data-post-id], [data-content-id]') ?? document;
}

function articleStorageId(article: Element | Document): string {
  if (article instanceof Element) {
    const stableId = article.getAttribute('data-post-id')?.trim()
      || article.getAttribute('data-content-id')?.trim()
      || article.id.trim();
    if (stableId) return stableId;
  }
  return location.pathname;
}

function storageKey(article: Element | Document, sync: string): string {
  return `richtext-containers:tabs:${encodeURIComponent(articleStorageId(article))}:${encodeURIComponent(sync)}`;
}

function readStoredTab(article: Element | Document, sync: string): string | null {
  try {
    return localStorage.getItem(storageKey(article, sync));
  } catch {
    return null;
  }
}

function storeTab(article: Element | Document, sync: string, value: string): void {
  try {
    localStorage.setItem(storageKey(article, sync), value);
  } catch {
    // Storage can be unavailable in privacy modes; switching still works in memory.
  }
}

function refreshDecksWithin(root: ParentNode): void {
  for (const slides of rootsWithin(root).filter((item) => item.matches('[data-rc-slides="v1"]'))) {
    slideStates.get(slides)?.instance.layout();
  }
}

function syncControllers(controller: TabController, value: string): void {
  const groups = articleSyncGroups.get(controller.article)?.get(controller.sync);
  if (!groups) return;
  for (const peer of Array.from(groups)) {
    if (!peer.root.isConnected) groups.delete(peer);
    else if (peer !== controller) peer.activateValue(value);
  }
}

function registerSync(controller: TabController): void {
  if (!controller.sync) return;
  let articleGroups = articleSyncGroups.get(controller.article);
  if (!articleGroups) {
    articleGroups = new Map();
    articleSyncGroups.set(controller.article, articleGroups);
  }
  let group = articleGroups.get(controller.sync);
  if (!group) {
    group = new Set();
    articleGroups.set(controller.sync, group);
  }
  group.add(controller);
}

function mountTabs(root: HTMLElement): void {
  if (mountedTabs.has(root)) return;
  mountedTabs.add(root);
  const panels = directChildren(root, '[data-rc-tab]');
  if (panels.length === 0) return;

  root.classList.add('rc-tabs');
  const tabList = document.createElement('div');
  tabList.className = 'rc-tabs__list';
  tabList.dataset.rcGenerated = 'tablist';
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', '内容选项卡');

  const rootId = `rc-tabs-${++generatedId}`;
  const items: TabItem[] = panels.map((panel, index) => {
    const id = panel.dataset.rcId || `tab-${index + 1}`;
    const title = panel.dataset.rcTitle || `选项卡 ${index + 1}`;
    const value = panel.dataset.rcValue || title;
    const button = document.createElement('button');
    const buttonId = `${rootId}-tab-${index + 1}`;
    const panelId = `${rootId}-panel-${index + 1}`;
    button.type = 'button';
    button.className = 'rc-tabs__tab';
    button.id = buttonId;
    button.textContent = title;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelId);
    button.setAttribute('aria-selected', 'false');
    button.tabIndex = -1;
    panel.classList.add('rc-tabs__panel');
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', buttonId);
    panel.tabIndex = 0;
    tabList.append(button);
    return { panel, button, id, value };
  });

  root.insertBefore(tabList, root.firstChild);
  const article = articleFor(root);
  const sync = root.dataset.rcSync?.trim() ?? '';
  let activeIndex = 0;

  const controller: TabController = {
    root, items, sync, article,
    activate(index, options = {}) {
      if (index < 0 || index >= items.length) return;
      activeIndex = index;
      items.forEach((item, itemIndex) => {
        const selected = itemIndex === activeIndex;
        item.button.setAttribute('aria-selected', String(selected));
        item.button.tabIndex = selected ? 0 : -1;
        item.panel.hidden = !selected;
      });
      const active = items[activeIndex];
      if (options.focus) active.button.focus();
      refreshDecksWithin(active.panel);
      active.panel.dispatchEvent(new CustomEvent('rc:shown', { bubbles: true }));
      if (sync && options.broadcast !== false) {
        storeTab(article, sync, active.value);
        syncControllers(controller, active.value);
      }
    },
    activateValue(value) {
      const index = items.findIndex((item) => item.value === value);
      if (index >= 0) controller.activate(index, { broadcast: false });
    },
  };

  items.forEach((item, index) => {
    item.button.addEventListener('click', () => controller.activate(index));
    item.button.addEventListener('keydown', (event) => {
      let target = activeIndex;
      if (event.key === 'ArrowRight') target = (index + 1) % items.length;
      else if (event.key === 'ArrowLeft') target = (index - 1 + items.length) % items.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = items.length - 1;
      else if (event.key === 'Enter' || event.key === ' ') target = index;
      else return;
      event.preventDefault();
      controller.activate(target, { focus: true });
    });
  });

  registerSync(controller);
  const stored = sync ? readStoredTab(article, sync) : null;
  const defaultId = root.dataset.rcDefault;
  const storedIndex = stored ? items.findIndex((item) => item.value === stored) : -1;
  const defaultIndex = items.findIndex((item) => item.id === defaultId);
  const requested = storedIndex >= 0 ? storedIndex : defaultIndex;
  controller.activate(requested >= 0 ? requested : 0, { broadcast: false });
}

function mountHint(root: HTMLElement): void {
  if (mountedHints.has(root)) return;
  mountedHints.add(root);
  const requestedKind = root.dataset.rcKind ?? 'note';
  const kind = requestedKind in hintTitles ? requestedKind : 'note';
  const title = root.dataset.rcTitle?.trim() || hintTitles[kind];
  root.dataset.rcMountedKind = kind;
  root.classList.add('rc-hint', `rc-hint--${kind}`);

  if (kind === 'details') {
    const body = document.createElement('div');
    const bodyId = `rc-details-${++generatedId}`;
    body.className = 'rc-hint__body';
    body.dataset.rcGenerated = 'body';
    body.id = bodyId;
    while (root.firstChild) body.append(root.firstChild);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'rc-hint__toggle';
    toggle.dataset.rcGenerated = 'title';
    toggle.textContent = title;
    toggle.setAttribute('aria-controls', bodyId);
    let open = safeBoolean(root.dataset.rcOpen, false);
    const render = () => {
      toggle.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
    };
    toggle.addEventListener('click', () => {
      open = !open;
      render();
      if (open) refreshDecksWithin(body);
    });
    root.append(toggle, body);
    render();
    return;
  }

  const heading = document.createElement('div');
  heading.className = 'rc-hint__title';
  heading.dataset.rcGenerated = 'title';
  heading.textContent = title;
  root.insertBefore(heading, root.firstChild);
}

function applySlideTheme(root: HTMLElement): void {
  const requested = root.dataset.rcTheme;
  const theme = requested === 'light' || requested === 'dark' ? requested : 'auto';
  root.classList.remove('rc-slides--auto', 'rc-slides--light', 'rc-slides--dark');
  root.classList.add(`rc-slides--${theme}`);
}

function mountSlideTitle(slide: HTMLElement): void {
  const title = slide.dataset.rcTitle?.trim();
  if (!title || directChildren(slide, '[data-rc-generated="slide-title"]').length > 0) return;
  const heading = document.createElement('h2');
  heading.className = 'rc-slides__title';
  heading.dataset.rcGenerated = 'slide-title';
  heading.textContent = title;
  slide.insertBefore(heading, slide.firstChild);
}

function showSlide(state: SlideState, horizontal = 0, vertical = 0): void {
  state.groups.forEach(({ group, slides }, groupIndex) => {
    const activeGroup = groupIndex === horizontal;
    group.hidden = !activeGroup;
    slides.forEach((slide, slideIndex) => {
      const active = activeGroup && slideIndex === vertical;
      slide.hidden = !active;
      slide.setAttribute('aria-hidden', String(!active));
    });
  });
  const active = state.groups[horizontal]?.slides[vertical] ?? state.groups[horizontal]?.slides[0];
  if (active) {
    active.classList.remove('rc-slides__slide--enter');
    void active.offsetWidth;
    active.classList.add('rc-slides__slide--enter');
    refreshDecksWithin(active);
    active.dispatchEvent(new CustomEvent('rc:shown', { bubbles: true }));
  }
}

async function mountSlides(root: HTMLElement): Promise<void> {
  if (slideStates.has(root)) return;
  const groupElements = directChildren(root, '[data-rc-group]');
  const groups = groupElements.map((group) => ({
    group,
    slides: directChildren(group, '[data-rc-slide]'),
  })).filter(({ slides }) => slides.length > 0);
  if (groups.length === 0) return;

  root.classList.add('rc-slides');
  applySlideTheme(root);
  const deck = document.createElement('div');
  deck.className = 'rc-slides__deck';
  deck.dataset.rcGenerated = 'deck';
  const toolbar = document.createElement('div');
  toolbar.className = 'rc-slides__toolbar';
  toolbar.dataset.rcGenerated = 'toolbar';
  const fullscreen = document.createElement('button');
  fullscreen.type = 'button';
  fullscreen.className = 'rc-slides__fullscreen';
  fullscreen.dataset.rcAction = 'fullscreen';
  fullscreen.textContent = '全屏';
  fullscreen.setAttribute('aria-label', '全屏显示演示');
  toolbar.append(fullscreen);

  const engine = document.createElement('div');
  engine.className = 'reveal rc-slides__engine';
  engine.dataset.rcGenerated = 'engine';
  engine.tabIndex = 0;
  engine.setAttribute('aria-label', '演示导航');
  const skeleton = document.createElement('div');
  skeleton.className = 'slides';
  skeleton.setAttribute('aria-hidden', 'true');
  groups.forEach(({ slides }) => {
    if (slides.length === 1) skeleton.append(document.createElement('section'));
    else {
      const stack = document.createElement('section');
      slides.forEach(() => stack.append(document.createElement('section')));
      skeleton.append(stack);
    }
  });
  engine.append(skeleton);

  const content = document.createElement('div');
  content.className = 'rc-slides__content';
  content.dataset.rcGenerated = 'content';
  groups.forEach(({ group, slides }) => {
    group.classList.add('rc-slides__group');
    slides.forEach((slide) => {
      slide.classList.add('rc-slides__slide');
      mountSlideTitle(slide);
    });
    content.append(group);
  });
  deck.append(toolbar, engine, content);
  root.append(deck);

  const transition = root.dataset.rcTransition;
  const options: Reveal.Options = {
    embedded: true,
    // Original content lives beside the engine; keep navigation in slide mode on narrow screens.
    scrollActivationWidth: 0,
    hash: false,
    history: false,
    keyboard: false,
    transition: transition === 'none' || transition === 'fade' ? transition : 'slide',
    slideNumber: safeBoolean(root.dataset.rcNumbers, true),
    progress: safeBoolean(root.dataset.rcProgress, true),
    controls: safeBoolean(root.dataset.rcControls, true),
  };
  const instance = new Reveal(engine, options) as unknown as RevealInstance;
  const onFullscreenChange = () => {
    fullscreen.textContent = document.fullscreenElement === deck ? '退出全屏' : '全屏';
    instance.layout();
  };
  const state: SlideState = { root, deck, engine, instance, groups, onFullscreenChange };
  slideStates.set(root, state);
  instance.on('slidechanged', (event) => showSlide(state, event.indexh ?? 0, event.indexv ?? 0));
  showSlide(state);
  engine.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing || event.target !== engine || document.activeElement !== engine) return;
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key;
    if (key === 'ArrowRight') {
      event.preventDefault();
      instance.right();
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      instance.left();
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      instance.up();
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      instance.down();
    } else if (key === 'Home') {
      event.preventDefault();
      instance.slide(0, 0);
    } else if (key === 'End') {
      event.preventDefault();
      const lastGroup = groups.length - 1;
      instance.slide(lastGroup, groups[lastGroup].slides.length - 1);
    } else if (key === ' ') {
      event.preventDefault();
      instance.next();
    } else if (key === 'f' || key === 'F') {
      event.preventDefault();
      fullscreen.click();
    }
  });
  deck.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('.rc-slides__deck') !== deck) return;
    if (!target.closest('a, button, input, select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])')) {
      engine.focus({ preventScroll: true });
    }
  });
  fullscreen.addEventListener('click', async () => {
    if (document.fullscreenElement === deck && document.exitFullscreen) await document.exitFullscreen();
    else if (deck.requestFullscreen) await deck.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', onFullscreenChange);
  await instance.initialize();
}

function refreshMountedRoot(root: HTMLElement): void {
  if (!root.matches('[data-rc-slides="v1"]')) return;
  applySlideTheme(root);
  const state = slideStates.get(root);
  if (!state) return;
  const transition = root.dataset.rcTransition;
  state.instance.configure({
    transition: transition === 'none' || transition === 'fade' ? transition : 'slide',
    slideNumber: safeBoolean(root.dataset.rcNumbers, true),
    progress: safeBoolean(root.dataset.rcProgress, true),
    controls: safeBoolean(root.dataset.rcControls, true),
  });
  state.instance.layout();
}

export async function mountContainers(root: ParentNode = document): Promise<void> {
  if (root instanceof Element && isInsideEditor(root)) return;
  mountFootnotes(root);
  const roots = rootsWithin(root).filter((candidate) => !isInsideEditor(candidate));
  const initializations: Promise<void>[] = [];
  for (const candidate of roots) {
    if (candidate.matches('[data-rc-tabs="v1"]')) mountTabs(candidate);
    else if (candidate.matches('[data-rc-hint="v1"]')) mountHint(candidate);
    else if (candidate.matches('[data-rc-slides="v1"]')) initializations.push(mountSlides(candidate));
  }
  await Promise.all(initializations);
}

function destroySlidesWithin(root: Node): void {
  if (typeof Element === 'undefined' || !(root instanceof Element)) return;
  const candidates = [
    ...(root.matches('[data-rc-slides="v1"]') ? [root as HTMLElement] : []),
    ...Array.from(root.querySelectorAll<HTMLElement>('[data-rc-slides="v1"]')),
  ];
  for (const candidate of candidates) {
    if (candidate.isConnected) continue;
    const state = slideStates.get(candidate);
    if (!state) continue;
    document.removeEventListener('fullscreenchange', state.onFullscreenChange);
    state.instance.destroy();
    for (const { group, slides } of state.groups) {
      group.hidden = false;
      group.classList.remove('rc-slides__group');
      for (const slide of slides) {
        slide.hidden = false;
        slide.removeAttribute('aria-hidden');
        slide.classList.remove('rc-slides__slide', 'rc-slides__slide--enter');
        directChildren(slide, '[data-rc-generated="slide-title"]').forEach((title) => title.remove());
      }
      candidate.insertBefore(group, state.deck);
    }
    state.deck.remove();
    candidate.classList.remove('rc-slides', 'rc-slides--auto', 'rc-slides--light', 'rc-slides--dark');
    slideStates.delete(candidate);
  }
}

function startAutomaticMounting(): void {
  void mountContainers(document);
  const observer = new MutationObserver((records) => {
    if (typeof Element === 'undefined') {
      observer.disconnect();
      return;
    }
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLElement) {
        refreshMountedRoot(record.target);
        continue;
      }
      record.addedNodes.forEach((node) => {
        if (node instanceof Element && !isInsideEditor(node) && !node.closest('[data-rc-footnotes-list]')) {
          void mountContainers(node);
        }
      });
      record.removedNodes.forEach(destroySlidesWithin);
    }
    dismissDetachedFootnotePreview();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-rc-theme', 'data-rc-transition', 'data-rc-numbers', 'data-rc-progress', 'data-rc-controls'],
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAutomaticMounting, { once: true });
  } else {
    queueMicrotask(startAutomaticMounting);
  }
}
