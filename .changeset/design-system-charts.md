---
'@openchoreo/backstage-design-system': minor
---

Add chart building blocks to the design system. Theme tokens gain a
`chart.series` categorical palette (light and dark, each colour at least 3:1
against the paper surface) so charts no longer need hex literals, and a new
`BarChart` component draws a single-series bar chart from plain
`{ category, value }` rows. It makes no API calls and has no OpenChoreo
dependency, and it includes a screen-reader data table.
