# OpenAI Realtime Agent API - TypeScript Examples

## Basic Setup

```typescript
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import { tool } from "@openai/agents";
import { z } from "zod";
```

## Creating an Agent

```typescript
const agent = new RealtimeAgent({
  name: "AgentName",
  instructions: "Your agent instructions here",
  voice: "alloy", // or "echo", "fable", "onyx", "nova", "shimmer"
  tools: [/* array of tools */],
});
```

## Creating a Session

### Basic Session
```typescript
const session = new RealtimeSession(agent, {
  model: "gpt-realtime-mini",
});
```

### Session with Custom Audio Configuration
```typescript
const session = new RealtimeSession(agent, {
  model: "gpt-realtime-mini",
  config: {
    audio: {
      input: {
        turnDetection: {
          type: "semantic_vad",
          eagerness: "low",
          create_response: false,
          interrupt_response: false,
        },
      },
    },
  },
});
```

## Connecting to Session

```typescript
// Connect with API key
await session.connect({ apiKey: "your-api-key" });

// Or with ephemeral token
await session.connect({ apiKey: ephemeralToken });
```

## Sending Messages

```typescript
// Send a text message
await session.sendMessage("Hello, agent!");

// Send a message after connection
session.connect({ apiKey: token })
  .then(() => session.sendMessage("Initial message"));
```

## Interrupting Agent

```typescript
session.interrupt();
```

## Closing Session

```typescript
session.close();
```

## Defining Tools

```typescript
const myTool = tool({
  name: "toolName",
  description: "What this tool does",
  parameters: z.object({
    param1: z.string().describe("Parameter description"),
    param2: z.number().optional(),
  }),
  execute: async ({ param1, param2 }) => {
    // Tool logic here
    return "Result string";
  },
});
```

### Tool with Array Parameters

```typescript
const arrayTool = tool({
  name: "arrayTool",
  description: "Tool with array parameter",
  parameters: z.object({
    items: z.array(z.string()),
  }),
  execute: async ({ items }) => {
    console.log(items);
    return "Processed";
  },
});
```

### Tool with No Parameters

```typescript
const noParamTool = tool({
  name: "noParamTool",
  description: "Tool without parameters",
  parameters: z.object({}),
  execute: async () => {
    // Logic here
    return "Result";
  },
});
```