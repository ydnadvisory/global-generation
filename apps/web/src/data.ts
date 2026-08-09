export type TextRange = readonly [start: number, end: number];

export type EvidenceQuestion = {
  id: string;
  prompt: string;
  correctRanges: readonly TextRange[];
};

export type EvidenceExercise = {
  id: string;
  section: string;
  difficulty: string;
  title: string;
  instruction: string;
  text: string;
  questions: readonly EvidenceQuestion[];
};

const text =
  "In the late 1800s, many cities faced a serious problem: too much waste and too little space to deal with it. Scientists who studied bacteria discovered that some bacteria break down waste materials into harmless substances. Using this knowledge, engineers designed systems that used bacteria to clean wastewater before it returned to rivers and lakes. These early wastewater treatment systems improved public health and helped cities grow.\n\nToday, some communities use constructed wetlands alongside treatment plants. In these wetlands, gravel, soil, plants, and microorganisms work together to remove pollutants from water. Unlike a traditional plant, a wetland system can also create habitat for birds and insects. However, it requires more land, so it may be impractical in densely populated areas.";

export const exercise: EvidenceExercise = {
  id: "rw-evidence-1",
  section: "Reading & Writing",
  difficulty: "Средний",
  title: "Найди опору",
  instruction:
    "Для каждого вопроса выделите один или несколько фрагментов общего текста, затем отправьте ответ.",
  text,
  questions: [
    {
      id: "wastewater-solution",
      prompt:
        "Which keywords show how the scientific discovery became a solution to the cities' waste problem?",
      correctRanges: [
        [162, 197],
        [278, 311],
      ],
    },
    {
      id: "problem",
      prompt: "Which keywords show what constructed wetlands do to water?",
      correctRanges: [
        [537, 577],
        [595, 623],
      ],
    },
    {
      id: "impact",
      prompt: "Which keywords identify a limitation of constructed wetlands?",
      correctRanges: [
        [729, 747],
        [762, 800],
      ],
    },
  ],
};
