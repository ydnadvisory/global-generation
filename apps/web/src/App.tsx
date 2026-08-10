import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  GraduationCap,
  Home,
  Lightbulb,
  RefreshCw,
  RotateCcw,
  Settings,
  Target,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getGeneratedExercise,
  getExercise,
  submitAnswer,
  type EvidenceExercise,
  type GeneratedEvidenceExercise,
  type SubmissionResult,
  type TextRange,
} from "./api";
import { addRange, getSelectionRange, scoreCoverage } from "./utils";

const navItems = [
  { label: "Главная", icon: Home },
  { label: "План подготовки", icon: BookOpen },
  { label: "Режимы тренировок", icon: Target, active: true },
  { label: "Мой прогресс", icon: BarChart3 },
];

type AnswersByQuestion = Record<string, TextRange[]>;
type SubmissionsByQuestion = Record<string, SubmissionResult>;
type LoadedExercise = EvidenceExercise | GeneratedEvidenceExercise;

function App() {
  const [exercise, setExercise] = useState<LoadedExercise | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswersByQuestion>({});
  const [submissions, setSubmissions] = useState<SubmissionsByQuestion>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [submittingQuestionId, setSubmittingQuestionId] = useState<string | null>(
    null,
  );
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    getGeneratedExercise()
      .catch(() => getExercise())
      .then((loadedExercise) => {
        if (!mounted) return;

        setExercise(loadedExercise);
        setActiveQuestionId(loadedExercise.questions[0]?.id ?? null);
      })
      .catch(() => {
        if (mounted) setLoadError("Не удалось загрузить упражнение.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loadError) {
    return <main className="app-status">{loadError}</main>;
  }

  if (!exercise || !activeQuestionId) {
    return <LoadingExercise />;
  }

  const loadedExercise: EvidenceExercise = exercise;
  const canRegenerate = "correctRangesByQuestion" in exercise;

  const selectedQuestion = loadedExercise.questions.find(
    ({ id }) => id === activeQuestionId,
  );
  if (!selectedQuestion) {
    return <main className="app-status">Вопрос не найден.</main>;
  }

  const currentQuestion = selectedQuestion;

  const activeRanges = answers[currentQuestion.id] ?? [];
  const activeSubmission = submissions[currentQuestion.id];
  const completedCount = Object.keys(submissions).length;

  function captureSelection() {
    if (activeSubmission || !textRef.current) return;

    const range = getSelectionRange(textRef.current);
    if (!range) return;

    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: addRange(current[currentQuestion.id] ?? [], range),
    }));
    window.getSelection()?.removeAllRanges();
  }

  function clearSelection() {
    if (activeSubmission) return;

    setAnswers((current) => ({ ...current, [currentQuestion.id]: [] }));
  }

  function removeSelectedRange(rangeToRemove: TextRange) {
    if (activeSubmission) return;

    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: (current[currentQuestion.id] ?? []).filter(
        ([start, end]) =>
          start !== rangeToRemove[0] || end !== rangeToRemove[1],
      ),
    }));
  }

  function resetExercise() {
    setActiveQuestionId(loadedExercise.questions[0].id);
    setAnswers({});
    setSubmissions({});
    setSubmissionError(null);
  }

  async function regenerateExercise() {
    setIsRegenerating(true);
    setRegenerateError(null);

    try {
      const freshExercise = await getGeneratedExercise("medium");
      setExercise(freshExercise);
      setActiveQuestionId(freshExercise.questions[0]?.id ?? null);
      setAnswers({});
      setSubmissions({});
      setSubmissionError(null);
    } catch {
      setRegenerateError("Не удалось создать новое упражнение. Попробуйте ещё раз.");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function submitActiveAnswer() {
    if (activeRanges.length === 0 || activeSubmission) return;

    setSubmissionError(null);
    setSubmittingQuestionId(currentQuestion.id);

    try {
      const generatedRanges = "correctRangesByQuestion" in loadedExercise
        ? (loadedExercise as GeneratedEvidenceExercise).correctRangesByQuestion
        : undefined;
      let result: SubmissionResult;
      if (generatedRanges) {
        const score = scoreCoverage(
          activeRanges,
          generatedRanges[currentQuestion.id] ?? [],
        );
        result = {
          passed: score.percent >= 70,
          score,
          correctRanges: generatedRanges[currentQuestion.id] ?? [],
        };
      } else {
        result = await submitAnswer(
          loadedExercise.id,
          currentQuestion.id,
          activeRanges,
        );
      }
      setSubmissions((current) => ({
        ...current,
        [currentQuestion.id]: result,
      }));
    } catch {
      setSubmissionError("Не удалось отправить ответ. Попробуйте ещё раз.");
    } finally {
      setSubmittingQuestionId(null);
    }
  }

  return (
    <PortalShell
      progress={Math.round(
        (completedCount / loadedExercise.questions.length) * 100,
      )}
      onReset={resetExercise}
    >
      <main className="feature-page">
        <section className="feature-head">
          <button className="back-link" onClick={resetExercise}>
            <ArrowLeft size={18} /> К тренировкам
          </button>
          <div className="head-copy">
            <p className="eyebrow">READING &amp; WRITING</p>
            <h1>{loadedExercise.title}</h1>
            <p>{loadedExercise.instruction}</p>
          </div>
          <div className="head-actions">
            {canRegenerate && (
              <button
                className="secondary-button"
                onClick={regenerateExercise}
                disabled={isRegenerating}
              >
                <RefreshCw size={16} className={isRegenerating ? "spin" : undefined} />
                {isRegenerating ? "Генерируем…" : "Новое упражнение"}
              </button>
            )}
            <div className="session-meta">
              <Clock3 size={17} /> {completedCount} из {loadedExercise.questions.length}{" "}
              вопросов
            </div>
          </div>
        </section>

        {canRegenerate && regenerateError && (
          <p className="regenerate-error" role="alert">
            {regenerateError}
          </p>
        )}

        <div className="workspace">
          <section className="question-card">
            <div className="question-topline">
              <span className="section-chip">
                <BookOpen size={13} /> Чтение и письмо
              </span>
              <span className="difficulty-chip">{loadedExercise.difficulty}</span>
            </div>

            <div className="passage-area">
              <p className="micro-label">ОБЩИЙ ТЕКСТ</p>
              <div
                ref={textRef}
                className="passage selectable-passage"
                aria-label="Текст для выделения"
                onMouseUp={captureSelection}
                onTouchEnd={captureSelection}
              >
                <HighlightedText
                  text={loadedExercise.text}
                  selectedRanges={activeRanges}
                  correctRanges={activeSubmission?.correctRanges ?? []}
                  showCorrectRanges={Boolean(activeSubmission)}
                  onRemoveRange={removeSelectedRange}
                />
              </div>
              <p className="selection-hint">
                Выделяйте текст мышью. Можно добавить несколько фрагментов.
              </p>
            </div>
          </section>

          <aside className="evidence-panel">
            <div className="question-copy">
              <p className="micro-label">
                ВОПРОС{" "}
                {loadedExercise.questions.findIndex(
                  ({ id }) => id === currentQuestion.id,
                ) + 1}
              </p>
              <h2>{currentQuestion.prompt}</h2>
            </div>

            <div className="question-tabs" aria-label="Вопросы">
              {loadedExercise.questions.map((question, index) => (
                <button
                  key={question.id}
                  className={
                    question.id === currentQuestion.id
                      ? "question-tab active"
                      : "question-tab"
                  }
                  onClick={() => setActiveQuestionId(question.id)}
                  aria-label={`Вопрос ${index + 1}`}
                  aria-pressed={question.id === currentQuestion.id}
                >
                  {submissions[question.id] ? <Check size={14} /> : index + 1}
                </button>
              ))}
            </div>

            {!activeSubmission && (
              <p className="selection-status" aria-live="polite">
                {activeRanges.length === 0
                  ? "Выделение пока не выбрано"
                  : `Выбрано фрагментов: ${activeRanges.length}`}
              </p>
            )}

            {activeSubmission ? (
              <div
                className={
                  activeSubmission.passed
                    ? "score-card score-card-success"
                    : "score-card score-card-review"
                }
                aria-live="polite"
              >
                <strong>{activeSubmission.score.percent}%</strong>
                <span>
                  {activeSubmission.passed
                    ? "Ответ засчитан"
                    : "Нужно повторить"}
                </span>
                <p>
                  Верно: {activeSubmission.score.coveredCharacters} из{" "}
                  {activeSubmission.score.correctCharacters} символов.
                </p>
                {activeSubmission.score.incorrectCharacters > 0 && (
                  <p className="score-penalty">
                    Штраф: −{activeSubmission.score.penaltyCharacters} за{" "}
                    {activeSubmission.score.incorrectCharacters} лишних символов.
                  </p>
                )}
                <p className="answer-key-hint">
                  Зелёным показаны правильные фрагменты.
                </p>
              </div>
            ) : (
              <div className="empty-evidence">
                <Lightbulb size={28} />
                <p>
                  Выделите в общем тексте фрагменты, которые отвечают на вопрос.
                </p>
              </div>
            )}

            {!activeSubmission && activeRanges.length > 0 && (
              <button
                className="text-button clear-button"
                onClick={clearSelection}
              >
                <RotateCcw size={14} /> Очистить выделение
              </button>
            )}
            {submissionError && (
              <p className="submission-error" role="alert">
                {submissionError}
              </p>
            )}
            <button
              className="primary-button full-width"
              disabled={
                Boolean(activeSubmission) ||
                activeRanges.length === 0 ||
                submittingQuestionId === currentQuestion.id
              }
              onClick={submitActiveAnswer}
            >
              {activeSubmission
                ? "Ответ отправлен"
                : submittingQuestionId === currentQuestion.id
                  ? "Отправка…"
                  : "Отправить ответ"}
            </button>
          </aside>
        </div>
      </main>
    </PortalShell>
  );
}

function LoadingExercise() {
  return (
    <PortalShell progress={0} onReset={() => undefined}>
      <main
        className="feature-page exercise-loading"
        aria-busy="true"
        aria-label="Загрузка упражнения"
      >
        <div className="skeleton-back skeleton-block" aria-hidden="true" />
        <section className="feature-head" aria-hidden="true">
          <div className="skeleton-head-copy">
            <div className="skeleton-line skeleton-eyebrow" />
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-instruction" />
          </div>
          <div className="skeleton-session skeleton-block" />
        </section>

        <div className="workspace" aria-hidden="true">
          <section className="question-card loading-card">
            <div className="skeleton-toolbar">
              <div className="skeleton-chip skeleton-block" />
              <div className="skeleton-chip skeleton-block skeleton-chip-short" />
            </div>
            <div className="skeleton-passage">
              <div className="skeleton-line skeleton-label" />
              <div className="skeleton-line skeleton-text-wide" />
              <div className="skeleton-line skeleton-text-wide" />
              <div className="skeleton-line skeleton-text-medium" />
              <div className="skeleton-line skeleton-text-short" />
              <div className="skeleton-line skeleton-hint" />
            </div>
          </section>

          <aside className="evidence-panel loading-card">
            <div className="skeleton-line skeleton-label" />
            <div className="skeleton-line skeleton-question" />
            <div className="skeleton-line skeleton-question-short" />
            <div className="skeleton-answer-box skeleton-block" />
            <div className="skeleton-button skeleton-block" />
          </aside>
        </div>
        <p className="loading-caption">Подбираем упражнение…</p>
      </main>
    </PortalShell>
  );
}

function HighlightedText({
  text,
  selectedRanges,
  correctRanges,
  showCorrectRanges,
  onRemoveRange,
}: {
  text: string;
  selectedRanges: readonly TextRange[];
  correctRanges: readonly TextRange[];
  showCorrectRanges: boolean;
  onRemoveRange: (range: TextRange) => void;
}) {
  const boundaries = Array.from(
    new Set([
      0,
      text.length,
      ...selectedRanges.flat(),
      ...(showCorrectRanges ? correctRanges.flat() : []),
    ]),
  ).sort((first, second) => first - second);

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const isSelected = selectedRanges.some(
      ([rangeStart, rangeEnd]) => start >= rangeStart && end <= rangeEnd,
    );
    const isCorrect = correctRanges.some(
      ([rangeStart, rangeEnd]) => start >= rangeStart && end <= rangeEnd,
    );
    const className = showCorrectRanges
      ? isSelected
        ? "text-highlight"
        : isCorrect
          ? "correct-highlight"
          : undefined
      : isSelected
        ? "text-highlight removable-highlight"
        : undefined;
    const isRemovable = !showCorrectRanges && isSelected;

    return (
      <span
        className={className}
        key={`${start}-${end}`}
        role={isRemovable ? "button" : undefined}
        tabIndex={isRemovable ? 0 : undefined}
        onClick={
          isRemovable
            ? () => onRemoveRange([start, end])
            : undefined
        }
        onKeyDown={
          isRemovable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRemoveRange([start, end]);
                }
              }
            : undefined
        }
      >
        {text.slice(start, end)}
      </span>
    );
  });
}

