# @openchoreo/genui-core

Framework-agnostic core of the constrained Generative UI engine.

The LLM never writes code or UI. It returns a small JSON **spec** that names a
pre-built component and an allowed data source. This package defines that spec
and everything that can be done with it without React or Backstage:

| Module      | Responsibility                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `spec`      | Strict [zod](https://zod.dev) schemas for what the LLM may return: a widget spec, a typed refusal, or a clarifying question.            |
| `catalog`   | The allowlist of data endpoints, their params and typed fields.                                                                         |
| `validate`  | Layer 3 of the boundary design: checks a schema-valid spec against the catalog and returns structured issues suitable for an LLM retry. |
| `transform` | The closed set of data operations: `filter`, `select`, `aggregate`, `sortBy`, `limit`, `bucketByTime`, `join`.                          |
| `pipeline`  | Fetches every source in parallel with pagination, row/call/namespace caps and typed errors, then runs the transform steps.              |
| `mocks`     | Fixtures for developing and testing a renderer before any LLM is connected.                                                             |

It deliberately has no dependency on React, Backstage or any design system, so a
renderer for another dashboard can reuse it by supplying its own catalog, its
own `fetchPage` function and its own component registry.

## Status

Early work in progress. The seed catalog in `catalog.ts` is hand-written and
will be generated from the OpenChoreo OpenAPI specs.
