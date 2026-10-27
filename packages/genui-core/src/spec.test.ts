import { ComposeResponse } from './spec';
import { mockResponses } from './mocks';
import { clone } from './testUtils';

describe('ComposeResponse schema', () => {
  it('accepts every mock response', () => {
    for (const [name, response] of Object.entries(mockResponses)) {
      expect({ name, ok: ComposeResponse.safeParse(response).success }).toEqual(
        { name, ok: true },
      );
    }
  });

  describe('rejects output the LLM must never produce', () => {
    const isValidAfter = (mutate: (response: any) => void) => {
      const response: any = clone(mockResponses.barRunsByWorkflow);
      mutate(response);
      return ComposeResponse.safeParse(response).success;
    };

    it('an unknown component kind', () => {
      expect(isValidAfter(r => (r.spec.view.kind = 'radarChart'))).toBe(false);
    });
    it('an unknown transform op', () => {
      expect(isValidAfter(r => (r.spec.pipeline[1].op = 'pivot'))).toBe(false);
    });
    it('an unknown prop on a component', () => {
      expect(isValidAfter(r => (r.spec.view.props.color = 'red'))).toBe(false);
    });
    it('an unknown top-level key, such as injected script text', () => {
      expect(isValidAfter(r => (r.spec.script = 'alert(1)'))).toBe(false);
    });
    it('a spec with no data source', () => {
      expect(isValidAfter(r => (r.spec.sources = []))).toBe(false);
    });
    it('a field path that tries to escape the row', () => {
      expect(
        isValidAfter(r => (r.spec.pipeline[0].args.field = '../secret')),
      ).toBe(false);
    });
    it('a refusal reason that is not in the enum', () => {
      const refusal: any = clone(mockResponses.refusalNoData);
      refusal.reason = 'because';
      expect(ComposeResponse.safeParse(refusal).success).toBe(false);
    });
    it('a clarify question with a single option', () => {
      const clarify: any = clone(mockResponses.clarifyMostActive);
      clarify.options = ['only one'];
      expect(ComposeResponse.safeParse(clarify).success).toBe(false);
    });
  });
});
