import type { ProblemType } from "./types";

export const PROBLEM_TYPES: {
  id: ProblemType;
  label: string;
  short: string;
  color: string;
  description: string;
}[] = [
  {
    id: "asphalt",
    label: "Разбитый асфальт",
    short: "Асфальт",
    color: "#f59e0b",
    description: "Колеи, трещины, разрушение покрытия",
  },
  {
    id: "pothole",
    label: "Ямы и выбоины",
    short: "Ямы",
    color: "#ef4444",
    description: "Опасные ямы на проезжей части",
  },
  {
    id: "traffic",
    label: "Затор / узкое место",
    short: "Затор",
    color: "#f97316",
    description: "Регулярные пробки из‑за дорожной ситуации",
  },
  {
    id: "trucks",
    label: "Грузовики ломают дорогу",
    short: "Грузовики",
    color: "#eab308",
    description: "Тяжёлый транспорт портит покрытие",
  },
  {
    id: "sidewalk",
    label: "Тротуар / пешеходы",
    short: "Тротуар",
    color: "#22c55e",
    description: "Проблемы для пешеходов у дороги",
  },
  {
    id: "lighting",
    label: "Освещение",
    short: "Свет",
    color: "#38bdf8",
    description: "Плохое или отсутствующее освещение",
  },
  {
    id: "other",
    label: "Другое",
    short: "Другое",
    color: "#a3a3a3",
    description: "Иная дорожная проблема",
  },
];

export function getProblemMeta(type: ProblemType) {
  return PROBLEM_TYPES.find((p) => p.id === type) ?? PROBLEM_TYPES[PROBLEM_TYPES.length - 1];
}
