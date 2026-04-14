/**
 * GraphQL Codegen plugin for Apollo Client type policies
 *
 * This plugin parses Apollo Client type policies and generates TypeScript types
 * that reflect the transformations made by read functions.
 *
 * @example
 * ```yaml
 * # codegen.yml
 * generates:
 *   ./src/generated/graphql.ts:
 *     plugins:
 *       - typescript
 *       - typescript-operations
 *       - graphql-codegen-apollo-typepolicies:
 *           typePoliciesPath: "./src/apollo/typePolicies.ts"
 * ```
 *
 * @packageDocumentation
 */

export { plugin } from './plugin';
export { resolveConfig, defaultConfig } from './config';
export type { TypePoliciesPluginConfig, ResolvedTypePoliciesPluginConfig } from './config';
export { parseTypePolicies } from './parser';
export type { TypeTransformation, ParseResult, ParseError } from './parser';
export { generateTypeOverrides } from './generator';
