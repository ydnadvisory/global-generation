from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from pytest_mock import MockerFixture

from app.main import app, generated_exercises, get_question_generator
from app.models.api_models import (
    GeneratedExercise,
    GeneratedQuestion,
    SelectionRange,
    UpstreamGenerationError,
)
from app.question_generator import QuestionGenerator


@pytest.fixture
def client() -> Iterator[TestClient]:
    app.dependency_overrides.clear()
    generated_exercises.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    generated_exercises.clear()


def valid_generated_exercise() -> GeneratedExercise:
    return GeneratedExercise(
        id="generated-exercise",
        section="Reading & Writing",
        difficulty="medium",
        title="Evidence practice",
        instruction="Select evidence.",
        text="A generated passage.",
        questions=[
            GeneratedQuestion(
                id=f"question-{index}",
                prompt="Which words show the evidence?",
                correct_ranges=[SelectionRange(start=0, end=1)],
            )
            for index in range(1, 4)
        ],
    )


def post_with_generator(client: TestClient, mocker: MockerFixture, payload: dict[str, str]):
    generator = mocker.Mock(spec=QuestionGenerator)
    generator.generate.return_value = valid_generated_exercise()
    app.dependency_overrides[get_question_generator] = lambda: generator
    return client.post("/api/exercises/generated", json=payload), generator


def test_exercise_response_does_not_expose_answer_key(client: TestClient) -> None:
    response = client.get("/api/exercises/rw-evidence-1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["questions"][0] == {
        "id": "wastewater-solution",
        "prompt": (
            "Which keywords show how the scientific discovery became a solution "
            "to the cities' waste problem?"
        ),
    }
    assert "correct_ranges" not in response.text


def test_submission_is_graded_server_side(client: TestClient) -> None:
    response = client.post(
        "/api/exercises/rw-evidence-1/submissions",
        json={
            "question_id": "wastewater-solution",
            "selected_ranges": [
                {"start": 162, "end": 197},
                {"start": 278, "end": 311},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["passed"] is True
    assert response.json()["score"]["percent"] == 100


def test_submission_rejects_ranges_outside_the_exercise(client: TestClient) -> None:
    response = client.post(
        "/api/exercises/rw-evidence-1/submissions",
        json={
            "question_id": "wastewater-solution",
            "selected_ranges": [{"start": 0, "end": 9999}],
        },
    )

    assert response.status_code == 422


def test_generate_exercise_accepts_valid_request(client: TestClient, mocker: MockerFixture) -> None:
    generator = mocker.Mock(spec=QuestionGenerator)
    generator.generate.return_value = valid_generated_exercise()
    app.dependency_overrides[get_question_generator] = lambda: generator
    response = client.post(
        "/api/exercises/generated",
        json={
            "difficulty": "easy",
        },
    )

    assert response.status_code == 200
    generator.generate.assert_called_once()


def test_generate_exercise_rejects_invalid_request(client: TestClient) -> None:
    response = client.post(
        "/api/exercises/generated",
        json={
            "difficulty": "abracadabra",
        },
    )

    assert response.status_code == 422


def test_generated_route_hides_answer_key_and_grades_server_side(
    client: TestClient, mocker: MockerFixture
) -> None:
    response, generator = post_with_generator(client, mocker, {"difficulty": "medium"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["exercise"]["id"].startswith("generated-")
    assert payload["exercise"]["difficulty"] == "medium"
    assert len(payload["exercise"]["questions"]) == 3
    assert "correct_ranges" not in response.text

    submission = client.post(
        f"/api/exercises/{payload['exercise']['id']}/submissions",
        json={
            "question_id": "question-1",
            "selected_ranges": [{"start": 0, "end": 1}],
        },
    )

    assert submission.status_code == 200
    assert submission.json()["passed"] is True
    generator.generate.assert_called_once()


def test_generated_route_maps_provider_failure_to_502(
    client: TestClient, mocker: MockerFixture
) -> None:
    generator = mocker.Mock(spec=QuestionGenerator)
    generator.generate.side_effect = UpstreamGenerationError("private provider detail")
    app.dependency_overrides[get_question_generator] = lambda: generator

    response = client.post("/api/exercises/generated", json={"difficulty": "medium"})

    assert response.status_code == 502
    assert response.json() == {"detail": "Question generation failed"}
    assert "private provider detail" not in response.text


def test_extra_request_field_is_rejected_before_generator_call(
    client: TestClient, mocker: MockerFixture
) -> None:
    generator = mocker.Mock(spec=QuestionGenerator)
    app.dependency_overrides[get_question_generator] = lambda: generator
    response = client.post(
        "/api/exercises/generated",
        json={"difficulty": "medium", "topic": "water treatment"},
    )

    assert response.status_code == 422
    generator.generate.assert_not_called()
