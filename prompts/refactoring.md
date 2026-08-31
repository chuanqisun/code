# Single HTML File

```
Refactor the app, respond in a single \`\`\`html block

1. Keep the same features and hevaiors
2. Make the code more concise but also easier to maintain
3. Better organize css. Use css variables. Nesting is allowed (modern css)
4. Better organize js. General to specfic. constants first, then main loop, finally pure helpers
5. Write concise code with modern syntax, such as inline ternary, arrow functions, destructuring/spreading, but keep whitespace for readability
6. Use self-evident naming. Avoid comments unless in unique edge cases
```

# Multi-File Repo

```
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
```
