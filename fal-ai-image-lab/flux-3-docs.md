# Flux 3 Image

> FLUX 3 Image Edit from Black Forest Labs makes precise local edits without changing the rest of the image, and combines up to 10 references into one balanced, well-composed result.

## Overview

- **Endpoint**: `https://fal.run/blackforestlabs/flux-3/edit-image`
- **Model ID**: `blackforestlabs/flux-3/edit-image`
- **Category**: image-to-image
- **Kind**: inference
  **Tags**: flux-3-image, black-forest-labs, multi-reference

## Pricing

Image pricing varies by resolution, starting at $0.0205 per image. A 1K (1 MP) image costs $0.024.

Note: these promotional launch rates are 50% off for a limited time. The discount ends October 8, after which a 1K (1 MP) image will cost $0.048

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.

### Input Schema

The API accepts the following input parameters:

- **`prompt`** (`string`, _required_):
  The prompt to generate an image from.
  - Examples: "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph."

- **`image_urls`** (`list<string>`, _required_):
  Reference image URLs or data URIs, in image 1 through image 10 order. Each must be at least 256 pixels per dimension. Oversized images are automatically downscaled to at most 4 megapixels while preserving aspect ratio. The first controls auto aspect ratio.
  - Array of string
  - Examples: ["https://storage.googleapis.com/falserverless/example_inputs/flux2_pro_edit_input.png"]

- **`aspect_ratio`** (`AspectRatioEnum`, _optional_):
  Output aspect ratio. Auto uses the first reference image when editing. Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"21:9"`, `"2:1"`, `"16:9"`, `"3:2"`, `"7:5"`, `"4:3"`, `"5:4"`, `"1:1"`, `"4:5"`, `"3:4"`, `"5:7"`, `"2:3"`, `"9:16"`, `"1:2"`

- **`resolution`** (`ResolutionEnum`, _optional_):
  Output resolution tier. 4k can take several minutes. Default value: `"1k"`
  - Default: `"1k"`
  - Options: `"512sq"`, `"768sq"`, `"1k"`, `"2k"`, `"4k"`

- **`enable_prompt_expansion`** (`boolean`, _optional_):
  Expand the prompt while preserving its intent and reference roles.
  - Default: `false`

- **`safety_tolerance`** (`integer`, _optional_):
  Safety tolerance, from 0 (strictest) to 4. Default value: `2`
  - Default: `2`
  - Range: `0` to `4`

- **`output_format`** (`OutputFormatEnum`, _optional_):
  The format of the generated image. Default value: `"jpeg"`
  - Default: `"jpeg"`
  - Options: `"jpeg"`, `"png"`

- **`sync_mode`** (`boolean`, _optional_):
  Return the image as a data URI instead of storing it in request history.
  - Default: `false`

- **`version`** (`string`, _optional_):
  The model version. Default value: `"latest"`
  - Default: `"latest"`

**Required Parameters Example**:

```json
{
  "prompt": "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph.",
  "image_urls": ["https://storage.googleapis.com/falserverless/example_inputs/flux2_pro_edit_input.png"]
}
```

**Full Example**:

```json
{
  "prompt": "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph.",
  "image_urls": ["https://storage.googleapis.com/falserverless/example_inputs/flux2_pro_edit_input.png"],
  "aspect_ratio": "auto",
  "resolution": "1k",
  "safety_tolerance": 2,
  "output_format": "jpeg",
  "version": "latest"
}
```

### Output Schema

The API returns the following output format:

- **`images`** (`list<ImageFile>`, _required_):
  The generated image.
  - Array of ImageFile

**Example Response**:

```json
{
  "images": [
    {
      "url": "",
      "content_type": "image/png",
      "file_name": "z9RV14K95DvU.png",
      "file_size": 4404019
    }
  ]
}
```

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/blackforestlabs/flux-3/edit-image \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph.",
     "image_urls": [
       "https://storage.googleapis.com/falserverless/example_inputs/flux2_pro_edit_input.png"
     ]
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "blackforestlabs/flux-3/edit-image",
    arguments={
        "prompt": "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph.",
        "image_urls": ["https://storage.googleapis.com/falserverless/example_inputs/flux2_pro_edit_input.png"]
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("blackforestlabs/flux-3/edit-image", {
  input: {
    prompt: "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph.",
    image_urls: ["https://storage.googleapis.com/falserverless/example_inputs/flux2_pro_edit_input.png"],
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```

## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/blackforestlabs/flux-3/edit-image)
- [API Documentation](https://fal.ai/models/blackforestlabs/flux-3/edit-image/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=blackforestlabs/flux-3/edit-image)

### fal.ai Platform

- [Platform Documentation](https://fal.ai/docs/documentation)
- [Python Client](https://fal.ai/docs/api-reference/client-libraries/python)
- [JavaScript Client](https://fal.ai/docs/api-reference/client-libraries/javascript)

### Other agent-readable surfaces

This file covers one model. To find anything else:

- [Platform overview](https://fal.ai/llms.txt): Entry points and representative endpoint IDs
- [Documentation index](https://fal.ai/docs/llms.txt): Every documentation page
- [Full documentation text](https://fal.ai/docs/llms-full.txt): The whole documentation inlined
- Any other model: `https://fal.ai/models/<endpoint-id>/llms.txt`

# Flux 3 Image

> FLUX 3 Image is Black Forest Labs' newest image model. Generate detailed, well-composed images in native 2K and 4K with precise layout control and improved text rendering.

## Overview

- **Endpoint**: `https://fal.run/blackforestlabs/flux-3/text-to-image`
- **Model ID**: `blackforestlabs/flux-3/text-to-image`
- **Category**: text-to-image
- **Kind**: inference
  **Tags**: flux-3-image, black-forest-labs, typography, 4k

## Pricing

Image pricing varies by resolution, starting at $0.0205 per image. A 1K (1 MP) image costs $0.024.

Note: these promotional launch rates are 50% off for a limited time. The discount ends October 8, after which a 1K (1 MP) image will cost $0.048

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.

### Input Schema

The API accepts the following input parameters:

- **`prompt`** (`string`, _required_):
  The prompt to generate an image from.
  - Examples: "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph."

- **`aspect_ratio`** (`AspectRatioEnum`, _optional_):
  Output aspect ratio. Auto uses the first reference image when editing. Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"21:9"`, `"2:1"`, `"16:9"`, `"3:2"`, `"7:5"`, `"4:3"`, `"5:4"`, `"1:1"`, `"4:5"`, `"3:4"`, `"5:7"`, `"2:3"`, `"9:16"`, `"1:2"`

- **`resolution`** (`ResolutionEnum`, _optional_):
  Output resolution tier. 4k can take several minutes. Default value: `"1k"`
  - Default: `"1k"`
  - Options: `"512sq"`, `"768sq"`, `"1k"`, `"2k"`, `"4k"`

- **`enable_prompt_expansion`** (`boolean`, _optional_):
  Expand the prompt while preserving its intent and reference roles.
  - Default: `false`

- **`safety_tolerance`** (`integer`, _optional_):
  Safety tolerance, from 0 (strictest) to 4. Default value: `2`
  - Default: `2`
  - Range: `0` to `4`

- **`output_format`** (`OutputFormatEnum`, _optional_):
  The format of the generated image. Default value: `"jpeg"`
  - Default: `"jpeg"`
  - Options: `"jpeg"`, `"png"`

- **`sync_mode`** (`boolean`, _optional_):
  Return the image as a data URI instead of storing it in request history.
  - Default: `false`

- **`version`** (`string`, _optional_):
  The model version. Default value: `"latest"`
  - Default: `"latest"`

**Required Parameters Example**:

```json
{
  "prompt": "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph."
}
```

**Full Example**:

```json
{
  "prompt": "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph.",
  "aspect_ratio": "auto",
  "resolution": "1k",
  "safety_tolerance": 2,
  "output_format": "jpeg",
  "version": "latest"
}
```

### Output Schema

The API returns the following output format:

- **`images`** (`list<ImageFile>`, _required_):
  The generated image.
  - Array of ImageFile

**Example Response**:

```json
{
  "images": [
    {
      "url": "",
      "content_type": "image/png",
      "file_name": "z9RV14K95DvU.png",
      "file_size": 4404019
    }
  ]
}
```

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/blackforestlabs/flux-3/text-to-image \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph."
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "blackforestlabs/flux-3/text-to-image",
    arguments={
        "prompt": "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph."
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("blackforestlabs/flux-3/text-to-image", {
  input: {
    prompt: "A red fox leaping over a stream in a pine forest, low-angle wildlife photograph.",
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```

## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/blackforestlabs/flux-3/text-to-image)
- [API Documentation](https://fal.ai/models/blackforestlabs/flux-3/text-to-image/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=blackforestlabs/flux-3/text-to-image)

### fal.ai Platform

- [Platform Documentation](https://fal.ai/docs/documentation)
- [Python Client](https://fal.ai/docs/api-reference/client-libraries/python)
- [JavaScript Client](https://fal.ai/docs/api-reference/client-libraries/javascript)

### Other agent-readable surfaces

This file covers one model. To find anything else:

- [Platform overview](https://fal.ai/llms.txt): Entry points and representative endpoint IDs
- [Documentation index](https://fal.ai/docs/llms.txt): Every documentation page
- [Full documentation text](https://fal.ai/docs/llms-full.txt): The whole documentation inlined
- Any other model: `https://fal.ai/models/<endpoint-id>/llms.txt`
