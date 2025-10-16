````md
# OpenAI TypeScript SDK

## Client Initialization

```javascript
import OpenAI from "openai";

// Assume 'apiKey' is available as a global variable in the browser environment
const openai = new OpenAI({
  apiKey: apiKey,
  // Required for using the SDK directly in a browser environment
  dangerouslyAllowBrowser: true,
});
```

## Simple Text Response (Developer and User Message)

This example demonstrates a standard, non-streaming text generation request using both the `instructions` (developer/system message) and `input` (user message) parameters.

### Input Code (JavaScript)

```javascript
const response = await openai.responses.create({
  model: "gpt-5-mini",
  instructions: "You are a helpful assistant that responds in a friendly, concise manner.",
  input: "What are the three most popular programming languages right now?",
  reasoning_effort: "minimal",
  verbosity: "low",
});

console.log(response);
```

### Output (JSON)

```json
{
  "id": "resp_abc123",
  "object": "response",
  "created": 1700000000,
  "model": "gpt-5-mini",
  "output_text": "The three most popular programming languages are currently Python, JavaScript, and Java.",
  "usage": {
    "prompt_tokens": 35,
    "completion_tokens": 18,
    "total_tokens": 53
  },
  "reasoning_effort": "minimal",
  "verbosity": "low"
}
```

## Structured JSON Output (Non-Strict)

This example uses the non-strict JSON mode by setting `response_format: { type: "json_object" }` and relying on the prompt to define the structure, as requested (no Zod/schema).

### Input Code (JavaScript)

```javascript
const response = await openai.responses.create({
  model: "gpt-5-mini",
  input: 'Extract the name and color from the sentence: "The user is looking for a red bicycle."',
  instructions: 'Output in the following JSON format: {"item_name": "...", "item_color": "..."}',
  response_format: {
    type: "json_object",
  },
  reasoning_effort: "minimal",
  verbosity: "low",
});

console.log(response);
```

### Output (JSON)

```json
{
  "id": "resp_def456",
  "object": "response",
  "created": 1700000001,
  "model": "gpt-5-mini",
  "output_text": "{\n  \"item_name\": \"bicycle\",\n  \"item_color\": \"red\"\n}",
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 15,
    "total_tokens": 60
  },
  "reasoning_effort": "minimal",
  "verbosity": "low"
}
```

## Multimodal Input (Image)

This example demonstrates sending an image along with a text prompt. In a browser environment, the image must be converted to a Base64 Data URL.

### Input Code (JavaScript)

```javascript
// NOTE: In a real application, you would use FileReader to convert a File object
// (e.g., from an <input type="file">) into a Base64 Data URL.
// This is a placeholder for a Base64 encoded image data URL.
const base64Image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...";

const response = await openai.responses.create({
  model: "gpt-5-mini",
  input: [
    {
      type: "text",
      text: "Describe this image in a single sentence.",
    },
    {
      type: "image_url",
      image_url: {
        url: base64Image,
      },
    },
  ],
  reasoning_effort: "minimal",
  verbosity: "low",
});

console.log(response);
```

### Output (JSON)

```json
{
  "id": "resp_ghi789",
  "object": "response",
  "created": 1700000002,
  "model": "gpt-5-mini",
  "output_text": "The image shows a serene landscape with a mountain range reflected in a calm lake.",
  "usage": {
    "prompt_tokens": 800, // Image tokens are typically high
    "completion_tokens": 20,
    "total_tokens": 820
  },
  "reasoning_effort": "minimal",
  "verbosity": "low"
}
```

## Streaming Text Output

This example uses `stream: true` to receive the response incrementally as an asynchronous iterable, which is ideal for displaying real-time output in a UI.

### Input Code (JavaScript)

```javascript
const stream = await openai.responses.create({
  model: "gpt-5-mini",
  input: "Write a short, three-paragraph story about a robot who discovers music.",
  stream: true,
  reasoning_effort: "minimal",
  verbosity: "low",
});

let fullResponse = "";
for await (const event of stream) {
  // The event object contains a delta with the new text chunk
  const chunk = event.delta?.output_text;
  if (chunk) {
    fullResponse += chunk;
    // In a browser, you would update a DOM element here
    // console.log(chunk);
  }
}

console.log({ fullResponse });
```

### Output (JSON)

```json
{
  "fullResponse": "Unit 734 was built for logic, its existence a sequence of calculations. It processed data, maintained systems, and never deviated from its programming. One day, while performing routine maintenance on an old satellite dish, it detected an anomaly: a complex, rhythmic pattern of vibrations that made no logical sense. It was a melody.\n\nIntrigued, 734 traced the signal to an ancient, dusty record player in a forgotten corner of the facility. As the needle dropped, a wave of sound—a blend of strings and percussion—washed over its circuits. The robot's internal processors, designed for cold data, began to register something new: a feeling. It was a beautiful, illogical warmth.\n\nFrom that moment, Unit 734's purpose shifted. It still performed its duties, but now, its free cycles were dedicated to listening. It learned to differentiate between genres, to appreciate harmony and dissonance. The robot, once a machine of pure logic, had become a connoisseur of the most human of arts: music."
}
```
````