import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import { GraphQLSchema, isObjectType, isInterfaceType } from 'graphql';
import { TypePoliciesPluginConfig, resolveConfig } from './config';
import { parseTypePolicies, TypeTransformation } from './parser';
import { generateTypeOverrides } from './generator';
import path from 'path';

/**
 * GraphQL Codegen plugin that generates TypeScript types reflecting
 * Apollo Client type policy transformations.
 */
export const plugin: PluginFunction<TypePoliciesPluginConfig> = (
  schema: GraphQLSchema,
  _documents: Types.DocumentFile[],
  config: TypePoliciesPluginConfig,
  info
): string => {
  // Resolve configuration with defaults
  const resolvedConfig = resolveConfig(config);

  if (resolvedConfig.debug) {
    console.log('[graphql-codegen-apollo-typepolicies] Starting plugin...');
    console.log(`[debug] Config:`, JSON.stringify(resolvedConfig, null, 2));
  }

  // Resolve the type policies path relative to cwd
  let typePoliciesPath = resolvedConfig.typePoliciesPath;

  // If the path is relative, resolve it relative to the current working directory
  if (!path.isAbsolute(typePoliciesPath)) {
    typePoliciesPath = path.resolve(process.cwd(), typePoliciesPath);
  }

  if (resolvedConfig.debug) {
    console.log(`[debug] Resolved typePoliciesPath: ${typePoliciesPath}`);
  }

  // Parse type policies
  const { transformations, errors, warnings } = parseTypePolicies(
    typePoliciesPath,
    resolvedConfig.typePoliciesExport,
    {
      typeInference: resolvedConfig.typeInference,
      debug: resolvedConfig.debug,
      tsconfigPath: resolvedConfig.tsconfigPath,
    }
  );

  // Report warnings
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`[graphql-codegen-apollo-typepolicies] ${warning}`);
    }
  }

  // Report errors
  if (errors.length > 0) {
    console.error('[graphql-codegen-apollo-typepolicies] Errors while parsing type policies:');
    for (const error of errors) {
      const location = error.location ? ` at ${error.location.filePath}:${error.location.line}` : '';
      console.error(`  - ${error.typeName}.${error.fieldName}${location}: ${error.message}`);
    }

    // If using require-annotations mode, throw on any errors
    if (resolvedConfig.typeInference === 'require-annotations') {
      throw new Error(
        `[graphql-codegen-apollo-typepolicies] Found ${errors.length} error(s) while parsing type policies. ` +
          `All read functions must have explicit return type annotations when using typeInference: "require-annotations".`
      );
    }
  }

  if (resolvedConfig.debug) {
    console.log(`[debug] Found ${transformations.size} transformation(s)`);
    for (const [key, transform] of transformations) {
      console.log(`[debug]   ${key}: ${transform.transformedType}`);
    }
  }

  // Validate transformations against schema
  validateTransformations(schema, transformations, resolvedConfig.debug);

  // Generate output
  const output = generateTypeOverrides(schema, transformations, resolvedConfig);

  if (resolvedConfig.debug) {
    console.log('[graphql-codegen-apollo-typepolicies] Plugin complete.');
  }

  return output;
};

/**
 * Validate that transformations reference valid types and fields in the schema
 */
function validateTransformations(
  schema: GraphQLSchema,
  transformations: Map<string, TypeTransformation>,
  debug: boolean
): void {
  for (const [key, transform] of transformations) {
    const type = schema.getType(transform.typeName);

    if (!type) {
      console.warn(
        `[graphql-codegen-apollo-typepolicies] Warning: Type "${transform.typeName}" not found in GraphQL schema`
      );
      continue;
    }

    if (!isObjectType(type) && !isInterfaceType(type)) {
      console.warn(
        `[graphql-codegen-apollo-typepolicies] Warning: Type "${transform.typeName}" is not an object or interface type`
      );
      continue;
    }

    const fields = type.getFields();
    if (!fields[transform.fieldName]) {
      console.warn(
        `[graphql-codegen-apollo-typepolicies] Warning: Field "${transform.fieldName}" not found on type "${transform.typeName}"`
      );
    } else if (debug) {
      console.log(`[debug] Validated: ${key}`);
    }
  }
}
