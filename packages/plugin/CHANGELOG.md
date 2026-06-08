# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-08

Initial release.

### Added
- Static analysis of Apollo type policies — extracts `read` function return types via ts-morph and generates TypeScript overlays that reflect what components actually receive from the Apollo cache.
- `<Type>WithTypePolicies` per-type overlays for every GraphQL object type with a `read` policy.
- `WithTypePolicies<T>` recursive utility — wraps a type or query result and applies the matching overlays throughout, preserving the original selection and recursing into nested objects and arrays.
- `TypePolicyTransformations` flat map (`'TypeName.fieldName' → transformedType`) for direct field-level type access.
- Interface support — a `read` on a GraphQL interface fans out to every concrete object type that implements it, mirroring Apollo Client's runtime behavior. Concrete-type policies override interface fan-outs on the same field.
- Two type-inference modes: `infer` (uses explicit return types when present, falls back to TypeScript inference) and `require-annotations` (errors when annotations are missing).
- Configurable nullability handling (`preserveNullability`) — keeps schema-level nullability on transformed types.
- Plugin configuration: `typePoliciesPath`, `typePoliciesExport`, `typeInference`, `preserveNullability`, `tsconfigPath`, `debug`.
