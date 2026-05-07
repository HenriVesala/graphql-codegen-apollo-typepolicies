import { describe, it, expect, afterEach } from 'vitest';
import { buildSchema } from 'graphql';
import { plugin } from '../src';
import fs from 'fs';
import path from 'path';
import os from 'os';

const schemaSource = fs.readFileSync(path.join(__dirname, 'fixtures', 'schema.graphql'), 'utf-8');
const schema = buildSchema(schemaSource);

// Helper: write source to a temp file, run plugin, clean up
const tmpFiles: string[] = [];

function pluginFromSource(source: string, config: Record<string, unknown> = {}): string {
  const tmpPath = path.join(os.tmpdir(), `test-policy-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`);
  fs.writeFileSync(tmpPath, source);
  tmpFiles.push(tmpPath);
  return plugin(schema, [], {
    typePoliciesPath: tmpPath,
    typePoliciesExport: 'typePolicies',
    ...config,
  }) as string;
}

afterEach(() => {
  for (const f of tmpFiles) {
    try { fs.unlinkSync(f); } catch {}
  }
  tmpFiles.length = 0;
});

describe('Plugin Integration', () => {
  it('should generate type overrides from simple policy', () => {
    const output = pluginFromSource(`
      export const typePolicies = {
        User: {
          fields: {
            createdAt: {
              read(existing: string): Date {
                return new Date(existing);
              },
            },
            name: {
              read(existing: string): string {
                return existing.toUpperCase();
              },
            },
          },
        },
      };
    `);

    expect(output).toContain('UserWithTypePolicies');
    expect(output).toContain('createdAt: Date');
    expect(output).toContain('TypePolicyTransformations');
  });

  it('should handle nullable types correctly', () => {
    const output = pluginFromSource(`
      export const typePolicies = {
        User: {
          fields: {
            updatedAt: {
              read(existing: string | null): Date | null {
                return existing ? new Date(existing) : null;
              },
            },
            deletedAt: {
              read(existing: string | undefined): Date | undefined {
                return existing ? new Date(existing) : undefined;
              },
            },
          },
        },
      };
    `, { preserveNullability: true });

    expect(output).toContain('updatedAt: Date | null');
  });

  it('should handle arrow function syntax', () => {
    const output = pluginFromSource(`
      export const typePolicies = {
        Post: {
          fields: {
            publishedAt: {
              read: (existing: string): Date => {
                return new Date(existing);
              },
            },
            title: {
              read: (existing: string): string => existing.trim(),
            },
          },
        },
      };
    `);

    expect(output).toContain('PostWithTypePolicies');
    expect(output).toContain('publishedAt: Date');
  });

  it('should infer types when typeInference is "infer"', () => {
    const output = pluginFromSource(`
      export const typePolicies = {
        User: {
          fields: {
            createdAt: {
              read(existing: string) {
                return new Date(existing);
              },
            },
            count: {
              read(existing: number) {
                return existing * 2;
              },
            },
          },
        },
      };
    `, { typeInference: 'infer' });

    expect(output).toContain('createdAt: Date');
  });

  it('should throw when typeInference is "require-annotations" and annotations are missing', () => {
    expect(() =>
      pluginFromSource(`
        export const typePolicies = {
          User: {
            fields: {
              createdAt: {
                read(existing: string) {
                  return new Date(existing);
                },
              },
            },
          },
        };
      `, { typeInference: 'require-annotations' })
    ).toThrow('require-annotations');
  });

  it('should handle complex custom types', () => {
    const output = pluginFromSource(`
      interface FormattedDate {
        date: Date;
        formatted: string;
      }

      interface ParsedMetadata {
        version: number;
        data: Record<string, unknown>;
      }

      export const typePolicies = {
        User: {
          fields: {
            lastLogin: {
              read(existing: string): FormattedDate {
                const date = new Date(existing);
                return {
                  date,
                  formatted: date.toISOString(),
                };
              },
            },
            metadata: {
              read(existing: string): ParsedMetadata {
                return JSON.parse(existing);
              },
            },
          },
        },
      };
    `);

    expect(output).toContain('lastLogin: FormattedDate');
    expect(output).toContain('metadata: ParsedMetadata');
  });

  it('should handle array types', () => {
    const output = pluginFromSource(`
      interface Tag {
        name: string;
        slug: string;
      }

      export const typePolicies = {
        Post: {
          fields: {
            tags: {
              read(existing: string[]): Tag[] {
                return existing.map((tag) => ({
                  name: tag,
                  slug: tag.toLowerCase().replace(/\\s+/g, '-'),
                }));
              },
            },
            categories: {
              read(existing: string[]): Set<string> {
                return new Set(existing);
              },
            },
          },
        },
      };
    `);

    expect(output).toContain('tags: Tag[]');
    expect(output).toContain('categories: Set<string>');
  });

  it('should throw when typePoliciesPath is missing', () => {
    expect(() =>
      plugin(schema, [], {
        typePoliciesPath: '',
      })
    ).toThrow('Missing required config: typePoliciesPath');
  });

  it('should throw when file does not exist', () => {
    expect(() =>
      plugin(schema, [], {
        typePoliciesPath: './non-existent-file.ts',
      })
    ).toThrow('Could not read file');
  });

  it('should generate WithTypePolicies utility type', () => {
    const output = pluginFromSource(`
      export const typePolicies = {
        User: {
          fields: {
            createdAt: {
              read(existing: string): Date {
                return new Date(existing);
              },
            },
            name: {
              read(existing: string): string {
                return existing.toUpperCase();
              },
            },
          },
        },
      };
    `);

    expect(output).toContain('export type WithTypePolicies<T>');
    expect(output).toContain("T extends { __typename?: 'User' }");
    expect(output).toContain("K extends 'createdAt' | 'name' ? UserWithTypePolicies[K]");
    expect(output).toContain('WithTypePolicies<T[K]>');
    expect(output).not.toContain('DeepWithTypePolicies');
  });

  it('should warn when type policy references a type not in schema', () => {
    const consoleSpy = { warn: [] as string[] };
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => consoleSpy.warn.push(args.join(' '));

    try {
      const output = pluginFromSource(`
        export const typePolicies = {
          NonExistentType: {
            fields: {
              foo: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
            },
          },
        };
      `);

      expect(consoleSpy.warn.some(w => w.includes('NonExistentType'))).toBe(true);
      // Should still produce output (not crash)
      expect(output).toBeDefined();
    } finally {
      console.warn = origWarn;
    }
  });

  it('should warn when field is not found on schema type', () => {
    const consoleSpy = { warn: [] as string[] };
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => consoleSpy.warn.push(args.join(' '));

    try {
      pluginFromSource(`
        export const typePolicies = {
          User: {
            fields: {
              nonExistentField: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
            },
          },
        };
      `);

      expect(consoleSpy.warn.some(w => w.includes('nonExistentField'))).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });

  it('should report parser warnings through plugin', () => {
    const consoleSpy = { warn: [] as string[] };
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => consoleSpy.warn.push(args.join(' '));

    try {
      pluginFromSource(`
        const FIELD = 'createdAt';
        export const typePolicies = {
          User: {
            fields: {
              [FIELD]: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
            },
          },
        };
      `);

      expect(consoleSpy.warn.some(w => w.includes('Computed property name'))).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });

  it('should fan an interface policy out to every implementing type', () => {
    const consoleSpy = { warn: [] as string[] };
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => consoleSpy.warn.push(args.join(' '));

    try {
      const output = pluginFromSource(`
        export const typePolicies = {
          Node: {
            fields: {
              displayName: {
                read(existing: string): string {
                  return existing.toUpperCase();
                },
              },
            },
          },
        };
      `);

      // Interface policies are now supported — no "not an object" warning.
      expect(consoleSpy.warn.some(w => w.includes('Node') && w.includes('not an object'))).toBe(false);

      // No NodeWithTypePolicies — the interface itself never gets its own overlay.
      expect(output).not.toContain('NodeWithTypePolicies');

      // Both implementing types pick up the transformation.
      expect(output).toContain('CommentWithTypePolicies');
      expect(output).toContain('ArticleWithTypePolicies');
      expect(output).toContain("'Comment.displayName'");
      expect(output).toContain("'Article.displayName'");
    } finally {
      console.warn = origWarn;
    }
  });

  it('should warn and skip emission when policy targets a union type', () => {
    const consoleSpy = { warn: [] as string[] };
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => consoleSpy.warn.push(args.join(' '));

    try {
      const output = pluginFromSource(`
        export const typePolicies = {
          SearchResult: {
            fields: {
              placeholder: {
                read(): string {
                  return '';
                },
              },
            },
          },
        };
      `);

      expect(consoleSpy.warn.some(w => w.includes('SearchResult') && w.includes('not an object or interface type'))).toBe(true);
      expect(output).not.toContain('SearchResultWithTypePolicies');
      expect(output).not.toContain("'SearchResult.placeholder'");
    } finally {
      console.warn = origWarn;
    }
  });

  it('should produce self-consistent output for interface policies', () => {
    const origWarn = console.warn;
    console.warn = () => {};

    try {
      const output = pluginFromSource(`
        export const typePolicies = {
          Node: {
            fields: {
              displayName: {
                read(existing: string): string {
                  return existing.toUpperCase();
                },
              },
            },
          },
        };
      `);

      const referenced = new Set(
        Array.from(output.matchAll(/(\w+)WithTypePolicies/g), m => m[1])
      );
      const declared = new Set(
        Array.from(output.matchAll(/export type (\w+)WithTypePolicies\b/g), m => m[1])
      );
      for (const name of referenced) {
        expect(declared.has(name)).toBe(true);
      }
    } finally {
      console.warn = origWarn;
    }
  });

  it('should handle shorthand method syntax', () => {
    const output = pluginFromSource(`
      export const typePolicies = {
        User: {
          fields: {
            createdAt(existing: string): Date {
              return new Date(existing);
            },
            name(existing: string): string {
              return existing.toUpperCase();
            },
          },
        },
      };
    `);

    expect(output).toContain('UserWithTypePolicies');
    expect(output).toContain('createdAt: Date');
    expect(output).toContain('name: string');
  });
});
