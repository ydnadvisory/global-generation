import type { TextRange } from "./api";

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
