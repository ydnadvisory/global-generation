from dataclasses import dataclass

TextRange = tuple[int, int]
INCORRECT_CHARACTER_PENALTY = 0.25
PASSING_PERCENT = 70


@dataclass(frozen=True)
class Question:
    id: str
    prompt: str
    correct_ranges: tuple[TextRange, ...]


@dataclass(frozen=True)
class Exercise:
    id: str
    section: str
    difficulty: str
    title: str
    instruction: str
    text: str
    questions: tuple[Question, ...]


EXERCISE = Exercise(
    id="rw-evidence-1",
    section="Reading & Writing",
    difficulty="Средний",
    title="Найди опору",
    instruction=(
        "Для каждого вопроса выделите один или несколько фрагментов общего текста, "
        "затем отправьте ответ."
    ),
    text=(
        "In the late 1800s, many cities faced a serious problem: too much waste and "
        "too little space to deal with it. Scientists who studied bacteria discovered "
        "that some bacteria break down waste materials into harmless substances. Using "
        "this knowledge, engineers designed systems that used bacteria to clean wastewater "
        "before it returned to rivers and lakes. These early wastewater treatment systems "
        "improved public health and helped cities grow.\n\nToday, some communities use "
        "constructed wetlands alongside treatment plants. In these wetlands, gravel, soil, "
        "plants, and microorganisms work together to remove pollutants from water. Unlike "
        "a traditional plant, a wetland system can also create habitat for birds and insects. "
        "However, it requires more land, so it may be impractical in densely populated areas."
    ),
    questions=(
        Question(
            id="wastewater-solution",
            prompt=(
                "Which keywords show how the scientific discovery became a solution "
                "to the cities' waste problem?"
            ),
            correct_ranges=((162, 197), (278, 311)),
        ),
        Question(
            id="problem",
            prompt="Which keywords show what constructed wetlands do to water?",
            correct_ranges=((537, 577), (595, 623)),
        ),
        Question(
            id="impact",
            prompt="Which keywords identify a limitation of constructed wetlands?",
            correct_ranges=((729, 747), (762, 800)),
        ),
    ),
)


def find_question(exercise: Exercise, question_id: str) -> Question | None:
    return next((question for question in exercise.questions if question.id == question_id), None)


def normalise_ranges(ranges: tuple[TextRange, ...]) -> tuple[TextRange, ...]:
    sorted_ranges = sorted(item for item in ranges if item[1] > item[0])
    merged: list[TextRange] = []

    for start, end in sorted_ranges:
        if not merged or start > merged[-1][1]:
            merged.append((start, end))
            continue

        previous_start, previous_end = merged[-1]
        merged[-1] = (previous_start, max(previous_end, end))

    return tuple(merged)


def score_coverage(
    selected_ranges: tuple[TextRange, ...], correct_ranges: tuple[TextRange, ...]
) -> dict[str, float | int]:
    selected = normalise_ranges(selected_ranges)
    correct = normalise_ranges(correct_ranges)
    correct_characters = sum(end - start for start, end in correct)
    selected_characters = sum(end - start for start, end in selected)
    covered_characters = sum(
        max(0, min(correct_end, selected_end) - max(correct_start, selected_start))
        for correct_start, correct_end in correct
        for selected_start, selected_end in selected
    )
    incorrect_characters = selected_characters - covered_characters
    penalty_characters = incorrect_characters * INCORRECT_CHARACTER_PENALTY
    percent = (
        0
        if correct_characters == 0
        else max(
            0,
            round(((covered_characters - penalty_characters) / correct_characters) * 100),
        )
    )

    return {
        "covered_characters": covered_characters,
        "correct_characters": correct_characters,
        "incorrect_characters": incorrect_characters,
        "penalty_characters": penalty_characters,
        "selected_characters": selected_characters,
        "percent": percent,
    }
