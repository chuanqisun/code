Keep the behavior unchanged but refactor the code:

- consise
  - use modern js features, inline arrow functions, destructuring, spread, ternary operators...
  - but keep white space for readability.
  - avoid comments. Use descriptive names instead. Only use comment for hacks/workarounds
- code organization
  - prioritize clarity, then extensibility and modularity (low coupling, high cohesion)
  - avoid duplicated logic
  - typical file should follow general to specific order to aid human understanding
- typescript
  - rely on implicit type inference
  - use explicit typing only if type inference fails
