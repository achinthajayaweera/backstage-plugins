---
'@openchoreo/backstage-plugin-backend': minor
---

Add a `GET /namespace-release-bindings` route that returns one page of the
release bindings in a namespace, across all components, in the same shape as
the existing per-component route. It takes `namespaceName` and optional `limit`
and `cursor` query parameters, and returns the next cursor when there are more.
