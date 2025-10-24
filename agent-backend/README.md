# Agent Backend

This workspace houses tooling for agentic story workflows. The code is written in TypeScript and executed with the root tooling (Vitest, tsx).

## Environment

You can provide environment variables either by exporting them in your shell (`export GEMINI_API_KEY=...`) or by creating a `.env` file in the repository root (or under `agent-backend/`). The CLI automatically loads `.env` if present before invoking Gemini.

1. Copy `.env.example` to `.env` and replace the placeholder values.
2. Alternatively, export the variables directly in your terminal session before running the CLI.

Required variables:

- `GEMINI_API_KEY` – required for live Gemini invocations. Supply a Vertex or Gemini Developer key before running code that hits the live service.

Optional overrides:

- `GEMINI_MODEL` – change the model identifier without code changes.
- `GEMINI_TIMEOUT_MS` – customise the long-running request timeout (milliseconds).
- `GEMINI_THINKING_BUDGET_TOKENS` – override the thinking budget tokens.

## Development

- `npm run test` – execute the unit tests.
- `npm run typecheck` – run the TypeScript compiler in no-emit mode.
- `npm run story-constitution:cli -- --brief "A curious engineer builds a music garden"` – exercise the story constitution workflow against the live Gemini API.
- Append `--stub` to the CLI command to use the offline stubbed response when you do not want to call Gemini.
