import pytest

from app.models.api_models import (
    GeneratedExercise,
    GeneratedQuestion,
    GenerateExerciseRequest,
    InvalidGeneratedExerciseError,
    SelectionRange,
)
from app.question_generator import build_prompt, validate_generated_exercise


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
    assert "start is inclusive and end is exclusive" in prompt
    assert "age-appropriate academic topic at random" in prompt


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
    ],
)
def test_invalid_generated_exercise_is_rejected(change, message: str) -> None:
    with pytest.raises(InvalidGeneratedExerciseError, match=message):
        validate_generated_exercise(change(valid_generated_exercise()))
