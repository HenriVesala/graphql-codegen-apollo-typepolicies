# Roadmap

## Optional / To Consider Future Features

### keyFields type narrowing

When `keyFields` is specified in a type policy (e.g., `keyFields: ['sku']`), Apollo guarantees those fields are always present and non-null on cached entities. The plugin could narrow the generated types accordingly — for example, turning `sku: string | null` into `sku: string` — so component code doesn't need unnecessary null checks on fields the cache guarantees to exist.

### TypedDocumentNode integration helper

`WithTypePolicies` already handles operation result types, so users can manually wrap query types. A further step would be a utility that wraps `TypedDocumentNode<TData, TVariables>` so that `useQuery` returns transformed types automatically without manual wrapping at every call site. This is more of an Apollo Client hook wrapper pattern than a codegen plugin concern — worth considering only if there's clear demand.

### Computed property name resolution

Currently, computed property names like `{ [FIELD]: { read(...) } }` are skipped with a warning. The plugin could follow the binding via ts-morph's symbol resolution to determine the literal value when `FIELD` resolves to a string constant — handling the common case (`const FIELD = 'createdAt'`) without trying to be a full evaluator. Lower priority since the workaround (use a literal key) is trivial.

### Default export support

The parser only finds named exports — `export default { ... }` is not detected. Adding default-export resolution would let users skip the `typePoliciesExport` config option for the most common Apollo Client setup pattern. Straightforward to implement; the question is whether to also let `typePoliciesExport: 'default'` (or similar) opt into it explicitly, or auto-detect when no named export matches.
