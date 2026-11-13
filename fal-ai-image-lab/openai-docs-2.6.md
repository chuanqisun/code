# GPT Image 2.6 Flare Text to Image

> OpenAI's default image model for most applications. Fast, high-quality generation with natural lighting, rich textures, and support for complex layouts including transparent backgrounds.

## Overview

- **Endpoint**: `https://fal.run/openai/gpt-image-2.6/flare/text-to-image`
- **Model ID**: `openai/gpt-image-2.6/flare/text-to-image`
- **Category**: text-to-image
- **Kind**: inference
  **Tags**: realism, typography, stylized

## Pricing

Text tokens (per 1M): **$5.00** input, **$1.25** cached, **$10.00** output.
Image tokens (per 1M): **$8.00** input, **$2.00** cached, **$30.00** output. Changing the **quality** parameter significantly affects cost; by default we use **high**. Adjust it to your preference.
See the description at the bottom of this page for more details on how much canonical image sizes cost. Total cost is rounded up to the closest hundredth of a cent ($0.0001.)

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.

### Input Schema

The API accepts the following input parameters:

- **`prompt`** (`string`, _required_):
  The prompt for image generation
  - Examples: "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912"

- **`image_size`** (`ImageSize | Enum`, _optional_):
  The size of the generated image. Supports preset names, explicit {width, height}, or 'auto' to let the model pick the best size. Concrete sizes must have both dimensions as multiples of 16, max edge 3840px, aspect ratio <= 3:1, total pixels between 655,360 and 8,294,400. Default value: `landscape_4_3`
  - Default: `"landscape_4_3"`
  - One of: ImageSize | Enum

