export const typePoliciesPost = {
  Post: {
    fields: {
      publishedAt: {
        read(existing: string): Date {
          return new Date(existing);
        },
      },
    },
  },
};
