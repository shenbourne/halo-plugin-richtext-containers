import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revealState = vi.hoisted(() => ({
  instances: [] as Array<{
    root: HTMLElement;
    options: Record<string, unknown>;
    initialize: ReturnType<typeof vi.fn>;
    layout: ReturnType<typeof vi.fn>;
    configure: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    emit: (name: string, event: Record<string, unknown>) => void;
  }>,
}));

vi.mock('reveal.js', () => ({
  default: class FakeReveal {
    root: HTMLElement;
    options: Record<string, unknown>;
    initialize = vi.fn(async () => undefined);
    layout = vi.fn();
    configure = vi.fn();
    destroy = vi.fn();
    left = vi.fn();
    right = vi.fn();
    up = vi.fn();
    down = vi.fn();
    next = vi.fn();
    slide = vi.fn();
    getHorizontalSlides = () => Array.from(this.root.querySelectorAll<HTMLElement>('.slides > section'));
    listeners = new Map<string, (event: Record<string, unknown>) => void>();
    on = vi.fn((name: string, listener: (event: Record<string, unknown>) => void) => {
      this.listeners.set(name, listener);
    });

    emit(name: string, event: Record<string, unknown>) {
      this.listeners.get(name)?.(event);
    }

    constructor(root: HTMLElement, options: Record<string, unknown>) {
      this.root = root;
      this.options = options;
      revealState.instances.push(this);
    }
  },
}));

import { mountContainers } from '../src/frontend/index';

