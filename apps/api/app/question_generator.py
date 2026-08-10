from langchain_core.language_models import BaseChatModel

from app.models.api_models import (
    GeneratedExercise,
    GenerateExerciseRequest,
    InvalidGeneratedExerciseError,
    UpstreamGenerationError,
)

PROMPT_TEMPLATE = """You create Reading & Writing evidence-selection exercises.

Choose one suitable, age-appropriate academic topic at random. Create one original English
text about that topic. Difficulty: {difficulty}.

Return exactly three questions. Each question must ask the learner to select evidence from
the text. For every question, provide one or more correct_ranges using character offsets in
the final text: start is inclusive and end is exclusive.

Rules:
- Write the complete final text before calculating offsets.
- Do not change the text after calculating offsets.
- Every range must satisfy 0 <= start < end <= length of the final text.
- Use distinct question IDs.
- Return no explanations, Markdown, or extra fields.
- Return English text and English questions.
- Return data matching the supplied structured-output schema only.
"""


def build_prompt(request: GenerateExerciseRequest) -> str:
    return PROMPT_TEMPLATE.format(difficulty=request.difficulty)


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
    if expected_difficulty is not None and exercise.difficulty != expected_difficulty:
        raise InvalidGeneratedExerciseError(
            f"Generated exercise difficulty {exercise.difficulty!r} does not match expected {expected_difficulty!r}."
        )
    return exercise


class QuestionGenerator:
    def __init__(self, model: BaseChatModel) -> None:
        self.model = model.with_structured_output(GeneratedExercise)

    def generate(self, request: GenerateExerciseRequest) -> GeneratedExercise:
        try:
            result = self.model.invoke(build_prompt(request))
            exercise = GeneratedExercise.model_validate(result)
        except InvalidGeneratedExerciseError:
            raise
        except Exception as exc:
            raise UpstreamGenerationError("question provider failed") from exc

        return validate_generated_exercise(exercise)
