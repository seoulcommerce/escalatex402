# Escalatex Protocol Spec

This directory contains versioned Escalatex protocol specifications.

- Current frozen version: **0.1** → `docs/spec/0.1.md`

## Compatibility

- Providers MUST expose the canonical endpoint: `/.well-known/escalatex`
- Clients SHOULD:
  - probe `{base_url}/.well-known/escalatex`
  - ignore unknown fields

## Versioning

- Backward-incompatible changes bump the minor version: `0.1` → `0.2`
- Patch changes clarify text and examples without changing meaning.
