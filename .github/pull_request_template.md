## Change

Explain the problem, the intended behaviour, and anything deliberately deferred.

## Evidence

List the commands run and provide sanitised results or a minimal synthetic example.

## Review checklist

- [ ] I kept this change focused and did not include secrets, real customer data, generated case output, or private evidence.
- [ ] I ran the checks relevant to the change, or this is documentation-only and I checked links, paths, commands, and examples instead.
- [ ] If executable behaviour changed, I ran the applicable tests plus `npm run typecheck`, `npm run build`, `npm run validate -- --framework-only`, and `npm run smoke:contoso`.
- [ ] If renderer or untrusted-content handling changed, I ran `npm run test:renderer` and added negative tests.
- [ ] If a structured contract changed, I updated the schema, catalogue, version, fixtures, and compatibility guidance; otherwise this is not applicable.
- [ ] If an agent, lifecycle, model, route, or skill changed, I kept profiles, contracts, README guidance, tests, and synthetic expectations in sync; otherwise this is not applicable.
- [ ] I considered security, approval/hash integrity, path containment, prompt/tool authority, and supply-chain impact. Security-sensitive changes include an abuse case and fail-closed tests.
- [ ] I updated user-facing documentation when behaviour, setup, or contribution expectations changed.
