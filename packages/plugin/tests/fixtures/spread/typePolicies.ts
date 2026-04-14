import { typePoliciesUser } from './typePoliciesUser';
import { typePoliciesPost } from './typePoliciesPost';

export const typePolicies = {
  ...typePoliciesUser,
  ...typePoliciesPost,
};
