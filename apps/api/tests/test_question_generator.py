import pytest

from app.models.api_models import (
    GeneratedExercise,
    GeneratedQuestion,
    GenerateExerciseRequest,
    InvalidGeneratedExerciseError,
    SelectionRange,
)
from app.question_generator import (
    QuestionGenerator,
    build_prompt,
    resolve_evidence_ranges,
    validate_generated_exercise,
)


def valid_generated_exercise() -> GeneratedExercise:
    text = "A short passage about a scientific discovery."
    return GeneratedExercise(
        id="exercise-1",
        section="Reading & Writing",
        difficulty="medium",
        title="Evidence practice",
        instruction="Select evidence.",
        text=text,
        questions=[
            GeneratedQuestion(
                id="question-1",
                prompt="Which words show the discovery?",
                correct_ranges=[SelectionRange(start=2, end=7)],
            ),
            GeneratedQuestion(
                id="question-2",
                prompt="Which words show the topic?",
                correct_ranges=[SelectionRange(start=8, end=15)],
            ),
            GeneratedQuestion(
                id="question-3",
                prompt="Which words show the result?",
                correct_ranges=[SelectionRange(start=16, end=25)],
            ),
        ],
    )


def test_build_prompt_contains_required_instructions() -> None:
    prompt = build_prompt(GenerateExerciseRequest(difficulty="hard"))

    assert "Difficulty: hard" in prompt
    assert "original English text" in prompt
    assert "exactly three questions" in prompt
    assert "evidence strings copied verbatim" in prompt
    assert "age-appropriate academic topic at random" in prompt
    assert "one specific claim" in prompt
    assert "Do not use vague prompts" in prompt
    assert "Every evidence string must occur exactly as written" in prompt


def test_resolve_evidence_ranges_uses_exact_unique_snippets() -> None:
    ranges = resolve_evidence_ranges("Green spaces reduce stress.", ["reduce stress"])

    assert [(item.start, item.end) for item in ranges] == [(13, 26)]


def test_resolve_evidence_ranges_rejects_ambiguous_snippets() -> None:
    with pytest.raises(InvalidGeneratedExerciseError, match="unique"):
        resolve_evidence_ranges("Green spaces help. Green spaces cool cities.", ["Green spaces"])


class FakeStructuredModel:
    def __init__(self, responses: list[object]) -> None:
        self.responses = iter(responses)
        self.prompts: list[str] = []

    def invoke(self, prompt: str) -> object:
        self.prompts.append(prompt)
        return next(self.responses)


class FakeModel:
    def __init__(
        self, generation_responses: list[object], validation_responses: list[object]
    ) -> None:
        self.generation_model = FakeStructuredModel(generation_responses)
        self.validation_model = FakeStructuredModel(validation_responses)

    def with_structured_output(self, schema: type) -> FakeStructuredModel:
        if schema.__name__ == "GeneratedExerciseDraft":
            return self.generation_model
        return self.validation_model


def generated_draft() -> dict[str, object]:
    return {
        "id": "draft-1",
        "section": "Reading & Writing Evidence Selection",
        "difficulty": "medium",
        "title": "Urban Green Spaces",
        "instruction": "Select evidence from the text.",
        "text": "Urban parks reduce stress for residents.",
        "questions": [
            {
                "id": "question-1",
                "prompt": "What do urban parks reduce for residents?",
                "evidence": ["reduce stress"],
            },
            {
                "id": "question-2",
                "prompt": "What type of places are urban parks?",
                "evidence": ["Urban parks"],
            },
            {
                "id": "question-3",
                "prompt": "Who benefits from the parks?",
                "evidence": ["residents"],
            },
        ],
    }


def test_question_generator_resolves_snippets_and_calls_validator() -> None:
    generator = QuestionGenerator(FakeModel([generated_draft()], [{"valid": True, "issues": []}]))

    result = generator.generate(GenerateExerciseRequest(difficulty="medium"))

    assert result.questions[0].correct_ranges[0].model_dump() == {"start": 12, "end": 25}


def test_question_generator_normalizes_provider_difficulty() -> None:
    draft = generated_draft()
    draft["difficulty"] = "Medium"
    generator = QuestionGenerator(FakeModel([draft], [{"valid": True, "issues": []}]))

    result = generator.generate(GenerateExerciseRequest(difficulty="medium"))

    assert result.difficulty == "medium"


def test_question_generator_retries_once_after_semantic_rejection() -> None:
    generator = QuestionGenerator(
        FakeModel(
            [generated_draft(), generated_draft()],
            [
                {"valid": False, "issues": ["evidence does not answer the question"]},
                {"valid": True},
            ],
        )
    )

    result = generator.generate(GenerateExerciseRequest(difficulty="medium"))

    assert result.id == "draft-1"


def test_question_generator_repairs_missing_evidence_with_targeted_prompt() -> None:
    invalid_draft = generated_draft()
    invalid_draft["questions"] = [
        {
            **question,
            "evidence": ["does not occur"],
        }
        if question["id"] == "question-1"
        else question
        for question in invalid_draft["questions"]  # type: ignore[index]
    ]
    model = FakeModel(
        [invalid_draft, generated_draft()],
        [{"valid": True}],
    )

    result = QuestionGenerator(model).generate(GenerateExerciseRequest(difficulty="medium"))

    assert result.id == "draft-1"
    repair_prompt = model.generation_model.prompts[1]
    assert "Repair this Reading & Writing evidence-selection exercise" in repair_prompt
    assert "Evidence does not occur in the generated text." in repair_prompt
    assert '"evidence"' in repair_prompt
    assert '"does not occur"' in repair_prompt


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (
            lambda exercise: exercise.model_copy(
                update={"questions": [*exercise.questions, exercise.questions[0]]}
            ),
            "3",
        ),
        (
            lambda exercise: exercise.model_copy(
                update={
                    "questions": [
                        exercise.questions[0],
                        exercise.questions[0],
                        exercise.questions[2],
                    ]
                }
            ),
            "unique",
        ),
        (
            lambda exercise: exercise.model_copy(
                update={
                    "questions": [
                        exercise.questions[0].model_copy(
                            update={
                                "correct_ranges": [
                                    SelectionRange(start=0, end=len(exercise.text) + 1)
                                ]
                            }
                        ),
                        *exercise.questions[1:],
                    ]
                }
            ),
            "outside",
        ),
        (
            lambda exercise: exercise.model_copy(
                update={
                    "questions": [
                        exercise.questions[0].model_copy(
                            update={"correct_ranges": [SelectionRange(start=3, end=8)]}
                        ),
                        *exercise.questions[1:],
                    ]
                }
            ),
            "invalid text boundaries",
        ),
    ],
)
def test_invalid_generated_exercise_is_rejected(change, message: str) -> None:
    with pytest.raises(InvalidGeneratedExerciseError, match=message):
        validate_generated_exercise(change(valid_generated_exercise()))
