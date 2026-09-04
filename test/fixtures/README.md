# Contract test fixtures

`cases/valid-case` is a compact, fully converged Phase 0 evidence set with a model plan, implementation
DAG, final AFF-A/AFF-B reviews, a human approval, and a run-journal event.

`invalid/` contains fixed malformed records. Tests also copy the valid case and make one controlled
change at a time to prove path escape, lifecycle drift, stale hashes, false reviewer convergence,
stale approval bindings, cyclic dependencies, and non-monotonic journals fail independently.
