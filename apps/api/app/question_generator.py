from typing import Protocol

from pydantic import BaseModel

from app.models.api_models import (
    EvidenceValidationResult,
    GeneratedExercise,
    GeneratedExerciseDraft,
    GeneratedQuestion,
    GeneratedQuestionDraft,
    GenerateExerciseRequest,
    InvalidGeneratedExerciseError,
    SelectionRange,
    UpstreamGenerationError,
)

PROMPT_TEMPLATE = """You create Reading & Writing evidence-selection exercises.

Choose one suitable, age-appropriate academic topic at random. Create one original English text
about that topic. Difficulty: {difficulty}.

Return exactly three questions. Each question must ask the learner to select evidence from
the text. For every question, provide one or more evidence strings copied verbatim from the
final text. The server will calculate character offsets from those strings.

Rules:
- Write the complete final text before choosing evidence.
- Do not change the text after choosing evidence.
- Each question must ask about one specific claim that is explicitly stated in the text.
- Each evidence string must directly and completely answer its question.
- Do not use vague prompts such as "What is one benefit?" when several answers are possible;
  name the specific benefit or claim the learner must find.
- Select the smallest self-contained phrase or sentence that proves the claim. Do not include
  neighbouring claims. Every evidence string must occur exactly as written in the final text.
- Before returning, copy each evidence string directly from the final text and verify that it
  is the intended evidence for that question.
- Use distinct question IDs.
- Return no explanations, Markdown, or extra fields.
- Return English text and English questions.
- Return data matching the supplied structured-output schema only.
"""

VALIDATION_PROMPT_TEMPLATE = """You are a strict reviewer of a Reading & Writing evidence-selection exercise.

Return valid=true only when every evidence string directly and completely answers its question.
Evidence must be copied verbatim from the text and must not rely on outside knowledge or
unstated inference. Reject vague questions, evidence that answers only part of a question,
evidence containing unrelated neighbouring claims, or evidence that does not occur exactly in
the text. Return no explanations outside the supplied structured-output schema.

Exercise:
{exercise}
"""

MAX_GENERATION_ATTEMPTS = 2


class StructuredRunnable(Protocol):
    def invoke(self, prompt: str) -> object: ...


class StructuredOutputModel(Protocol):
    def with_structured_output(self, schema: type[BaseModel]) -> StructuredRunnable: ...


def build_prompt(request: GenerateExerciseRequest) -> str:
    return PROMPT_TEMPLATE.format(difficulty=request.difficulty)


def normalize_generated_difficulty(difficulty: str) -> str:
    """Canonicalize harmless provider formatting before request validation."""
    return difficulty.strip().lower()


def resolve_evidence_ranges(text: str, evidence: list[str]) -> list[SelectionRange]:
    ranges: list[SelectionRange] = []
    for snippet in evidence:
        if not snippet or snippet != snippet.strip():
            raise InvalidGeneratedExerciseError(
                "Evidence must not contain leading or trailing whitespace."
            )

        start = text.find(snippet)
        if start == -1:
            raise InvalidGeneratedExerciseError("Evidence does not occur in the generated text.")
        if text.find(snippet, start + 1) != -1:
            raise InvalidGeneratedExerciseError("Evidence must identify one unique text location.")

        ranges.append(SelectionRange(start=start, end=start + len(snippet)))
    return ranges


def build_validation_prompt(exercise: GeneratedExerciseDraft) -> str:
    return VALIDATION_PROMPT_TEMPLATE.format(exercise=exercise.model_dump_json(indent=2))


