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

function _smoke(id: string) {
  const { data } = useQuery(GET_USER, { variables: { id } });

  // data.user is a GraphQL union; narrow by __typename before accessing fields.
  if (data?.user?.__typename === 'User') {
    const created: Date = data.user.createdAt;
    void created;
  }
}

void _smoke;
