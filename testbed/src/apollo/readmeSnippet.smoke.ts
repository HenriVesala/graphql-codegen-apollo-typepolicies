/**
 * Type-level smoke test for the README's recommended TypedDocumentNode pattern.
 *
 * Not executed at runtime — exists so `tsc --noEmit` verifies the snippet in
 * the README actually typechecks. If this file fails to compile, the README
 * is out of date with reality.
 */
import { gql, type TypedDocumentNode } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { GetUserQuery, GetUserQueryVariables, WithTypePolicies } from '../generated/graphql';

const GET_USER: TypedDocumentNode<WithTypePolicies<GetUserQuery>, GetUserQueryVariables> = gql`
  query GetUser($id: ID!) {
    user(id: $id) { id email name createdAt }
  }
`;

// Type-level assertions on the result shape.
function _smoke(id: string) {
  const { data } = useQuery(GET_USER, { variables: { id } });

  // Without the WithTypePolicies wrapping in the document type, the next line
  // would error: data?.user could be a union including UserNotFound which
  // doesn't have a typed createdAt. The narrowing via __typename is real
  // application code; the smoke test only needs to confirm the union resolves
  // and that wherever User appears, createdAt is Date (not string).
  if (data?.user?.__typename === 'User') {
    // Should be Date thanks to WithTypePolicies fanning the policy through
    // GetUserQuery's nested User shape.
    const created: Date = data.user.createdAt;
    void created;
  }
}

void _smoke;
