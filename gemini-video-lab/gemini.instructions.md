---
applyTo: "connections/**/*.ts"
---

# Google AI (Gemini)

## Text Gen

```ts
import { GoogleGenAI } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const config = {
    thinkingConfig: {
      thinkingBudget: 0,
    },
  };
  const model = "gemini-2.5-flash-lite";
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `INSERT_INPUT_HERE`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });
  let fileIndex = 0;
  for await (const chunk of response) {
    console.log(chunk.text);
  }
}

main();
```

## Image Gen

```ts
import { GoogleGenAI } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({
    apiKey: "YOUR_GEMINI_API_KEY", // In browser, get from user input or secure storage
  });
  const config = {
    responseModalities: ["IMAGE", "TEXT"],
  };
  const model = "gemini-2.5-flash-image-preview";
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `INSERT_INPUT_HERE`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });

  let imageUrls: string[] = [];
  let textContent = "";

  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue;
    }

    const parts = chunk.candidates[0].content.parts;
    for (const part of parts) {
      if (part.inlineData) {
        // Create a portable data URL for the image
        const { mimeType, data } = part.inlineData;
        const imageUrl = `data:${mimeType};base64,${data}`;
        imageUrls.push(imageUrl);
        console.log("Generated image URL:", imageUrl);
      } else if (part.text) {
        textContent += part.text;
        console.log("Text response:", part.text);
      }
    }
  }

  // Return or use the image URLs and text
  return { imageUrls, textContent };
}

main();
```

## Image Edit

```ts
import { GoogleGenAI } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({
    apiKey: "YOUR_GEMINI_API_KEY", // In browser, get from user input or secure storage
  });
  const config = {
    responseModalities: ["IMAGE"],
  };
  const model = "gemini-2.5-flash-image-preview";
  const contents = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            data: `...data url to image`, // Replace with actual base64 data without data: prefix
            mimeType: `image/jpeg`,
          },
        },
        {
          inlineData: {
            data: `...data url to image`, // Replace with actual base64 data without data: prefix
            mimeType: `image/jpeg`,
          },
        },
        {
          text: `Blend the two images into one`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });

  let imageUrls: string[] = [];
  let textContent = "";

  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue;
    }

    const parts = chunk.candidates[0].content.parts;
    for (const part of parts) {
      if (part.inlineData) {
        // Create a portable data URL for the image
        const { mimeType, data } = part.inlineData;
        const imageUrl = `data:${mimeType};base64,${data}`;
        imageUrls.push(imageUrl);
        console.log("Generated image URL:", imageUrl);
      } else if (part.text) {
        textContent += part.text;
        console.log("Text response:", part.text);
      }
    }
  }

  // Return or use the image URLs and text
  return { imageUrls, textContent };
}

main();
```

## Text to Image

```ts
import { GoogleGenAI } from "@google/genai";

function saveBinaryFile(fileName: string, content: Buffer) {
  writeFile(fileName, content, "utf8", (err) => {
    if (err) {
      console.error(`Error writing file ${fileName}:`, err);
      return;
    }
    console.log(`File ${fileName} saved to file system.`);
  });
}

async function main() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const config = {
    responseModalities: ["IMAGE"],
  };
  const model = "gemini-2.5-flash-image-preview";
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `INSERT_INPUT_HERE`,
        },
      ],
    },
  ];
}

main();
```

## Image to text

```ts
// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import { GoogleGenAI } from "@google/genai";
import mime from "mime";
import { writeFile } from "fs";

function saveBinaryFile(fileName: string, content: Buffer) {
  writeFile(fileName, content, "utf8", (err) => {
    if (err) {
      console.error(`Error writing file ${fileName}:`, err);
      return;
    }
    console.log(`File ${fileName} saved to file system.`);
  });
}

async function main() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const config = {
    responseModalities: ["IMAGE", "TEXT"],
  };
  const model = "gemini-2.5-flash-image-preview";
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `INSERT_INPUT_HERE`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });
  let fileIndex = 0;
  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue;
    }
    if (chunk.text) {
      console.log("text chunk:", chunk.text);
    }
  }
}

main();
```
