<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- The app is the user's uploaded HTML file kept byte-for-byte in `public/so-cot-truyen.html`; `/so` loads it unchanged in an iframe (srcdoc) and injects `window.claude` backed by Lovable Cloud table `story_docs`, so the file's built-in cloud save works per account. Sign-in/sign-up is a dialog on the same `/so` page (signed-out users still edit with local save). `/` redirects to `/so`. Why: the user asked that their code stay unchanged.
- AI contradiction check lives in `src/lib/ai/consistency.{functions,server}.ts`: auth-only server fn, Lovable AI Gateway Responses API with structured output; the book JSON is read from the iframe via `eval("JSON.stringify(S)")`. Why: keeps the user HTML untouched and the AI endpoint closed to anonymous callers.