- **`background`** (`BackgroundEnum`, _optional_):
  Background for the generated image Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"transparent"`, `"opaque"`

- **`quality`** (`QualityEnum`, _optional_):
  Rendering quality for the generated image. For SVG output it controls the reference image used to create the vector. Default value: `"high"`
  - Default: `"high"`
  - Options: `"auto"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`

- **`reasoning_effort`** (`ReasoningEffortEnum`, _optional_):
  How much the model plans before rendering, independently of quality (OpenAI `complexity`). Higher levels can help with dense text and complex layouts but add latency. Default value: `"high"`
  - Default: `"high"`
  - Options: `"low"`, `"medium"`, `"high"`

- **`num_images`** (`integer`, _optional_):
  Number of images to generate. Must be 1 for SVG output. For GIF output, all frames of all outputs share the request's pixel budget. Default value: `1`
  - Default: `1`
  - Range: `1` to `10`
  - Examples: 1

- **`output_format`** (`OutputFormatEnum`, _optional_):
  Output format for the images. 'gif' returns an animation and 'svg' a vector image. Default value: `"png"`
  - Default: `"png"`
  - Options: `"jpeg"`, `"png"`, `"webp"`, `"gif"`, `"svg"`

- **`output_compression`** (`integer`, _optional_):
  Compression level from 0 to 100. Only supported when output_format is 'jpeg' or 'webp'.
  - Range: `0` to `100`

- **`frame_count`** (`integer`, _optional_):
  GIF only: number of frames. image_size applies to each frame; reduce size or count if the request exceeds the pixel budget. Default value: `9`
  - Default: `9`
  - Range: `2` to `16`

- **`frame_duration_ms`** (`integer`, _optional_):
  GIF only: milliseconds per frame, rounded to 10 ms. Default value: `200`
  - Default: `200`
  - Range: `20` to `2000`

- **`svg_model`** (`SvgModelEnum`, _optional_):
  SVG only: the model that converts the generated reference image into vector paths. Larger models produce more accurate shapes. Default value: `"gpt-6-astra"`
  - Default: `"gpt-6-astra"`
  - Options: `"gpt-6-astra"`, `"gpt-5.5"`, `"gpt-5.4"`, `"gpt-5.6-terra"`, `"gpt-6-luna"`, `"gpt-6-sol"`

- **`sync_mode`** (`boolean`, _optional_):
  If `True`, the media will be returned as a data URI and the output data won't be available in the request history.
  - Default: `false`

- **`enable_safety_checker`** (`boolean`, _optional_):
  Authorized callers may set false to request relaxed screening. Default value: `true`
  - Default: `true`

**Required Parameters Example**:

```json
{
  "prompt": "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912"
}
```

**Full Example**:

```json
{
  "prompt": "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912",
  "image_size": "landscape_4_3",
  "background": "auto",
  "quality": "high",
  "reasoning_effort": "high",
  "num_images": 1,
  "output_format": "png",
  "frame_count": 9,
  "frame_duration_ms": 200,
  "svg_model": "gpt-6-astra",
  "enable_safety_checker": true
}
```

### Output Schema

The API returns the following output format:

- **`images`** (`list<ImageFile>`, _required_):
  The generated images.
  - Array of ImageFile
  - Examples: [{"height":1024,"width":1024,"content_type":"image/png","url":"https://v3b.fal.media/files/b/0a869129/EnWrO3XWjPE0nxBDpaQrj.png","file_name":"EnWrO3XWjPE0nxBDpaQrj.png"}]

**Example Response**:

```json
{
  "images": [
    {
      "height": 1024,
      "width": 1024,
      "content_type": "image/png",
      "url": "https://v3b.fal.media/files/b/0a869129/EnWrO3XWjPE0nxBDpaQrj.png",
      "file_name": "EnWrO3XWjPE0nxBDpaQrj.png"
    }
  ]
}
```

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/openai/gpt-image-2.6/flare/text-to-image \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912"
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
    "openai/gpt-image-2.6/flare/text-to-image",
    arguments={
        "prompt": "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912"
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

const result = await fal.subscribe("openai/gpt-image-2.6/flare/text-to-image", {
  input: {
    prompt: "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912",
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

## Deploy your own model

To run your own weights, a fine-tune or a custom pipeline on the GPUs that serve this API, deploy it on fal Serverless. GPUs from H100 (80GB) to B300 (288GB), billed per second; an H100 is $4.50/h list, as low as $2.49/h. Prices, GPU specs and deploy steps: [fal Serverless](https://fal.ai/serverless.md).

## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/openai/gpt-image-2.6/flare/text-to-image)
- [API Documentation](https://fal.ai/models/openai/gpt-image-2.6/flare/text-to-image/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=openai/gpt-image-2.6/flare/text-to-image)

### fal.ai Platform

- [Platform Documentation](https://fal.ai/docs/documentation)
- [Python Client](https://fal.ai/docs/api-reference/client-libraries/python)
- [JavaScript Client](https://fal.ai/docs/api-reference/client-libraries/javascript)

### Other agent-readable surfaces

This file covers one model. To find anything else:

- [Platform overview](https://fal.ai/llms.txt): Entry points and representative endpoint IDs
- [Documentation index](https://fal.ai/docs/llms.txt): Every documentation page
- [Full documentation text](https://fal.ai/docs/llms-full.txt): The whole documentation inlined
- [Pricing](https://fal.ai/pricing.md): Model API and Serverless GPU prices
- [fal Serverless](https://fal.ai/serverless.md): Deploy your own models: GPU prices, specs and steps
- Any other model: `https://fal.ai/models/<endpoint-id>/llms.txt`

# GPT Image 2.6 Flare Edit

> Precise image editing that changes only what's asked, keeping subject, composition, and background intact, with reference subjects staying recognizable across styles and successive edits.

## Overview

- **Endpoint**: `https://fal.run/openai/gpt-image-2.6/flare/edit`
- **Model ID**: `openai/gpt-image-2.6/flare/edit`
- **Category**: image-to-image
- **Kind**: inference
  **Tags**: stylized, transform, editing

## Pricing

Text tokens (per 1M): **$5.00** input, **$1.25** cached, **$10.00** output.
Image tokens (per 1M): **$8.00** input, **$2.00** cached, **$30.00** output. Changing the **quality** parameter significantly affects cost; by default we use **high**. Adjust it to your preference.
See the description at the bottom of this page for more details on how much canonical image sizes cost. Total cost is rounded up to the closest hundredth of a cent ($0.0001.)

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.

### Input Schema

The API accepts the following input parameters:

- **`prompt`** (`string`, _required_):
  The prompt for image generation
  - Examples: "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods."

