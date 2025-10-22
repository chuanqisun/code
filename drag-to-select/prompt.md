# Drag-to-Select Implementation Summary

This document outlines the core logic for implementing a drag-to-select feature, allowing users to select multiple elements within a scrollable container by drawing a selection rectangle.

## Core Concept: Intersection and Coordinate Systems

The implementation relies on tracking the drag rectangle's coordinates relative to the scrollable container's content area.

1.  **Drag Vector (`dragVector`):** Tracks the mouse movement relative to the container's viewport (client coordinates).
2.  **Scroll Vector (`scrollVector`):** Tracks how much the container has scrolled since the drag started.
3.  **Selection Rectangle:** The final selection area is the `dragVector` adjusted by the `scrollVector`, placing it correctly within the container's total scrollable content area.
4.  **Intersection:** Each selectable item's position (relative to the container's content) is checked for intersection with the Selection Rectangle.

## Key Data Structure: `DOMVector`

A custom class is used to manage the starting point (`x`, `y`) and the magnitude (`magnitudeX`, `magnitudeY`) of the drag operation.

```javascript
class DOMVector {
    constructor(x, y, magnitudeX, magnitudeY) {
        this.x = x;
        this.y = y;
        this.magnitudeX = magnitudeX;
        this.magnitudeY = magnitudeY;
    }

    // Converts the vector into a normalized DOMRect (handling negative magnitudes)
    toDOMRect() {
        return new DOMRect(
            Math.min(this.x, this.x + this.magnitudeX),
            Math.min(this.y, this.y + this.magnitudeY),
            Math.abs(this.magnitudeX),
            Math.abs(this.magnitudeY)
        );
    }

    // Adds two vectors (used to combine drag and scroll)
    add(vector) {
        return new DOMVector(
            this.x + vector.x,
            this.y + vector.y,
            this.magnitudeX + vector.magnitudeX,
            this.magnitudeY + vector.magnitudeY
        );
    }
}
```

## Event Handling Flow

### 1. `pointerdown` (Start Drag)

Capture the initial position and scroll state.

```javascript
function handlePointerDown(e) {
    const containerRect = e.currentTarget.getBoundingClientRect();

    // 1. Initial position relative to container viewport
    dragVector = new DOMVector(
        e.clientX - containerRect.x,
        e.clientY - containerRect.y,
        0, 0
    );

    // 2. Initial scroll position
    scrollVector = new DOMVector(
        e.currentTarget.scrollLeft,
        e.currentTarget.scrollTop,
        0, 0
    );

    e.currentTarget.setPointerCapture(e.pointerId);
}
```

### 2. `pointermove` (Update Drag)

Update the magnitude of the `dragVector` and check for intersections.

```javascript
function handlePointerMove(e) {
    if (!dragVector || !scrollVector) return;

    const containerRect = e.currentTarget.getBoundingClientRect();

    // Calculate new magnitude based on current pointer position
    dragVector = new DOMVector(
        dragVector.x,
        dragVector.y,
        e.clientX - containerRect.x - dragVector.x,
        e.clientY - containerRect.y - dragVector.y
    );

    // Combine drag and scroll vectors to get the final selection area
    const selectionArea = dragVector.add(scrollVector).toDOMRect();

    // Check intersection for all items
    updateSelectedItems(selectionArea);
    updateSelectionRect(selectionArea);
    
    // Start auto-scrolling if the pointer is near the edge
    if (!isDragging) {
        isDragging = true;
        startAutoScroll();
    }
}
```

### 3. `scroll` (Adjust for Scrolling)

When the container scrolls (either manually or via auto-scroll), update the `scrollVector` to maintain the correct selection area relative to the content.

```javascript
function handleScroll(e) {
    if (!dragVector || !scrollVector) return;

    const { scrollLeft, scrollTop } = e.currentTarget;

    // Update the scroll vector's magnitude to reflect the change in scroll position
    scrollVector = new DOMVector(
        scrollVector.x,
        scrollVector.y,
        scrollLeft - scrollVector.x,
        scrollTop - scrollVector.y
    );

    // Re-evaluate selection based on the new scroll position
    updateSelectedItems(dragVector, scrollVector);
}
```

## Intersection Logic

The `updateSelectedItems` function iterates through all selectable elements and uses a standard rectangle intersection check.

```javascript
function updateSelectedItems(dragVec, scrollVec) {
    const selectionRect = dragVec.add(scrollVec).toDOMRect();

    containerEl.querySelectorAll('[data-item]').forEach(el => {
        const itemRect = el.getBoundingClientRect();
        
        // Translate item's viewport coordinates to content coordinates
        const translatedItemRect = new DOMRect(
            itemRect.x - containerEl.getBoundingClientRect().x + containerEl.scrollLeft,
            itemRect.y - containerEl.getBoundingClientRect().y + containerEl.scrollTop,
            itemRect.width,
            itemRect.height
        );

        // Check if the two rectangles overlap
        if (intersect(selectionRect, translatedItemRect)) {
            // Item is selected
        }
    });
}

function intersect(rect1, rect2) {
    if (rect1.right < rect2.left || rect2.right < rect1.left) return false;
    if (rect1.bottom < rect2.top || rect2.bottom < rect1.top) return false;
    return true;
}
```