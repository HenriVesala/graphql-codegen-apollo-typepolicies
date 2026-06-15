/**
 * Type-level smoke test for data-masking compatibility.
 *
 * Apollo Client 4's data-masking, when emitted by graphql-codegen's
 * client-preset, produces types with a special `$fragmentRefs` marker plus
 * the directly-selected fields. WithTypePolicies recurses through
 * `[K in keyof T]` — it doesn't care about Apollo's masking machinery, it
 * just walks whatever keys are present on T and rewrites the policy-targeted
 * ones.
 *
 * The composition we expect to hold:
 *
 *   useQuery emits   →   MaybeMasked<TData>
 *   TData is         →   WithTypePolicies<MaskedQueryShape>
 *   Result is        →   The masked shape with policy-targeted fields swapped
 *
 * This file constructs a hand-rolled masked-shape (mimicking what
 * graphql-codegen's client-preset would emit) and asserts the transformation
 * still fires correctly without leaking masked-away fields.
 */
import type { WithTypePolicies } from '../generated/graphql';

// Mimic what graphql-codegen's client-preset emits for a masked query:
// only the directly-selected fields, plus the $fragmentRefs marker. The full
// User type from the schema is NOT here — it's masked away.
type MaskedGetUserResult = {
  user: {
    __typename?: 'User';
    id: string;
    createdAt: string;
    // <- intentionally NO `email`, `name`, etc. The mask hides them.
    ' $fragmentRefs'?: {
      // hidden fragment data — Apollo runtime strips this; type-wise we
      // never read it.
      UserFields?: unknown;
    };
  };
};

type Transformed = WithTypePolicies<MaskedGetUserResult>;

// Positive: createdAt was selected AND has a policy → must be Date.
type CreatedAtType = Transformed['user']['createdAt'];
const _createdAtIsDate: CreatedAtType = new Date();
void _createdAtIsDate;

// Positive: id was selected but has no policy → stays string.
type IdType = Transformed['user']['id'];
const _idIsString: IdType = 'abc';
void _idIsString;

// Negative: email was masked away. Transformed['user'] must NOT contain it.
// If WithTypePolicies wrongly widened the type to the full UserWithTypePolicies
// (the flat-overlay bug we removed), this line would compile successfully —
// it must fail to compile here.
//
// @ts-expect-error — email is not in the masked selection, must not appear
const _emailMustNotExist: string = ({} as Transformed['user']).email;
void _emailMustNotExist;

// Negative: name was masked away. Same expectation.
//
// @ts-expect-error — name is not in the masked selection
const _nameMustNotExist: string = ({} as Transformed['user']).name;
void _nameMustNotExist;

// Sanity: the fragmentRefs marker passes through (WithTypePolicies recursion
// hits it via `T extends object` branch and recurses; nothing to transform
// inside).
type FragmentRefsType = Transformed['user'][' $fragmentRefs'];
const _fragRefs: FragmentRefsType = undefined;
void _fragRefs;
