const REF_SELECTOR = 'span[data-rc-footnote-ref="v1"]';
const DEFINITION_SELECTOR = 'aside[data-rc-footnote="v1"]';
const LIST_SELECTOR = '[data-rc-footnotes-list]';
const EDITOR_SELECTOR = '.tiptap, .ProseMirror';
const CONTENT_SELECTOR = '[data-rc-content], [itemprop="articleBody"], #post-content, #article-content, .post-content, .article-content, .entry-content, .post-body, .page-content, .markdown-body';
const PAGE_CHROME_SELECTOR = 'footer, nav, aside:not([data-rc-footnote]), [role="complementary"], #comments, #comment, .comments, .post-comments, .post-reactions, halo-comment-widget';

let generatedId = 0;
let activePreview: { anchor: HTMLAnchorElement; dismiss: () => void } | undefined;

type Scope = Element | Document;

function isEditorElement(element: Element): boolean {
  return Boolean(element.closest(EDITOR_SELECTOR));
}

function elementsWithin(root: ParentNode, selector: string): Element[] {
  const elements = 'querySelectorAll' in root
    ? Array.from(root.querySelectorAll(selector))
    : [];
  if (root instanceof Element && root.matches(selector)) elements.unshift(root);
  return Array.from(new Set(elements)).filter(element => !isEditorElement(element));
}

function scopeFor(element: Element): Scope {
  return element.closest(CONTENT_SELECTOR)
    ?? element.closest('article, [data-post-id], [data-content-id], main')
    ?? document;
}

function placeList(section: HTMLElement, scope: Scope, markers: Element[]): void {
  if (scope instanceof Element && scope.matches(CONTENT_SELECTOR)) {
    scope.append(section);
    return;
  }
  // A theme may put the reader body, reactions and comments in the same article.
  let content = markers[0].parentElement;
  while (content && !markers.every(marker => content!.contains(marker))) content = content.parentElement;
  if (content && content !== document.body && content !== document.documentElement && content !== scope) {
    content.append(section);
    return;
  }
  // Without a dedicated wrapper, stop at recognizable page chrome.
  const boundary = scope instanceof Element ? scope : document.body;
  let lastBlock = markers[markers.length - 1];
  while (lastBlock.parentElement && lastBlock.parentElement !== boundary) lastBlock = lastBlock.parentElement;
  if (scope instanceof Element) {
    while (lastBlock.nextElementSibling && !lastBlock.nextElementSibling.matches(PAGE_CHROME_SELECTOR)) {
      lastBlock = lastBlock.nextElementSibling;
    }
  }
  lastBlock.after(section);
}

export function dismissDetachedFootnotePreview(): void {
  if (activePreview && !activePreview.anchor.isConnected) activePreview.dismiss();
}

function attachPreview(link: HTMLAnchorElement, definition: HTMLElement): void {
  let hovered = false;
  let focused = false;
  const show = () => {
    if (activePreview?.anchor === link) return;
    const copy = definition.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[data-rc-footnote-generated], [data-rc-footnote-ref], script, style, template').forEach(node => node.remove());
    const content = [...copy.childNodes].map(node => node.textContent?.trim()).filter(Boolean).join('\n');
    if (!content) return;
    activePreview?.dismiss();
    const preview = document.createElement('div');
    preview.className = 'rc-footnote-preview';
    preview.id = `rc-footnote-preview-${++generatedId}`;
    preview.setAttribute('role', 'tooltip');
    preview.textContent = content;
    document.body.append(preview);
    link.setAttribute('aria-describedby', preview.id);
    const anchor = link.getBoundingClientRect();
    const bounds = preview.getBoundingClientRect();
    preview.style.left = `${Math.max(8, Math.min(anchor.left, document.documentElement.clientWidth - bounds.width - 8))}px`;
    const top = anchor.bottom + bounds.height + 8 > window.innerHeight ? anchor.top - bounds.height - 6 : anchor.bottom + 6;
    preview.style.top = `${Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8))}px`;
    const dismiss = () => {
      preview.remove();
      link.removeAttribute('aria-describedby');
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      if (activePreview?.anchor === link) activePreview = undefined;
    };
    activePreview = { anchor: link, dismiss };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
  };
  const hide = () => {
    if (activePreview?.anchor === link) activePreview.dismiss();
  };
  link.addEventListener('pointerenter', () => { hovered = true; show(); });
  link.addEventListener('pointerleave', () => { hovered = false; if (!focused) hide(); });
  link.addEventListener('focus', () => { focused = true; show(); });
  link.addEventListener('blur', () => { focused = false; if (!hovered) hide(); });
  link.addEventListener('click', hide);
  link.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
}

function cleanKey(element: Element): string {
  return (element.getAttribute('data-rc-key') ?? '').trim().slice(0, 96);
}

function generated(attribute: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.dataset.rcFootnoteGenerated = attribute;
  return element;
}

function removeGenerated(definition: HTMLElement): void {
  definition.querySelectorAll('[data-rc-footnote-generated]').forEach(element => element.remove());
  definition.classList.remove('rc-footnote--duplicate');
  definition.removeAttribute('hidden');
  definition.removeAttribute('aria-hidden');
  definition.removeAttribute('role');
  definition.removeAttribute('tabindex');
}

