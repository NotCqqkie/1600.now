const SECONDS_PER_MINUTE = 60;

const getPracticeTimeParts = (seconds: number) => ({
  minutes: Math.floor(seconds / SECONDS_PER_MINUTE),
  remainder: seconds % SECONDS_PER_MINUTE,
});

const formatTwoDigitTimePart = (value: number): string =>
  String(value).padStart(2, "0");

export const formatPracticeClock = (seconds: number): string => {
  const { minutes, remainder } = getPracticeTimeParts(seconds);
  return `${formatTwoDigitTimePart(minutes)}:${formatTwoDigitTimePart(remainder)}`;
};

export const formatPracticeResultTime = (seconds: number): string => {
  if (!seconds) return "0s";
  const { minutes, remainder } = getPracticeTimeParts(seconds);
  if (!minutes) return `${remainder}s`;
  return `${minutes}m ${formatTwoDigitTimePart(remainder)}s`;
};
