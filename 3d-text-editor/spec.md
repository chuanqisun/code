# Multi-Layered Monospace Text Editor — Specification

## Overview

- A multi-layered monospace text editor.
- Isometric camera view, implemented with 3D CSS transform.

## Layers

- Start with 1 layer.
- User can add up to K layers; K = 4 by default.
- Each layer is an N \* N grid for text input; N = 8 by default.
- The grid is vertically oriented in relation to the ground, so the text can be read from left to right.

## Text Input & IME

- Support CJK input via the OS native IME.
- Use a native contenteditable element for content, and draw the grid separately as a background layer.
- Carefully constrain input to N rows and N columns.
- Design line height and letter width so each cell forms a perfect square.
- Keep arrow-key behavior correct.
- Typing behavior should be "type over", not "insert".

## Grid & Character Alignment

- Draw the grid separately from the contenteditable input.
- Perfectly center each character within its grid cell.
- The layer border must be perfectly outside the grid lines, with no overlap on any side (top, left, right, bottom).
- The layer border must be a single black line (not a double line of thick-outside/thin-inside).

## Editing & Interaction

- User can select one layer at a time, and edit its text content by typing on it.
- Select the active grid by using the tab key to cycle through the layers.
- Remove the prev/next buttons.

## Caret Style

- When a cell is in focus, the entire cell area should blink, alternating between a white/black square.
- The text color should maintain contrast by automatically using the opposite color.
- Consider using the CSS built-in `contrast-color()` feature.
- The caret must be strictly inside the grid, with no overlap onto the grid lines.
- After typing the last character in each row, the cursor must not be rendered off the grid; the cursor should never appear outside the layer grid area.
- The blink and animation should be reset whenever the cursor moves, to ensure best visibility immediately after a cursor move.
- Immediately after each cursor move, the text and cell background must be white on black.
- Pay attention to visual details; the caret should be pixel perfect.

## Data Model

- The data model contains the final data, as a K _ N _ N array of characters.

## Export

- An export button that console.log the data model content.

## Aesthetics & Styling

- Minimalist aesthetic via minimalist CSS.
- Monospace aesthetics.
- Centered in the center of the editor.
- Keep it compact, centered, and relatively small; don't waste white space.
- Black on white.
- No decorative styles.

## Code Organization

- Refactor the app. Keep everything unchanged but better organize the code to be clean and efficient.
- Roughly in this order:
  1. CSS, with CSS variables for consistent color/size.
  2. Global constants, params.
  3. DOM queries.
  4. High-level loops, event listener setups, etc.
  5. Low-level pure functions, helpers, utils.
- Avoid excessive comments. Comment only when the logic/intent isn't obvious.
