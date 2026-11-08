import { describe, expect, it } from 'vitest';
import { createTabs, createSlides, createHint, validateTabSync } from '../src/editor/model';

describe('container document factories', () => {
  it('creates native editable bodies and fresh stable identities', () => {
    const tabs = createTabs();
    expect(tabs.content).toHaveLength(2);
    expect(tabs.content?.[0].content).toEqual([{ type: 'paragraph' }]);
    expect(tabs.attrs?.defaultId).toBe(tabs.content?.[0].attrs?.id);
    const another = createTabs();
    expect(another.content?.[0].attrs?.id).not.toBe(tabs.content?.[0].attrs?.id);
    expect(createSlides().content?.[0].content?.[0].content).toEqual([{ type: 'paragraph' }]);
    expect(createHint().content).toEqual([{ type: 'paragraph' }]);
  });
  it('rejects effective duplicate synchronization values only in synchronized groups', () => {
    const tabs = createTabs();
    tabs.content![0].attrs = { ...tabs.content![0].attrs, title: 'Linux', value: '' };
    tabs.content![1].attrs = { ...tabs.content![1].attrs, title: 'Other', value: 'Linux' };
    expect(validateTabSync(tabs)).toBeNull();
    tabs.attrs!.sync = 'platform';
    expect(validateTabSync(tabs)).toBeTruthy();
    tabs.content![1].attrs!.value = 'Windows';
    expect(validateTabSync(tabs)).toBeNull();
  });
});
