import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { EvidenceExercise } from "./api";

vi.mock("./utils", async () => {
  const actual = await vi.importActual<typeof import("./utils")>("./utils");
  return {
    ...actual,
    getSelectionRange: vi.fn(),
  };
});

import { getSelectionRange } from "./utils";
import App from "./App";

const getSelectionRangeMock = vi.mocked(getSelectionRange);

const exercise: EvidenceExercise = {
  id: "rw-evidence-1",
  section: "Reading & Writing",
  difficulty: "Средний",
  title: "Найди опору",
  instruction: "Выберите фрагменты.",
  text: "x".repeat(900),
  questions: [
    { id: "wastewater-solution", prompt: "Question one" },
    { id: "problem", prompt: "Question two" },
    { id: "impact", prompt: "Question three" },
  ],
};

const passingResult = {
  passed: true,
  score: {
    covered_characters: 68,
    correct_characters: 68,
    incorrect_characters: 0,
    penalty_characters: 0,
    selected_characters: 68,
    percent: 100,
  },
  correct_ranges: [
    { start: 162, end: 197 },
    { start: 278, end: 311 },
  ],
};

const reviewResult = {
  passed: false,
  score: {
    covered_characters: 0,
    correct_characters: 68,
    incorrect_characters: 3,
    penalty_characters: 0.75,
    selected_characters: 3,
    percent: 0,
  },
  correct_ranges: passingResult.correct_ranges,
};

function getPassage() {
  return screen.getByLabelText("Текст для выделения");
}

async function renderApp() {
  render(<App />);
  await screen.findByText(exercise.title);
}

describe("App", () => {
  beforeEach(() => {
    getSelectionRangeMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string, init?: RequestInit) => {
        if (input === "/api/exercises/rw-evidence-1" && !init) {
          return Promise.resolve(new Response(JSON.stringify(exercise)));
        }

        const result =
          JSON.parse(init?.body as string).selected_ranges.length === 2
            ? passingResult
            : reviewResult;
        return Promise.resolve(new Response(JSON.stringify(result)));
      }),
    );
  });

  it("collects selections and allows clearing", async () => {
    getSelectionRangeMock.mockReturnValue([0, 10]);
    await renderApp();

    const passage = getPassage();
    fireEvent.mouseUp(passage);

    expect(screen.getByText("Выбрано фрагментов: 1")).toBeInTheDocument();

    getSelectionRangeMock.mockReturnValue([15, 20]);
    fireEvent.mouseUp(passage);

    expect(screen.getByText("Выбрано фрагментов: 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Очистить выделение" }));

    expect(screen.getByText("Выделение пока не выбрано")).toBeInTheDocument();
  });

  it("removes selected range via Enter key", async () => {
    getSelectionRangeMock.mockReturnValue([0, 10]);
    await renderApp();

    const passage = getPassage();
    fireEvent.mouseUp(passage);

    const removableRange = within(passage).getByText(exercise.text.slice(0, 10));
    fireEvent.keyDown(removableRange, { key: "Enter", code: "Enter" });

    expect(screen.getByText("Выделение пока не выбрано")).toBeInTheDocument();
  });

  it("submits an answer through the API", async () => {
    getSelectionRangeMock
      .mockReturnValueOnce([162, 197])
      .mockReturnValueOnce([278, 311]);
    await renderApp();

    const passage = getPassage();
    fireEvent.mouseUp(passage);
    fireEvent.mouseUp(passage);

    fireEvent.click(screen.getByRole("button", { name: "Отправить ответ" }));

    expect(await screen.findByText("Ответ засчитан")).toBeInTheDocument();
    expect(screen.getByText("1 из 3 вопросов")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ответ отправлен" }),
    ).toBeInTheDocument();
  });

  it("shows server-side review feedback", async () => {
    getSelectionRangeMock.mockReturnValue([0, 3]);
    await renderApp();

    fireEvent.mouseUp(getPassage());
    fireEvent.click(screen.getByRole("button", { name: "Отправить ответ" }));

    expect(await screen.findByText("Нужно повторить")).toBeInTheDocument();
    expect(screen.getByText(/Штраф:/)).toBeInTheDocument();
  });

  it("navigates between questions and resets exercise", async () => {
    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Вопрос 2" }));
    expect(screen.getByText(exercise.questions[1].prompt)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "К тренировкам" }));
    expect(screen.getByText(exercise.questions[0].prompt)).toBeInTheDocument();
    expect(screen.getByText("0 из 3 вопросов")).toBeInTheDocument();
  });
});