- **`image_urls`** (`list<string>`, _required_):
  The URLs of the images to use as a reference for the generation. A maximum of 16 images are allowed.
  - Array of string
  - Examples: ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"]

- **`mask_url`** (`string`, _optional_):
  Mask image URL. White marks regions to edit and black marks regions to keep.

- **`markup_image_url`** (`string`, _optional_):
  Transparent PNG containing only annotations (circles, arrows, notes) that guide the edit of the first image. Must match the first image's dimensions. Cannot be combined with mask_url. Reference images are sent unmodified when set.

- **`image_size`** (`ImageSize | Enum`, _optional_):
  The size of the generated image. Use 'auto' to infer from input images. Default value: `auto`
  - Default: `"auto"`
  - One of: ImageSize | Enum

- **`background`** (`BackgroundEnum`, _optional_):
  Background for the generated image Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"transparent"`, `"opaque"`

- **`quality`** (`QualityEnum`, _optional_):
  Rendering quality for the generated image. For SVG output it controls the reference image used to create the vector. Default value: `"high"`
  - Default: `"high"`
  - Options: `"auto"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`

- **`reasoning_effort`** (`ReasoningEffortEnum`, _optional_):
  How much the model plans before rendering, independently of quality (OpenAI `complexity`). Higher levels can help with dense text and complex layouts but add latency. Default value: `"high"`
  - Default: `"high"`
  - Options: `"low"`, `"medium"`, `"high"`

- **`num_images`** (`integer`, _optional_):
  Number of images to generate. Must be 1 for SVG output. For GIF output, all frames of all outputs share the request's pixel budget. Default value: `1`
  - Default: `1`
  - Range: `1` to `10`
  - Examples: 1

- **`output_format`** (`OutputFormatEnum`, _optional_):
  Output format for the images. 'gif' returns an animation. Default value: `"png"`
  - Default: `"png"`
  - Options: `"jpeg"`, `"png"`, `"webp"`, `"gif"`

- **`output_compression`** (`integer`, _optional_):
  Compression level from 0 to 100. Only supported when output_format is 'jpeg' or 'webp'.
  - Range: `0` to `100`

- **`frame_count`** (`integer`, _optional_):
  GIF only: number of frames. image_size applies to each frame; reduce size or count if the request exceeds the pixel budget. Default value: `9`
  - Default: `9`
  - Range: `2` to `16`

- **`frame_duration_ms`** (`integer`, _optional_):
  GIF only: milliseconds per frame, rounded to 10 ms. Default value: `200`
  - Default: `200`
  - Range: `20` to `2000`

- **`sync_mode`** (`boolean`, _optional_):
  If `True`, the media will be returned as a data URI and the output data won't be available in the request history.
  - Default: `false`

- **`enable_safety_checker`** (`boolean`, _optional_):
  Authorized callers may set false to request relaxed screening. Default value: `true`
  - Default: `true`

**Required Parameters Example**:

```json
{
  "prompt": "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
  "image_urls": ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"]
}
```

**Full Example**:

```json
{
  "prompt": "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
  "image_urls": ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"],
  "image_size": "auto",
  "background": "auto",
  "quality": "high",
  "reasoning_effort": "high",
  "num_images": 1,
  "output_format": "png",
  "frame_count": 9,
  "frame_duration_ms": 200,
  "enable_safety_checker": true
}
```

### Output Schema

The API returns the following output format:

- **`images`** (`list<ImageFile>`, _required_):
  The generated images.
  - Array of ImageFile
  - Examples: [{"height":1024,"width":1024,"content_type":"image/png","url":"https://v3b.fal.media/files/b/0a8691b0/yUt7tifLSbg1WzWWgfj2o.png","file_name":"yUt7tifLSbg1WzWWgfj2o.png"}]

**Example Response**:

```json
{
  "images": [
    {
      "height": 1024,
      "width": 1024,
      "content_type": "image/png",
      "url": "https://v3b.fal.media/files/b/0a8691b0/yUt7tifLSbg1WzWWgfj2o.png",
      "file_name": "yUt7tifLSbg1WzWWgfj2o.png"
    }
  ]
}
```

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/openai/gpt-image-2.6/flare/edit \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "Same workers, same beam, same lunch boxes - but they'\''re all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
     "image_urls": [
       "https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"
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
    "openai/gpt-image-2.6/flare/edit",
    arguments={
        "prompt": "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
        "image_urls": ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"]
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

const result = await fal.subscribe("openai/gpt-image-2.6/flare/edit", {
  input: {
    prompt:
      "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
    image_urls: ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"],
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

## Deploy your own model

To run your own weights, a fine-tune or a custom pipeline on the GPUs that serve this API, deploy it on fal Serverless. GPUs from H100 (80GB) to B300 (288GB), billed per second; an H100 is $4.50/h list, as low as $2.49/h. Prices, GPU specs and deploy steps: [fal Serverless](https://fal.ai/serverless.md).

## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/openai/gpt-image-2.6/flare/edit)
- [API Documentation](https://fal.ai/models/openai/gpt-image-2.6/flare/edit/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=openai/gpt-image-2.6/flare/edit)

### fal.ai Platform

- [Platform Documentation](https://fal.ai/docs/documentation)
- [Python Client](https://fal.ai/docs/api-reference/client-libraries/python)
- [JavaScript Client](https://fal.ai/docs/api-reference/client-libraries/javascript)

### Other agent-readable surfaces

This file covers one model. To find anything else:

- [Platform overview](https://fal.ai/llms.txt): Entry points and representative endpoint IDs
- [Documentation index](https://fal.ai/docs/llms.txt): Every documentation page
- [Full documentation text](https://fal.ai/docs/llms-full.txt): The whole documentation inlined
- [Pricing](https://fal.ai/pricing.md): Model API and Serverless GPU prices
- [fal Serverless](https://fal.ai/serverless.md): Deploy your own models: GPU prices, specs and steps
- Any other model: `https://fal.ai/models/<endpoint-id>/llms.txt`

