import fs from 'node:fs';
import path from 'node:path';
import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { generateTypeOverrides } from '../src/generator';
import type { TypeTransformation } from '../src/parser';

const fixturesPath = path.join(__dirname, 'fixtures');
const schemaSource = fs.readFileSync(path.join(fixturesPath, 'schema.graphql'), 'utf-8');
const schema = buildSchema(schemaSource);

const defaultConfig = {
  typePoliciesPath: './test.ts',
  typePoliciesExport: 'typePolicies',
  typeInference: 'infer' as const,
  preserveNullability: true,
  debug: false,
  tsconfigPath: undefined,
};

describe('Type Override Generator', () => {
  describe('basic generation', () => {
    it('should generate empty output when no transformations', () => {
      const transformations = new Map<string, TypeTransformation>();
      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain('No type policy transformations found');
    });

    it('should generate TypePolicyTransformations interface', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain('export interface TypePolicyTransformations');
      expect(output).toContain("'User.createdAt': Date");
    });

    it('should generate WithTypePolicies type for transformed types', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain('export type UserWithTypePolicies');
      expect(output).toContain('createdAt: Date');
      expect(output).toContain("__typename?: 'User'");
    });
  });

  describe('nullability handling', () => {
    it('should preserve nullability when configured', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.updatedAt',
          {
            typeName: 'User',
            fieldName: 'updatedAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, {
        ...defaultConfig,
        preserveNullability: true,
      });

      expect(output).toContain('updatedAt: Date | null');
    });

    it('should not add null when transformation already includes null', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.updatedAt',
          {
            typeName: 'User',
            fieldName: 'updatedAt',
            transformedType: 'Date | null',
            isNullable: true,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, {
        ...defaultConfig,
        preserveNullability: true,
      });

      expect(output).toContain('updatedAt: Date | null');
      expect(output).not.toContain('Date | null | null');
    });
  });

  describe('multiple types', () => {
    it('should generate types for multiple GraphQL types', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
        [
          'Post.publishedAt',
          {
            typeName: 'Post',
            fieldName: 'publishedAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain('export type UserWithTypePolicies');
      expect(output).toContain('export type PostWithTypePolicies');
    });
  });

  describe('utility types', () => {
    it('should generate WithTypePolicies utility type', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain('export type WithTypePolicies<T>');
      expect(output).toContain("T extends { __typename?: 'User' }");
    });

    it('should generate TypesWithPolicies union', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
        [
          'Post.title',
          {
            typeName: 'Post',
            fieldName: 'title',
            transformedType: 'string',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain('export type TypesWithPolicies');
      expect(output).toContain("'User'");
      expect(output).toContain("'Post'");
    });
  });

  describe('WithTypePolicies recursive behavior', () => {
    it('should generate the recursive base cases', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain('export type WithTypePolicies<T>');
      expect(output).toContain('T extends null | undefined ? T');
      expect(output).toContain(
        'T extends ReadonlyArray<infer U> ? (T extends Array<infer U> ? Array<WithTypePolicies<U>> : ReadonlyArray<WithTypePolicies<U>>)'
      );
      expect(output).toContain('T extends object ? { [K in keyof T]: WithTypePolicies<T[K]> }');
    });

    it('should generate __typename match branches with transformed field names', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
        [
          'User.name',
          {
            typeName: 'User',
            fieldName: 'name',
            transformedType: 'string',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain(
        "T extends { __typename?: 'User' } ? { [K in keyof T]: K extends 'createdAt' | 'name' ? UserWithTypePolicies[K] : WithTypePolicies<T[K]> }"
      );
    });

    it('should generate branches for multiple types', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
        [
          'Post.title',
          {
            typeName: 'Post',
            fieldName: 'title',
            transformedType: 'string',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain("T extends { __typename?: 'User' }");
      expect(output).toContain('UserWithTypePolicies[K]');
      expect(output).toContain("T extends { __typename?: 'Post' }");
      expect(output).toContain('PostWithTypePolicies[K]');
    });

    it('should preserve ReadonlyArray vs Array mutability', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain('T extends ReadonlyArray<infer U>');
      expect(output).toContain(
        'T extends Array<infer U> ? Array<WithTypePolicies<U>> : ReadonlyArray<WithTypePolicies<U>>'
      );
    });

    it('should not generate WithTypePolicies when no transformations', () => {
      const output = generateTypeOverrides(schema, new Map(), defaultConfig);

      expect(output).not.toContain('WithTypePolicies');
    });
  });

  describe('schema validation', () => {
    it('should not generate type definition for types not in schema', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'NonExistent.createdAt',
          {
            typeName: 'NonExistent',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).not.toContain('export type NonExistentWithTypePolicies = {');
    });
  });

  describe('interface and union types', () => {
    it('should fan an interface transformation out to every implementing type', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'Node.displayName',
          {
            typeName: 'Node',
            fieldName: 'displayName',
            transformedType: 'string',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).not.toContain('NodeWithTypePolicies');
      expect(output).not.toContain("'Node.displayName'");

      expect(output).toContain('export type CommentWithTypePolicies');
      expect(output).toContain('export type ArticleWithTypePolicies');
      expect(output).toContain("'Comment.displayName': string");
      expect(output).toContain("'Article.displayName': string");
      expect(output).toMatch(
        /export type TypesWithPolicies = '(Comment|Article)' \| '(Comment|Article)'/
      );
    });

    it('should let a concrete-type transformation override an interface fan-out', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'Node.displayName',
          {
            typeName: 'Node',
            fieldName: 'displayName',
            transformedType: 'string',
            isNullable: false,
            isArray: false,
          },
        ],
        [
          'Comment.displayName',
          {
            typeName: 'Comment',
            fieldName: 'displayName',
            transformedType: 'CommentName',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain("'Comment.displayName': CommentName");
      expect(output).not.toContain("'Comment.displayName': string");
      expect(output).toContain("'Article.displayName': string");
    });

    it('should coexist with non-overlapping object-type policies', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'Node.displayName',
          {
            typeName: 'Node',
            fieldName: 'displayName',
            transformedType: 'string',
            isNullable: false,
            isArray: false,
          },
        ],
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain('export type UserWithTypePolicies');
      expect(output).toContain('export type CommentWithTypePolicies');
      expect(output).toContain('export type ArticleWithTypePolicies');
      expect(output).toContain("'User.createdAt': Date");
      expect(output).toContain("'Comment.displayName': string");
      expect(output).toContain("'Article.displayName': string");
    });

    it('should drop transformations on union types', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'SearchResult.placeholder',
          {
            typeName: 'SearchResult',
            fieldName: 'placeholder',
            transformedType: 'string',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).not.toContain('SearchResultWithTypePolicies');
      expect(output).not.toContain("'SearchResult.placeholder'");
      expect(output).toContain('No type policy transformations found');
    });

    it('should not leave dispatch references to undeclared aliases', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'Node.displayName',
          {
            typeName: 'Node',
            fieldName: 'displayName',
            transformedType: 'string',
            isNullable: false,
            isArray: false,
          },
        ],
        [
          'SearchResult.placeholder',
          {
            typeName: 'SearchResult',
            fieldName: 'placeholder',
            transformedType: 'string',
            isNullable: false,
            isArray: false,
          },
        ],
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      const referenced = new Set(
        Array.from(output.matchAll(/(\w+)WithTypePolicies/g), (m) => m[1])
      );
      const declared = new Set(
        Array.from(output.matchAll(/export type (\w+)WithTypePolicies\b/g), (m) => m[1])
      );
      for (const name of referenced) {
        expect(declared.has(name)).toBe(true);
      }
    });
  });

  describe('non-transformed fields', () => {
    it('should reference base type for non-transformed fields', () => {
      const transformations = new Map<string, TypeTransformation>([
        [
          'User.createdAt',
          {
            typeName: 'User',
            fieldName: 'createdAt',
            transformedType: 'Date',
            isNullable: false,
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, defaultConfig);

      expect(output).toContain("email: User['email']");
      expect(output).toContain("name: User['name']");
    });
  });
});
