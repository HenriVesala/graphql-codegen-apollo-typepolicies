import { describe, it, expect } from 'vitest';
import { buildSchema } from 'graphql';
import { generateTypeOverrides } from '../src/generator';
import { TypeTransformation } from '../src/parser';
import fs from 'fs';
import path from 'path';

const fixturesPath = path.join(__dirname, 'fixtures');
const schemaSource = fs.readFileSync(path.join(fixturesPath, 'schema.graphql'), 'utf-8');
const schema = buildSchema(schemaSource);

const defaultConfig = {
  typePoliciesPath: './test.ts',
  typePoliciesExport: 'typePolicies',
  typeInference: 'infer' as const,
  preserveNullability: true,
  debug: false,
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
            isNullable: false, // The transformation itself is not nullable
            isArray: false,
          },
        ],
      ]);

      const output = generateTypeOverrides(schema, transformations, {
        ...defaultConfig,
        preserveNullability: true,
      });

      // updatedAt is nullable in schema (String), so output should be Date | null
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

      // Should not double up on null
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

  describe('DeepWithTypePolicies', () => {
    it('should generate DeepWithTypePolicies recursive type', () => {
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

      expect(output).toContain('export type DeepWithTypePolicies<T>');
      expect(output).toContain('T extends null | undefined ? T');
      expect(output).toContain('T extends ReadonlyArray<infer U> ? (T extends Array<infer U> ? Array<DeepWithTypePolicies<U>> : ReadonlyArray<DeepWithTypePolicies<U>>)');
      expect(output).toContain('T extends object ? { [K in keyof T]: DeepWithTypePolicies<T[K]> }');
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

      // Should match on __typename and list transformed fields
      expect(output).toContain("T extends { __typename?: 'User' } ? { [K in keyof T]: K extends 'createdAt' | 'name' ? UserWithTypePolicies[K] : DeepWithTypePolicies<T[K]> }");
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
      expect(output).toContain("UserWithTypePolicies[K]");
      expect(output).toContain("T extends { __typename?: 'Post' }");
      expect(output).toContain("PostWithTypePolicies[K]");
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

      // ReadonlyArray check comes first, then distinguishes mutable Array inside
      expect(output).toContain('T extends ReadonlyArray<infer U>');
      expect(output).toContain('T extends Array<infer U> ? Array<DeepWithTypePolicies<U>> : ReadonlyArray<DeepWithTypePolicies<U>>');
    });

    it('should not generate DeepWithTypePolicies when no transformations', () => {
      const output = generateTypeOverrides(schema, new Map(), defaultConfig);

      expect(output).not.toContain('DeepWithTypePolicies');
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

      // The type definition should be skipped
      expect(output).not.toContain('export type NonExistentWithTypePolicies = {');
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

      // email field should reference the base User type
      expect(output).toContain("email: User['email']");
      expect(output).toContain("name: User['name']");
    });
  });
});