# GPT Image 2.6 Sunburst Text to Image

> OpenAI's precision-focused image model, built for premium visual work, extra fidelity on intricate detail, in exchange for longer generation times.

## Overview

- **Endpoint**: `https://fal.run/openai/gpt-image-2.6/sunburst/text-to-image`
- **Model ID**: `openai/gpt-image-2.6/sunburst/text-to-image`
- **Category**: text-to-image
- **Kind**: inference
  **Tags**: realism, typography, stylized

## Pricing

Text tokens (per 1M): **$5.00** input, **$1.25** cached, **$10.00** output.
Image tokens (per 1M): **$8.00** input, **$2.00** cached, **$30.00** output. Changing the **quality** parameter significantly affects cost; by default we use **high**. Adjust it to your preference.
See the description at the bottom of this page for more details on how much canonical image sizes cost. Total cost is rounded up to the closest hundredth of a cent ($0.0001.)

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.

### Input Schema

The API accepts the following input parameters:

- **`prompt`** (`string`, _required_):
  The prompt for image generation
  - Examples: "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912"

- **`image_size`** (`ImageSize | Enum`, _optional_):
  The size of the generated image. Supports preset names, explicit {width, height}, or 'auto' to let the model pick the best size. Concrete sizes must have both dimensions as multiples of 16, max edge 3840px, aspect ratio <= 3:1, total pixels between 655,360 and 8,294,400. Default value: `landscape_4_3`
  - Default: `"landscape_4_3"`
  - One of: ImageSize | Enum

