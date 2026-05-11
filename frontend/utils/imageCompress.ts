/**
 * PG5 — resize + re-encode a receipt before base64 upload.
 *
 * The OCR endpoint takes whatever we send; previously that was the
 * camera's native resolution (e.g. 4032×3024 ≈ 4MB base64). Capping
 * the long edge to 1600px and re-encoding JPEG at q=0.85 typically
 * shrinks payloads 5–10× without measurably hurting OCR accuracy on
 * the existing test corpus.
 *
 * Falls through unchanged when manipulator throws or width/height
 * are unknown — we never want a compression failure to block a
 * receipt upload.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export const MAX_LONG_EDGE_PX = 1600;
export const JPEG_QUALITY = 0.85;

export interface CompressInput {
  uri: string;
  width?: number;
  height?: number;
}

export interface CompressResult {
  uri: string;
  width: number;
  height: number;
  /** Approximate byte size of the encoded JPEG. May be undefined when
   *  expo-file-system cannot stat the URI (e.g. web blobs). */
  byteSize?: number;
  /** True when a real resize/re-encode happened; false when the input
   *  was already small enough or we fell through to a passthrough. */
  resized: boolean;
}

function targetDims(width: number, height: number): { width: number; height: number } | null {
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_LONG_EDGE_PX) return null;
  const scale = MAX_LONG_EDGE_PX / longEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export async function compressForUpload(input: CompressInput): Promise<CompressResult> {
  const { uri, width, height } = input;

  if (!width || !height) {
    return { uri, width: width ?? 0, height: height ?? 0, resized: false };
  }

  const target = targetDims(width, height);
  if (!target) {
    const passthroughSize = await safeFileSize(uri);
    return { uri, width, height, byteSize: passthroughSize, resized: false };
  }

  try {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: target.width, height: target.height });
    const image = await ctx.renderAsync();
    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: JPEG_QUALITY,
    });
    const byteSize = await safeFileSize(result.uri);
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      byteSize,
      resized: true,
    };
  } catch (err) {
    if (__DEV__) console.warn('[PG5] compressForUpload fell through to passthrough:', err);
    return { uri, width, height, resized: false };
  }
}

async function safeFileSize(uri: string): Promise<number | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true } as never);
    if (info && typeof (info as { size?: number }).size === 'number') {
      return (info as { size?: number }).size;
    }
  } catch {
    // not all URIs (web blobs, in-memory) have a stat
  }
  return undefined;
}
