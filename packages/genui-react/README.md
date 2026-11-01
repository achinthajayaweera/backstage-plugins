# @openchoreo/genui-react

React renderer for the constrained Generative UI engine.

It takes the drawable result produced by `@openchoreo/genui-core` and draws it
with the pre-built, data-only components of the OpenChoreo design system (bar,
pie and line charts, and a single-number card). When something cannot be drawn,
it shows a plain-language explanation instead.

It contains no OpenChoreo-specific data access, so another dashboard can reuse
it by supplying its own catalog and fetch function to `@openchoreo/genui-core`.

## Status

Early work in progress. Table and status-list widgets are not built yet and
show an explanation.
