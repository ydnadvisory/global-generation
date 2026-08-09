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
  RotateCcw,
  Settings,
  Target,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { exercise, type TextRange } from "./data";
import { addRange, getSelectionRange, scoreCoverage } from "./utils";

const navItems = [
  { label: "Главная", icon: Home },
  { label: "План подготовки", icon: BookOpen },
  { label: "Режимы тренировок", icon: Target, active: true },
  { label: "Мой прогресс", icon: BarChart3 },
];

type AnswersByQuestion = Record<string, TextRange[]>;
type SubmittedByQuestion = Record<string, boolean>;

function App() {
  const [activeQuestionId, setActiveQuestionId] = useState(
    exercise.questions[0].id,
  );
  const [answers, setAnswers] = useState<AnswersByQuestion>({});
  const [submitted, setSubmitted] = useState<SubmittedByQuestion>({});
  const textRef = useRef<HTMLDivElement>(null);

  const activeQuestion = exercise.questions.find(
    ({ id }) => id === activeQuestionId,
  )!;
  const activeRanges = answers[activeQuestion.id] ?? [];
  const activeScore = useMemo(
    () => scoreCoverage(activeRanges, activeQuestion.correctRanges),
    [activeRanges, activeQuestion.correctRanges],
  );
  const activeAnswerPassed = activeScore.percent >= 70;
  const completedCount = Object.keys(submitted).length;

  function captureSelection() {
    if (submitted[activeQuestion.id] || !textRef.current) return;

    const range = getSelectionRange(textRef.current);
    if (!range) return;

    setAnswers((current) => ({
      ...current,
      [activeQuestion.id]: addRange(current[activeQuestion.id] ?? [], range),
    }));
    window.getSelection()?.removeAllRanges();
  }

  function clearSelection() {
    if (submitted[activeQuestion.id]) return;

    setAnswers((current) => ({ ...current, [activeQuestion.id]: [] }));
  }

  function removeSelectedRange(rangeToRemove: TextRange) {
    if (submitted[activeQuestion.id]) return;

    setAnswers((current) => ({
      ...current,
      [activeQuestion.id]: (current[activeQuestion.id] ?? []).filter(
        ([start, end]) =>
          start !== rangeToRemove[0] || end !== rangeToRemove[1],
      ),
    }));
  }

  function resetExercise() {
    setActiveQuestionId(exercise.questions[0].id);
    setAnswers({});
    setSubmitted({});
  }

  return (
    <PortalShell
      progress={Math.round((completedCount / exercise.questions.length) * 100)}
      onReset={resetExercise}
    >
      <main className="feature-page">
        <section className="feature-head">
          <button className="back-link" onClick={resetExercise}>
            <ArrowLeft size={18} /> К тренировкам
          </button>
          <div className="head-copy">
            <p className="eyebrow">READING &amp; WRITING</p>
            <h1>{exercise.title}</h1>
            <p>{exercise.instruction}</p>
          </div>
          <div className="session-meta">
            <Clock3 size={17} /> {completedCount} из {exercise.questions.length}{" "}
            вопросов
          </div>
        </section>

        <div className="workspace">
          <section className="question-card">
            <div className="question-topline">
              <span className="section-chip">
                <BookOpen size={13} /> Чтение и письмо
              </span>
              <span className="difficulty-chip">{exercise.difficulty}</span>
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
                  text={exercise.text}
                  selectedRanges={activeRanges}
                  correctRanges={activeQuestion.correctRanges}
                  showCorrectRanges={submitted[activeQuestion.id] ?? false}
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
                {exercise.questions.findIndex(
                  ({ id }) => id === activeQuestion.id,
                ) + 1}
              </p>
              <h2>{activeQuestion.prompt}</h2>
            </div>

            <div className="question-tabs" aria-label="Вопросы">
              {exercise.questions.map((question, index) => (
                <button
                  key={question.id}
                  className={
                    question.id === activeQuestion.id
                      ? "question-tab active"
                      : "question-tab"
                  }
                  onClick={() => setActiveQuestionId(question.id)}
                  aria-label={`Вопрос ${index + 1}`}
                  aria-pressed={question.id === activeQuestion.id}
                >
                  {submitted[question.id] ? <Check size={14} /> : index + 1}
                </button>
              ))}
            </div>

            {!submitted[activeQuestion.id] && (
              <p className="selection-status" aria-live="polite">
                {activeRanges.length === 0
                  ? "Выделение пока не выбрано"
                  : `Выбрано фрагментов: ${activeRanges.length}`}
              </p>
            )}

            {submitted[activeQuestion.id] ? (
              <div
                className={
                  activeAnswerPassed
                    ? "score-card score-card-success"
                    : "score-card score-card-review"
                }
                aria-live="polite"
              >
                <strong>{activeScore.percent}%</strong>
                <span>
                  {activeAnswerPassed
                    ? "Ответ засчитан"
                    : "Нужно повторить"}
                </span>
                <p>
                  Верно: {activeScore.coveredCharacters} из{" "}
                  {activeScore.correctCharacters} символов.
                </p>
                {activeScore.incorrectCharacters > 0 && (
                  <p className="score-penalty">
                    Штраф: −{activeScore.penaltyCharacters} за {activeScore.incorrectCharacters} лишних символов.
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

            {!submitted[activeQuestion.id] && activeRanges.length > 0 && (
              <button
                className="text-button clear-button"
                onClick={clearSelection}
              >
                <RotateCcw size={14} /> Очистить выделение
              </button>
            )}
            <button
              className="primary-button full-width"
              disabled={
                submitted[activeQuestion.id] || activeRanges.length === 0
              }
              onClick={() =>
                setSubmitted((current) => ({
                  ...current,
                  [activeQuestion.id]: true,
                }))
              }
            >
              {submitted[activeQuestion.id]
                ? "Ответ отправлен"
                : "Отправить ответ"}
            </button>
          </aside>
        </div>
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