const settle = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('frontend rich-text containers', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.body.removeAttribute('class');
    localStorage.clear();
    revealState.instances.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts direct tab children once, selects the declared default, and preserves body nodes', async () => {
    document.body.innerHTML = `
      <div data-rc-tabs="v1" data-rc-default="second">
        <div data-rc-tab="v1" data-rc-id="first" data-rc-title="<b>Unsafe</b>"><p id="kept">First body</p></div>
        <div data-rc-tab="v1" data-rc-id="second" data-rc-title="Second"><p>Second body</p></div>
        <div><div data-rc-tab="v1" data-rc-id="nested-nope" data-rc-title="Not owned"></div></div>
      </div>`;
    const kept = document.querySelector('#kept');

    await mountContainers(document);
    await mountContainers(document);

    const root = document.querySelector<HTMLElement>('[data-rc-tabs]')!;
    const tabs = Array.from(root.querySelectorAll<HTMLElement>(':scope > [role="tabpanel"]'));
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(':scope > [role="tablist"] > [role="tab"]'));
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe('<b>Unsafe</b>');
    expect(buttons[0].querySelector('b')).toBeNull();
    expect(buttons[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs.map((panel) => panel.hidden)).toEqual([true, false]);
    expect(document.querySelector('#kept')).toBe(kept);
    expect(root.querySelectorAll(':scope > [role="tablist"]')).toHaveLength(1);
  });

  it('supports tab keyboard navigation, same-article synchronization, persistence, and duplicate labels in independent groups', async () => {
    document.body.innerHTML = `
      <article id="article-a">
        <div data-rc-tabs="v1" data-rc-sync="language">
          <div data-rc-tab="v1" data-rc-id="a1" data-rc-title="Same" data-rc-value="cn"><p>A CN</p></div>
          <div data-rc-tab="v1" data-rc-id="a2" data-rc-title="Same" data-rc-value="en"><p>A EN</p></div>
        </div>
        <div data-rc-tabs="v1" data-rc-sync="language">
          <div data-rc-tab="v1" data-rc-id="b1" data-rc-title="中文" data-rc-value="cn"><p>B CN</p></div>
          <div data-rc-tab="v1" data-rc-id="b2" data-rc-title="English" data-rc-value="en"><p>B EN</p></div>
        </div>
        <div data-rc-tabs="v1">
          <div data-rc-tab="v1" data-rc-id="c1" data-rc-title="Same"><p>C1</p></div>
          <div data-rc-tab="v1" data-rc-id="c2" data-rc-title="Same"><p>C2</p></div>
        </div>
      </article>
      <article id="article-b">
        <div data-rc-tabs="v1" data-rc-sync="language">
          <div data-rc-tab="v1" data-rc-id="d1" data-rc-title="中文" data-rc-value="cn"><p>D CN</p></div>
          <div data-rc-tab="v1" data-rc-id="d2" data-rc-title="English" data-rc-value="en"><p>D EN</p></div>
        </div>
      </article>`;

    await mountContainers(document);
    const articleA = document.querySelector('#article-a')!;
    const groups = articleA.querySelectorAll<HTMLElement>('[data-rc-tabs="v1"]');
    const firstButtons = groups[0].querySelectorAll<HTMLButtonElement>('[role="tab"]');
    firstButtons[0].focus();
    firstButtons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(document.activeElement).toBe(firstButtons[1]);
    expect(firstButtons[1].getAttribute('aria-selected')).toBe('true');
    expect(groups[1].querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
    expect(groups[2].querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(groups[2].querySelectorAll('[role="tab"]')[0].textContent).toBe('Same');
    expect(groups[2].querySelectorAll('[role="tab"]')[1].textContent).toBe('Same');
    expect(document.querySelector('#article-b [role="tab"]')?.getAttribute('aria-selected')).toBe('true');
    expect(Object.values(localStorage).some((value) => value === 'en')).toBe(true);

    document.body.innerHTML = `<article id="article-a"><div data-rc-tabs="v1" data-rc-sync="language">
      <div data-rc-tab="v1" data-rc-id="fresh-cn" data-rc-title="中文" data-rc-value="cn"><p>CN</p></div>
      <div data-rc-tab="v1" data-rc-id="fresh-en" data-rc-title="English" data-rc-value="en"><p>EN</p></div>
    </div></article>`;
    await mountContainers(document);
    expect(document.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
  });

  it('isolates persisted tab values by pathname when articles have no stable identity', async () => {
    const originalPath = location.pathname;
    const renderArticle = () => {
      document.body.innerHTML = `<article><div data-rc-tabs="v1" data-rc-sync="language">
        <div data-rc-tab="v1" data-rc-id="cn" data-rc-title="中文" data-rc-value="cn"><p>CN</p></div>
        <div data-rc-tab="v1" data-rc-id="en" data-rc-title="English" data-rc-value="en"><p>EN</p></div>
      </div></article>`;
    };

    history.pushState({}, '', '/posts/storage-a');
    renderArticle();
    await mountContainers(document);
    document.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();

    history.pushState({}, '', '/posts/storage-b');
    renderArticle();
    await mountContainers(document);
    expect(document.querySelectorAll('[role="tab"]')[0].getAttribute('aria-selected')).toBe('true');

    history.pushState({}, '', '/posts/storage-a');
    renderArticle();
    await mountContainers(document);
    expect(document.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
    history.pushState({}, '', originalPath);
  });

  it('falls back from a stale persisted value to the declared default tab', async () => {
    document.body.innerHTML = `<article id="stable-post"><div data-rc-tabs="v1" data-rc-sync="language">
      <div data-rc-tab="v1" data-rc-id="first" data-rc-title="First" data-rc-value="first"><p>First</p></div>
      <div data-rc-tab="v1" data-rc-id="removed" data-rc-title="Removed" data-rc-value="removed"><p>Removed</p></div>
    </div></article>`;
    await mountContainers(document);
    document.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();

    document.body.innerHTML = `<article id="stable-post"><div data-rc-tabs="v1" data-rc-sync="language" data-rc-default="preferred">
      <div data-rc-tab="v1" data-rc-id="first" data-rc-title="First" data-rc-value="first"><p>First</p></div>
      <div data-rc-tab="v1" data-rc-id="preferred" data-rc-title="Preferred" data-rc-value="preferred"><p>Preferred</p></div>
    </div></article>`;
    await mountContainers(document);

    expect(document.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
  });

  it('never mounts roots inside editor DOM', async () => {
    document.body.innerHTML = `
      <div class="ProseMirror"><div data-rc-tabs="v1"><div data-rc-tab="v1" data-rc-id="a" data-rc-title="A"><p>A</p></div></div></div>
      <div class="tiptap"><aside data-rc-hint="v1" data-rc-kind="note"><p>Note</p></aside></div>`;

    await mountContainers(document);

    expect(document.querySelector('[data-rc-tabs] [role="tablist"]')).toBeNull();
    expect(document.querySelector('[data-rc-hint] [data-rc-generated]')).toBeNull();
  });

  it('renders all seven hint kinds and makes details accessible without cloning its body', async () => {
    const kinds = ['important', 'info', 'note', 'tip', 'warning', 'caution', 'details'];
    document.body.innerHTML = kinds.map((kind) => `
      <aside data-rc-hint="v1" data-rc-kind="${kind}" data-rc-open="${kind === 'details'}">
        <p id="body-${kind}">${kind}</p>
      </aside>`).join('');
    const originalDetailsBody = document.querySelector('#body-details');

    await mountContainers(document);

    for (const kind of kinds.slice(0, -1)) {
      const hint = document.querySelector<HTMLElement>(`[data-rc-kind="${kind}"]`)!;
      expect(hint.dataset.rcMountedKind).toBe(kind);
      expect(hint.querySelector(':scope > [data-rc-generated="title"]')?.textContent).not.toBe('');
    }
    const details = document.querySelector<HTMLElement>('[data-rc-kind="details"]')!;
    const toggle = details.querySelector<HTMLButtonElement>(':scope > button')!;
    const body = details.querySelector<HTMLElement>(':scope > [data-rc-generated="body"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(body.hidden).toBe(false);
    expect(document.querySelector('#body-details')).toBe(originalDetailsBody);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body.hidden).toBe(true);
  });

  it('builds isolated horizontal and vertical Reveal decks, keeps original content, and initializes each instance once', async () => {
    document.body.innerHTML = `
      <div data-rc-slides="v1" data-rc-theme="dark" data-rc-transition="fade" data-rc-numbers="true" data-rc-progress="false" data-rc-controls="true">
        <div data-rc-group="v1">
          <div data-rc-slide="v1" data-rc-id="s1" data-rc-title="Outer <title>"><p id="outer-body">One</p></div>
          <div data-rc-slide="v1" data-rc-id="s2" data-rc-title="Two"><p>Two</p></div>
        </div>
        <div data-rc-group="v1">
          <div data-rc-slide="v1" data-rc-id="s3" data-rc-title="Three">
            <div data-rc-slides="v1"><div data-rc-group="v1"><div data-rc-slide="v1" data-rc-id="inner"><p id="inner-body">Inner</p></div></div></div>
          </div>
        </div>
      </div>
      <div data-rc-slides="v1"><div data-rc-group="v1"><div data-rc-slide="v1" data-rc-id="other"><p>Other deck</p></div></div></div>`;
    const outerBody = document.querySelector('#outer-body');
    const innerBody = document.querySelector('#inner-body');

    await mountContainers(document);
    await mountContainers(document);

    expect(revealState.instances).toHaveLength(3);
    const outer = document.querySelector<HTMLElement>('[data-rc-slides="v1"]')!;
    const topLevel = outer.querySelectorAll(':scope > .rc-slides__deck > .rc-slides__engine > .slides > section');
    expect(topLevel).toHaveLength(2);
    expect(topLevel[0].querySelectorAll(':scope > section')).toHaveLength(2);
    const outerEngineElement = outer.querySelector<HTMLElement>('.rc-slides__engine')!;
    expect(outerEngineElement.querySelector('[data-rc-slide]')).toBeNull();
    expect(outerEngineElement.querySelector('[data-rc-slides]')).toBeNull();
    expect(document.querySelector('#outer-body')).toBe(outerBody);
    expect(document.querySelector('#inner-body')).toBe(innerBody);
    expect(outer.querySelector('h2')?.textContent).toBe('Outer <title>');
    expect(outer.querySelector('h2 title')).toBeNull();
    expect(outer.querySelectorAll('[data-rc-generated="slide-title"]')).toHaveLength(3);

    const outerInstance = revealState.instances.find((instance) => instance.root.closest('[data-rc-slides]') === outer)!;
    const navigate = vi.fn();
    const slide = vi.fn();
    Object.assign(outerInstance, {
      left: navigate, right: navigate, up: navigate, down: navigate, next: navigate,
      slide, getHorizontalSlides: () => [document.createElement('section'), document.createElement('section')],
    });
    expect(outerInstance.options).toMatchObject({ embedded: true, keyboard: false, scrollActivationWidth: 0, transition: 'fade', slideNumber: true, progress: false, controls: true });
    expect(outerInstance.options.keyboardCondition).toBeUndefined();
    const outerEngine = outerEngineElement;
    const outerRequestFullscreen = vi.fn(async () => undefined);
    Object.defineProperty(outerDeckElement(outer), 'requestFullscreen', { configurable: true, value: outerRequestFullscreen });
    outerEngine.focus();
    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
      outerEngine.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
    expect(navigate).toHaveBeenCalledTimes(4);
    outerEngine.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    outerEngine.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    outerEngine.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(navigate).toHaveBeenCalledTimes(5);
    expect(slide).toHaveBeenNthCalledWith(1, 0, 0);
    expect(slide).toHaveBeenNthCalledWith(2, 1, 0);
    outerEngine.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true }));
    await settle();
    expect(outerRequestFullscreen).toHaveBeenCalledOnce();
    const outerPanels = Array.from(outer.querySelectorAll<HTMLElement>('[data-rc-slide]'))
      .filter((panel) => panel.closest('[data-rc-slides]') === outer);
    expect(outerPanels.map((panel) => panel.hidden)).toEqual([false, true, true]);
    outerInstance.emit('slidechanged', { indexh: 0, indexv: 1 });
    expect(outerPanels.map((panel) => panel.hidden)).toEqual([true, false, true]);
    expect(outerPanels[1].classList.contains('rc-slides__slide--enter')).toBe(true);
    const innerInstance = revealState.instances.find((instance) => instance.root.closest('[data-rc-slides]') !== outer
      && outer.contains(instance.root))!;
    innerInstance.root.focus();
    innerInstance.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(navigate).toHaveBeenCalledTimes(5);
  });

  it('leaves interactive controls and page keys alone in normal and fullscreen decks', async () => {
    document.body.innerHTML = `<div data-rc-slides="v1"><div data-rc-group="v1"><div data-rc-slide="v1">
      <button id="body-button">Action</button><select><option>One</option></select>
      <div data-rc-tabs="v1"><div data-rc-tab="v1" data-rc-title="One"></div><div data-rc-tab="v1" data-rc-title="Two"></div></div>
    </div></div></div>`;
    await mountContainers(document);
    const root = document.querySelector<HTMLElement>('[data-rc-slides]')!;
    const deck = outerDeckElement(root);
    const engine = root.querySelector<HTMLElement>('.rc-slides__engine')!;
    const navigate = vi.fn();
    Object.assign(revealState.instances[0], { left: navigate, right: navigate, up: navigate, down: navigate, next: navigate, slide: navigate });
    const requestFullscreen = vi.fn(async () => undefined);
    Object.defineProperty(deck, 'requestFullscreen', { configurable: true, value: requestFullscreen });
    const controls = Array.from(root.querySelectorAll<HTMLElement>('button, select'));
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' ', 'f'];
    try {
      for (const fullscreenElement of [null, deck]) {
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
        for (const control of controls) {
          control.focus();
          for (const key of keys) {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            control.dispatchEvent(event);
            // Tabs own their navigation; ordinary form controls keep browser defaults.
            if (control.getAttribute('role') !== 'tab') expect(event.defaultPrevented).toBe(false);
          }
        }
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      }
      expect(navigate).not.toHaveBeenCalled();
      expect(requestFullscreen).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
    }
  });

  it('handles only direct engine key events and ignores composition, modifiers, and other shortcuts', async () => {
    document.body.innerHTML = `<div data-rc-slides="v1"><div data-rc-group="v1"><div data-rc-slide="v1">Slide</div></div></div>`;
    await mountContainers(document);
    const engine = document.querySelector<HTMLElement>('.rc-slides__engine')!;
    const next = vi.fn();
    Object.assign(revealState.instances[0], { next });
    engine.focus();
    const ignoredEvents = [
      new KeyboardEvent('keydown', { key: ' ', isComposing: true, bubbles: true, cancelable: true }),
      ...['ctrlKey', 'altKey', 'metaKey', 'shiftKey'].map((modifier) => new KeyboardEvent('keydown', { key: ' ', [modifier]: true, bubbles: true, cancelable: true })),
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    ];
    for (const event of ignoredEvents) {
      engine.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    const child = engine.querySelector('section')!;
    const childEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    child.dispatchEvent(childEvent);
    expect(childEvent.defaultPrevented).toBe(false);
    expect(next).not.toHaveBeenCalled();
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    engine.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('provides per-deck fullscreen and refreshes added containers and theme attributes', async () => {
    document.body.innerHTML = `<main id="article"><div data-rc-slides="v1" data-rc-theme="light"><div data-rc-group="v1"><div data-rc-slide="v1"><p>One</p></div></div></div></main>`;
    await mountContainers(document);
    const slides = document.querySelector<HTMLElement>('[data-rc-slides]')!;
    const deck = slides.querySelector<HTMLElement>('.rc-slides__deck')!;
    const requestFullscreen = vi.fn(async () => undefined);
    Object.defineProperty(deck, 'requestFullscreen', { configurable: true, value: requestFullscreen });

    slides.querySelector<HTMLButtonElement>('[data-rc-action="fullscreen"]')!.click();
    await settle();
    expect(requestFullscreen).toHaveBeenCalledOnce();

    slides.dataset.rcTheme = 'dark';
    document.querySelector('#article')!.insertAdjacentHTML('beforeend', `<aside data-rc-hint="v1" data-rc-kind="tip"><p>Added</p></aside>`);
    await settle();

    expect(slides.classList.contains('rc-slides--dark')).toBe(true);
    expect(document.querySelector('[data-rc-hint] [data-rc-generated="title"]')?.textContent).toBe('提示');
  });

  it('disposes removed decks, releases fullscreen listeners, and remounts the same original content', async () => {
    document.body.innerHTML = `<div data-rc-slides="v1"><div data-rc-group="v1"><div data-rc-slide="v1" data-rc-title="Kept title"><p id="retained">Kept body</p></div></div></div>`;
    const root = document.querySelector<HTMLElement>('[data-rc-slides]')!;
    const originalBody = document.querySelector('#retained');
    await mountContainers(document);
    const firstEngine = revealState.instances[0];
    root.remove();
    await settle();
    const layoutCallsAfterRemoval = firstEngine.layout.mock.calls.length;
    document.dispatchEvent(new Event('fullscreenchange'));

    expect(firstEngine.destroy).toHaveBeenCalledOnce();
    expect(firstEngine.layout.mock.calls.length).toBe(layoutCallsAfterRemoval);
    expect(root.querySelector(':scope > [data-rc-group] > [data-rc-slide] > #retained')).toBe(originalBody);

    document.body.append(root);
    await mountContainers(root);
    await settle();
    expect(revealState.instances).toHaveLength(2);
    expect(root.querySelectorAll('.rc-slides__engine')).toHaveLength(1);
    expect(root.querySelectorAll('[data-rc-generated="slide-title"]')).toHaveLength(1);
    expect(root.querySelector('#retained')).toBe(originalBody);
    const secondEngine = revealState.instances[1];
    const liveLayoutCalls = secondEngine.layout.mock.calls.length;
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(firstEngine.layout.mock.calls.length).toBe(layoutCallsAfterRemoval);
    expect(secondEngine.layout.mock.calls.length).toBe(liveLayoutCalls + 1);
  });
});

function outerDeckElement(outer: Element): HTMLElement {
  return outer.querySelector<HTMLElement>('.rc-slides__deck')!;
}
