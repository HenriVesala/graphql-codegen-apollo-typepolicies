import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: './src/graphql/**/*.graphql',
  generates: {
    './src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        {
          'graphql-codegen-apollo-typepolicies': {
            typePoliciesPath: './src/apollo/typePolicies.ts',
            typePoliciesExport: 'typePolicies',
            typeInference: 'infer',
            preserveNullability: true,
            debug: true,
          },
        },
      ],
    },
  },
};

export default config;
