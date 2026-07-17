# Task 2 Architecture Plan — Dynamic Form Engine (React Native / Expo)

## Layer diagram

`JSON Schema → Schema Types → Visibility → Validation → Form FSM → UI Renderer`

- **Schema:** Typed field and form definitions.
- **Validation:** Pure composable rule runner; first failure wins.
- **Visibility:** Pure evaluation of `visibleWhen`.
- **State:** Reducer-driven finite state machine and field values/errors.
- **Registry:** Single runtime map from type string → component. Built-ins registered at boot; customs via `registerFieldType`.
- **UI:** One Expo screen rendering fields via a single registry lookup.

## TypeScript schema types

- `FormSchema`: form ID/title plus `fields`.
- Shared field properties: `name`, `label`, `initialValue`, `validation`, `visibleWhen`.
- No `editable` / `disabled` field APIs unless the brief later requires them.
- Discriminated built-in schemas:
  - `TextFieldSchema` with `type: "text"`
  - `SelectFieldSchema` with `type: "select"` and options
  - `DateFieldSchema` with `type: "date"` — value is an ISO `YYYY-MM-DD` string; validated by regex; no native date picker
  - `MultiSelectFieldSchema` with `type: "multiSelect"` and options
- `CustomFieldSchema` uses a runtime `type: string` plus optional component-specific `config`.
- Values: `string` for text/select/date; `string[]` for multi-select; custom fields document their own value shape in config/tests.
- Validation rules: discriminated union — `required`, `minLength`, `maxLength`, `regex`, named `custom`.

### Custom type discriminant issue

A true `FieldSchema` union cannot safely include both `type: "text" | "select" | ...` and a catch-all `type: string`, because `string` collapses the discriminant and TypeScript loses narrowing for built-ins.

**Approach:**

1. Define `BuiltinFieldType = "text" | "select" | "date" | "multiSelect"`.
2. Define `BuiltinFieldSchema` as a proper discriminated union on those literals.
3. Define `CustomFieldSchema = { type: string; ... }` separately (optionally branded / documented as “not a BuiltinFieldType”).
4. Export `FieldSchema = BuiltinFieldSchema | CustomFieldSchema`.
5. At runtime / in narrowing helpers: if `field.type` is in the built-in set, treat as built-in; otherwise treat as custom and look up the registry.
6. Prefer writing schemas with `as const` / satisfies so built-in literals stay narrow in demo/fixtures; custom fields use an explicit custom type string (e.g. `"rating"`).

## Rule runner API

- `validateField(value, rules, context) → string | undefined`
- Runs rules in declaration order; first failure wins.
- `context` exposes current field, all form values, and named custom validators.
- `validateForm(schema, values, validators) → errors`
- Evaluates visibility first; validates only visible fields.
- Regex patterns are JSON-serializable (`pattern` string + optional `flags`).
- Custom functions are registered by name, not embedded in JSON.
- Date fields use a regex rule for `YYYY-MM-DD` (no native picker in scope).

## Visibility function

- `isFieldVisible(field, values) → boolean`
- Fields without `visibleWhen` are visible.
- `visibleWhen: { field, equals }` uses strict equality against the referenced value.
- Hidden fields remain in internal state so toggling visibility can restore input.
- Hidden fields are excluded from validation errors and submit payloads.

## Form status FSM

Status union:

`pristine | dirty | validating | submitting | success | error`

Transitions:

| From | Event | To |
| --- | --- | --- |
| `pristine` | field change | `dirty` |
| `dirty` | submit | `validating` |
| `error` | submit | `validating` |
| `validating` | valid form | `submitting` |
| `validating` | invalid form | `error` |
| `submitting` | resolved | `success` |
| `submitting` | rejected | `error` |
| `success` | field change | `dirty` |
| `error` | field change | `dirty` |
| any except `submitting` | reset | `pristine` |

- Submit is allowed from **`dirty` or `error`** (not only `dirty`).
- Invalid submissions retain field errors and entered values.
- Submit while `pristine` / `validating` / `submitting` / `success` is a no-op (or ignored by the reducer).

## Runtime field registry

- One shared registry: type string → field component.
- **Boot:** register built-ins (`text`, `select`, `date`, `multiSelect`) onto the same registry.
- **`FormRenderer`:** single `getFieldType(field.type)` lookup for every field (no special-case switch for built-ins vs custom in the render path).
- `registerFieldType(type, component)` — intended for custom types; **may replace** an existing entry (including a built-in if the caller insists).
- Soft policy on built-in names: **warn** (dev console / returned warning) when replacing a known built-in; do **not** hard-reject.
- `unregisterFieldType(type)` for cleanup/tests.
- Custom components receive: field schema, value, error, `onChange` (no editable/disabled props unless required later).
- Unknown types render a controlled configuration error instead of crashing.

## Concrete demo schema

Single Expo demo screen uses a schema shaped like:

1. **`role`** — `select` with options e.g. `player` | `coach` | `fan`.
2. **`licenseId`** — `text`, `visibleWhen: { field: "role", equals: "coach" }`, with required (and optional length/regex) when visible.
3. **`rating`** — custom type `"rating"` registered at runtime via `registerFieldType("rating", RatingField)`; simple numeric/star control writing a number or string value as defined by the component.
4. Supporting fields as needed for coverage: e.g. a `date` (ISO text + regex), a `multiSelect`, and another `text` — enough to exercise all built-ins without expanding scope.

Demo boot sequence: register built-ins → `registerFieldType("rating", ...)` → render `FormRenderer` with the schema above.

## Package layout

- `src/form/schema.ts` — schema and value types
- `src/form/validation.ts` — rule runner and validator registry
- `src/form/visibility.ts` — visibility evaluation
- `src/form/state.ts` — reducer, FSM events, payload construction
- `src/form/registry.ts` — field type registry (+ boot registration of built-ins)
- `src/form/FormRenderer.tsx` — schema-driven renderer (registry lookup only)
- `src/form/fields/` — built-in + demo custom field components
- `src/screens/DynamicFormDemoScreen.tsx` — single Expo demo
- `src/form/__tests__/` — pure Jest tests

## Pure Jest test plan

- Built-in schema/value shapes and date ISO regex validation.
- Rules compose in order; first failure wins.
- Required, length, regex, and named custom validators pass/fail correctly.
- Missing custom validator names produce deterministic errors.
- Visibility: absent deps, match, mismatch; `licenseId` hidden unless `role === "coach"`.
- Hidden fields neither validated nor included in payloads.
- FSM: submit from `dirty` and from `error`; other transitions in the table; reset; success/error recovery.
- Payload construction omits hidden fields.
- Registry: boot built-ins, register/replace custom, soft-warn on built-in replace, lookup, unregister, unknown type.
- UI: small renderer smoke only; business logic remains React-free.

## Rejected alternatives

- **Formik/Yup:** Obscures the required custom rule runner and explicit FSM; adds dependencies outside scope.
- **Component-owned form state:** Couples behavior to React Native; validation/visibility/FSM become hard to unit-test.
- **Executable functions inside schema JSON:** Not JSON-serializable; named validator + field registries keep schemas portable.
- **Hard-reject reserved registry names:** Too rigid; soft-warn + allow replace keeps one lookup path and supports demos/tests that override a built-in.
- **Native date picker:** Out of scope; ISO `YYYY-MM-DD` text + regex is sufficient.

## Scope / process reminders

- One Expo demo screen; date as ISO text + regex only.
- Split pure logic from UI; unit-test schema, validation, visibility, FSM without React Native.
- Process: plan → approval → implement in slices → commit after plan and after each feat; do not squash history.
- No app code until this revised plan is approved.
