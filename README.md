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

## License
MIT
