/** Metadata carried by a replay marker. */
export interface ReplayMarkerMetadata {
  visionText?: string;
  visionModelId?: string;
  reasoningText?: string;
  segmentId?: string;
}

/** Result of parsing a replay marker from message content. */
export interface ParsedReplayMarker {
  valid: boolean;
  error?: string;
  segmentId?: string;
  visionText?: string;
  visionModelId?: string;
  reasoningText?: string;
  payloadFormat?: string;
  /** true when marker is a legacy UUID-only segment reference. */
  legacySegmentOnly?: boolean;
}