function PortalShell({
  children,
  progress,
  onReset,
}: {
  children: ReactNode;
  progress: number;
  onReset: () => void;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={onReset}
          aria-label="Вернуться к началу"
        >
          <b>SAT</b>
          <span>Portal</span>
          <small>by Global Generation</small>
        </button>
        <div className="tutor-mini">
          <div className="avatar">Е</div>
          <div>
            <strong>AI Репетитор</strong>
            <span>Елена Сергеевна</span>
          </div>
        </div>
        <nav>
          <p>ОСНОВНОЕ</p>
          {navItems.map(({ label, icon: Icon, active }) => (
            <button key={label} className={active ? "nav-active" : ""}>
              <Icon size={18} />
              {label}
            </button>
          ))}
          <p>РЕСУРСЫ</p>
          <button>
            <GraduationCap size={18} /> Видеоуроки
          </button>
          <button>
            <CircleHelp size={18} /> Вузы
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="daily-progress">
            <div>
              <span>Тренировка</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <i style={{ width: `${progress}%` }} />
            </div>
            <small>Найди опору · 3 вопроса</small>
          </div>
          <button>
            <Settings size={17} />
            Настройки
          </button>
        </div>
      </aside>
      <div className="main-canvas">{children}</div>
    </div>
  );
}

export default App;