- **`background`** (`BackgroundEnum`, _optional_):
  Background for the generated image Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"transparent"`, `"opaque"`

- **`quality`** (`QualityEnum`, _optional_):
  Rendering quality for the generated image. For SVG output it controls the reference image used to create the vector. Default value: `"high"`
  - Default: `"high"`
  - Options: `"auto"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`

- **`reasoning_effort`** (`ReasoningEffortEnum`, _optional_):
  How much the model plans before rendering, independently of quality (OpenAI `complexity`). Higher levels can help with dense text and complex layouts but add latency. Default value: `"high"`
  - Default: `"high"`
  - Options: `"low"`, `"medium"`, `"high"`

- **`num_images`** (`integer`, _optional_):
  Number of images to generate. Must be 1 for SVG output. For GIF output, all frames of all outputs share the request's pixel budget. Default value: `1`
  - Default: `1`
  - Range: `1` to `10`
  - Examples: 1

- **`output_format`** (`OutputFormatEnum`, _optional_):
  Output format for the images. 'gif' returns an animation and 'svg' a vector image. Default value: `"png"`
  - Default: `"png"`
  - Options: `"jpeg"`, `"png"`, `"webp"`, `"gif"`, `"svg"`

- **`output_compression`** (`integer`, _optional_):
  Compression level from 0 to 100. Only supported when output_format is 'jpeg' or 'webp'.
  - Range: `0` to `100`

- **`frame_count`** (`integer`, _optional_):
  GIF only: number of frames. image_size applies to each frame; reduce size or count if the request exceeds the pixel budget. Default value: `9`
  - Default: `9`
  - Range: `2` to `16`

- **`frame_duration_ms`** (`integer`, _optional_):
  GIF only: milliseconds per frame, rounded to 10 ms. Default value: `200`
  - Default: `200`
  - Range: `20` to `2000`

- **`svg_model`** (`SvgModelEnum`, _optional_):
  SVG only: the model that converts the generated reference image into vector paths. Larger models produce more accurate shapes. Default value: `"gpt-6-astra"`
  - Default: `"gpt-6-astra"`
  - Options: `"gpt-6-astra"`, `"gpt-5.5"`, `"gpt-5.4"`, `"gpt-5.6-terra"`, `"gpt-6-luna"`, `"gpt-6-sol"`

- **`sync_mode`** (`boolean`, _optional_):
  If `True`, the media will be returned as a data URI and the output data won't be available in the request history.
  - Default: `false`

- **`enable_safety_checker`** (`boolean`, _optional_):
  Authorized callers may set false to request relaxed screening. Default value: `true`
  - Default: `true`

**Required Parameters Example**:

```json
{
  "prompt": "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912"
}
```

**Full Example**:

```json
{
  "prompt": "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912",
  "image_size": "landscape_4_3",
  "background": "auto",
  "quality": "high",
  "reasoning_effort": "high",
  "num_images": 1,
  "output_format": "png",
  "frame_count": 9,
  "frame_duration_ms": 200,
  "svg_model": "gpt-6-astra",
  "enable_safety_checker": true
}
```

### Output Schema

The API returns the following output format:

- **`images`** (`list<ImageFile>`, _required_):
  The generated images.
  - Array of ImageFile
  - Examples: [{"url":"https://v3b.fal.media/files/b/0a869129/EnWrO3XWjPE0nxBDpaQrj.png","content_type":"image/png","file_name":"EnWrO3XWjPE0nxBDpaQrj.png","width":1024,"height":1024}]

**Example Response**:

```json
{
  "images": [
    {
      "url": "https://v3b.fal.media/files/b/0a869129/EnWrO3XWjPE0nxBDpaQrj.png",
      "content_type": "image/png",
      "file_name": "EnWrO3XWjPE0nxBDpaQrj.png",
      "width": 1024,
      "height": 1024
    }
  ]
}
```

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/openai/gpt-image-2.6/sunburst/text-to-image \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912"
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
    "openai/gpt-image-2.6/sunburst/text-to-image",
    arguments={
        "prompt": "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912"
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

const result = await fal.subscribe("openai/gpt-image-2.6/sunburst/text-to-image", {
  input: {
    prompt: "create a realistic image taken with iphone at these coordinates 41°43′32″N 49°56′49″W 15 April 1912",
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

## Deploy your own model

To run your own weights, a fine-tune or a custom pipeline on the GPUs that serve this API, deploy it on fal Serverless. GPUs from H100 (80GB) to B300 (288GB), billed per second; an H100 is $4.50/h list, as low as $2.49/h. Prices, GPU specs and deploy steps: [fal Serverless](https://fal.ai/serverless.md).

## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/openai/gpt-image-2.6/sunburst/text-to-image)
- [API Documentation](https://fal.ai/models/openai/gpt-image-2.6/sunburst/text-to-image/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=openai/gpt-image-2.6/sunburst/text-to-image)

### fal.ai Platform

- [Platform Documentation](https://fal.ai/docs/documentation)
- [Python Client](https://fal.ai/docs/api-reference/client-libraries/python)
- [JavaScript Client](https://fal.ai/docs/api-reference/client-libraries/javascript)

### Other agent-readable surfaces

This file covers one model. To find anything else:

- [Platform overview](https://fal.ai/llms.txt): Entry points and representative endpoint IDs
- [Documentation index](https://fal.ai/docs/llms.txt): Every documentation page
- [Full documentation text](https://fal.ai/docs/llms-full.txt): The whole documentation inlined
- [Pricing](https://fal.ai/pricing.md): Model API and Serverless GPU prices
- [fal Serverless](https://fal.ai/serverless.md): Deploy your own models: GPU prices, specs and steps
- Any other model: `https://fal.ai/models/<endpoint-id>/llms.txt`

