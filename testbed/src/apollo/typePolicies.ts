import type { TypePolicies } from '@apollo/client';

/**
 * Custom type for formatted dates
 */
interface FormattedDate {
  date: Date;
  formatted: string;
  relative: string;
}

/**
 * Custom type for parsed metadata
 */
interface ParsedMetadata {
  version: number;
  preferences: Record<string, unknown>;
}

/**
 * Apollo Client type policies with read function transformations
 */
export const typePolicies: TypePolicies = {
  User: {
    fields: {
      // Simple transformation: string -> Date (with explicit annotation)
      createdAt: {
        read(existing: string): Date {
          return new Date(existing);
        },
      },

      // Nullable transformation: string | undefined -> Date | undefined
      updatedAt: {
        read(existing: string | undefined): Date | undefined {
          return existing ? new Date(existing) : undefined;
        },
      },

      // Arrow function syntax with complex return type
      lastLoginAt: {
        read: (existing: string | null): FormattedDate | null => {
          if (!existing) return null;
          const date = new Date(existing);
          return {
            date,
            formatted: date.toLocaleDateString(),
            relative: getRelativeTime(date),
          };
        },
      },

      // JSON parsing transformation
      metadata: {
        read(existing: string | null): ParsedMetadata | null {
          if (!existing) return null;
          try {
            return JSON.parse(existing) as ParsedMetadata;
          } catch {
            return null;
          }
        },
      },

      // Array transformation (keeping same type but transforming values)
      tags: {
        read(existing: string[]): string[] {
          return existing.map((tag) => tag.toLowerCase());
        },
      },
    },
  },

  Post: {
    fields: {
      createdAt: {
        read(existing: string): Date {
          return new Date(existing);
        },
      },

      // Transformation with inferred type (no explicit annotation)
      // This tests the "infer" mode
      publishedAt: {
        read(existing: string | null) {
          if (!existing) return null;
          return new Date(existing);
        },
      },

      // Transform view count to formatted string
      viewCount: {
        read(existing: number): string {
          return formatNumber(existing);
        },
      },
    },
  },

  Comment: {
    fields: {
      createdAt: {
        read: (existing: string): Date => new Date(existing),
      },
    },
  },

  // Media types - all implement Media interface with shared field transformations
  Image: {
    fields: {
      createdAt: {
        read(existing: string): Date {
          return new Date(existing);
        },
      },
      // Transform bytes to human-readable format
      size: {
        read(existing: number): string {
          return formatBytes(existing);
        },
      },
    },
  },

  Video: {
    fields: {
      createdAt: {
        read(existing: string): Date {
          return new Date(existing);
        },
      },
      size: {
        read(existing: number): string {
          return formatBytes(existing);
        },
      },
      // Transform duration seconds to formatted time
      duration: {
        read(existing: number): string {
          return formatDuration(existing);
        },
      },
    },
  },

  Document: {
    fields: {
      createdAt: {
        read(existing: string): Date {
          return new Date(existing);
        },
      },
      size: {
        read(existing: number): string {
          return formatBytes(existing);
        },
      },
    },
  },
};

// Helper functions
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
