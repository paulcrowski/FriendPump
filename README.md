# Workflow_clean

Minimalny, mechaniczny workflow do pracy z agentami AI. Repo pilnuje, żeby agent wykonał jedną potrzebną zmianę, w dozwolonych plikach, z dowodem `PASS` albo `FAIL`.

The same workflow is documented in English below. The repository rules live in [`AGENTS.md`](AGENTS.md); this README is only onboarding.

- [Polski](#polski)
- [English](#english)

## Polski

### Do czego służy

Workflow porządkuje pracę agenta wokół pięciu pytań:

1. Jaki ma być wynik?
2. Jak poznamy, że działa?
3. Jakie są ograniczenia i dozwolone pliki?
4. Jakie mamy dowody?
5. Jaka jest najmniejsza bezpieczna zmiana?

Agent nie powinien zaczynać od kodowania. Najpierw dobiera tryb pracy, sprawdza fakty, a po zmianie uruchamia kontrole odpowiednie do ryzyka.

### Start bez programowania (lite)

Nie musisz od razu instalować skryptów. Skopiuj do swojego projektu dwa pliki: `AGENTS.md` i `CLAUDE.md`. Codex czyta `AGENTS.md`, a Claude Code przez `CLAUDE.md` wczytuje ten sam plik.

Możesz też poprosić agenta: `Dodaj do tego projektu AGENTS.md i CLAUDE.md z github.com/paulcrowski/Workflow_clean. Niczego nie nadpisuj bez pytania.`

W wersji lite agent opisuje task w rozmowie zamiast `task:new`. Pełną wersję ze skryptami i bramami dodasz, gdy projekt urośnie.

### Szybki start

```bash
npm install
npm run hooks:install
npm run gate:local
```

Jeżeli pracujesz przez Codexa, wystarczy opisać cel normalnym językiem, na przykład: `Napraw błąd logowania i pokaż, jak to sprawdziłeś.` Agent dobiera tryb, zakres i weryfikację.

### Tryby pracy

| Tryb | Kiedy używać |
| --- | --- |
| `MINIMAL_FIX` | Mały bugfix, maksymalnie 3 pliki i 50 liczonych linii. |
| `CONTENT_FIX` | Copy, dokumentacja, statyczna treść albo mały UI polish bez runtime i danych. |
| `RUNTIME_FIX` | API, worker, parser, kolejka, cache, provider, dane albo status UI. |
| `STRUCTURE_FIX` | Granice modułów, zależności, duży plik albo god file. |
| `FEATURE` | Nowe zachowanie lub nowa funkcja. |
| `AUDIT` | Diagnoza bez kodowania i bez zmian w plikach. |

Nie używaj `CONTENT_FIX` do API, auth, bazy danych, workerów, providerów, security, danych użytkownika ani źródła prawdy.

### Praca nad taskiem

Dla zmian kodu agent może utworzyć bieżący task:

```bash
npm run task:new -- \
  --slug simple-fix \
  --mode MINIMAL_FIX \
  --change-mode code-change \
  --files src/example.js \
  --outcome "Naprawić prosty błąd" \
  --success "gate:local przechodzi"
```

Komenda tworzy `tasks/todo.md`, ustawia tryb i twardą allowlistę plików. Nie trzeba ręcznie wypełniać formularza.

Po zakończeniu:

```bash
npm run task:close -- --result PASS
```

Gotowy task trafia do `tasks/archive/`, a `tasks/todo.md` wraca do `READY_FOR_NEXT_TASK`.

### Audyt tylko do odczytu

Gdy prosisz o audyt, agent ma czytać kod, konfigurację i logi, ale nie może zapisywać taska, archiwum, `ParkingLot.md` ani plików projektu. Najpierw zbiera dostępne dowody. Dopiero gdy nadal brakuje informacji, zgłasza `BLOCKED_BY_MISSING_EVIDENCE` i wskazuje najmniejszy następny krok.

### Zakres i weryfikacja

Każdy task kodujący wskazuje:

- `Tryb zmiany: code-change` albo `release-build`,
- `Dozwolone pliki do zmiany`,
- kryterium sukcesu,
- sposób sprawdzenia wyniku.

Najważniejsze bramy:

```bash
npm run gate:local   # lokalnie; hook pre-commit
npm run gate:pr      # to samo co gate:local; hook pre-push i GitHub Actions
npm run gate:main    # alias gate:pr
```

Wszystkie trzy uruchamiają ten sam zestaw kontroli. Różni je tylko moment. GitHub Actions uruchamia `gate:pr` wyłącznie przy pull requeście do `main`. Bezpośredni push na `main` sprawdza tylko lokalny hook `pre-push`, więc po sklonowaniu repo uruchom `npm run hooks:install`.

Bramy sprawdzają formularz i świeżość taska, scope lock, rozmiar diffu, duże pliki, import boundaries oraz wymagane `lint`, `typecheck`, `test` i `build`, gdy repo zawiera aplikację.

Po `PASS` nie uruchamiaj w kółko tych samych kontroli. Poszerz weryfikację dopiero po kolejnej zmianie, błędzie albo nierozstrzygniętym ryzyku.

### Modele i koszty

Workflow nie wymaga konkretnego modelu. Tańszy model może obsługiwać proste, dobrze określone zadania; mocniejszy model ma sens przy niepewnej diagnozie, trudnej regresji albo większym ryzyku. Model i poziom reasoning wybiera użytkownik. Nie zmieniaj ich automatycznie bez uzasadnienia.

### Gdzie są zasady

- [`AGENTS.md`](AGENTS.md) — krótki, zawsze ładowany kontrakt agenta.
- [`docs/AGENT_READY_WORKFLOW.md`](docs/AGENT_READY_WORKFLOW.md) — projektowanie taska jako `REPRO -> FAIL -> FIX -> PASS`.
- [`docs/CONTEXT_BUDGET_GUARD.md`](docs/CONTEXT_BUDGET_GUARD.md) — kontekst, skille, narzędzia i koszt pracy.
- [`docs/ARCHITECTURE_GUARDS.md`](docs/ARCHITECTURE_GUARDS.md) — runtime, API, workerzy i dane.
- [`docs/CODE_STRUCTURE_GUARDS.md`](docs/CODE_STRUCTURE_GUARDS.md) — granice modułów i duże pliki.
- `scripts/` — mechaniczne kontrole taska, scope, diffu i projektu.

Po utworzeniu aplikacji dopnij do `package.json` prawdziwe komendy `lint`, `typecheck`, `test` i `build`. Starter workflow nie udaje testów aplikacji, której jeszcze nie ma.

## English

### What it is

Workflow_clean is a small, mechanical workflow for AI-assisted projects. It keeps each change scoped, reviewable, and backed by a `PASS` or `FAIL` result.

The agent works outcome-first:

1. define the outcome,
2. define success criteria,
3. identify constraints and allowed files,
4. collect available evidence,
5. make the smallest safe change.

The agent should inspect the facts before coding and choose verification that matches the risk.

### Start without coding (lite)

You do not need the scripts on day one. Copy two files into your project: `AGENTS.md` and `CLAUDE.md`. Codex reads `AGENTS.md`; Claude Code loads the same file through `CLAUDE.md`.

You can also ask the agent: `Add AGENTS.md and CLAUDE.md from github.com/paulcrowski/Workflow_clean to this project. Do not overwrite anything without asking.`

In lite mode the agent describes the task in the conversation instead of running `task:new`. Add the full version with scripts and gates when the project grows.

### Quick start

```bash
npm install
npm run hooks:install
npm run gate:local
```

When using Codex, describe the goal in normal language, for example: `Fix the login bug and show how you verified it.` The agent chooses the work mode, scope, and verification.

### Work modes

| Mode | Use it for |
| --- | --- |
| `MINIMAL_FIX` | A small bugfix, up to 3 files and 50 counted lines. |
| `CONTENT_FIX` | Copy, documentation, static content, or small UI polish without runtime or data changes. |
| `RUNTIME_FIX` | APIs, workers, parsers, queues, caches, providers, data, or UI status. |
| `STRUCTURE_FIX` | Module boundaries, dependencies, large files, or god files. |
| `FEATURE` | New behavior or a new feature. |
| `AUDIT` | Diagnosis without coding or file changes. |

Do not use `CONTENT_FIX` for APIs, auth, databases, workers, providers, security, user data, or source-of-truth state.

### Task lifecycle

For code changes, the agent can create the current task:

```bash
npm run task:new -- \
  --slug simple-fix \
  --mode MINIMAL_FIX \
  --change-mode code-change \
  --files src/example.js \
  --outcome "Fix the simple bug" \
  --success "gate:local passes"
```

This creates `tasks/todo.md`, selects the work mode, and records the file allowlist. You do not need to fill the form by hand.

When the work is complete:

```bash
npm run task:close -- --result PASS
```

The completed task is archived in `tasks/archive/`, and `tasks/todo.md` is reset to `READY_FOR_NEXT_TASK`.

### Read-only audits

For an audit, the agent may inspect code, configuration, and logs, but it must not write a task, archive, `ParkingLot.md`, or project files. It gathers available evidence first. If evidence is still missing, it reports `BLOCKED_BY_MISSING_EVIDENCE` and names the smallest next step.

### Scope and verification

Every code task declares its change mode, allowed files, success criteria, and verification method. Run:

```bash
npm run gate:local   # locally; pre-commit hook
npm run gate:pr      # same as gate:local; pre-push hook and GitHub Actions
npm run gate:main    # alias for gate:pr
```

All three run the same checks; only the moment differs. GitHub Actions runs `gate:pr` only on pull requests to `main`. A direct push to `main` is checked only by the local `pre-push` hook, so run `npm run hooks:install` after cloning.

The gates check task completeness and freshness, scope lock, diff size, large files, import boundaries, and real `lint`, `typecheck`, `test`, and `build` scripts when the repository contains an application.

After a `PASS`, do not repeat the same checks without a new change, failure, or unresolved risk.

### Models and cost

The workflow is model-independent. Use a lower-cost model for clear, routine work and a stronger model when diagnosis is uncertain, the regression is difficult, or the risk is high. The user chooses the model and reasoning level; the workflow does not switch models silently.

### Where the rules live

- [`AGENTS.md`](AGENTS.md) — the short always-on agent contract.
- [`docs/AGENT_READY_WORKFLOW.md`](docs/AGENT_READY_WORKFLOW.md) — task design as `REPRO -> FAIL -> FIX -> PASS`.
- [`docs/CONTEXT_BUDGET_GUARD.md`](docs/CONTEXT_BUDGET_GUARD.md) — context, skills, tools, and cost.
- [`docs/ARCHITECTURE_GUARDS.md`](docs/ARCHITECTURE_GUARDS.md) — runtime, APIs, workers, and data.
- [`docs/CODE_STRUCTURE_GUARDS.md`](docs/CODE_STRUCTURE_GUARDS.md) — module boundaries and large files.
- `scripts/` — mechanical task, scope, diff, and project checks.

Once an application exists, add real `lint`, `typecheck`, `test`, and `build` commands to `package.json`. The starter does not pretend to test an application that is not there yet.
