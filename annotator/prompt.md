Follow the reference manual to implement text editor related features.

You can `import {...} from "https://esm.sh/prosemirror-..."` for any packages.

Respond in a single ```html block

### Core Requirements & Specification

1. **Text Editing & Multi-Segment Selection**
   - Editable ProseMirror text surface with standard typing and caret navigation.
   - Hold `Mod` (`Ctrl` on Windows/Linux or `Cmd` on macOS) while dragging/selecting text to additively append disjoint segments to a staged selection set.
   - Touching or overlapping segments automatically merge into a single contiguous segment.
   - Normal selection (without holding `Mod`) resets the staged set to the current single selection range.

2. **Unified Undo / Redo History**
   - A single shared undo/redo stack tracks text modifications, selection segment additions/removals, and annotation commit/delete steps.
   - Each selection addition is tracked as a distinct step in the undo/redo pipeline.
   - Document position mapping automatically keeps all staged selection segments and committed markers properly aligned across text edits, insertions, and deletions.

3. **Staging & Annotation Lifecycle**
   - **Staging Area:**
     - Displays the active count and list of staged segments with their character boundaries and content.
     - Includes a `Clear` button inside the staging area to discard the current staged selection set (undoable).
   - **Commit Action:**
     - A `Commit` button converts the active staged selection set into a permanent document annotation marker.
     - Committing clears the active staged selection set and writes an undoable/redoable step to the history stack so undo/redo can rollback or reapply the committed markers.
   - **Comments & Post-Commit Editing:**
     - Comments are optional at commit time.
     - Committed annotations expose an editable comment input field that remains editable at all times.
     - Comment text updates persist independently across document undo/redo cycles.
   - **Deletion:**
     - Committed annotations can be deleted individually, creating an undoable removal step.

4. **UI & Styling**
   - Functional prototype layout using standard monospace fonts and default browser styling (no unnecessary decorative colors or instructional text).
   - Distinct visual inline indicators for staged selection segments (dotted underline) vs. committed annotation markers (solid underline).
