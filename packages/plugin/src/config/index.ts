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
   * Name of the exported variable containing the type policies.
   * @default "typePolicies"
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
};

/**
 * Merges user config with defaults
 */
export function resolveConfig(config: TypePoliciesPluginConfig): ResolvedTypePoliciesPluginConfig {
  if (!config.typePoliciesPath) {
    throw new Error('[graphql-codegen-apollo-typepolicies] Missing required config: typePoliciesPath');
  }

  return {
    ...defaultConfig,
    ...config,
    typePoliciesPath: config.typePoliciesPath,
  };
}
