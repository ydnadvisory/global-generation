import type { TextRange } from "./data";

const INCORRECT_CHARACTER_PENALTY = 0.25;

export type CoverageScore = {
  coveredCharacters: number;
  correctCharacters: number;
  incorrectCharacters: number;
  penaltyCharacters: number;
  selectedCharacters: number;
  percent: number;
};

export function normaliseRanges(ranges: readonly TextRange[]): TextRange[] {
  const sorted = [...ranges]
    .filter(([start, end]) => end > start)
    .sort(([firstStart, firstEnd], [secondStart, secondEnd]) =>
      firstStart === secondStart
        ? firstEnd - secondEnd
        : firstStart - secondStart,
    );

  return sorted.reduce<TextRange[]>((merged, [start, end]) => {
    const previous = merged.at(-1);

    if (!previous || start > previous[1]) {
      return [...merged, [start, end]];
    }

    return [...merged.slice(0, -1), [previous[0], Math.max(previous[1], end)]];
  }, []);
}

export function addRange(
  ranges: readonly TextRange[],
  range: TextRange,
): TextRange[] {
  return normaliseRanges([...ranges, range]);
}

export function scoreCoverage(
  selectedRanges: readonly TextRange[],
  correctRanges: readonly TextRange[],
): CoverageScore {
  const selected = normaliseRanges(selectedRanges);
  const correct = normaliseRanges(correctRanges);
  const correctCharacters = correct.reduce(
    (total, [start, end]) => total + end - start,
    0,
  );
  const selectedCharacters = selected.reduce(
    (total, [start, end]) => total + end - start,
    0,
  );
  const coveredCharacters = correct.reduce(
    (total, [correctStart, correctEnd]) =>
      total +
      selected.reduce(
        (coverage, [selectedStart, selectedEnd]) =>
          coverage +
          Math.max(
            0,
            Math.min(correctEnd, selectedEnd) -
              Math.max(correctStart, selectedStart),
          ),
        0,
      ),
    0,
  );
  const incorrectCharacters = selectedCharacters - coveredCharacters;
  const penaltyCharacters = incorrectCharacters * INCORRECT_CHARACTER_PENALTY;

  return {
    coveredCharacters,
    correctCharacters,
    incorrectCharacters,
    penaltyCharacters,
    selectedCharacters,
    percent:
      correctCharacters === 0
        ? 0
        : Math.max(
            0,
            Math.round(
              ((coveredCharacters - penaltyCharacters) / correctCharacters) *
                100,
            ),
          ),
  };
}

export function getSelectionRange(container: HTMLElement): TextRange | null {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  selection.modify("extend", "forward", "word");

  const range = selection.getRangeAt(0);
  const start = getContainerOffset(
    container,
    range.startContainer,
    range.startOffset,
  );
  const end = getContainerOffset(
    container,
    range.endContainer,
    range.endOffset,
  );

  if (start === null || end === null || start === end) {
    return null;
  }

  return [Math.min(start, end), Math.max(start, end)];
}

function getContainerOffset(
  container: HTMLElement,
  node: Node,
  offset: number,
): number | null {
  if (!container.contains(node)) {
    return null;
  }

  const range = document.createRange();
  range.selectNodeContents(container);

  try {
    range.setEnd(node, offset);
  } catch {
    return null;
  }

  return range.toString().length;
}