# GPT Image 2.6 Sunburst Edit

> Editing built for the tightest control, edits scoped precisely to the instruction, with subject and composition preserved across many rounds of revision.

## Overview

- **Endpoint**: `https://fal.run/openai/gpt-image-2.6/sunburst/edit`
- **Model ID**: `openai/gpt-image-2.6/sunburst/edit`
- **Category**: image-to-image
- **Kind**: inference
  **Tags**: stylized, transform, editing

## Pricing

Text tokens (per 1M): **$5.00** input, **$1.25** cached, **$10.00** output.
Image tokens (per 1M): **$8.00** input, **$2.00** cached, **$30.00** output. Changing the **quality** parameter significantly affects cost; by default we use **high**. Adjust it to your preference.
See the description at the bottom of this page for more details on how much canonical image sizes cost. Total cost is rounded up to the closest hundredth of a cent ($0.0001.)

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.

### Input Schema

The API accepts the following input parameters:

- **`prompt`** (`string`, _required_):
  The prompt for image generation
  - Examples: "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods."

- **`image_urls`** (`list<string>`, _required_):
  The URLs of the images to use as a reference for the generation. A maximum of 16 images are allowed.
  - Array of string
  - Examples: ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"]

- **`mask_url`** (`string`, _optional_):
  Mask image URL. White marks regions to edit and black marks regions to keep.

- **`markup_image_url`** (`string`, _optional_):
  Transparent PNG containing only annotations (circles, arrows, notes) that guide the edit of the first image. Must match the first image's dimensions. Cannot be combined with mask_url. Reference images are sent unmodified when set.

- **`image_size`** (`ImageSize | Enum`, _optional_):
  The size of the generated image. Use 'auto' to infer from input images. Default value: `auto`
  - Default: `"auto"`
  - One of: ImageSize | Enum

