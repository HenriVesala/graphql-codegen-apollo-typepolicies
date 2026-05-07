# Roadmap

## Optional / To Consider Future Features

### keyFields type narrowing

When `keyFields` is specified in a type policy (e.g., `keyFields: ['sku']`), Apollo guarantees those fields are always present and non-null on cached entities. The plugin could narrow the generated types accordingly — for example, turning `sku: string | null` into `sku: string` — so component code doesn't need unnecessary null checks on fields the cache guarantees to exist.

### TypedDocumentNode integration helper

`WithTypePolicies` already handles operation result types, so users can manually wrap query types. A further step would be a utility that wraps `TypedDocumentNode<TData, TVariables>` so that `useQuery` returns transformed types automatically without manual wrapping at every call site. This is more of an Apollo Client hook wrapper pattern than a codegen plugin concern — worth considering only if there's clear demand.
