from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_exercise_response_does_not_expose_answer_key() -> None:
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


def test_submission_is_graded_server_side() -> None:
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


def test_submission_rejects_ranges_outside_the_exercise() -> None:
    response = client.post(
        "/api/exercises/rw-evidence-1/submissions",
        json={
            "question_id": "wastewater-solution",
            "selected_ranges": [{"start": 0, "end": 9999}],
        },
    )

    assert response.status_code == 422


def test_generate_exercise_accepts_valid_request() -> None:
    response = client.post(
        "/api/exercises/generated",
        json={
            "difficulty": "easy",
        },
    )

    assert response.status_code == 200


def test_generate_exercise_rejects_invalid_request() -> None:
    response = client.post(
        "/api/exercises/generated",
        json={
            "difficulty": "abracadabra",
        },
    )

    assert response.status_code == 422
