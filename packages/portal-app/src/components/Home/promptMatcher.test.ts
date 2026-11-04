import { matchPrompt, presetTitle } from './promptMatcher';

describe('matchPrompt', () => {
  it.each([
    ['show my deployments per day', 'perDay'],
    ['deployments trend as a line chart', 'perDay'],
    ['show my current deployments as a status pie chart', 'byStatus'],
    ['which deployments failed', 'byStatus'],
    ['deployments per environment as a bar chart', 'byEnvironment'],
    ['how many active deployments', 'activeCount'],
    ['show my deployments', 'byEnvironment'],
  ])('%s -> %s', (text, expected) => {
    expect(matchPrompt(text)).toBe(expected);
  });

  it('is not case sensitive', () => {
    expect(matchPrompt('DEPLOYMENTS BY STATUS')).toBe('byStatus');
  });

  it.each(['', '   ', 'show me the weather', 'cpu usage per component'])(
    'returns undefined for %p',
    text => {
      expect(matchPrompt(text)).toBeUndefined();
    },
  );
});

describe('presetTitle', () => {
  it('gives a short title for every preset', () => {
    expect(presetTitle('byStatus')).toBe('Deployments by status');
    expect(presetTitle('perDay')).toBe('Deployments per day');
  });
});
