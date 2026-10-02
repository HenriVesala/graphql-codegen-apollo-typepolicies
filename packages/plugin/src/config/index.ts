/**
 * Configuration options for the graphql-codegen-apollo-typepolicies plugin
 */
export interface TypePoliciesPluginConfig {
  /**
   * Path to the TypeScript file containing type policies.
   * Can be relative to the codegen config file or absolute.
   * @example "./src/apollo/typePolicies.ts"
   */
  typePoliciesPath: string;

  /**
   * Name of the export inside `typePoliciesPath` that holds the policies.
   *
   * The plugin looks for `export const <name> = { ... }` in the file. Override
   * this when your variable isn't called `typePolicies` — e.g. `apolloTypePolicies`
   * or any name your codebase uses.
   *
   * Pass `"default"` to pick up `export default { ... }` instead.
   *
   * @default "typePolicies"
   * @example "apolloTypePolicies"
   * @example "default"
   */
  typePoliciesExport?: string;

  /**
   * How to handle return type extraction from read functions.
   *
   * - "infer": Use annotation if present, otherwise infer from TypeScript. Error if inference fails.
   * - "require-annotations": All read functions must have explicit return type annotations.
   *
   * @default "infer"
   */
  typeInference?: 'infer' | 'require-annotations';

  /**
   * Whether to preserve nullability from the original GraphQL schema.
   * When true, if the schema field is nullable, the transformed type will also be nullable.
   * @default true
   */
  preserveNullability?: boolean;

  /**
   * Enable debug logging for troubleshooting.
   * @default false
   */
  debug?: boolean;

  /**
   * Path to tsconfig.json for proper type resolution.
   * Useful for projects with path aliases or complex TypeScript configurations.
   * If not specified, a minimal TypeScript configuration will be used.
   * @example "./tsconfig.json"
   */
  tsconfigPath?: string;

  /**
   * How to handle a computed property name that cannot be statically resolved
   * to a string literal (e.g. `{ [getFieldName()]: ... }` or a `let` binding).
   *
   * Apollo evaluates the key at runtime and the `read` still fires, so skipping
   * it produces a type that disagrees with the runtime value. This option
   * controls whether that mismatch is a loud warning or a hard error.
   *
   * @default "warn" — "error" when `typeInference` is "require-annotations"
   */
  onUnresolvedComputedKey?: 'warn' | 'error';
}

/**
 * Resolved configuration with all values defined
 */
export interface ResolvedTypePoliciesPluginConfig {
  typePoliciesPath: string;
  typePoliciesExport: string;
  typeInference: 'infer' | 'require-annotations';
  preserveNullability: boolean;
  debug: boolean;
  tsconfigPath: string | undefined;
  onUnresolvedComputedKey: 'warn' | 'error';
}

/**
 * Default configuration values
 */
export const defaultConfig: Omit<ResolvedTypePoliciesPluginConfig, 'typePoliciesPath'> = {
  typePoliciesExport: 'typePolicies',
  typeInference: 'infer',
  preserveNullability: true,
  debug: false,
  tsconfigPath: undefined,
  onUnresolvedComputedKey: 'warn',
};

/**
 * Merges user config with defaults
 */
export function resolveConfig(config: TypePoliciesPluginConfig): ResolvedTypePoliciesPluginConfig {
  if (!config.typePoliciesPath) {
    throw new Error(
      '[graphql-codegen-apollo-typepolicies] Missing required config: typePoliciesPath'
    );
  }

  // When `require-annotations` strictness is on, unresolved computed keys
  // should also be strict unless the user has explicitly opted out.
  const onUnresolvedComputedKey =
    config.onUnresolvedComputedKey ??
    (config.typeInference === 'require-annotations' ? 'error' : 'warn');

  return {
    ...defaultConfig,
    ...config,
    typePoliciesPath: config.typePoliciesPath,
    onUnresolvedComputedKey,
  };
}
