# Auth Presentation Repository Guidelines

## Purpose
- This repository stores HTML presentations for teaching authentication and authorization.
- Each presentation should cover one subject at a time. If a slide introduces multiple concepts, split it. If a deck mixes subjects, create a separate presentation.
- Generated HTML is committed so presentations can be opened or served as static files.

## Structure
- Root `index.html` is generated and lists every presentation.
- Each presentation lives under `presentations/<slug>/`.
- Each presentation has one editable source file: `presentations/<slug>/slides.md`.
- Generated presentation HTML lives at `presentations/<slug>/index.html`.
- Shared runtime and visual assets live under `assets/`.
- Build and maintenance scripts live under `scripts/`.

## Deck Source Format
- Put deck metadata in front matter at the top of `slides.md`.
- Separate slides with a line containing only `---`.
- Put presenter-only context in a notes block:

```md
::: notes
Presenter notes go here.
:::
```

- Keep slide text short. Move implementation nuance, spec context, and examples the presenter may forget into notes.
- The first slide of each deck must summarize the deck and link to important references, such as RFCs, BCPs, or official specifications.

## Commands
- Always run npm through Socket Firewall: use `sfw npm ...`.
- Do not run bare `npm`, `yarn`, `pnpm`, or `bun`.
- Install dependencies with `sfw npm install`.
- If the local npm version is older than `11.10.0`, bootstrap with `sfw npm run bootstrap`.
- Build generated HTML with `sfw npm run build`.
- Check generated HTML freshness with `sfw npm run check`.
- Install the local pre-commit hook with `sfw npm run install-hooks`.

## Dependency Policy
- Use npm only.
- New dependencies must be well-known, stable, narrowly scoped, and exact-pinned.
- Prefer packages with no or few transitive dependencies.
- Do not add a package released less than 7 days ago.
- Commit `package-lock.json`.
- Review every new or upgraded dependency before adding it:

```sh
sfw npm view <pkg>@<version> version time dependencies peerDependencies engines license dist.integrity --json
sfw npm audit --audit-level=moderate
```

- `.npmrc` sets `min-release-age=7`, `save-exact=true`, and `engine-strict=true`.
- `package.json` requires npm `>=11.10.0` because older npm versions do not honor `min-release-age`.
- Socket Firewall registry mode is not configured because this repository does not have a company Socket registry URL.

## Content Standards
- Prefer official sources: RFC Editor, IETF Datatracker, OpenID Foundation, and OWASP.
- Distinguish OAuth 2.0, OAuth 2.1 drafts, and OpenID Connect clearly.
- Avoid provider-specific behavior unless the deck is explicitly about that provider.
- Use concrete HTTP requests, redirect URLs, and token exchanges when they clarify protocol mechanics.
- Do not overload slides with exhaustive parameter lists. Split anatomy slides into meaningful groups.
