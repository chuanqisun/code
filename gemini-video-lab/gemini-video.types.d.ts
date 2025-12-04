/**
 * Video Generation Types for @google/genai
 *
 * These types are extracted from the @google/genai package for video generation
 * functionality using Google's Veo models.
 */

// ============================================================================
// Core Types
// ============================================================================

/** HTTP options to be used in each of the requests. */
export interface HttpOptions {
  /** The base URL for the AI platform service endpoint. */
  baseUrl?: string;
  /** Specifies the version of the API to use. */
  apiVersion?: string;
  /** Additional HTTP headers to be sent with the request. */
  headers?: Record<string, string>;
  /** Timeout for the request in milliseconds. */
  timeout?: number;
  /**
   * Extra parameters to add to the request body.
   * The structure must match the backend API's request structure.
   * - VertexAI backend API docs: https://cloud.google.com/vertex-ai/docs/reference/rest
   * - GeminiAPI backend API docs: https://ai.google.dev/api/rest
   */
  extraBody?: Record<string, unknown>;
}

/** A wrapper class for the http response. */
export interface HttpResponse {
  /** Used to retain the processed HTTP headers in the response. */
  headers?: Record<string, string>;
}

// ============================================================================
// Image Types
// ============================================================================

/** An image. */
export interface Image {
  /**
   * The Cloud Storage URI of the image. `Image` can contain a value
   * for this field or the `imageBytes` field but not both.
   */
  gcsUri?: string;
  /**
   * The image bytes data. `Image` can contain a value for this field
   * or the `gcsUri` field but not both.
   * @remarks Encoded as base64 string.
   */
  imageBytes?: string;
  /** The MIME type of the image. */
  mimeType?: string;
}

// ============================================================================
// Video Types
// ============================================================================

/** A video. */
export interface Video {
  /** Path to another storage. */
  uri?: string;
  /**
   * Video bytes.
   * @remarks Encoded as base64 string.
   */
  videoBytes?: string;
  /** Video encoding, for example `video/mp4`. */
  mimeType?: string;
}

/** A generated video. */
export interface GeneratedVideo {
  /** The output video */
  video?: Video;
}

// ============================================================================
// Video Generation Parameters
// ============================================================================

/**
 * Class that represents the parameters for generating videos.
 */
export interface GenerateVideosParameters {
  /**
   * ID of the model to use. For a list of models, see Google models
   * https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models
   */
  model: string;
  /**
   * The text prompt for generating the videos.
   * Optional if image or video is provided.
   */
  prompt?: string;
  /**
   * The input image for generating the videos.
   * Optional if prompt is provided. Not allowed if video is provided.
   */
  image?: Image;
  /**
   * The input video for video extension use cases.
   * Optional if prompt is provided. Not allowed if image is provided.
   */
  video?: Video;
  /** A set of source input(s) for video generation. */
  source?: GenerateVideosSource;
  /** Configuration for generating videos. */
  config?: GenerateVideosConfig;
}

/** A set of source input(s) for video generation. */
export interface GenerateVideosSource {
  /**
   * The text prompt for generating the videos.
   * Optional if image or video is provided.
   */
  prompt?: string;
  /**
   * The input image for generating the videos.
   * Optional if prompt is provided. Not allowed if video is provided.
   */
  image?: Image;
  /**
   * The input video for video extension use cases.
   * Optional if prompt is provided. Not allowed if image is provided.
   */
  video?: Video;
}

// ============================================================================
// Video Generation Configuration
// ============================================================================

/** Configuration for generating videos. */
export interface GenerateVideosConfig {
  /** Used to override HTTP request options. */
  httpOptions?: HttpOptions;
  /**
   * Abort signal which can be used to cancel the request.
   *
   * NOTE: AbortSignal is a client-only operation. Using it to cancel an
   * operation will not cancel the request in the service. You will still
   * be charged usage for any applicable operations.
   */
  abortSignal?: AbortSignal;
  /** Number of output videos. */
  numberOfVideos?: number;
  /** The gcs bucket where to save the generated videos. */
  outputGcsUri?: string;
  /** Frames per second for video generation. */
  fps?: number;
  /** Duration of the clip for video generation in seconds. */
  durationSeconds?: number;
  /**
   * The RNG seed. If RNG seed is exactly same for each request with
   * unchanged inputs, the prediction results will be consistent. Otherwise,
   * a random RNG seed will be used each time to produce a different result.
   */
  seed?: number;
  /**
   * The aspect ratio for the generated video. 16:9 (landscape) and
   * 9:16 (portrait) are supported.
   */
  aspectRatio?: string;
  /**
   * The resolution for the generated video. 720p and 1080p are supported.
   */
  resolution?: string;
  /**
   * Whether allow to generate person videos, and restrict to specific
   * ages. Supported values are: dont_allow, allow_adult.
   */
  personGeneration?: string;
  /** The pubsub topic where to publish the video generation progress. */
  pubsubTopic?: string;
  /** Explicitly state what should not be included in the generated videos. */
  negativePrompt?: string;
  /** Whether to use the prompt rewriting logic. */
  enhancePrompt?: boolean;
  /** Whether to generate audio along with the video. */
  generateAudio?: boolean;
  /**
   * Image to use as the last frame of generated videos.
   * Only supported for image to video use cases.
   */
  lastFrame?: Image;
  /**
   * The images to use as the references to generate the videos.
   * If this field is provided, the text prompt field must also be provided.
   * The image, video, or last_frame field are not supported. Each image must
   * be associated with a type. Veo 2 supports up to 3 asset images *or* 1
   * style image.
   */
  referenceImages?: VideoGenerationReferenceImage[];
  /** The mask to use for generating videos. */
  mask?: VideoGenerationMask;
  /** Compression quality of the generated videos. */
  compressionQuality?: VideoCompressionQuality;
}

