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

export type { ResolvedTypePoliciesPluginConfig, TypePoliciesPluginConfig } from './config';
export { defaultConfig, resolveConfig } from './config';
export { generateTypeOverrides } from './generator';
export type { ParseError, ParseResult, TypeTransformation } from './parser';
export { parseTypePolicies } from './parser';
export { plugin } from './plugin';
