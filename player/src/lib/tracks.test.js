import { describe, it, expect } from 'vitest';
import { normalizeTextTracks, textTrackOptions, nextTextOption } from './tracks.js';

// T-184: the subtitle picker cycles through REAL Shaka text tracks. Normalising
// and cycling are pure, so the behaviour is testable without a TV.

const tracks = [
  { id: 1, label: 'English CC', language: 'en', active: false },
  { id: 2, label: '', language: 'es', active: true },
  { id: 3, label: '', language: 'und', active: false },
];

describe('normalizeTextTracks', () => {
  it('keeps real track ids and labels', () => {
    expect(normalizeTextTracks(tracks).map((t) => t.label)).toEqual(['English CC', 'es', 'Subtitles 3']);
  });

  it('reports which track is active', () => {
    expect(normalizeTextTracks(tracks).find((t) => t.active).id).toBe(2);
  });

  it('drops entries without an id', () => {
    expect(normalizeTextTracks([{ label: 'bad' }, tracks[0]])).toHaveLength(1);
  });

  it('returns an empty list for missing input', () => {
    expect(normalizeTextTracks()).toEqual([]);
  });
});

describe('textTrackOptions', () => {
  it('always offers Off first', () => {
    expect(textTrackOptions([])).toEqual([{ id: null, label: 'Off' }]);
  });

  it('appends every real track after Off', () => {
    expect(textTrackOptions(tracks)).toHaveLength(4);
    expect(textTrackOptions(tracks)[1].id).toBe(1);
  });
});

describe('nextTextOption', () => {
  const options = textTrackOptions(tracks);

  it('starts at Off when nothing is selected', () => {
    expect(nextTextOption(options, null)).toBe(1);
  });

  it('cycles forward through the real tracks', () => {
    expect(nextTextOption(options, 1)).toBe(2);
    expect(nextTextOption(options, 2)).toBe(3);
  });

  it('wraps back to Off at the end', () => {
    expect(nextTextOption(options, 3)).toBe(0);
  });

  it('recovers when the current id is unknown', () => {
    expect(nextTextOption(options, 99)).toBe(0);
  });

  it('returns Off only when there are no tracks', () => {
    expect(nextTextOption([{ id: null, label: 'Off' }], null)).toBe(0);
  });
});
