import { describe, it, expect, vi } from 'vitest';
import { createStore } from './createStore.js';

describe('createStore', () => {
  it('returns the initial state from getState', () => {
    const store = createStore({ count: 1 });
    expect(store.getState()).toEqual({ count: 1 });
  });

  it('defaults to an empty object when no initial state is given', () => {
    expect(createStore().getState()).toEqual({});
  });

  it('keeps getState identity stable across writes', () => {
    const store = createStore({ count: 1 });
    const ref = store.getState();
    store.setState({ count: 2 });
    expect(store.getState()).toBe(ref);
  });

  it('merges a patch instead of replacing the state object', () => {
    const store = createStore({ a: 1, b: 2 });
    store.setState({ b: 3 });
    expect(store.getState()).toEqual({ a: 1, b: 3 });
  });

  it('notifies a subscriber after setState', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('passes the live state and a version to the listener', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ count: 4 });
    expect(listener.mock.calls[0][0]).toBe(store.getState());
    expect(listener.mock.calls[0][1]).toBe(1);
  });

  it('increments the version once per setState call', () => {
    const store = createStore({ n: 0 });
    store.setState({ n: 1 });
    store.setState({ n: 2 });
    expect(store.getVersion()).toBe(2);
  });

  it('supports several subscribers', () => {
    const store = createStore({ n: 0 });
    const a = vi.fn(),
      b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.setState({ n: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops further notifications', () => {
    const store = createStore({ n: 0 });
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.setState({ n: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe returns a boolean from Set.delete', () => {
    const store = createStore({ n: 0 });
    const off = store.subscribe(() => {});
    expect(off()).toBe(true);
    expect(off()).toBe(false);
  });

  it('observes a direct property write, not just setState', () => {
    const store = createStore({ n: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.getState().n = 5;
    expect(store.getState().n).toBe(5);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify when a direct write sets the same value', () => {
    const store = createStore({ n: 7 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.getState().n = 7;
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not increment the version for a no-op direct write', () => {
    const store = createStore({ n: 7 });
    store.getState().n = 7;
    expect(store.getVersion()).toBe(0);
  });

  it('keeps nested object identity intact', () => {
    const nested = { deep: true };
    const store = createStore({ nested });
    store.setState({ n: 1 });
    expect(store.getState().nested).toBe(nested);
  });

  it('keeps array identity intact when a slice mutates a collection', () => {
    const list = [];
    const store = createStore({ list });
    store.getState().list.push({ name: 'CNN' });
    expect(store.getState().list).toBe(list);
    expect(list).toHaveLength(1);
  });

  it('notifies once per changed key when Object.assign writes several fields', () => {
    const store = createStore({ a: 0, b: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    Object.assign(store.getState(), { a: 1, b: 2 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not let a subscriber added during dispatch receive that dispatch', () => {
    const store = createStore({ n: 0 });
    const late = vi.fn();
    store.subscribe(() => store.subscribe(late));
    store.setState({ n: 1 });
    expect(late).not.toHaveBeenCalled();
  });

  it('allows a subscriber to unsubscribe itself', () => {
    const store = createStore({ n: 0 });
    const listener = vi.fn();
    const off = store.subscribe(() => {
      listener();
      off();
    });
    store.setState({ n: 1 });
    store.setState({ n: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-function subscriber', () => {
    const store = createStore({ n: 0 });
    expect(() => store.subscribe(null)).toThrow(TypeError);
  });
});
