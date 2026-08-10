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


class QuestionBase(BaseModel):
    id: str
    prompt: str


class PublicQuestion(QuestionBase):
    pass


class ExerciseBase[QuestionT: QuestionBase](BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    section: str = Field(min_length=1)
    difficulty: str = Field(min_length=1)
    title: str = Field(min_length=1)
    instruction: str = Field(min_length=1)
    text: str = Field(min_length=1)
    questions: list[QuestionT]

    @model_validator(mode="after")
    def validate_questions(self) -> "ExerciseBase[QuestionT]":
        if not self.questions:
            raise ValueError("questions must not be empty")
        if len(self.questions) != 3:
            raise ValueError("questions must contain exactly 3 items")
        question_ids = {question.id for question in self.questions}
        if len(question_ids) != len(self.questions):
            raise ValueError("questions must have unique ids")
        return self


class PublicExercise(ExerciseBase[PublicQuestion]):
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


class GeneratedQuestion(QuestionBase):
    """The trusted generated response, including the resolved answer key."""

    model_config = ConfigDict(extra="forbid")

    correct_ranges: list[SelectionRange] = Field(min_length=1)


class GeneratedExercise(ExerciseBase[GeneratedQuestion]):
    """The trusted generated response returned by the API."""

    questions: list[GeneratedQuestion] = Field(min_length=3, max_length=3)


class GeneratedQuestionDraft(QuestionBase):
    """Provider output before evidence snippets are resolved to character ranges."""

    model_config = ConfigDict(extra="forbid")

    evidence: list[str] = Field(min_length=1)


class GeneratedExerciseDraft(ExerciseBase[GeneratedQuestionDraft]):
    """Strict structured output expected from the generation model."""

    questions: list[GeneratedQuestionDraft] = Field(min_length=3, max_length=3)


class EvidenceValidationResult(BaseModel):
    """Structured semantic review returned by the validation model."""

    model_config = ConfigDict(extra="forbid")

    valid: bool
    issues: list[str] = Field(default_factory=list)


class GenerateExerciseResponse(BaseModel):
    exercise: GeneratedExercise


class GenerationError(Exception):
    """Base class for errors that should become HTTP 502."""


class UpstreamGenerationError(GenerationError):
    """The provider could not produce a result."""


class InvalidGeneratedExerciseError(GenerationError):
    """The provider returned data that failed independent validation."""
