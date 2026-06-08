import path from 'node:path';
import {
  type ArrowFunction,
  type FunctionExpression,
  type MethodDeclaration,
  Node,
  type ObjectLiteralExpression,
  Project,
  type PropertyAssignment,
  type SourceFile,
  type SpreadAssignment,
  type Type,
} from 'ts-morph';

/**
 * Represents a type transformation extracted from a type policy read function
 */
export interface TypeTransformation {
  typeName: string;
  fieldName: string;
  transformedType: string;
  isNullable: boolean;
  isArray: boolean;
  arrayElementType?: string;
  location?: {
    filePath: string;
    line: number;
    column: number;
  };
}

export interface ParseError {
  typeName: string;
  fieldName: string;
  message: string;
  location?: {
    filePath: string;
    line: number;
    column: number;
  };
}

export interface ParseResult {
  transformations: Map<string, TypeTransformation>;
  errors: ParseError[];
  warnings: string[];
}

interface ParseOptions {
  typeInference: 'infer' | 'require-annotations';
  debug: boolean;
  tsconfigPath?: string;
}

/**
 * Parse a TypeScript file containing Apollo Client type policies
 * and extract type transformations from read functions.
 *
 * Supports:
 * - Object with method: { read(existing) { ... } }
 * - Object with arrow: { read: (existing) => ... }
 * - Object with function expression: { read: function(existing) { ... } }
 * - Shorthand method: { fieldName(existing) { ... } }
 * - Spread operators: { ...otherPolicies } (resolved across files)
 *
 * Does NOT support:
 * - Computed property names: { [FIELD_NAME]: ... }
 */
