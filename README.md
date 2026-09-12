<p align="center">
  <a href="https://github.com/relakeinc/trell">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/icon-white.svg" />
      <img src="apps/web/public/icon.svg" width="160" alt="Trell" />
    </picture>
  </a>
</p>

<p align="center">
    The open-source form analytics platform.
    <br />
    <a href="https://github.com/relakeinc/trell"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="#introduction"><strong>Introduction</strong></a> ·
    <a href="#tech-stack"><strong>Tech Stack</strong></a> ·
    <a href="#self-hosting"><strong>Self-hosting</strong></a> ·
    <a href="#contributing"><strong>Contributing</strong></a>
</p>

<p align="center">
  <a href="https://github.com/relakeinc/trell/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/relakeinc/trell?label=license&logo=github&color=f80&logoColor=fff" alt="License" />
  </a>
  <a href="https://github.com/relakeinc/trell/stargazers">
    <img src="https://img.shields.io/github/stars/relakeinc/trell?style=flat&label=stars&logo=github&color=0bf&logoColor=fff" alt="Stars" />
  </a>
  <a href="https://github.com/relakeinc/trell/actions/workflows/ci.yml">
    <img src="https://github.com/relakeinc/trell/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
</p>

<br/>

## Introduction

Trell is the open-source form analytics platform for [form views, starts & submissions](https://github.com/relakeinc/trell), [funnels](https://github.com/relakeinc/trell), and [UTM attribution](https://github.com/relakeinc/trell).

Drop one script on your site and Trell tracks every form automatically — views, field interactions, abandons, conversions — with a dashboard, per-form submissions inbox, funnels, and an MCP server so AI agents can query your analytics.

## Tech Stack

- [Next.js](https://nextjs.org/) – dashboard framework
- [TypeScript](https://www.typescriptlang.org/) – language
- [Tailwind](https://tailwindcss.com/) – CSS
- [Hono](https://hono.dev/) – ingestion + query API
- [Prisma](https://www.prisma.io/) – ORM
- [NextAuth.js (Auth.js)](https://authjs.dev/) – auth
- [Polar](https://polar.sh/) – billing
- [Model Context Protocol](https://modelcontextprotocol.io/) – AI agent server
- [Turborepo](https://turbo.build/repo) – monorepo
- [Docker](https://www.docker.com/) – self-hosting

## Self-Hosting

You can self-host Trell for greater control over your data. All settings come
from the environment — copy the example file and edit it:

```bash
cp .env.example .env
# at minimum: POSTGRES_PASSWORD, TRELL_ADMIN_KEY, AUTH_SECRET, TRELL_ENC_KEY
# public deployments: also set NEXT_PUBLIC_SDK_URL / NEXT_PUBLIC_INGEST_URL
# to your own API origin (they bake into the build)
docker compose up -d --build
```

- Dashboard: `http://localhost:3000`
- API: `http://localhost:8787`

Create your first project via the onboarding flow, paste the tracking snippet
into your site, and events start flowing. [Read the self-hosting guide](docs/selfhost.md)
to learn more (Google OAuth, custom domains, production checklist).

## Contributing

We love our contributors! Here's how you can contribute:

- [Open an issue](https://github.com/relakeinc/trell/issues) if you believe you've encountered a bug.
- Follow the [local development guide](#local-development) to get your environment set up.
- Make a [pull request](https://github.com/relakeinc/trell/pull) to add new features / fix bugs.
- Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) in all community spaces.

### Local development

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm dev
```

```bash
pnpm typecheck  # strict TS across the monorepo
pnpm test       # all suites (api, web, sdk, mcp, shared)
pnpm build
```

Tests use in-memory repos — no database needed. For `prisma validate/generate`
outside Docker, any dummy `DATABASE_URL` works (e.g.
`postgresql://trell:trell@localhost:5432/trell`).

### Recommended Versions

| Package | Version   |
| ------- | --------- |
| node    | v20.x     |
| pnpm    | 10.33.0   |

### Common Local Development Issues

- `Environment variable not found: DATABASE_URL` from prisma – export a dummy
  `DATABASE_URL` (see above); no live DB is required for validate/generate.
- `AUTH_DEV_MODE must never be enabled in production` during `next build` –
  that guard only trips when `AUTH_DEV_MODE=true` is set; unset it to build.
- The project is not building correctly locally – verify your versions of
  `node` and `pnpm` match the recommended versions above.

## Security model

- Publishable keys (`pk_…`) only write events from allowlisted domains.
- Secret keys (`sk_…`) are encrypted at rest (`TRELL_ENC_KEY`) and bypass the
  domain check — server-side only, never in the browser.
- Webhook targets are validated against SSRF (no private IPs).
- Never commit `.env` files — only `.env.example` is tracked.

## License

MIT — see [LICENSE](LICENSE).
