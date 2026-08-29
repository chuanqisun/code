Turn the outlines into the front view of a wooden organizing shelf. Transform each line into a wooden divider

Front-facing studio photo of a square light oak wooden bookcase with an asymmetrical, geometric grid layout. The unit features open-backed sections and wood-backed cubbies of varying rectangular sizes, completely empty with no items. Natural light oak grain texture, soft shadows, warm minimalist interior design aesthetic, straight-on centered shot, clean lines, high resolution.

# Zero divider

A direct front-facing product photograph of a modern minimalist wooden wall shelf. The design features a single, completely hollow open-box frame with no internal dividers, vertical partitions, or shelves. The interior is backed by a smooth, single continuous wood panel of matching light-toned natural oak/birch plywood with a visible, subtle wood grain. The open hollow compartment has realistic 3D depth, with soft natural sunlight coming from the upper right, casting gentle directional shadows across the interior backing panel. Clean Scandinavian aesthetic, straight-on orthographic view, ultra-realistic, neutral studio lighting against a soft off-white wall.

# Generic

A direct front-facing product photograph of a modern minimalist wooden wall shelf and organizer. Transform each line into light-toned natural oak/birch plywood dividers and shelves with visible subtle wood grain. The compartments have realistic 3D depth, with soft natural sunlight coming from the upper right, casting gentle directional shadows inside the cubbies. Clean Scandinavian aesthetic, straight-on orthographic view, ultra-realistic, neutral studio lighting against a soft off-white wall.

# Parametric

```js
/**
 * Generates an image prompt for a wooden wall shelf.
 * @param {number} M - Number of horizontal dividers.
 * @param {number} N - Number of vertical dividers.
 * @returns {string} The prompt string.
 */
function generateShelfPrompt(M, N) {
  // If the total divider count exceeds 3, return the generic prompt
  if (M + N > 3) {
    return `A direct front-facing product photograph of a modern minimalist wooden wall shelf and organizer. Transform each line into light-toned natural oak/birch plywood dividers and shelves with visible subtle wood grain. The compartments have realistic 3D depth, with soft natural sunlight coming from the upper right, casting gentle directional shadows inside the cubbies. Clean Scandinavian aesthetic, straight-on orthographic view, ultra-realistic, neutral studio lighting against a soft off-white wall.`;
  }

  const numberWords = ["zero", "one", "two", "three"];

  const formatDividerText = (count, type) => {
    if (count === 0) return `no ${type} dividers`;
    if (count === 1) return `a single ${type} divider`;
    return `${numberWords[count]} ${type} dividers`;
  };

  // Build the layout description for M + N <= 3
  let structureDesc = "";
  if (M === 0 && N === 0) {
    structureDesc = "The interior is a completely hollow open-box space with no dividers or partitions";
  } else {
    const hText = formatDividerText(M, "horizontal");
    const vText = formatDividerText(N, "vertical");
    structureDesc = `The layout features ${hText} and ${vText}`;
  }

  const shadowTarget = M === 0 && N === 0 ? "across the interior backing panel" : "inside the cubbies";

  return `A direct front-facing product photograph of a modern minimalist wooden wall shelf and organizer. ${structureDesc}, constructed from light-toned natural oak/birch plywood with visible subtle wood grain. The entire unit is backed by a smooth, single continuous wood backing panel. The shelf has realistic 3D depth, with soft natural sunlight coming from the upper right, casting gentle directional shadows ${shadowTarget}. Clean Scandinavian aesthetic, straight-on orthographic view, ultra-realistic, neutral studio lighting against a soft off-white wall.`;
}
```

# With plants

```js
/**
 * Generates an image prompt for a wooden wall shelf.
 * @param {number} M - Number of horizontal dividers.
 * @param {number} N - Number of vertical dividers.
 * @param {number} [potCount=0] - Number of pots.
 * @param {number} [plantCount=0] - Number of plants inside the pots.
 * @returns {string} The prompt string.
 */
function generateShelfPrompt(M, N, potCount = 0, plantCount = 0) {
  // Helper to format the plant/pot contents description
  const formatPlantText = (pots, plants) => {
    if (pots <= 0) return "";

    let text = "";
    if (plants === 0) {
      text = `${pots} empty white ceramic plant pots`;
    } else if (pots > plants && plants > 0) {
      text = `${pots} white ceramic plant pots, ${plants} with green pothos, ${pots - plants} empty`;
    } else if (pots === plants && plants > 0) {
      text = `${pots} white ceramic plant pots with green pothos`;
    } else {
      // Fallback if plantCount exceeds potCount
      text = `${pots} white ceramic plant pots with lush green pothos`;
    }

    return ` Placed neatly within the unit are ${text}.`;
  };

  const plantDesc = formatPlantText(potCount, plantCount);

  // If the total divider count exceeds 3, return the generic prompt with plant description
  if (M + N > 3) {
    return `A direct front-facing product photograph of a modern minimalist wooden wall shelf and organizer. Transform each line into light-toned natural oak/birch plywood dividers and shelves with visible subtle wood grain. The compartments have realistic 3D depth, with soft natural sunlight coming from the upper right, casting gentle directional shadows inside the cubbies.${plantDesc} Clean Scandinavian aesthetic, straight-on orthographic view, ultra-realistic, neutral studio lighting against a soft off-white wall.`;
  }

  const numberWords = ["zero", "one", "two", "three"];

  const formatDividerText = (count, type) => {
    if (count === 0) return `no ${type} dividers`;
    if (count === 1) return `a single ${type} divider`;
    return `${numberWords[count]} ${type} dividers`;
  };

  // Build the layout description for M + N <= 3
  let structureDesc = "";
  if (M === 0 && N === 0) {
    structureDesc = "The interior is a completely hollow open-box space with no dividers or partitions";
  } else {
    const hText = formatDividerText(M, "horizontal");
    const vText = formatDividerText(N, "vertical");
    structureDesc = `The layout features ${hText} and ${vText}`;
  }

  const shadowTarget = M === 0 && N === 0 ? "across the interior backing panel" : "inside the cubbies";

  return `A direct front-facing product photograph of a modern minimalist wooden wall shelf and organizer. ${structureDesc}, constructed from light-toned natural oak/birch plywood with visible subtle wood grain. The entire unit is backed by a smooth, single continuous wood backing panel. The shelf has realistic 3D depth, with soft natural sunlight coming from the upper right, casting gentle directional shadows ${shadowTarget}.${plantDesc} Clean Scandinavian aesthetic, straight-on orthographic view, ultra-realistic, neutral studio lighting against a soft off-white wall.`;
}
```