export function parseTypePolicies(
  filePath: string,
  exportName: string,
  options: ParseOptions
): ParseResult {
  const absolutePath = path.resolve(filePath);
  const project = createProject(options);

  let sourceFile: SourceFile;
  try {
    sourceFile = project.addSourceFileAtPath(absolutePath);
  } catch (error) {
    throw new Error(
      `[graphql-codegen-apollo-typepolicies] Could not read file: ${absolutePath}\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Resolve all imported files so spread references across files can be followed.
  // Note: this eagerly resolves all transitive imports. If performance becomes a
  // concern on very large projects, this could be deferred until a spread is encountered.
  project.resolveSourceFileDependencies();

  return parseSourceFile(sourceFile, absolutePath, exportName, options);
}

/**
 * Parse type policies from an inline TypeScript source string.
 * Useful for testing without needing fixture files on disk.
 *
 * @param additionalSources - Optional map of fileName -> source for multi-file spread tests
 */
export function parseTypePoliciesFromSource(
  source: string,
  exportName: string,
  options: ParseOptions,
  fileName: string = 'inline.ts',
  additionalSources?: Map<string, string>
): ParseResult {
  const project = createProject(options);

  if (additionalSources) {
    for (const [name, content] of additionalSources) {
      project.createSourceFile(name, content);
    }
  }

  const sourceFile = project.createSourceFile(fileName, source);
  project.resolveSourceFileDependencies();

  return parseSourceFile(sourceFile, fileName, exportName, options);
}

function createProject(options: ParseOptions): Project {
  const projectOptions = options.tsconfigPath
    ? {
        tsConfigFilePath: path.resolve(options.tsconfigPath),
        skipAddingFilesFromTsConfig: true,
      }
    : {
        compilerOptions: {
          strict: true,
          skipLibCheck: true,
        },
      };

  return new Project(projectOptions);
}

/**
 * Bundles mutable state for the recursive AST walk.
 */
interface WalkContext {
  transformations: Map<string, TypeTransformation>;
  errors: ParseError[];
  warnings: string[];
  options: ParseOptions;
}

function parseSourceFile(
  sourceFile: SourceFile,
  filePath: string,
  exportName: string,
  options: ParseOptions
): ParseResult {
  const context: WalkContext = {
    transformations: new Map(),
    errors: [],
    warnings: [],
    options,
  };

  // Find the typePolicies declaration
  const declaration = findTypePoliciesDeclaration(sourceFile, exportName);
  if (!declaration) {
    throw new Error(
      `[graphql-codegen-apollo-typepolicies] Could not find "${exportName}" export in ${filePath}`
    );
  }

  // Get the initializer (the object literal)
  const raw = declaration.getInitializer();
  const initializer = raw ? unwrapExpression(raw) : undefined;
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
    throw new Error(
      `[graphql-codegen-apollo-typepolicies] "${exportName}" must be an object literal expression`
    );
  }

  processTypeProperties(initializer, context);

  if (context.warnings.length > 0 && options.debug) {
    for (const warning of context.warnings) {
      console.warn(`[warning] ${warning}`);
    }
  }

  return {
    transformations: context.transformations,
    errors: context.errors,
    warnings: context.warnings,
  };
}

/**
 * Walk top-level type entries in an object literal.
 * Recursively resolves spread operators.
 *
 * Properties are processed in source order (as returned by ts-morph's getProperties()),
 * so later properties override earlier ones — matching JavaScript spread semantics.
 */
function processTypeProperties(
  objectLiteral: ObjectLiteralExpression,
  context: WalkContext,
  spreadAncestry: Set<string> = new Set()
): void {
  for (const typeProperty of objectLiteral.getProperties()) {
    if (Node.isSpreadAssignment(typeProperty)) {
      const resolved = resolveSpreadToObjectLiteral(typeProperty, context, spreadAncestry);
      if (resolved) {
        processTypeProperties(resolved.objectLiteral, context, resolved.ancestry);
      }
      continue;
    }

    if (!Node.isPropertyAssignment(typeProperty)) continue;

    const nodeFilePath = typeProperty.getSourceFile().getFilePath();
    const typeName = getPropertyName(typeProperty, nodeFilePath, context.warnings);
    if (!typeName) continue;

    const typeValue = typeProperty.getInitializer();
    if (!typeValue || !Node.isObjectLiteralExpression(typeValue)) continue;

    const fieldsProperty = typeValue.getProperty('fields');
    if (!fieldsProperty || !Node.isPropertyAssignment(fieldsProperty)) continue;

    const fieldsValue = fieldsProperty.getInitializer();
    if (!fieldsValue || !Node.isObjectLiteralExpression(fieldsValue)) continue;

    processFieldProperties(fieldsValue, typeName, context);
  }
}

/**
 * Walk field entries within a type's fields object.
 * Recursively resolves spread operators.
 */
function processFieldProperties(
  fieldsObjectLiteral: ObjectLiteralExpression,
  typeName: string,
  context: WalkContext,
  spreadAncestry: Set<string> = new Set()
): void {
  for (const fieldProperty of fieldsObjectLiteral.getProperties()) {
    if (Node.isSpreadAssignment(fieldProperty)) {
      const resolved = resolveSpreadToObjectLiteral(fieldProperty, context, spreadAncestry);
      if (resolved) {
        processFieldProperties(resolved.objectLiteral, typeName, context, resolved.ancestry);
      }
      continue;
    }

    const nodeFilePath = fieldProperty.getSourceFile().getFilePath();

    if (Node.isMethodDeclaration(fieldProperty)) {
      const fieldName = fieldProperty.getName();
      try {
        const transformation = extractFromMethod(
          typeName,
          fieldName,
          fieldProperty,
          context.options,
          nodeFilePath
        );
        if (transformation) {
          context.transformations.set(`${typeName}.${fieldName}`, transformation);
          if (context.options.debug) {
            console.log(
              `[debug] Found transformation: ${typeName}.${fieldName} -> ${transformation.transformedType}`
            );
          }
        }
      } catch (error) {
        const line = fieldProperty.getStartLineNumber();
        context.errors.push({
          typeName,
          fieldName,
          message: error instanceof Error ? error.message : String(error),
          location: { filePath: nodeFilePath, line, column: 0 },
        });
      }
      continue;
    }

    if (!Node.isPropertyAssignment(fieldProperty)) continue;

    const fieldName = getPropertyName(fieldProperty, nodeFilePath, context.warnings);
    if (!fieldName) continue;

    try {
      const transformation = extractFieldTransformation(
        typeName,
        fieldName,
        fieldProperty,
        context.options,
        nodeFilePath
      );

      if (transformation) {
        context.transformations.set(`${typeName}.${fieldName}`, transformation);
        if (context.options.debug) {
          console.log(
            `[debug] Found transformation: ${typeName}.${fieldName} -> ${transformation.transformedType}`
          );
        }
      }
    } catch (error) {
      const line = fieldProperty.getStartLineNumber();
      context.errors.push({
        typeName,
        fieldName,
        message: error instanceof Error ? error.message : String(error),
        location: { filePath: nodeFilePath, line, column: 0 },
      });
    }
  }
}

/**
 * Resolve a spread assignment to the underlying object literal.
 * Follows symbol references across files via ts-morph's type checker.
 *
 * @param spreadAncestry - Tracks the current resolution chain to detect circular references.
 *   Scoped per chain so the same variable can be spread in independent contexts
 */
function resolveSpreadToObjectLiteral(
  spreadNode: SpreadAssignment,
  context: WalkContext,
  spreadAncestry: Set<string>
): { objectLiteral: ObjectLiteralExpression; filePath: string; ancestry: Set<string> } | null {
  const expr = spreadNode.getExpression();
  const line = spreadNode.getStartLineNumber();
  const filePath = spreadNode.getSourceFile().getFilePath();

  if (!Node.isIdentifier(expr)) {
    context.warnings.push(
      `[${filePath}:${line}] Cannot resolve spread expression '...${expr.getText()}' (not a simple identifier)`
    );
    return null;
  }

  const symbol = expr.getSymbol();
  if (!symbol) {
    context.warnings.push(
      `[${filePath}:${line}] Cannot resolve spread expression '...${expr.getText()}' (symbol not found)`
    );
    return null;
  }

  // Follow import aliases to the original declaration
  const resolved = symbol.isAlias() ? symbol.getAliasedSymbol() : symbol;
  if (!resolved) {
    context.warnings.push(
      `[${filePath}:${line}] Cannot resolve spread expression '...${expr.getText()}' (could not follow alias)`
    );
    return null;
  }

  const decl = resolved.getValueDeclaration();
  if (!decl || !Node.isVariableDeclaration(decl)) {
    context.warnings.push(
      `[${filePath}:${line}] Cannot resolve spread expression '...${expr.getText()}' (not a variable declaration)`
    );
    return null;
  }

  // Circular reference check — scoped to the current ancestry chain
  const declFilePath = decl.getSourceFile().getFilePath();
  const nodeKey = `${declFilePath}:${decl.getStart()}`;
  if (spreadAncestry.has(nodeKey)) {
    context.warnings.push(
      `[${filePath}:${line}] Circular spread reference detected for '...${expr.getText()}'`
    );
    return null;
  }

  const rawInit = decl.getInitializer();
  const init = rawInit ? unwrapExpression(rawInit) : undefined;
  if (!init || !Node.isObjectLiteralExpression(init)) {
    context.warnings.push(
      `[${filePath}:${line}] Cannot resolve spread expression '...${expr.getText()}' (initializer is not an object literal)`
    );
    return null;
  }

  if (context.options.debug) {
    console.log(`[debug] Resolved spread '...${expr.getText()}' from ${declFilePath}`);
  }

  // Clone the ancestry and extend it for the recursive call
  const childAncestry = new Set(spreadAncestry);
  childAncestry.add(nodeKey);

  return { objectLiteral: init, filePath: declFilePath, ancestry: childAncestry };
}

/**
 * Unwrap expression wrappers like `as const`, `satisfies T`, and parentheses.
 */
function unwrapExpression(node: Node): Node {
  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node)) {
    return unwrapExpression(node.getExpression());
  }
  if (Node.isParenthesizedExpression(node)) {
    return unwrapExpression(node.getExpression());
  }
  return node;
}

/**
 * Find the typePolicies variable declaration in the source file
 */
function findTypePoliciesDeclaration(sourceFile: SourceFile, exportName: string) {
  const variableDeclaration = sourceFile.getVariableDeclaration(exportName);
  if (variableDeclaration) {
    return variableDeclaration;
  }

  for (const exportDecl of sourceFile.getExportedDeclarations().values()) {
    for (const decl of exportDecl) {
      if (Node.isVariableDeclaration(decl) && decl.getName() === exportName) {
        return decl;
      }
    }
  }

  return null;
}

/**
 * Get the name of a property assignment, with warnings for unsupported patterns
 */
function getPropertyName(
  property: PropertyAssignment,
  filePath: string,
  warnings: string[]
): string | null {
  const nameNode = property.getNameNode();

  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }

  if (Node.isStringLiteral(nameNode)) {
    return nameNode.getLiteralValue();
  }

  if (Node.isComputedPropertyName(nameNode)) {
    const line = property.getStartLineNumber();
    warnings.push(
      `[${filePath}:${line}] Computed property name is not supported and will be skipped`
    );
  }

  return null;
}

/**
 * Extract type transformation from a field policy.
 *
 * Supports:
 * - Object with method: { read(existing) { ... } }
 * - Object with arrow: { read: (existing) => ... }
 * - Object with function expression: { read: function(existing) { ... } }
 */
function extractFieldTransformation(
  typeName: string,
  fieldName: string,
  fieldProperty: PropertyAssignment,
  options: ParseOptions,
  filePath: string
): TypeTransformation | null {
  const fieldValue = fieldProperty.getInitializer();

  if (!fieldValue) return null;

  if (Node.isObjectLiteralExpression(fieldValue)) {
    const readProperty = fieldValue.getProperty('read');
    if (!readProperty) return null;

    if (Node.isMethodDeclaration(readProperty)) {
      return extractFromMethod(typeName, fieldName, readProperty, options, filePath);
    }

    if (Node.isPropertyAssignment(readProperty)) {
      const readValue = readProperty.getInitializer();

      if (readValue && Node.isArrowFunction(readValue)) {
        return extractFromArrowFunction(typeName, fieldName, readValue, options, filePath);
      }

      if (readValue && Node.isFunctionExpression(readValue)) {
        return extractFromFunctionExpression(typeName, fieldName, readValue, options, filePath);
      }
    }
  }

  return null;
}

/**
 * Extract transformation from a method declaration
 */
function extractFromMethod(
  typeName: string,
  fieldName: string,
  method: MethodDeclaration,
  options: ParseOptions,
  filePath: string
): TypeTransformation | null {
  const returnTypeNode = method.getReturnTypeNode();
  const line = method.getStartLineNumber();

  if (returnTypeNode) {
    const returnType = method.getReturnType();
    return createTransformation(typeName, fieldName, returnType, filePath, line);
  }

  if (options.typeInference === 'require-annotations') {
    throw new Error(
      `Missing return type annotation on read function at ${filePath}:${line} ` +
        `(typeInference: "require-annotations")`
    );
  }

  // Try to infer return type
  const returnType = method.getReturnType();
  return createTransformationWithInference(typeName, fieldName, returnType, filePath, line);
}

/**
 * Extract transformation from an arrow function
 */
function extractFromArrowFunction(
  typeName: string,
  fieldName: string,
  func: ArrowFunction,
  options: ParseOptions,
  filePath: string
): TypeTransformation | null {
  const returnTypeNode = func.getReturnTypeNode();
  const line = func.getStartLineNumber();

  if (returnTypeNode) {
    const returnType = func.getReturnType();
    return createTransformation(typeName, fieldName, returnType, filePath, line);
  }

  if (options.typeInference === 'require-annotations') {
    throw new Error(
      `Missing return type annotation on read function at ${filePath}:${line} ` +
        `(typeInference: "require-annotations")`
    );
  }

  // Try to infer return type
  const returnType = func.getReturnType();
  return createTransformationWithInference(typeName, fieldName, returnType, filePath, line);
}

/**
 * Extract transformation from a function expression
 */
function extractFromFunctionExpression(
  typeName: string,
  fieldName: string,
  func: FunctionExpression,
  options: ParseOptions,
  filePath: string
): TypeTransformation | null {
  const returnTypeNode = func.getReturnTypeNode();
  const line = func.getStartLineNumber();

  if (returnTypeNode) {
    const returnType = func.getReturnType();
    return createTransformation(typeName, fieldName, returnType, filePath, line);
  }

  if (options.typeInference === 'require-annotations') {
    throw new Error(
      `Missing return type annotation on read function at ${filePath}:${line} ` +
        `(typeInference: "require-annotations")`
    );
  }

  const returnType = func.getReturnType();
  return createTransformationWithInference(typeName, fieldName, returnType, filePath, line);
}

/**
 * Sanitize type text to remove import paths.
 * ts-morph may return types like `import("/path/to/file").TypeName`
 * This function extracts just the type name.
 */
function sanitizeTypeText(typeText: string): string {
  const importPattern = /import\s*\([^)]+\)\s*\.\s*/g;
  let sanitized = typeText.replace(importPattern, '');

  while (importPattern.test(sanitized)) {
    sanitized = sanitized.replace(importPattern, '');
  }

  return sanitized;
}

/**
 * Create a transformation from an explicit type
 */
function createTransformation(
  typeName: string,
  fieldName: string,
  returnType: Type,
  filePath: string,
  line: number
): TypeTransformation {
  const rawTypeText = returnType.getText();
  const typeText = sanitizeTypeText(rawTypeText);
  const isNullable = returnType.isNullable();
  const isArray = returnType.isArray();

  let arrayElementType: string | undefined;
  if (isArray) {
    const elementType = returnType.getArrayElementType();
    if (elementType) {
      arrayElementType = sanitizeTypeText(elementType.getText());
    }
  }

  return {
    typeName,
    fieldName,
    transformedType: typeText,
    isNullable,
    isArray,
    arrayElementType,
    location: { filePath, line, column: 0 },
  };
}

/**
 * Check if a type text represents an unresolvable/error type.
 * More precise than checking for 'error' substring to avoid false positives
 * with types like 'ErrorHandler'.
 */
function isUnresolvableType(typeText: string): boolean {
  const unresolvablePatterns = [
    /^any$/,
    /^unknown$/,
    /^never$/,
    /\{\s*\}/, // empty object type {} often indicates inference failure
    /^error$/, // exact match only
    /ts\(\d+\)/, // TypeScript error codes like ts(2322)
  ];

  return unresolvablePatterns.some((pattern) => pattern.test(typeText));
}

/**
 * Create a transformation with type inference validation
 */
function createTransformationWithInference(
  typeName: string,
  fieldName: string,
  returnType: Type,
  filePath: string,
  line: number
): TypeTransformation {
  const rawTypeText = returnType.getText();
  const typeText = sanitizeTypeText(rawTypeText);

  // Check if we got a meaningful type (not 'any' or inferred to something useless)
  if (isUnresolvableType(typeText)) {
    throw new Error(
      `Cannot infer return type for read function at ${filePath}:${line}. ` +
        `Got: "${typeText}". Add an explicit return type annotation.`
    );
  }

  return createTransformation(typeName, fieldName, returnType, filePath, line);
}
