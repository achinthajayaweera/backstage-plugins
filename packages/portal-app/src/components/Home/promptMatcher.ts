export type GeneratedPreset =
  | 'byEnvironment'
  | 'activeCount'
  | 'perDay'
  | 'byStatus';

/**
 * MOCK. Picks one of the ready-made specs from typed text using keywords.
 * The real LLM replaces this later and returns a spec instead of a preset.
 * Returns undefined when the text is not about deployments.
 */
export function matchPrompt(text: string): GeneratedPreset | undefined {
  const t = text.toLowerCase();
  if (!/deploy|release/.test(t)) return undefined;
  if (/per day|daily|each day|over time|trend|line/.test(t)) return 'perDay';
  if (/status|health|failed|ready|pie/.test(t)) return 'byStatus';
  if (/environment|\benv\b|staging|prod|\bdev\b|bar/.test(t)) {
    return 'byEnvironment';
  }
  if (/active|how many|count|total|number of|running/.test(t)) {
    return 'activeCount';
  }
  return 'byEnvironment';
}

const PRESET_TITLES: Record<GeneratedPreset, string> = {
  byEnvironment: 'Deployments per environment',
  activeCount: 'Active deployments',
  perDay: 'Deployments per day',
  byStatus: 'Deployments by status',
};

/** Short widget title for a preset. The real LLM returns its own title. */
export function presetTitle(preset: GeneratedPreset): string {
  return PRESET_TITLES[preset];
}
