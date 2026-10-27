import { mockResponses } from './mocks';
import type { WidgetSpecT } from './spec';

export type MockName = keyof typeof mockResponses;

/** Deep copy so each test can mutate its own spec. */
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** The spec inside a mock response; throws if the mock is a refusal or clarify. */
export function specOf(name: MockName): WidgetSpecT {
  const response = mockResponses[name];
  if (response.type !== 'spec') {
    throw new Error(`Mock "${name}" is not a spec`);
  }
  return clone(response.spec);
}