function renderScope(scope: Scope, refs: Element[], definitions: Element[]): void {
  for (const definition of definitions as HTMLElement[]) removeGenerated(definition);

  const byKey = new Map<string, HTMLElement>();
  const primaryByKey = new Map<string, HTMLElement>();
  for (const definition of definitions as HTMLElement[]) {
    const key = cleanKey(definition);
    if (key && definition.dataset.rcFootnotePrimary === 'true' && !primaryByKey.has(key)) {
      primaryByKey.set(key, definition);
    }
  }

  for (const definition of definitions as HTMLElement[]) {
    const key = cleanKey(definition);
    if (!key) continue;
    const primary = primaryByKey.get(key) ?? definition;
    if (!primaryByKey.has(key)) {
      primaryByKey.set(key, primary);
      primary.dataset.rcFootnotePrimary = 'true';
    }
    if (primary !== definition) {
      delete definition.dataset.rcFootnotePrimary;
      definition.classList.add('rc-footnote--duplicate');
      definition.setAttribute('hidden', '');
      definition.setAttribute('aria-hidden', 'true');
    } else {
      byKey.set(key, primary);
    }
  }

  const numberByKey = new Map<string, number>();
  const refsByKey = new Map<string, HTMLElement[]>();
  for (const ref of refs as HTMLElement[]) {
    const key = cleanKey(ref);
    if (!key || !byKey.has(key)) {
      ref.classList.add('rc-footnote-ref--missing');
      ref.dataset.rcFootnoteStatus = 'missing';
      ref.setAttribute('title', '脚注定义尚未创建');
      ref.replaceChildren(document.createTextNode('?'));
      continue;
    }
    if (!numberByKey.has(key)) numberByKey.set(key, numberByKey.size + 1);
    const group = refsByKey.get(key) ?? [];
    group.push(ref);
    refsByKey.set(key, group);
  }

  if (numberByKey.size === 0) return;
  let section = Array.from(scope.querySelectorAll<HTMLElement>(LIST_SELECTOR))
    .find(candidate => scopeFor(candidate) === scope);
  if (!section) {
    section = document.createElement('section');
    section.dataset.rcFootnotesList = 'v1';
    const markers = [...refs, ...definitions].sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    placeList(section, scope, markers);
  }
  section.className = 'rc-footnotes';
  section.setAttribute('role', 'doc-endnotes');
  section.setAttribute('aria-label', '脚注');

  const heading = document.createElement('h2');
  heading.className = 'rc-footnotes__title';
  heading.textContent = '脚注';
  section.replaceChildren(heading);

  for (const [key, number] of numberByKey) {
    const definition = byKey.get(key)!;
    const noteId = `rc-footnote-${++generatedId}`;
    const definitionRefs = refsByKey.get(key) ?? [];
    const backlinks = generated('backlinks');
    backlinks.className = 'rc-footnote__backlinks';
    backlinks.setAttribute('aria-label', '返回正文引用');
    definitionRefs.forEach((ref, index) => {
      const referenceId = `rc-footnote-reference-${++generatedId}`;
      const link = document.createElement('a');
      link.href = `#${noteId}`;
      link.id = referenceId;
      link.setAttribute('role', 'doc-noteref');
      link.setAttribute('aria-label', `转到脚注 ${number}`);
      link.textContent = `[${number}]`;
      attachPreview(link, definition);
      ref.classList.remove('rc-footnote-ref--missing');
      ref.removeAttribute('data-rc-footnote-status');
      ref.replaceChildren(link);

      const backlink = document.createElement('a');
      backlink.href = `#${referenceId}`;
      backlink.dataset.rcGenerated = 'backlink';
      backlink.setAttribute('role', 'doc-backlink');
      backlink.setAttribute('aria-label', `返回引用 ${number}.${index + 1}`);
      backlink.title = `返回引用 ${number}.${index + 1}`;
      backlink.textContent = '↩';
      backlinks.append(backlink);
    });

    removeGenerated(definition);
    const marker = generated('number');
    marker.className = 'rc-footnote__number';
    marker.textContent = `${number}.`;
    definition.prepend(marker);
    definition.append(backlinks);
    definition.id = noteId;
    definition.classList.add('rc-footnote');
    definition.setAttribute('role', 'doc-footnote');
    definition.setAttribute('tabindex', '-1');
    definition.setAttribute('aria-label', `脚注 ${number}`);
    section.append(definition);
  }
  dismissDetachedFootnotePreview();
}

export function mountFootnotes(root: ParentNode = document): void {
  if (root instanceof Element && isEditorElement(root)) return;
  const refs = elementsWithin(root, REF_SELECTOR);
  const definitions = elementsWithin(root, DEFINITION_SELECTOR);
  if (refs.length === 0 && definitions.length === 0) return;

  const scopes = new Set([...refs, ...definitions].map(scopeFor));
  for (const scope of scopes) {
    const scopedRefs = elementsWithin(scope, REF_SELECTOR).filter(element => scopeFor(element) === scope);
    const scopedDefinitions = elementsWithin(scope, DEFINITION_SELECTOR).filter(element => scopeFor(element) === scope);
    renderScope(scope, scopedRefs, scopedDefinitions);
  }
}
