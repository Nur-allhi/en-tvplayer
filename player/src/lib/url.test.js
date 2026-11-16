import { describe, it, expect } from 'vitest';
import { withAuthQuery, redactUrl, extractAuthQuery } from './url.js';

describe('withAuthQuery — appending', () => {
  it('appends a token to a URL with no query string', () => {
    expect(withAuthQuery('https://h.example.com/a', '__hdnea__=T')).toBe('https://h.example.com/a?__hdnea__=T');
  });

  it('appends with & when a query string already exists', () => {
    expect(withAuthQuery('https://h.example.com/a?x=1', '__hdnea__=T')).toBe('https://h.example.com/a?x=1&__hdnea__=T');
  });

  it('appends several token params at once', () => {
    expect(withAuthQuery('https://h.example.com/a', 'a=1&b=2')).toBe('https://h.example.com/a?a=1&b=2');
  });

  it('appends only the params that are missing', () => {
    expect(withAuthQuery('https://h.example.com/a?a=1', 'a=1&b=2')).toBe('https://h.example.com/a?a=1&b=2');
  });

  it('preserves a fragment and appends before it', () => {
    expect(withAuthQuery('https://h.example.com/a#frag', '__hdnea__=T')).toBe(
      'https://h.example.com/a?__hdnea__=T#frag',
    );
  });

  it('does not treat a param name inside the fragment as present', () => {
    expect(withAuthQuery('https://h.example.com/a#__hdnea__=X', '__hdnea__=T')).toBe(
      'https://h.example.com/a?__hdnea__=T#__hdnea__=X',
    );
  });
});

describe('withAuthQuery — skipping', () => {
  it('leaves the URL alone when the param is already present', () => {
    expect(withAuthQuery('https://h.example.com/a?__hdnea__=T', '__hdnea__=T')).toBe(
      'https://h.example.com/a?__hdnea__=T',
    );
  });

  it('detects a present param when it is not the first one', () => {
    expect(withAuthQuery('https://h.example.com/a?x=1&__hdnea__=T', '__hdnea__=T')).toBe(
      'https://h.example.com/a?x=1&__hdnea__=T',
    );
  });

  it('does not match a param that merely shares a prefix', () => {
    expect(withAuthQuery('https://h.example.com/a?__hdnea__extra=T', '__hdnea__=T')).toBe(
      'https://h.example.com/a?__hdnea__extra=T&__hdnea__=T',
    );
  });

  it('leaves non-network URIs untouched so data: licenses survive', () => {
    const dataUri = 'data:text/plain;base64,QUJD';
    expect(withAuthQuery(dataUri, '__hdnea__=T')).toBe(dataUri);
  });

  it('leaves blob: and file: URIs untouched', () => {
    expect(withAuthQuery('blob:https://h.example.com/x', 'a=1')).toBe('blob:https://h.example.com/x');
    expect(withAuthQuery('file:///local/a.m3u8', 'a=1')).toBe('file:///local/a.m3u8');
  });

  it('returns the URI unchanged when there is no auth query', () => {
    const uri = 'https://h.example.com/a';
    expect(withAuthQuery(uri, null)).toBe(uri);
    expect(withAuthQuery(uri, '')).toBe(uri);
  });

  it('returns falsy input as-is', () => {
    expect(withAuthQuery(null, 'a=1')).toBeNull();
    expect(withAuthQuery(undefined, 'a=1')).toBeUndefined();
  });

  it('is case-insensitive about the scheme', () => {
    expect(withAuthQuery('HTTPS://h.example.com/a', 'a=1')).toBe('HTTPS://h.example.com/a?a=1');
  });

  it('skips empty, malformed and nameless pairs', () => {
    expect(withAuthQuery('https://h.example.com/a', '&&junk&=x&b=2')).toBe('https://h.example.com/a?b=2');
  });

  it('treats regex metacharacters in a param name literally', () => {
    expect(withAuthQuery('https://h.example.com/a?tok.n=1', 'tok.n=2')).toBe('https://h.example.com/a?tok.n=1');
  });

  it('appends a param name containing a plus sign rather than decoding it', () => {
    expect(withAuthQuery('https://h.example.com/a', 'a+b=1')).toBe('https://h.example.com/a?a+b=1');
  });
});

describe('redactUrl', () => {
  it('strips a token query string', () => {
    expect(redactUrl('https://cdn.example.com/live/bbc?token=SECRET')).toBe('https://cdn.example.com/live/bbc');
  });

  it('strips a query and a fragment', () => {
    expect(redactUrl('https://h.example.com/a.ts?__hdnea__=ABC#frag')).toBe('https://h.example.com/a.ts');
  });

  it('strips a fragment with no query string', () => {
    expect(redactUrl('https://h.example.com/a#frag')).toBe('https://h.example.com/a');
  });

  it('leaves an already-clean URL untouched', () => {
    const url = 'https://h.example.com/a.ts';
    expect(redactUrl(url)).toBe(url);
  });

  it('leaves non-HTTP schemes alone so a data: license stays readable', () => {
    const dataUri = 'data:text/plain,abc?def';
    expect(redactUrl(dataUri)).toBe(dataUri);
  });

  it('passes null and non-strings through unchanged', () => {
    expect(redactUrl(null)).toBeNull();
    expect(redactUrl(undefined)).toBeUndefined();
    expect(redactUrl(42)).toBe(42);
  });
});

describe('extractAuthQuery', () => {
  it('promotes a known token cookie', () => {
    expect(extractAuthQuery({ Cookie: 'sess=abc; __hdnea__=TOK123' })).toBe('__hdnea__=TOK123');
  });

  it('is case-insensitive about the Cookie header name', () => {
    expect(extractAuthQuery({ cookie: 'hdnea=TOK' })).toBe('hdnea=TOK');
  });

  it('finds the Cookie header among other headers', () => {
    expect(extractAuthQuery({ Referer: 'https://s.example/', Cookie: 'hdntl=T' })).toBe('hdntl=T');
  });

  it('collects every known token name', () => {
    expect(extractAuthQuery({ Cookie: '__hdnea__=A; hdnts=B' })).toBe('__hdnea__=A&hdnts=B');
  });

  it('keeps only the first occurrence of a duplicated token', () => {
    expect(extractAuthQuery({ Cookie: 'hdnea=FIRST; hdnea=SECOND' })).toBe('hdnea=FIRST');
  });

  it('ignores cookies that are not auth tokens', () => {
    expect(extractAuthQuery({ Cookie: 'sess=abc; theme=dark' })).toBeNull();
  });

  it('returns null when there is no Cookie header', () => {
    expect(extractAuthQuery({ Referer: 'https://s.example/' })).toBeNull();
  });

  it('returns null for empty, null and undefined input', () => {
    expect(extractAuthQuery(null)).toBeNull();
    expect(extractAuthQuery(undefined)).toBeNull();
    expect(extractAuthQuery({})).toBeNull();
  });

  it('ignores a Cookie header with an empty value', () => {
    expect(extractAuthQuery({ Cookie: '' })).toBeNull();
  });

  it('skips cookie parts without = and parts with an empty name or value', () => {
    expect(extractAuthQuery({ Cookie: 'junk; =novalue; hdnea=' })).toBeNull();
  });

  it('trims whitespace around a token name and value', () => {
    expect(extractAuthQuery({ Cookie: '  hdnea  =  TOK  ' })).toBe('hdnea=TOK');
  });

  it('preserves a = inside the token value', () => {
    expect(extractAuthQuery({ Cookie: 'hdnea=a=b' })).toBe('hdnea=a=b');
  });
});
