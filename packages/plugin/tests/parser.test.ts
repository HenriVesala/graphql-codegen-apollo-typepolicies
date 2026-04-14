import { describe, it, expect } from 'vitest';
import { parseTypePolicies, parseTypePoliciesFromSource } from '../src/parser';
import path from 'path';

const opts = { typeInference: 'infer' as const, debug: false };

describe('TypePolicy Parser', () => {
  describe('simple type policies', () => {
    it('should extract simple read function return types', () => {
      const result = parseTypePoliciesFromSource(`
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
      `, 'typePolicies', opts);

      expect(result.errors).toHaveLength(0);
      expect(result.transformations.size).toBe(2);

      const createdAt = result.transformations.get('User.createdAt');
      expect(createdAt).toBeDefined();
      expect(createdAt?.typeName).toBe('User');
      expect(createdAt?.fieldName).toBe('createdAt');
      expect(createdAt?.transformedType).toBe('Date');
      expect(createdAt?.isNullable).toBe(false);

      const name = result.transformations.get('User.name');
      expect(name).toBeDefined();
      expect(name?.transformedType).toBe('string');
    });
  });

  describe('nullable types', () => {
    const nullableSource = `
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
    `;

    it('should handle nullable return types with null', () => {
      const result = parseTypePoliciesFromSource(nullableSource, 'typePolicies', opts);

      expect(result.errors).toHaveLength(0);

      const updatedAt = result.transformations.get('User.updatedAt');
      expect(updatedAt).toBeDefined();
      expect(updatedAt?.transformedType).toBe('Date | null');
      expect(updatedAt?.isNullable).toBe(true);
    });

    it('should handle nullable return types with undefined', () => {
      const result = parseTypePoliciesFromSource(nullableSource, 'typePolicies', opts);

      const deletedAt = result.transformations.get('User.deletedAt');
      expect(deletedAt).toBeDefined();
      expect(deletedAt?.transformedType).toBe('Date | undefined');
      expect(deletedAt?.isNullable).toBe(true);
    });
  });

  describe('arrow functions', () => {
    it('should extract types from arrow function syntax', () => {
      const result = parseTypePoliciesFromSource(`
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
      `, 'typePolicies', opts);

      expect(result.errors).toHaveLength(0);
      expect(result.transformations.size).toBe(2);

      const publishedAt = result.transformations.get('Post.publishedAt');
      expect(publishedAt).toBeDefined();
      expect(publishedAt?.transformedType).toBe('Date');

      const title = result.transformations.get('Post.title');
      expect(title).toBeDefined();
      expect(title?.transformedType).toBe('string');
    });
  });

  describe('type inference', () => {
    const inferredSource = `
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
    `;

    it('should infer return types when typeInference is "infer"', () => {
      const result = parseTypePoliciesFromSource(inferredSource, 'typePolicies', opts);

      expect(result.errors).toHaveLength(0);

      const createdAt = result.transformations.get('User.createdAt');
      expect(createdAt).toBeDefined();
      expect(createdAt?.transformedType).toBe('Date');

      const count = result.transformations.get('User.count');
      expect(count).toBeDefined();
      expect(count?.transformedType).toBe('number');
    });

    it('should error when typeInference is "require-annotations" and annotation is missing', () => {
      const result = parseTypePoliciesFromSource(
        inferredSource,
        'typePolicies',
        { typeInference: 'require-annotations', debug: false }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('require-annotations');
    });
  });

  describe('complex types', () => {
    it('should handle custom interface return types', () => {
      const result = parseTypePoliciesFromSource(`
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
      `, 'typePolicies', opts);

      expect(result.errors).toHaveLength(0);

      const lastLogin = result.transformations.get('User.lastLogin');
      expect(lastLogin).toBeDefined();
      expect(lastLogin?.transformedType).toBe('FormattedDate');

      const metadata = result.transformations.get('User.metadata');
      expect(metadata).toBeDefined();
      expect(metadata?.transformedType).toBe('ParsedMetadata');
    });
  });

  describe('array types', () => {
    const arraySource = `
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
    `;

    it('should handle array return types', () => {
      const result = parseTypePoliciesFromSource(arraySource, 'typePolicies', opts);

      expect(result.errors).toHaveLength(0);

      const tags = result.transformations.get('Post.tags');
      expect(tags).toBeDefined();
      expect(tags?.transformedType).toBe('Tag[]');
      expect(tags?.isArray).toBe(true);
    });

    it('should handle Set return types', () => {
      const result = parseTypePoliciesFromSource(arraySource, 'typePolicies', opts);

      const categories = result.transformations.get('Post.categories');
      expect(categories).toBeDefined();
      expect(categories?.transformedType).toBe('Set<string>');
    });
  });

  describe('shorthand method syntax', () => {
    it('should extract types from shorthand method syntax', () => {
      const result = parseTypePoliciesFromSource(`
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
      `, 'typePolicies', opts);

      expect(result.errors).toHaveLength(0);
      expect(result.transformations.size).toBe(2);

      const createdAt = result.transformations.get('User.createdAt');
      expect(createdAt).toBeDefined();
      expect(createdAt?.transformedType).toBe('Date');

      const name = result.transformations.get('User.name');
      expect(name).toBeDefined();
      expect(name?.transformedType).toBe('string');
    });
  });

  describe('location information', () => {
    it('should include location in transformations', () => {
      const result = parseTypePoliciesFromSource(`
        export const typePolicies = {
          User: {
            fields: {
              createdAt: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
            },
          },
        };
      `, 'typePolicies', opts);

      const createdAt = result.transformations.get('User.createdAt');
      expect(createdAt?.location).toBeDefined();
      expect(createdAt?.location?.line).toBeGreaterThan(0);
    });

    it('should include location in errors', () => {
      const result = parseTypePoliciesFromSource(`
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
      `, 'typePolicies', { typeInference: 'require-annotations', debug: false });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].location).toBeDefined();
      expect(result.errors[0].location?.line).toBeGreaterThan(0);
    });
  });

  describe('warnings', () => {
    it('should return empty warnings for valid policy', () => {
      const result = parseTypePoliciesFromSource(`
        export const typePolicies = {
          User: {
            fields: {
              createdAt: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
            },
          },
        };
      `, 'typePolicies', opts);

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('spread operators', () => {
    it('should resolve top-level spread operators across files', () => {
      const result = parseTypePoliciesFromSource(
        `
        import { typePoliciesUser } from './typePoliciesUser';
        export const typePolicies = {
          ...typePoliciesUser,
        };
        `,
        'typePolicies',
        opts,
        '/virtual/typePolicies.ts',
        new Map([
          ['/virtual/typePoliciesUser.ts', `
            export const typePoliciesUser = {
              User: {
                fields: {
                  createdAt: {
                    read(existing: string): Date {
                      return new Date(existing);
                    },
                  },
                },
              },
            };
          `],
        ])
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.transformations.size).toBe(1);

      const createdAt = result.transformations.get('User.createdAt');
      expect(createdAt).toBeDefined();
      expect(createdAt?.transformedType).toBe('Date');
      expect(createdAt?.location?.filePath).toContain('typePoliciesUser');
    });

    it('should resolve multiple top-level spread operators', () => {
      const result = parseTypePoliciesFromSource(
        `
        import { typePoliciesUser } from './typePoliciesUser';
        import { typePoliciesPost } from './typePoliciesPost';
        export const typePolicies = {
          ...typePoliciesUser,
          ...typePoliciesPost,
        };
        `,
        'typePolicies',
        opts,
        '/virtual/typePolicies.ts',
        new Map([
          ['/virtual/typePoliciesUser.ts', `
            export const typePoliciesUser = {
              User: {
                fields: {
                  createdAt: {
                    read(existing: string): Date {
                      return new Date(existing);
                    },
                  },
                },
              },
            };
          `],
          ['/virtual/typePoliciesPost.ts', `
            export const typePoliciesPost = {
              Post: {
                fields: {
                  publishedAt: {
                    read: (existing: string): Date => new Date(existing),
                  },
                },
              },
            };
          `],
        ])
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.transformations.size).toBe(2);
      expect(result.transformations.get('User.createdAt')?.transformedType).toBe('Date');
      expect(result.transformations.get('Post.publishedAt')?.transformedType).toBe('Date');
    });

    it('should resolve field-level spread operators', () => {
      const result = parseTypePoliciesFromSource(
        `
        import { dateFields } from './dateFields';
        export const typePolicies = {
          User: {
            fields: {
              ...dateFields,
              name: {
                read(existing: string): string {
                  return existing.toUpperCase();
                },
              },
            },
          },
        };
        `,
        'typePolicies',
        opts,
        '/virtual/typePolicies.ts',
        new Map([
          ['/virtual/dateFields.ts', `
            export const dateFields = {
              createdAt: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
              updatedAt: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
            };
          `],
        ])
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.transformations.size).toBe(3);
      expect(result.transformations.get('User.createdAt')?.transformedType).toBe('Date');
      expect(result.transformations.get('User.updatedAt')?.transformedType).toBe('Date');
      expect(result.transformations.get('User.name')?.transformedType).toBe('string');
    });

    it('should resolve nested spreads recursively', () => {
      const result = parseTypePoliciesFromSource(
        `
        import { typePoliciesA } from './typePoliciesA';
        export const typePolicies = {
          ...typePoliciesA,
        };
        `,
        'typePolicies',
        opts,
        '/virtual/typePolicies.ts',
        new Map([
          ['/virtual/typePoliciesA.ts', `
            import { typePoliciesB } from './typePoliciesB';
            export const typePoliciesA = {
              ...typePoliciesB,
              User: {
                fields: {
                  name: {
                    read(existing: string): string {
                      return existing.toUpperCase();
                    },
                  },
                },
              },
            };
          `],
          ['/virtual/typePoliciesB.ts', `
            export const typePoliciesB = {
              Post: {
                fields: {
                  title: {
                    read(existing: string): string {
                      return existing.trim();
                    },
                  },
                },
              },
            };
          `],
        ])
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.transformations.size).toBe(2);
      expect(result.transformations.get('User.name')?.transformedType).toBe('string');
      expect(result.transformations.get('Post.title')?.transformedType).toBe('string');
    });

    it('should warn on circular spread references without infinite loop', () => {
      const result = parseTypePoliciesFromSource(
        `
        import { policiesB } from './policiesB';
        export const policiesA = {
          ...policiesB,
        };
        `,
        'policiesA',
        opts,
        '/virtual/policiesA.ts',
        new Map([
          ['/virtual/policiesB.ts', `
            import { policiesA } from './policiesA';
            export const policiesB = {
              ...policiesA,
            };
          `],
        ])
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Circular'))).toBe(true);
    });

    it('should warn when spread expression cannot be resolved', () => {
      const result = parseTypePoliciesFromSource(
        `
        export const typePolicies = {
          ...({} as any),
        };
        `,
        'typePolicies',
        opts
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Cannot resolve spread expression');
    });

    it('should handle mix of inline properties and spread operators', () => {
      const result = parseTypePoliciesFromSource(
        `
        import { typePoliciesPost } from './typePoliciesPost';
        export const typePolicies = {
          User: {
            fields: {
              createdAt: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
            },
          },
          ...typePoliciesPost,
        };
        `,
        'typePolicies',
        opts,
        '/virtual/typePolicies.ts',
        new Map([
          ['/virtual/typePoliciesPost.ts', `
            export const typePoliciesPost = {
              Post: {
                fields: {
                  publishedAt: {
                    read: (existing: string): Date => new Date(existing),
                  },
                },
              },
            };
          `],
        ])
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.transformations.size).toBe(2);
      expect(result.transformations.get('User.createdAt')?.transformedType).toBe('Date');
      expect(result.transformations.get('Post.publishedAt')?.transformedType).toBe('Date');
    });

    it('should resolve the same spread used in multiple independent contexts', () => {
      const result = parseTypePoliciesFromSource(
        `
        import { sharedDateFields } from './sharedDateFields';
        export const typePolicies = {
          User: {
            fields: {
              ...sharedDateFields,
            },
          },
          Post: {
            fields: {
              ...sharedDateFields,
            },
          },
        };
        `,
        'typePolicies',
        opts,
        '/virtual/typePolicies.ts',
        new Map([
          ['/virtual/sharedDateFields.ts', `
            export const sharedDateFields = {
              createdAt: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
              updatedAt: {
                read(existing: string): Date {
                  return new Date(existing);
                },
              },
            };
          `],
        ])
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.transformations.size).toBe(4);
      expect(result.transformations.get('User.createdAt')?.transformedType).toBe('Date');
      expect(result.transformations.get('User.updatedAt')?.transformedType).toBe('Date');
      expect(result.transformations.get('Post.createdAt')?.transformedType).toBe('Date');
      expect(result.transformations.get('Post.updatedAt')?.transformedType).toBe('Date');
    });

    it('should let later properties override earlier spread properties', () => {
      const result = parseTypePoliciesFromSource(
        `
        import { basePolicies } from './basePolicies';
        export const typePolicies = {
          ...basePolicies,
          User: {
            fields: {
              createdAt: {
                read(existing: string): string {
                  return existing.toUpperCase();
                },
              },
            },
          },
        };
        `,
        'typePolicies',
        opts,
        '/virtual/typePolicies.ts',
        new Map([
          ['/virtual/basePolicies.ts', `
            export const basePolicies = {
              User: {
                fields: {
                  createdAt: {
                    read(existing: string): Date {
                      return new Date(existing);
                    },
                  },
                },
              },
            };
          `],
        ])
      );

      expect(result.errors).toHaveLength(0);
      // The inline User.createdAt (string) should override the spread one (Date)
      const createdAt = result.transformations.get('User.createdAt');
      expect(createdAt?.transformedType).toBe('string');
    });
  });

  describe('spread operators (file-based)', () => {
    it('should resolve spreads across real files on disk', () => {
      const result = parseTypePolicies(
        path.join(__dirname, 'fixtures', 'spread', 'typePolicies.ts'),
        'typePolicies',
        opts
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.transformations.size).toBe(3);
      expect(result.transformations.get('User.createdAt')?.transformedType).toBe('Date');
      expect(result.transformations.get('User.updatedAt')?.transformedType).toBe('Date');
      expect(result.transformations.get('Post.publishedAt')?.transformedType).toBe('Date');
    });
  });

  describe('error handling', () => {
    it('should throw when file does not exist', () => {
      expect(() =>
        parseTypePolicies(
          path.join(__dirname, 'fixtures', 'non-existent.ts'),
          'typePolicies',
          { typeInference: 'infer', debug: false }
        )
      ).toThrow('Could not read file');
    });

    it('should throw when export is not found', () => {
      expect(() =>
        parseTypePoliciesFromSource(`
          export const something = {};
        `, 'nonExistentExport', opts)
      ).toThrow('Could not find');
    });
  });
});
