---
'@openchoreo/backstage-design-system': minor
---

Add a `PieChart` component that draws a donut chart from plain
`{ category, value }` rows. It colours slices from the `chart.series` theme
tokens, merges the smallest slices into an "Other" slice past a configurable
limit, skips values it cannot draw, and includes a screen-reader data table.
It makes no API calls and has no OpenChoreo dependency.
