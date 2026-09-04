# Migration notes

Add one concise file when an upgrade requires a user, case owner, or maintainer to take action.

Use:

```text
docs/migrations/<from-version>-to-<to-version>.md
```

Each note must state:

- which version changes: repository release, package/tool, lifecycle, or schema contract;
- who is affected;
- the exact action and validation command;
- whether existing case records remain valid;
- rollback or safe-stop guidance;
- known limitations.

Do not create a migration note for wording-only changes with no user action. Link every required note
from `CHANGELOG.md` and the release notes.
