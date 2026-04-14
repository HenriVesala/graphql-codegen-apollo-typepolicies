export const typePoliciesUser = {
  User: {
    fields: {
      createdAt: {
        read(existing: string): Date {
          return new Date(existing);
        },
      },
      updatedAt: {
        read: (existing: string): Date => new Date(existing),
      },
    },
  },
};
