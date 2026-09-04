# Security policy

## Supported versions

The repository does not yet maintain formal release branches. Security fixes target the current
`main` branch and, when releases exist, the latest GitHub release. Older commits, tags, forks, and
generated case outputs are not maintained as supported versions.

## Report a vulnerability privately

Use GitHub's **Report a vulnerability** form on the repository
[Security advisories page](https://github.com/aramsmith/agentic-architecture-v2/security/advisories/new).
This is the primary reporting path. Do not open a public issue for a suspected vulnerability.

Do not include real customer data, architecture records, credentials, tokens, keys, personal data,
regulated data, or other secrets. Use a minimal synthetic example and redact logs before attaching
them.

For this agent and tooling repository, vulnerabilities include credible ways to:

- bypass renderer sanitisation or execute untrusted HTML, script, SVG, URL, or Mermaid content;
- escape case or output path containment, including through traversal, symbolic links, or junctions;
- compromise the workflow or dependency supply chain;
- escalate prompt content into unauthorised tool use, deployment, testing, or approval;
- expose secrets or confidential case content through logs, artifacts, generated HTML, or errors;
- bypass canonical hashes, reviewer convergence, human approval, or other fail-closed gates.

Include the affected commit or version, the smallest safe reproduction, expected and observed
behaviour, security impact, and any suggested mitigation. State whether you believe exploitation is
active or public.

## What to expect

Repository maintainers will triage reports when capacity allows, may request more safe evidence, and
will use the private advisory to coordinate investigation, remediation, credit, and disclosure.
There is no guaranteed acknowledgement, fix, or release time. Please avoid public disclosure until
the maintainers and reporter have had a reasonable opportunity to coordinate a fix or advisory.

This process does not create a warranty, support contract, certification, or production
authorisation.
