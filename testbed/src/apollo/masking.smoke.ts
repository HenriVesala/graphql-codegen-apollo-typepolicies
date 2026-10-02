// Type-level smoke test: confirms WithTypePolicies composes with Apollo 4's
// data masking. The MaskedGetUserResult below is a hand-rolled shape mimicking
// what graphql-codegen's client-preset emits for a masked query — only the
// directly-selected fields plus the $fragmentRefs marker. The two @ts-expect-
// error lines are the real assertions: the wrapper must not widen the masked
// selection back to the full schema type.
import type { WithTypePolicies } from '../generated/graphql';

type MaskedGetUserResult = {
  user: {
    __typename?: 'User';
    id: string;
    createdAt: string;
    ' $fragmentRefs'?: {
      UserFields?: unknown;
    };
  };
};

type Transformed = WithTypePolicies<MaskedGetUserResult>;

// createdAt was selected and has a policy → Date.
const _createdAtIsDate: Transformed['user']['createdAt'] = new Date();
void _createdAtIsDate;

// id was selected but has no policy → unchanged.
const _idIsString: Transformed['user']['id'] = 'abc';
void _idIsString;

// @ts-expect-error — email was masked away, must not appear on Transformed
const _emailMustNotExist: string = ({} as Transformed['user']).email;
void _emailMustNotExist;

// @ts-expect-error — name was masked away, must not appear on Transformed
const _nameMustNotExist: string = ({} as Transformed['user']).name;
void _nameMustNotExist;

// fragmentRefs marker survives the recursion untouched.
const _fragRefs: Transformed['user'][' $fragmentRefs'] = undefined;
void _fragRefs;
