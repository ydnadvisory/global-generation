from pydantic import BaseModel, ConfigDict, Field, model_validator


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

    @model_validator(mode="after")
    def validate_questions(self) -> "PublicExercise":
        if not self.questions:
            raise ValueError("questions must not be empty")
        if len(self.questions) != 3:
            raise ValueError("questions must contain exactly 3 items")
        question_ids = {question.id for question in self.questions}
        if len(question_ids) != len(self.questions):
            raise ValueError("questions must have unique ids")
        return self


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


class GenerateExerciseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    difficulty: str

    @model_validator(mode="after")
    def validate_difficulty(self) -> "GenerateExerciseRequest":
        valid_difficulties = {"easy", "medium", "hard"}
        if self.difficulty not in valid_difficulties:
            raise ValueError(
                f"Invalid difficulty: {self.difficulty}. Must be one of {valid_difficulties}."
            )
        return self


class GenerateExerciseResponse(BaseModel):
    exercise: PublicExercise


class GeneratedQuestion(BaseModel):
    """The model/provider output, including the answer key for trusted use."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    correct_ranges: list[SelectionRange] = Field(min_length=1)


class GeneratedExercise(BaseModel):
    """Strict structured output expected from the question generator."""

    model_config = ConfigDict(extra="forbid")

    section: str = Field(min_length=1)
    difficulty: str = Field(min_length=1)
    title: str = Field(min_length=1)
    instruction: str = Field(min_length=1)
    text: str = Field(min_length=1)
    questions: list[GeneratedQuestion] = Field(min_length=3, max_length=3)


class GenerationError(Exception):
    """Base class for errors that should become HTTP 502."""


class UpstreamGenerationError(GenerationError):
    """The provider could not produce a result."""


class InvalidGeneratedExerciseError(GenerationError):
    """The provider returned data that failed independent validation."""
