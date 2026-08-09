# Lab: Generate an evidence exercise with OpenAI

## Lab outcome

Add `POST /api/exercises/generated`. It accepts only a difficulty, asks a
`QuestionGenerator` service to create one text and exactly three evidence-selection
questions, then returns an `Exercise`-shaped response similar to `get_exercise`.

Every successful call creates a **new** text, three questions, and their correct answer
ranges. The response is a complete new exercise set; it does not reuse `EXERCISE`.

**You will practise:** FastAPI request validation, a service boundary, LangChain
structured output, and validating AI-generated character offsets.

> The current public `get_exercise` response deliberately hides `correct_ranges`.
> Returning them makes this endpoint suitable for author preview, moderation, or
> trusted users only. Do not expose it to learners before grading is complete.

## Step 1 — define the contract

```json
POST /api/exercises/generated
{
  "difficulty": "Средний"
}
```

```json
{
  "id": "generated-uuid",
  "section": "Reading & Writing",
  "difficulty": "Средний",
  "title": "Evidence practice",
  "instruction": "Select evidence in the text for each question.",
  "text": "...",
  "questions": [
    {
      "id": "question-1",
      "prompt": "...",
      "correct_ranges": [{ "start": 12, "end": 44 }]
    }
  ]
}
```

`difficulty` is the only required client input. Configure the request model with
`extra="forbid"`: reject `topic`, `language`, and all other fields. The service chooses
a random suitable topic; all generated text and questions are English by default.

Validate supported difficulty, exactly three questions, unique IDs,
`0 <= start < end <= len(text)`, and at least one range per question. Return `422` for
invalid client input and `502` for an unusable model result or OpenAI/LangChain failure.
Never return a partial exercise.

**Checkpoint:** a request is either rejected before the model is called, or produces one
complete exercise with exactly three questions.

**Test task:** create a FastAPI test that sends only a valid `difficulty` and asserts
`200`. Send an unsupported difficulty and a request containing `topic`; each must return
`422`. Use a fake generator: this test must not call OpenAI.

## Step 2 — keep responsibilities separate

```
app/
  main.py                  # request/response models and route
  question_generator.py    # QuestionGenerator and OpenAI/LangChain call
  exercises.py             # existing static exercise and grading logic
```

Keep the route thin:

1. Parse `GenerateExerciseRequest`.
2. Call `QuestionGenerator.generate(request)`.
3. Validate the generated result with a strict output model.
4. Convert it to the response model and return it.

`QuestionGenerator` owns prompt construction and the AI call. Inject the chat model
into its constructor so tests can replace it with a fake. Read `OPENAI_API_KEY` from
the environment; never log the key, full prompt, or generated learner data.

## Step 3 — use this valid prompt

Pass the validated difficulty into this template. Use it as the system/developer
instruction; the Pydantic model supplied to `with_structured_output` defines the
response schema.

```text
You create Reading & Writing evidence-selection exercises.

Choose one suitable, age-appropriate academic topic at random. Create one original
English text about that topic. Difficulty: {difficulty}.

Return exactly three questions. Each question must ask the learner to select evidence
from the text. For every question, provide one or more correct_ranges using character
offsets in the final text: start is inclusive and end is exclusive.

Rules:
- Write the complete final text before calculating offsets.
- Do not change the text after calculating offsets.
- Every range must satisfy 0 <= start < end <= length of the final text.
- Use distinct question IDs and do not return explanations, Markdown, or extra fields.
- Return data matching the supplied structured-output schema only.
```

Build the prompt from this fixed template and the validated difficulty. Do not allow the
caller to inject a topic or choose the output language.

**Checkpoint:** test the prompt with a fake model first. The service must reject a
result with four questions or an out-of-bounds range.

**Test task:** create a unit test for `build_prompt`. Assert that it contains the
difficulty, English-language rule, random-topic instruction, exactly-three requirement,
and inclusive/exclusive offset rule.

## Step 4 — validate the AI result

Use a structured-output Pydantic model, not free-form JSON parsing. In the prompt,
require the model to return text first and character offsets that refer to that exact
text. Ask it not to change the text after calculating ranges.

After the response, independently check every range against `text`. Character offsets
are Python string offsets: start inclusive, end exclusive, matching the existing
`TextRange` contract and browser selection API.

**Test task:** create parameterised validator tests for: four questions, duplicate IDs,
`start == end`, a negative start, and an `end` greater than `len(text)`. Each case must
fail before the route returns a response.

## Step 5 — implementation outline

```python
class QuestionGenerator:
    def __init__(self, model: Runnable) -> None:
        self.model = model

    def generate(self, request: GenerateExerciseRequest) -> GeneratedExercise:
        prompt = build_prompt(request)
        result = self.model.with_structured_output(GeneratedExercise).invoke(prompt)
        validate_generated_exercise(result)
        return result
```

Create the real model once during application startup/configuration, for example with
`ChatOpenAI(model="...", temperature=...)`. Choose the model name from an environment
variable. Do not instantiate the client for every request.

**Test task:** create a route test where the fake generator raises an upstream error.
Assert `502` and assert that the response does not contain the provider exception text.

### Pytest mocking reminder

Make the route depend on `get_question_generator`, then override that dependency in
tests. This keeps all tests offline: no API key and no OpenAI request are needed.

```python
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_question_generator
from app.question_generator import QuestionGenerator, UpstreamGenerationError


@pytest.fixture
def fake_generator() -> Mock:
    return Mock(spec=QuestionGenerator)


def test_generates_new_exercise(fake_generator: Mock) -> None:
    fake_generator.generate.return_value = generated_exercise
    app.dependency_overrides[get_question_generator] = lambda: fake_generator
    try:
        response = TestClient(app).post("/api/exercises/generated", json=valid_request)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    fake_generator.generate.assert_called_once()


def test_hides_provider_error(fake_generator: Mock) -> None:
    fake_generator.generate.side_effect = UpstreamGenerationError("OpenAI timeout")
    # Apply the same dependency override, call the route, then assert 502.
```

Use `return_value` for a successful fake and `side_effect` for an error. Always clear
`app.dependency_overrides` in `finally`, otherwise one test can change another test.

## Step 6 — test and deliver

Add focused tests with a fake generator/model:

- valid result returns `200` and three questions;
- invalid range, duplicate ID, or not-three questions is rejected;
- provider failure becomes `502` without leaking provider details;
- static `GET /api/exercises/{exercise_id}` still does not expose answer keys.

Add pinned `langchain` and `langchain-openai` dependencies with `uv`, update
`uv.lock`, document required environment variables, then run:

```bash
cd apps/api
uv run pytest
uv run ruff check .
```

Before production, add authentication/rate limiting and persist generated exercises
only after a moderation/quality-review decision.