- **`background`** (`BackgroundEnum`, _optional_):
  Background for the generated image Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"transparent"`, `"opaque"`

- **`quality`** (`QualityEnum`, _optional_):
  Rendering quality for the generated image. For SVG output it controls the reference image used to create the vector. Default value: `"high"`
  - Default: `"high"`
  - Options: `"auto"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`

- **`reasoning_effort`** (`ReasoningEffortEnum`, _optional_):
  How much the model plans before rendering, independently of quality (OpenAI `complexity`). Higher levels can help with dense text and complex layouts but add latency. Default value: `"high"`
  - Default: `"high"`
  - Options: `"low"`, `"medium"`, `"high"`

- **`num_images`** (`integer`, _optional_):
  Number of images to generate. Must be 1 for SVG output. For GIF output, all frames of all outputs share the request's pixel budget. Default value: `1`
  - Default: `1`
  - Range: `1` to `10`
  - Examples: 1

- **`output_format`** (`OutputFormatEnum`, _optional_):
  Output format for the images. 'gif' returns an animation. Default value: `"png"`
  - Default: `"png"`
  - Options: `"jpeg"`, `"png"`, `"webp"`, `"gif"`

- **`output_compression`** (`integer`, _optional_):
  Compression level from 0 to 100. Only supported when output_format is 'jpeg' or 'webp'.
  - Range: `0` to `100`

- **`frame_count`** (`integer`, _optional_):
  GIF only: number of frames. image_size applies to each frame; reduce size or count if the request exceeds the pixel budget. Default value: `9`
  - Default: `9`
  - Range: `2` to `16`

- **`frame_duration_ms`** (`integer`, _optional_):
  GIF only: milliseconds per frame, rounded to 10 ms. Default value: `200`
  - Default: `200`
  - Range: `20` to `2000`

- **`sync_mode`** (`boolean`, _optional_):
  If `True`, the media will be returned as a data URI and the output data won't be available in the request history.
  - Default: `false`

- **`enable_safety_checker`** (`boolean`, _optional_):
  Authorized callers may set false to request relaxed screening. Default value: `true`
  - Default: `true`

**Required Parameters Example**:

```json
{
  "prompt": "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
  "image_urls": ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"]
}
```

**Full Example**:

```json
{
  "prompt": "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
  "image_urls": ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"],
  "image_size": "auto",
  "background": "auto",
  "quality": "high",
  "reasoning_effort": "high",
  "num_images": 1,
  "output_format": "png",
  "frame_count": 9,
  "frame_duration_ms": 200,
  "enable_safety_checker": true
}
```

### Output Schema

The API returns the following output format:

- **`images`** (`list<ImageFile>`, _required_):
  The generated images.
  - Array of ImageFile
  - Examples: [{"url":"https://v3b.fal.media/files/b/0a8691b0/yUt7tifLSbg1WzWWgfj2o.png","content_type":"image/png","file_name":"yUt7tifLSbg1WzWWgfj2o.png","width":1024,"height":1024}]

**Example Response**:

```json
{
  "images": [
    {
      "url": "https://v3b.fal.media/files/b/0a8691b0/yUt7tifLSbg1WzWWgfj2o.png",
      "content_type": "image/png",
      "file_name": "yUt7tifLSbg1WzWWgfj2o.png",
      "width": 1024,
      "height": 1024
    }
  ]
}
```

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/openai/gpt-image-2.6/sunburst/edit \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "Same workers, same beam, same lunch boxes - but they'\''re all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
     "image_urls": [
       "https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"
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
    "openai/gpt-image-2.6/sunburst/edit",
    arguments={
        "prompt": "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
        "image_urls": ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"]
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

const result = await fal.subscribe("openai/gpt-image-2.6/sunburst/edit", {
  input: {
    prompt:
      "Same workers, same beam, same lunch boxes - but they're all on their phones now. One is taking a selfie. One is on a call looking annoyed. Same danger, new priorities. A hard hat has AirPods.",
    image_urls: ["https://v3b.fal.media/files/b/0a8691af/9Se_1_VX1wzTjjTOpWbs9_bb39c2eb-1a41-4749-b1d0-cf134abc8bbf.png"],
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

## Deploy your own model

To run your own weights, a fine-tune or a custom pipeline on the GPUs that serve this API, deploy it on fal Serverless. GPUs from H100 (80GB) to B300 (288GB), billed per second; an H100 is $4.50/h list, as low as $2.49/h. Prices, GPU specs and deploy steps: [fal Serverless](https://fal.ai/serverless.md).

## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/openai/gpt-image-2.6/sunburst/edit)
- [API Documentation](https://fal.ai/models/openai/gpt-image-2.6/sunburst/edit/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=openai/gpt-image-2.6/sunburst/edit)

### fal.ai Platform

- [Platform Documentation](https://fal.ai/docs/documentation)
- [Python Client](https://fal.ai/docs/api-reference/client-libraries/python)
- [JavaScript Client](https://fal.ai/docs/api-reference/client-libraries/javascript)

### Other agent-readable surfaces

This file covers one model. To find anything else:

- [Platform overview](https://fal.ai/llms.txt): Entry points and representative endpoint IDs
- [Documentation index](https://fal.ai/docs/llms.txt): Every documentation page
- [Full documentation text](https://fal.ai/docs/llms-full.txt): The whole documentation inlined
- [Pricing](https://fal.ai/pricing.md): Model API and Serverless GPU prices
- [fal Serverless](https://fal.ai/serverless.md): Deploy your own models: GPU prices, specs and steps
- Any other model: `https://fal.ai/models/<endpoint-id>/llms.txt`
