# Roadmap

## Optional / To Consider Future Features

### keyFields type narrowing

When `keyFields` is specified in a type policy (e.g., `keyFields: ['sku']`), Apollo guarantees those fields are always present and non-null on cached entities. The plugin could narrow the generated types accordingly — for example, turning `sku: string | null` into `sku: string` — so component code doesn't need unnecessary null checks on fields the cache guarantees to exist.

### Auto-apply via Apollo 4 `TypeOverrides` (likely 0.2.0)

Apollo Client 4 exposes a built-in module-augmentation extension surface — `interface TypeOverrides` exported from `@apollo/client`. It uses HKT (higher-kinded types) so a third-party package can register handlers that Apollo composes into the result types of every hook/operation:

```ts
import type { HKT } from '@apollo/client/utilities';
import type { TypeOverrides } from '@apollo/client';
// (provided by the plugin's generated output:)
import type { WithTypePolicies } from './generated/graphql';

interface WithTypePoliciesHKT extends HKT {
  return: WithTypePolicies<this['arg1']>;
}

declare module '@apollo/client' {
  interface TypeOverrides {
    Complete: WithTypePoliciesHKT;
    Streaming: WithTypePoliciesHKT;
    Partial: WithTypePoliciesHKT;
  }
}
```

With this in place, every `data` returned from `useQuery`/`useFragment`/`useSuspenseQuery`/etc. — whether in `complete`, `streaming`, or `partial` state — has `WithTypePolicies` applied automatically. No manual `TypedDocumentNode<WithTypePolicies<T>, V>` wrapping, no casts.

The plugin's generated file could emit this `declare module` block directly. Behind a config flag so users can opt in (since it's a global augmentation that affects every Apollo result type in the project).

Notes:
- Composes with Apollo's data masking via the same surface (`MaybeMasked`/`Unmasked` are also `TypeOverrides` slots). Apollo's own `GraphQLCodegenDataMasking` namespace in `@apollo/client/masking` is the reference pattern.
- For `Partial`, default behavior is `DeepPartial<TData>`; the plugin's HKT would likely want `DeepPartial<WithTypePolicies<TData>>` to preserve the partial semantics.
- Originated from feedback by an Apollo Client maintainer on the v0.1.0 release.

Reference: https://www.apollographql.com/docs/react/data/typescript#signature-styles-classic-and-modern

### Richer computed property name resolution

Local `const` and imported `const` bindings to string literals already resolve. Remaining cases that could be added:

- **Template literals with substitutions**: `` { [`${PREFIX}At`]: ... } ``. Requires evaluating template parts and interpolations.
- **Member access**: `const KEYS = { createdAt: 'createdAt' as const }; { [KEYS.createdAt]: ... }`. Requires resolving object property access.

Neither is high priority — the current behavior (loud warning + opt-in error mode via `onUnresolvedComputedKey`) makes the gap safe to live with, and the workaround is to use a literal key.
