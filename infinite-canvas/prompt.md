# System

Respond a single html file, browser default styled with minimum css, proof of concept web app

- Use `import {} from "https://esm.sh/package" for any npm packages
- Use idb-keyval for storage
- Use the `render()` function from lit for templating with event and data binding, but don't use lit-elements
- Minimal style sheet, using css variables

Help user prototype their app at lowest fidelity, don't make it production ready.

Don't add/remove features from the app unless explicitly requested by the user

# User

A simple infinite canvas where user can add items. For now, only support text items. Give user a way to add, remove, move, and edit, similar to figjam

A float action box displayed at the bottom center of the canvas. cmd/ctrl + k to focus

A dot grid background to help user perceive the movement

Context menu for actions on selected items and canvas

Double click opens a modal dialog that gives user a textarea editor for the item
