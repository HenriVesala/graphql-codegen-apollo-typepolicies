// Types referenced by typePolicies read functions. Kept in this file (rather
// than inline in typePolicies.ts) so codegen's `@graphql-codegen/add` plugin
// can prepend an import for them to the generated graphql.ts.

export interface FormattedDate {
  date: Date;
  formatted: string;
  relative: string;
}

export interface ParsedMetadata {
  version: number;
  preferences: Record<string, unknown>;
}
