import { typePoliciesPost } from './typePoliciesPost';
import { typePoliciesUser } from './typePoliciesUser';

export const typePolicies = {
  ...typePoliciesUser,
  ...typePoliciesPost,
};
