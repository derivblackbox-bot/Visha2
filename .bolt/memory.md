# Project memory

## Product intent & audience

- Web application deployed on Netlify.
- SPA architecture (client-side routing requiring redirect fallback).

## Brand personality & voice

- Not yet inferred.

## Visual design & UX direction

- Not yet inferred.

## Decisions, constraints & rationale

- **Netlify deployment configuration confirmed present:**
  - `netlify.toml` — publish directory set to `.` (project root).
  - `_redirects` — plain-text fallback at root level.
- **SPA redirect rule** `/* /index.html 200` defined in both files to support client-side routing on Netlify.
- Both files were verified as matching the spec; no changes were needed.

## Open questions & assumptions

- Framework/stack details not yet confirmed beyond SPA behavior.
- Build command and plugin configuration in `netlify.toml` not discussed yet.
- Whether publish dir `.` vs a `dist`/`build` folder is intentional for this project's build output structure.