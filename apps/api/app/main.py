from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from app.exercises import EXERCISE, PASSING_PERCENT, TextRange, find_question, score_coverage


class HealthResponse(BaseModel):
    status: str


class SelectionRange(BaseModel):
    start: int = Field(ge=0)
    end: int = Field(ge=0)

    @model_validator(mode="after")
    def has_positive_length(self) -> "SelectionRange":
        if self.end <= self.start:
            raise ValueError("end must be greater than start")
        return self


class PublicQuestion(BaseModel):
    id: str
    prompt: str


class PublicExercise(BaseModel):
    id: str
    section: str
    difficulty: str
    title: str
    instruction: str
    text: str
    questions: list[PublicQuestion]


class SubmissionRequest(BaseModel):
    question_id: str
    selected_ranges: list[SelectionRange] = Field(min_length=1)


class CoverageScore(BaseModel):
    covered_characters: int
    correct_characters: int
    incorrect_characters: int
    penalty_characters: float
    selected_characters: int
    percent: int


class SubmissionResponse(BaseModel):
    passed: bool
    score: CoverageScore
    correct_ranges: list[SelectionRange]


app = FastAPI(title="global-generation-api", version="0.1.0")


@app.get("/", response_model=HealthResponse)
def root() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/api/exercises/{exercise_id}", response_model=PublicExercise)
def get_exercise(exercise_id: str) -> PublicExercise:
    if exercise_id != EXERCISE.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    return PublicExercise(
        id=EXERCISE.id,
        section=EXERCISE.section,
        difficulty=EXERCISE.difficulty,
        title=EXERCISE.title,
        instruction=EXERCISE.instruction,
        text=EXERCISE.text,
        questions=[
            PublicQuestion(id=question.id, prompt=question.prompt)
            for question in EXERCISE.questions
        ],
    )


@app.post(
    "/api/exercises/{exercise_id}/submissions",
    response_model=SubmissionResponse,
)
def submit_exercise(exercise_id: str, submission: SubmissionRequest) -> SubmissionResponse:
    if exercise_id != EXERCISE.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    question = find_question(EXERCISE, submission.question_id)
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    selected_ranges: tuple[TextRange, ...] = tuple(
        (selected_range.start, selected_range.end)
        for selected_range in submission.selected_ranges
    )
    if any(end > len(EXERCISE.text) for _, end in selected_ranges):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Selection range exceeds exercise text length",
        )

    score = score_coverage(selected_ranges, question.correct_ranges)
    return SubmissionResponse(
        passed=score["percent"] >= PASSING_PERCENT,
        score=CoverageScore(**score),
        correct_ranges=[
            SelectionRange(start=start, end=end)
            for start, end in question.correct_ranges
        ],
    )
