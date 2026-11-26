export const GENERATION_DEFAULTS = {
  scriptLinesMin: 7,
  scriptLinesMax: 8,
  wordsPerLineMax: 10,
  episodeDurationMinSeconds: 25,
  episodeDurationMaxSeconds: 40,
  bulkEpisodesMax: 20,
  aiRetryCount: 2,
  renderMaxRetries: 2,
  aiTimeoutMs: 60000,
  criticThreshold: 7,
} as const;