def validate_generated_exercise(
    exercise: GeneratedExercise, *, expected_difficulty: str | None = None
) -> GeneratedExercise:
    if len(exercise.questions) != 3:
        raise InvalidGeneratedExerciseError("Generated exercise must contain exactly 3 questions.")

    question_ids = {question.id for question in exercise.questions}
    if len(question_ids) != len(exercise.questions):
        raise InvalidGeneratedExerciseError("Generated exercise questions must have unique IDs.")

    text_length = len(exercise.text)
    for question in exercise.questions:
        if not question.correct_ranges:
            raise InvalidGeneratedExerciseError(
                f"Question {question.id} must have at least one correct range."
            )

        for text_range in question.correct_ranges:
            if not 0 <= text_range.start < text_range.end <= text_length:
                raise InvalidGeneratedExerciseError(
                    f"range for question {question.id!r} is outside the generated text"
                )

            starts_inside_word = (
                text_range.start > 0
                and exercise.text[text_range.start - 1].isalnum()
                and exercise.text[text_range.start].isalnum()
            )
            ends_inside_word = (
                text_range.end < text_length
                and exercise.text[text_range.end - 1].isalnum()
                and exercise.text[text_range.end].isalnum()
            )
            includes_leading_or_trailing_whitespace = (
                exercise.text[text_range.start].isspace()
                or exercise.text[text_range.end - 1].isspace()
            )
            if starts_inside_word or ends_inside_word or includes_leading_or_trailing_whitespace:
                raise InvalidGeneratedExerciseError(
                    f"range for question {question.id!r} has invalid text boundaries"
                )
    if expected_difficulty is not None and exercise.difficulty != expected_difficulty:
        raise InvalidGeneratedExerciseError(
            f"Generated exercise difficulty {exercise.difficulty!r} does not match expected {expected_difficulty!r}."
        )
    return exercise


class QuestionGenerator:
    def __init__(self, model: StructuredOutputModel) -> None:
        self.generation_model = model.with_structured_output(GeneratedExerciseDraft)
        self.validation_model = model.with_structured_output(EvidenceValidationResult)

    def _generate_once(self, request: GenerateExerciseRequest) -> GeneratedExercise:
        draft = GeneratedExerciseDraft.model_validate(
            self.generation_model.invoke(build_prompt(request))
        )
        exercise = GeneratedExercise(
            id=draft.id,
            section=draft.section,
            difficulty=normalize_generated_difficulty(draft.difficulty),
            title=draft.title,
            instruction=draft.instruction,
            text=draft.text,
            questions=[
                GeneratedQuestion(
                    id=question.id,
                    prompt=question.prompt,
                    correct_ranges=resolve_evidence_ranges(draft.text, question.evidence),
                )
                for question in draft.questions
            ],
        )
        return validate_generated_exercise(exercise, expected_difficulty=request.difficulty)

    def generate(self, request: GenerateExerciseRequest) -> GeneratedExercise:
        last_invalid: InvalidGeneratedExerciseError | None = None
        for _ in range(MAX_GENERATION_ATTEMPTS):
            try:
                exercise = self._generate_once(request)
                validation = EvidenceValidationResult.model_validate(
                    self.validation_model.invoke(
                        build_validation_prompt(
                            GeneratedExerciseDraft(
                                id=exercise.id,
                                section=exercise.section,
                                difficulty=exercise.difficulty,
                                title=exercise.title,
                                instruction=exercise.instruction,
                                text=exercise.text,
                                questions=[
                                    GeneratedQuestionDraft(
                                        id=question.id,
                                        prompt=question.prompt,
                                        evidence=[
                                            exercise.text[item.start : item.end]
                                            for item in question.correct_ranges
                                        ],
                                    )
                                    for question in exercise.questions
                                ],
                            )
                        )
                    )
                )
                if not validation.valid:
                    detail = "; ".join(validation.issues) or "semantic validation failed"
                    raise InvalidGeneratedExerciseError(detail)
                return exercise
            except InvalidGeneratedExerciseError as exc:
                last_invalid = exc
            except Exception as exc:
                raise UpstreamGenerationError("question provider failed") from exc

        raise last_invalid or InvalidGeneratedExerciseError("generated exercise failed validation")
