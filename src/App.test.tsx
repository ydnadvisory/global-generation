import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { exercise } from "./data";

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

function getPassage() {
  return screen.getByLabelText("Текст для выделения");
}

function renderApp() {
  return render(<App />);
}

describe("App", () => {
  beforeEach(() => {
    getSelectionRangeMock.mockReset();
  });

  it("collects selections and allows clearing", () => {
    getSelectionRangeMock.mockReturnValue([0, 10]);
    renderApp();

    const passage = getPassage();
    fireEvent.mouseUp(passage);

    expect(screen.getByText("Выбрано фрагментов: 1")).toBeInTheDocument();

    getSelectionRangeMock.mockReturnValue([15, 20]);
    fireEvent.mouseUp(passage);

    expect(screen.getByText("Выбрано фрагментов: 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Очистить выделение" }));

    expect(screen.getByText("Выделение пока не выбрано")).toBeInTheDocument();
  });

  it("removes selected range via Enter key", () => {
    getSelectionRangeMock.mockReturnValue([0, 10]);
    renderApp();

    const passage = getPassage();
    fireEvent.mouseUp(passage);

    const removableRange = within(passage).getByText(exercise.text.slice(0, 10));
    fireEvent.keyDown(removableRange, { key: "Enter", code: "Enter" });

    expect(screen.getByText("Выделение пока не выбрано")).toBeInTheDocument();
  });

  it("submits an answer as passing when all correct fragments are selected", () => {
    getSelectionRangeMock
      .mockReturnValueOnce([162, 197])
      .mockReturnValueOnce([278, 311]);
    renderApp();

    const passage = getPassage();
    fireEvent.mouseUp(passage);
    fireEvent.mouseUp(passage);

    fireEvent.click(screen.getByRole("button", { name: "Отправить ответ" }));

    expect(screen.getByText("Ответ засчитан")).toBeInTheDocument();
    expect(screen.getByText("1 из 3 вопросов")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ответ отправлен" }),
    ).toBeInTheDocument();
  });

  it("submits an answer as review when score is low", () => {
    getSelectionRangeMock.mockReturnValue([0, 3]);
    renderApp();

    fireEvent.mouseUp(getPassage());
    fireEvent.click(screen.getByRole("button", { name: "Отправить ответ" }));

    expect(screen.getByText("Нужно повторить")).toBeInTheDocument();
    expect(screen.getByText(/Штраф:/)).toBeInTheDocument();
  });

  it("navigates between questions and resets exercise", () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Вопрос 2" }));
    expect(screen.getByText(exercise.questions[1].prompt)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "К тренировкам" }));
    expect(screen.getByText(exercise.questions[0].prompt)).toBeInTheDocument();
    expect(screen.getByText("0 из 3 вопросов")).toBeInTheDocument();
  });
});
