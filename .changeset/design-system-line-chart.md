---
'@openchoreo/backstage-design-system': minor
---

Add a `LineChart` component that draws a single-series line chart from plain
`{ x, value }` rows. It keeps the given order, leaves a gap where a value is
missing instead of drawing zero, colours the line from the `chart.series` theme
tokens, and includes a screen-reader data table. It makes no API calls and has
no OpenChoreo dependency.
