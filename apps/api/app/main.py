from functools import lru_cache
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, status
from langchain_openai import ChatOpenAI

from app.config import Settings
from app.exercises import EXERCISE, PASSING_PERCENT, TextRange, find_question, score_coverage
from app.models.api_models import (
    CoverageScore,
    GeneratedExercise,
    GeneratedQuestion,
    GenerateExerciseRequest,
    GenerateExerciseResponse,
    HealthResponse,
    InvalidGeneratedExerciseError,
    PublicExercise,
    PublicQuestion,
    SelectionRange,
    SubmissionRequest,
    SubmissionResponse,
    UpstreamGenerationError,
)
from app.question_generator import QuestionGenerator

app = FastAPI(title="global-generation-api", version="0.1.0")

config = Settings()

api_version = config.API_V1_STR


@lru_cache
def get_question_generator() -> "QuestionGenerator":
    from app.question_generator import QuestionGenerator

    if not config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set in the environment")

    model = ChatOpenAI(
        api_key=config.OPENAI_API_KEY,
        model=config.OPENAI_MODEL,
        temperature=0.7,
    )
    return QuestionGenerator(model)


question_generator_dependency = Depends(get_question_generator)


def generated_to_response(exercise: GeneratedExercise) -> GenerateExerciseResponse:
    return GenerateExerciseResponse(
        exercise=GeneratedExercise(
            id=f"generated-{uuid4()}",
            section=exercise.section,
            difficulty=exercise.difficulty,
            title=exercise.title,
            instruction=exercise.instruction,
            text=exercise.text,
            questions=[
                GeneratedQuestion(
                    id=question.id,
                    prompt=question.prompt,
                    correct_ranges=question.correct_ranges,
                )
                for question in exercise.questions
            ],
        )
    )


@app.get("/", response_model=HealthResponse)
def root() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get(f"{api_version}/exercises/{{exercise_id}}", response_model=PublicExercise)
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


@app.post(f"{api_version}/exercises/generated", response_model=GenerateExerciseResponse)
def generate_exercise(
    request: GenerateExerciseRequest,
    generator: QuestionGenerator = question_generator_dependency,
) -> GenerateExerciseResponse:
    try:
        generated = generator.generate(request)
    except (InvalidGeneratedExerciseError, UpstreamGenerationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Question generation failed",
        ) from exc

    return generated_to_response(generated)


@app.post(
    f"{api_version}/exercises/{{exercise_id}}/submissions",
    response_model=SubmissionResponse,
)
def submit_exercise(exercise_id: str, submission: SubmissionRequest) -> SubmissionResponse:
    if exercise_id != EXERCISE.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    question = find_question(EXERCISE, submission.question_id)
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    selected_ranges: tuple[TextRange, ...] = tuple(
        (selected_range.start, selected_range.end) for selected_range in submission.selected_ranges
    )
    if any(end > len(EXERCISE.text) for _, end in selected_ranges):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Selection range exceeds exercise text length",
        )

    score = score_coverage(selected_ranges, question.correct_ranges)
    return SubmissionResponse(
        passed=score["percent"] >= PASSING_PERCENT,
        score=CoverageScore(
            covered_characters=int(score["covered_characters"]),
            correct_characters=int(score["correct_characters"]),
            incorrect_characters=int(score["incorrect_characters"]),
            penalty_characters=score["penalty_characters"],
            selected_characters=int(score["selected_characters"]),
            percent=int(score["percent"]),
        ),
        correct_ranges=[
            SelectionRange(start=start, end=end) for start, end in question.correct_ranges
        ],
    )
