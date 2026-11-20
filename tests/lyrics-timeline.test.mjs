import test from "node:test";
import assert from "node:assert/strict";
import {
  AmberLinkLyricsTimeline,
  normalizeProviderRecord,
  timelineFromLegacyLyrics,
} from "../dist/index.mjs";

const track = {
  id: 7,
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  durationMs: 5000,
};

function makeTimeline(overrides = {}) {
  return new AmberLinkLyricsTimeline({
    track,
    instrumental: false,
    syncMode: "word",
    hasWordSync: true,
    plainLyrics: null,
    lines: [
      {
        text: "Hello world",
        startMs: 1000,
        endMs: 3000,
        words: [
          { text: "Hello ", startMs: 1000, endMs: 1500 },
          { text: "world", startMs: 1500, endMs: 3000 },
        ],
      },
    ],
    ...overrides,
  });
}

test("word-synchronized provider data retains word timestamps", () => {
  const lyricsfile = `version: "1.0"\nmetadata:\n  title: "Example"\n  artist: "Example Artist"\nlines:\n  - text: "Hello world"\n    start_ms: 1000\n    end_ms: 3000\n    words:\n      - text: "Hello "\n        start_ms: 1000\n        end_ms: 1500\n      - text: "world"\n        start_ms: 1500\n        end_ms: 3000\n`;
  const timeline = normalizeProviderRecord({
    id: 1,
    trackName: "Example",
    artistName: "Example Artist",
    duration: 5,
    instrumental: false,
    lyricsfile,
  });

  assert.equal(timeline.syncMode, "word");
  assert.equal(timeline.track.durationMs, 5000);
  assert.equal(timeline.lines[0].words[0].startMs, 1000);
  assert.equal(timeline.lines[0].words[1].startMs, 1500);
  assert.equal(timeline.getActiveAt(1200).activeLines[0].currentWordIndex, 0);
  assert.equal(timeline.getActiveAt(1700).activeLines[0].currentWordIndex, 1);
});

test("line-synchronized lyrics are not marked as word-synchronized", () => {
  const timeline = normalizeProviderRecord({
    id: 2,
    trackName: "Line only",
    artistName: "Example Artist",
    duration: 4,
    instrumental: false,
    syncedLyrics: "[00:01.00]First line\n[00:02.50]Second line",
  });


  assert.equal(timeline.syncMode, "line");
  assert.equal(timeline.hasWordSync, false);
  assert.equal(timeline.lines.length, 2);
  assert.deepEqual(timeline.lines[0].words, []);
  assert.equal(timeline.lines[1].startMs, 2500);
});

test("plain lyric text produces untimed lines", () => {
  const timeline = normalizeProviderRecord({
    trackName: "Plain",
    artistName: "Artist",
    plainLyrics: "First line\n\nSecond line",
  });

  assert.equal(timeline.syncMode, "plain");
  assert.equal(timeline.lines.length, 2);
  assert.equal(timeline.lines[0].startMs, null);
  assert.equal(timeline.lines[1].text, "Second line");
  assert.equal(timeline.getActiveAt(1000).activeLines.length, 0);
});

test("instrumental provider record is labeled instrumental", () => {
  const timeline = normalizeProviderRecord({
    trackName: "Instrumental",
    artistName: "Artist",
    duration: 120,
    instrumental: true,
    plainLyrics: null,
    syncedLyrics: null,
  });

  assert.equal(timeline.instrumental, true);
  assert.equal(timeline.syncMode, "instrumental");
  assert.equal(timeline.lines.length, 0);
});

test("active lines and word states are correct at timing boundaries", () => {
  const timeline = makeTimeline();


  assert.equal(timeline.getActiveAt(999).activeLines.length, 0);
  assert.equal(timeline.getActiveAt(1000).activeLines[0].currentWordIndex, 0);
  assert.deepEqual(timeline.getActiveAt(1500).activeLines[0].completedWordIndexes, [0]);
  assert.equal(timeline.getActiveAt(1500).activeLines[0].currentWordIndex, 1);
  assert.equal(timeline.getActiveAt(3000).activeLines.length, 0);
});

test("overlapping lines can be active simultaneously", () => {
  const timeline = makeTimeline({
    lines: [
      { text: "First voice", startMs: 1000, endMs: 3000, words: [{ text: "First", startMs: 1000, endMs: 3000 }] },
      { text: "Second voice", startMs: 2000, endMs: 4000, words: [{ text: "Second", startMs: 2000, endMs: 4000 }] },
    ],
  });

  const state = timeline.getActiveAt(2500);
  assert.equal(state.activeLines.length, 2);
  assert.deepEqual(state.activeLines.map((line) => line.index), [0, 1]);
});

test("next-boundary lookup returns the nearest future timestamp", () => {
  const timeline = makeTimeline();
  assert.equal(timeline.getNextBoundaryAfter(1200), 1500);
  assert.equal(timeline.getNextBoundaryAfter(1500), 3000);
  assert.equal(timeline.getNextBoundaryAfter(3000), null);
});

test("negative or non-finite playback positions normalize to zero", () => {
  const timeline = makeTimeline();
  assert.equal(timeline.getActiveAt(-500).positionMs, 0);
  assert.equal(timeline.getActiveAt(Number.NaN).positionMs, 0);
  assert.equal(timeline.getNextBoundaryAfter(-1), 1000);
});

test("legacy lyric payload is converted to line timeline", () => {
  const timeline = timelineFromLegacyLyrics({
    provider: "Legacy source",
    text: "Old lyrics",
    lines: [
      { line: "Verse one", timestamp: 1000, duration: 2000 },
      { line: "Verse two", timestamp: 3000, duration: 1500 },
    ],
  });

  assert.ok(timeline instanceof AmberLinkLyricsTimeline);
  assert.equal(timeline.syncMode, "line");
  assert.equal(timeline.provider, "Legacy source");
  assert.equal(timeline.lines[0].endMs, 3000);
  assert.equal(timeline.lines[1].startMs, 3000);
});

test("invalid legacy payloads return null", () => {
  assert.equal(timelineFromLegacyLyrics(null), null);
  assert.equal(timelineFromLegacyLyrics({ lines: [] }), null);
  assert.equal(timelineFromLegacyLyrics({ lines: [{ nope: "not a line" }] }), null);
});