// ============================================================================
// Video Generation Response
// ============================================================================

/** Response with generated videos. */
export interface GenerateVideosResponse {
  /** List of the generated videos */
  generatedVideos?: GeneratedVideo[];
  /** Returns if any videos were filtered due to RAI policies. */
  raiMediaFilteredCount?: number;
  /** Returns rai failure reasons if any. */
  raiMediaFilteredReasons?: string[];
}

/** A video generation operation. */
export interface GenerateVideosOperation {
  /**
   * The server-assigned name, which is only unique within the same service
   * that originally returns it. If you use the default HTTP mapping, the
   * `name` should be a resource name ending with `operations/{unique_id}`.
   */
  name?: string;
  /**
   * Service-specific metadata associated with the operation. It typically
   * contains progress information and common metadata such as create time.
   * Some services might not provide such metadata. Any method that returns
   * a long-running operation should document the metadata type, if any.
   */
  metadata?: Record<string, unknown>;
  /**
   * If the value is `false`, it means the operation is still in progress.
   * If `true`, the operation is completed, and either `error` or `response`
   * is available.
   */
  done?: boolean;
  /** The error result of the operation in case of failure or cancellation. */
  error?: Record<string, unknown>;
  /** The generated videos. */
  response?: GenerateVideosResponse;
  /** The full HTTP response. */
  sdkHttpResponse?: HttpResponse;
}

// ============================================================================
// Video Generation Reference Images
// ============================================================================

/** A reference image for video generation. */
export interface VideoGenerationReferenceImage {
  /** The reference image. */
  image?: Image;
  /**
   * The type of the reference image, which defines how the reference
   * image will be used to generate the video.
   */
  referenceType?: VideoGenerationReferenceType;
}

/** Enum for the reference type of a video generation reference image. */
export enum VideoGenerationReferenceType {
  /**
   * A reference image that provides assets to the generated video,
   * such as the scene, an object, a character, etc.
   */
  ASSET = "ASSET",
  /**
   * A reference image that provides aesthetics including colors,
   * lighting, texture, etc., to be used as the style of the generated video,
   * such as 'anime', 'photography', 'origami', etc.
   */
  STYLE = "STYLE",
}

// ============================================================================
// Video Generation Mask
// ============================================================================

/** A mask for video generation. */
export interface VideoGenerationMask {
  /** The image mask to use for generating videos. */
  image?: Image;
  /**
   * Describes how the mask will be used. Inpainting masks must
   * match the aspect ratio of the input video. Outpainting masks can be
   * either 9:16 or 16:9.
   */
  maskMode?: VideoGenerationMaskMode;
}

/** Enum for the mask mode of a video generation mask. */
export enum VideoGenerationMaskMode {
  /**
   * The image mask contains a masked rectangular region which is
   * applied on the first frame of the input video. The object described in
   * the prompt is inserted into this region and will appear in subsequent
   * frames.
   */
  INSERT = "INSERT",
  /**
   * The image mask is used to determine an object in the
   * first video frame to track. This object is removed from the video.
   */
  REMOVE = "REMOVE",
  /**
   * The image mask is used to determine a region in the
   * video. Objects in this region will be removed.
   */
  REMOVE_STATIC = "REMOVE_STATIC",
  /**
   * The image mask contains a masked rectangular region where
   * the input video will go. The remaining area will be generated. Video
   * masks are not supported.
   */
  OUTPAINT = "OUTPAINT",
}

// ============================================================================
// Video Compression Quality
// ============================================================================

/** Enum that controls the compression quality of the generated videos. */
export enum VideoCompressionQuality {
  /**
   * Optimized video compression quality. This will produce videos
   * with a compressed, smaller file size.
   */
  OPTIMIZED = "OPTIMIZED",
  /**
   * Lossless video compression quality. This will produce videos
   * with a larger file size.
   */
  LOSSLESS = "LOSSLESS",
}

// ============================================================================
// Video Metadata
// ============================================================================

/** Metadata describes the input video content. */
export interface VideoMetadata {
  /** Optional. The end offset of the video. */
  endOffset?: string;
  /**
   * Optional. The frame rate of the video sent to the model.
   * If not specified, the default value will be 1.0.
   * The fps range is (0.0, 24.0].
   */
  fps?: number;
  /** Optional. The start offset of the video. */
  startOffset?: string;
}
