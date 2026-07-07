export async function textToImage(apiKey, prompt) {
  const response = await fetch("https://fal.run/fal-ai/krea-2/turbo", {
    method: "POST",
    headers: {
      Authorization: "Key " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      num_images: 1,
      image_size: "square",
      output_format: "jpeg",
      enable_safety_checker: false,
      acceleration: "none",
      sync_mode: true,
      enable_prompt_expansion: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed");
  }

  const result = await response.json();

  const imageUrl = result?.data?.images?.[0]?.url || result?.images?.[0]?.url || result?.image?.url || result?.url;

  if (!imageUrl) {
    throw new Error("No image URL found in response.");
  }

  return imageUrl;
}
