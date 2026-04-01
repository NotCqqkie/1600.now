export interface SatCalculatorSection {
  title: string;
  part: string;
  rate: number;
  scores: number[];
  maxRaw: number;
}

export interface SatCalculatorYear {
  label: string;
  sections: SatCalculatorSection[];
}

export interface SatDistribution {
  distribution: number[];
  questionCount: number;
  totalStudents: number;
  examCount: number;
  label: string;
  sectionIndex: number;
}

export interface SatScoreColorBand {
  min: number;
  max: number;
  color: string;
}

export const satScoreColorBands: SatScoreColorBand[] = [
  { min: 1451, max: 1600, color: "#8224e3" },
  { min: 1251, max: 1450, color: "#1e73be" },
  { min: 1051, max: 1250, color: "#13866a" },
  { min: 851, max: 1050, color: "#9d691b" },
  { min: 0, max: 850, color: "#cc3224" },
];

export const satCalculatorYears: SatCalculatorYear[] = [
  {
    label: "Digital SAT",
    sections: [
      {
        title: "Reading and Writing Module 1",
        part: "Reading and Writing Score",
        rate: 10,
        scores: [100, 100, 120, 140, 160, 170, 180, 190, 200, 200, 210, 210, 220, 230, 240, 260, 270, 290, 310, 320, 340, 360, 370, 390, 410, 430, 440, 460],
        maxRaw: 27,
      },
      {
        title: "Reading and Writing Module 2",
        part: "Reading and Writing Score",
        rate: 10,
        scores: [100, 100, 100, 110, 110, 110, 120, 120, 120, 130, 130, 140, 150, 170, 190, 190, 200, 210, 230, 240, 250, 260, 280, 290, 300, 310, 330, 340],
        maxRaw: 27,
      },
      {
        title: "Math Module 1",
        part: "Math Score",
        rate: 10,
        scores: [100, 100, 120, 140, 160, 160, 180, 180, 200, 200, 210, 240, 260, 280, 300, 320, 340, 360, 390, 410, 430, 450, 470],
        maxRaw: 22,
      },
      {
        title: "Math Module 2",
        part: "Math Score",
        rate: 10,
        scores: [100, 100, 100, 120, 120, 130, 150, 170, 170, 170, 190, 190, 200, 200, 210, 230, 240, 260, 270, 290, 300, 320, 330],
        maxRaw: 22,
      },
    ],
  },
  {
    label: "Legacy Pen-and-Paper",
    sections: [
      {
        title: "SAT Reading Section",
        part: "Reading & Writing Section Score",
        rate: 10,
        scores: [100, 100, 100, 110, 120, 130, 140, 150, 150, 160, 170, 170, 180, 190, 190, 200, 200, 210, 210, 220, 220, 230, 230, 240, 240, 250, 250, 260, 260, 270, 280, 280, 290, 290, 300, 300, 310, 310, 320, 320, 330, 330, 340, 350, 350, 360, 370, 370, 380, 380, 390, 400, 400],
        maxRaw: 52,
      },
      {
        title: "SAT Writing Section",
        part: "Reading & Writing Section Score",
        rate: 10,
        scores: [100, 100, 100, 100, 110, 120, 130, 130, 140, 150, 160, 160, 170, 180, 190, 190, 200, 210, 210, 220, 230, 230, 240, 250, 250, 260, 260, 270, 280, 280, 290, 300, 300, 310, 320, 320, 330, 340, 340, 350, 360, 370, 380, 390, 400],
        maxRaw: 44,
      },
      {
        title: "SAT Math Section",
        part: "",
        rate: 1,
        scores: [200, 200, 210, 230, 240, 260, 280, 290, 310, 320, 330, 340, 360, 370, 380, 390, 410, 420, 430, 440, 450, 460, 470, 480, 480, 490, 500, 510, 520, 520, 530, 540, 550, 560, 560, 570, 580, 590, 600, 600, 610, 620, 630, 640, 650, 660, 670, 670, 680, 690, 700, 710, 730, 740, 750, 760, 780, 790, 800],
        maxRaw: 58,
      },
    ],
  },
];

export const satDistributions: SatDistribution[] = [
  {
    distribution: [2, 7, 32, 92, 174, 277, 356, 429, 495, 573, 610, 573, 651, 640, 646, 706, 726, 787, 759, 754, 667, 568, 558, 420, 363, 294, 314, 49, 45, 53, 43, 42, 39, 33, 31, 36, 33, 23, 32, 22, 25, 21, 26, 19, 7, 5, 6, 3, 3, 4, 4, 5],
    questionCount: 52,
    totalStudents: 13082,
    examCount: 9,
    label: "Reading and Writing Module 1",
    sectionIndex: 0,
  },
  {
    distribution: [0, 14, 41, 99, 174, 244, 358, 405, 443, 468, 440, 465, 462, 414, 435, 450, 464, 478, 493, 471, 444, 408, 356, 223, 159, 118, 133],
    questionCount: 27,
    totalStudents: 8659,
    examCount: 2,
    label: "Reading and Writing Module 2",
    sectionIndex: 1,
  },
  {
    distribution: [71, 62, 165, 264, 406, 480, 582, 560, 582, 552, 467, 464, 422, 481, 401, 425, 380, 433, 343, 393, 241, 257, 18, 19, 22, 24, 25, 22, 24, 29, 26, 28, 32, 18, 35, 33, 22, 31],
    questionCount: 38,
    totalStudents: 8839,
    examCount: 8,
    label: "Math Module 1",
    sectionIndex: 2,
  },
  {
    distribution: [59, 149, 316, 376, 446, 495, 465, 374, 359, 315, 309, 275, 235, 252, 258, 287, 279, 299, 281, 311, 216, 194],
    questionCount: 22,
    totalStudents: 6550,
    examCount: 2,
    label: "Math Module 2",
    sectionIndex: 3,
  },
];

export function extractSatSubject(title: string) {
  const match = title.match(/^(.+?)\s*[-–—]?\s*Module\s*\d+/i);
  return match ? match[1].trim() : title;
}

export function getSatSubjectGroups(year: SatCalculatorYear) {
  const groups = new Map<string, { subject: string; sections: { secIdx: number; section: SatCalculatorSection }[] }>();

  year.sections.forEach((section, secIdx) => {
    const subject = extractSatSubject(section.title);
    const group = groups.get(subject) ?? { subject, sections: [] };
    group.sections.push({ secIdx, section });
    groups.set(subject, group);
  });

  return Array.from(groups.values());
}

export function getSatScoreColor(total: number) {
  return satScoreColorBands.find((band) => total >= band.min && total <= band.max)?.color ?? "#1abc9c";
}

export function getPercentileForDistribution(distribution: SatDistribution, rawScore: number) {
  const capped = Math.max(0, Math.min(rawScore, distribution.distribution.length - 1));
  const total = distribution.distribution.reduce((sum, count) => sum + count, 0);
  if (!total) return 0;

  const below = distribution.distribution.slice(0, capped).reduce((sum, count) => sum + count, 0);
  const equal = distribution.distribution[capped] ?? 0;
  return Math.round(((below + equal * 0.5) / total) * 100);
}

export function formatOrdinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}
