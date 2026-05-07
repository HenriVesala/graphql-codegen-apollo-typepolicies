# graphql-codegen-apollo-typepolicies

A [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) plugin that generates TypeScript types reflecting Apollo Client cache's type policy transformations.

GraphQL Code Generator typically produces TypeScript types that match the GraphQL schema — the scalar types and object structures as they are stored in the Apollo Client cache. However, when you define [`read` functions in your type policies](https://www.apollographql.com/docs/react/caching/cache-field-behavior/#the-read-function), the cache transforms fields on the way out, so the types your components actually receive can differ from what codegen generated. Since the generated types are what you use throughout your frontend, they should reflect the data as your components see it — which is what comes **out** of the cache, not what goes in.

This plugin bridges that gap by statically analyzing your type policies and generating accurate per-field type overrides that reflect the cache output.

### Why not use codegen's scalar overrides?

Codegen does support [manually overriding types](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript#scalars), but this works at the scalar/type level — not at the per-field level that Apollo Client type policies operate on. More importantly, manual overrides offer no safeguard: if you add a new field that uses an overridden scalar, there is nothing ensuring you also add a corresponding `read` function in your type policies. The generated types will assume the transformation exists, but at runtime the raw value comes through untransformed. This plugin avoids that problem by deriving types directly from your actual type policy code.


## Installation

```bash
npm install -D graphql-codegen-apollo-typepolicies
```

### Peer dependencies

- `graphql` ^15.0.0 || ^16.0.0
- `@graphql-codegen/plugin-helpers` ^5.0.0 || ^6.0.0

## Usage

Add the plugin to your `codegen.ts` configuration:

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  generates: {
    './src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        {
          'graphql-codegen-apollo-typepolicies': {
            typePoliciesPath: './src/apollo/typePolicies.ts',
          },
        },
      ],
    },
  },
};

export default config;
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `typePoliciesPath` | `string` | **required** | Path to the TypeScript file containing your type policies |
| `typePoliciesExport` | `string` | `"typePolicies"` | Name of the exported variable containing the type policies |
| `typeInference` | `"infer" \| "require-annotations"` | `"infer"` | How to extract return types from `read` functions |
| `preserveNullability` | `boolean` | `true` | Preserve nullability from the GraphQL schema on transformed types |
| `tsconfigPath` | `string` | `undefined` | Path to `tsconfig.json` for proper type resolution (useful with path aliases) |
| `debug` | `boolean` | `false` | Enable debug logging |

### Type inference modes

- **`infer`** (default) — Uses explicit return type annotations when present, otherwise infers the type from TypeScript. Errors if inference fails.
- **`require-annotations`** — All `read` functions must have explicit return type annotations. Throws an error if any are missing.

## Using the generated types

Given this type policy:

```ts
// src/apollo/typePolicies.ts
export const typePolicies = {
  User: {
    fields: {
      createdAt: {
        read(existing: string): Date {
          return new Date(existing);
        },
      },
    },
  },
};
```

The plugin emits these types into your generated file (alongside the standard codegen output):

```ts
// src/generated/graphql.ts
export type UserWithTypePolicies = {
  __typename?: 'User';
  createdAt: Date;          // <-- post-transform type
  id: User['id'];
  name: User['name'];
  // ...all other User fields, untransformed
};

export type WithTypePolicies<T>   // applies overlays throughout T
```

### `WithTypePolicies<T>` — wrap any value coming out of the cache

`WithTypePolicies<T>` walks `T` recursively, swapping in the post-transform type wherever it sees a `__typename` that has a registered policy. It preserves the original selection (no field widening) and recurses into nested objects and arrays — so it works for any shape the cache hands you.

The two most common usages:

**Wrapping a `useQuery` result:**

```tsx
import { useQuery } from '@apollo/client';
import { GetUserQuery, GetUserQueryVariables, WithTypePolicies } from './generated/graphql';

function UserCard({ id }: { id: string }) {
  const { data } = useQuery<GetUserQuery, GetUserQueryVariables>(GET_USER, { variables: { id } });
  const user = (data as WithTypePolicies<GetUserQuery>)?.user;
  //    ^? user.createdAt is Date, not string
  return <div>{user?.createdAt.toLocaleDateString()}</div>;
}
```

**Wrapping a `cache.readFragment` result:**

```ts
const fragment = cache.readFragment<User>({ id: 'User:1', fragment: USER_FIELDS });
const user = fragment as WithTypePolicies<User>;
//    ^? user.createdAt is Date
```

### Type-only access via `TypePolicyTransformations`

The plugin also exports a flat map keyed by `"TypeName.fieldName"` if you need the post-transform type of a single field directly:

```ts
import { TypePolicyTransformations } from './generated/graphql';

type CreatedAt = TypePolicyTransformations['User.createdAt']; // Date
```

## Development

This is a monorepo using npm workspaces.

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm run test

# Run the testbed codegen
npm run codegen
```

## Supported policy targets

| Target | Supported | Notes |
|--------|-----------|-------|
| Object types (`type User`) | Yes | Generates a `<Type>WithTypePolicies` overlay. |
| Interface types (`interface Node`) | Yes | The transformation is fanned out to every concrete object type that implements the interface, mirroring Apollo Client's runtime behavior. A concrete-type policy on the same field overrides the interface fan-out. |
| Union types (`union Foo = A \| B`) | No | Apollo doesn't apply field reads across union members (they don't share fields). The plugin emits a warning and skips the entry. |

## Supported policy features

The plugin analyzes only `read` functions. Other type policy options (`merge`, `keyFields`, `keyArgs`) are not parsed and don't affect the generated TypeScript. See [ROADMAP.md](./ROADMAP.md) for planned work — including `keyFields`-driven type narrowing.

## License

MIT
