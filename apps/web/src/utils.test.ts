import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addRange,
  getSelectionRange,
  normaliseRanges,
  scoreCoverage,
} from "./utils";

describe("normaliseRanges", () => {
  it("sorts ranges and merges overlaps", () => {
    expect(normaliseRanges([[10, 20], [1, 5], [4, 12], [30, 35], [30, 31]])).toEqual(
      [
        [1, 20],
        [30, 35],
      ],
    );
  });

  it("discards degenerate ranges", () => {
    expect(normaliseRanges([[5, 5], [7, 6], [1, 3]])).toEqual([[1, 3]]);
  });
});

describe("addRange", () => {
  it("normalizes when adding a new range", () => {
    expect(addRange([[1, 5]], [3, 9])).toEqual([[1, 9]]);
  });
});

describe("scoreCoverage", () => {
  it("computes complete coverage without penalty", () => {
    expect(scoreCoverage([[0, 3], [5, 8]], [[0, 3], [5, 8]])).toEqual({
      coveredCharacters: 6,
      correctCharacters: 6,
      incorrectCharacters: 0,
      penaltyCharacters: 0,
      selectedCharacters: 6,
      percent: 100,
    });
  });

  it("applies partial credit and penalties", () => {
    expect(scoreCoverage([[0, 5]], [[2, 6]])).toEqual({
      coveredCharacters: 3,
      correctCharacters: 4,
      incorrectCharacters: 2,
      penaltyCharacters: 0.5,
      selectedCharacters: 5,
      percent: 63,
    });
  });
});

describe("getSelectionRange", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for collapsed selection", () => {
    const container = document.createElement("div");
    container.append("abcdef");
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);
    range.collapse(true);

    const selection = {
      isCollapsed: true,
      rangeCount: 1,
      modify: vi.fn(),
      getRangeAt: vi.fn(() => range),
      removeAllRanges: vi.fn(),
    } as unknown as Selection;

    vi.spyOn(window, "getSelection").mockReturnValue(selection);

    expect(getSelectionRange(container)).toBeNull();
  });

  it("returns normalized offsets for valid selection", () => {
    const container = document.createElement("div");
    const text = document.createTextNode("hello world");
    container.appendChild(text);
    document.body.appendChild(container);

    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 7);

    const selection = {
      isCollapsed: false,
      rangeCount: 1,
      modify: vi.fn(),
      getRangeAt: vi.fn(() => range),
      removeAllRanges: vi.fn(),
    } as unknown as Selection;

    vi.spyOn(window, "getSelection").mockReturnValue(selection);

    expect(getSelectionRange(container)).toEqual([1, 7]);
  });
});
