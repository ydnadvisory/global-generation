export type TextRange = readonly [start: number, end: number];

export type EvidenceQuestion = {
  id: string;
  prompt: string;
};

export type EvidenceExercise = {
  id: string;
  section: string;
  difficulty: string;
  title: string;
  instruction: string;
  text: string;
  questions: readonly EvidenceQuestion[];
};

export type CoverageScore = {
  coveredCharacters: number;
  correctCharacters: number;
  incorrectCharacters: number;
  penaltyCharacters: number;
  selectedCharacters: number;
  percent: number;
};

export type SubmissionResult = {
  passed: boolean;
  score: CoverageScore;
  correctRanges: readonly TextRange[];
};

type ApiRange = {
  start: number;
  end: number;
};

type ApiSubmissionResult = {
  passed: boolean;
  score: {
    covered_characters: number;
    correct_characters: number;
    incorrect_characters: number;
    penalty_characters: number;
    selected_characters: number;
    percent: number;
  };
  correct_ranges: ApiRange[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getExercise(): Promise<EvidenceExercise> {
  return request<EvidenceExercise>("/api/exercises/rw-evidence-1");
}

export async function submitAnswer(
  exerciseId: string,
  questionId: string,
  selectedRanges: readonly TextRange[],
): Promise<SubmissionResult> {
  const result = await request<ApiSubmissionResult>(
    `/api/exercises/${exerciseId}/submissions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        selected_ranges: selectedRanges.map(([start, end]) => ({ start, end })),
      }),
    },
  );

  return {
    passed: result.passed,
    score: {
      coveredCharacters: result.score.covered_characters,
      correctCharacters: result.score.correct_characters,
      incorrectCharacters: result.score.incorrect_characters,
      penaltyCharacters: result.score.penalty_characters,
      selectedCharacters: result.score.selected_characters,
      percent: result.score.percent,
    },
    correctRanges: result.correct_ranges.map(({ start, end }) => [start, end]),
  };
}
