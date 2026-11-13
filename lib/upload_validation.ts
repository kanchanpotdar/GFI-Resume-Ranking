import path from "path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_ZIP_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 500;
export const MAX_ZIP_COMPRESSION_RATIO = 100;

/**
 * Sanitizes an uploaded filename to a safe basename without path traversal or control characters.
 */
export function sanitizeUploadFilename(rawName: string): string {
  const base = path.basename(rawName || "resume").replace(/[\x00-\x1f\x7f<>:"/\\|?*]+/g, "_").trim();
  return base || "resume";
}

/**
 * Verifies binary magic signatures for supported formats (.pdf -> %PDF, .docx -> PK\x03\x04).
 */
export function validateFileMagicBytes(buffer: Buffer, ext: string): { valid: boolean; error?: string } {
  const normalizedExt = ext.toLowerCase();
  if (normalizedExt === ".pdf") {
    const isPdfMagic =
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46;
    return isPdfMagic
      ? { valid: true }
      : { valid: false, error: "File content does not match a valid PDF binary signature." };
  }

  if (normalizedExt === ".docx") {
    const isDocxMagic =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;
    return isDocxMagic
      ? { valid: true }
      : { valid: false, error: "File content does not match a valid DOCX (OpenXML) binary signature." };
  }

  return { valid: false, error: `Unsupported file format '${ext}'. Please upload a .docx or .pdf resume.` };
}

export interface ZipSafetyOptions {
  maxUncompressedBytes?: number;
  maxEntries?: number;
  maxCompressionRatio?: number;
}

/**
 * Validates DOCX (ZIP) container safety by parsing End of Central Directory (EOCD)
 * and walking Central Directory headers (authoritative sizes, entry count, compression ratio),
 * plus checking for oversized or malformed structures without vulnerable local-only scanning.
 */
export function checkZipSafety(buffer: Buffer, options: ZipSafetyOptions = {}): boolean {
  const maxUncompressedBytes = options.maxUncompressedBytes ?? MAX_ZIP_UNCOMPRESSED_BYTES;
  const maxEntries = options.maxEntries ?? MAX_ZIP_ENTRIES;
  const maxCompressionRatio = options.maxCompressionRatio ?? MAX_ZIP_COMPRESSION_RATIO;

  if (!buffer || buffer.length < 22) {
    return false;
  }

  // Locate End of Central Directory (0x06054b50) searching backwards within max 64KB comment window
  const minSearchStart = Math.max(0, buffer.length - 65557);
  let eocdOffset = -1;
  for (let pos = buffer.length - 22; pos >= minSearchStart; pos--) {
    if (
      buffer[pos] === 0x50 &&
      buffer[pos + 1] === 0x4b &&
      buffer[pos + 2] === 0x05 &&
      buffer[pos + 3] === 0x06
    ) {
      eocdOffset = pos;
      break;
    }
  }

  if (eocdOffset === -1) {
    return false;
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries === 0 || totalEntries > maxEntries) {
    return false;
  }

  // Reject ZIP64 markers or out-of-bounds Central Directory offsets
  if (
    totalEntries === 0xffff ||
    cdSize === 0xffffffff ||
    cdOffset === 0xffffffff ||
    cdOffset + cdSize > eocdOffset
  ) {
    return false;
  }

  let totalUncompressed = 0;
  let offset = cdOffset;
  let parsedEntries = 0;

  while (offset + 46 <= cdOffset + cdSize && parsedEntries < totalEntries) {
    // Central directory header signature: 0x02014b50
    if (
      buffer[offset] !== 0x50 ||
      buffer[offset + 1] !== 0x4b ||
      buffer[offset + 2] !== 0x01 ||
      buffer[offset + 3] !== 0x02
    ) {
      return false;
    }

    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      return false;
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > maxUncompressedBytes) {
      return false;
    }

    // Enforce compression ratio cap on non-trivial payloads (>1MB uncompressed)
    if (uncompressedSize > 1024 * 1024) {
      if (compressedSize === 0 || uncompressedSize / compressedSize > maxCompressionRatio) {
        return false;
      }
    }

    const nextOffset = offset + 46 + fileNameLen + extraLen + commentLen;
    if (nextOffset <= offset || nextOffset > buffer.length) {
      return false;
    }

    offset = nextOffset;
    parsedEntries++;
  }

  return parsedEntries === totalEntries;
}

// Bounded in-memory sliding-window rate limiter per client key
const rateLimitMap = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 2000;

export function resetUploadRateLimiter(): void {
  rateLimitMap.clear();
}

export function checkUploadRateLimit(
  clientKey: string,
  maxRequests = 30,
  windowMs = 60_000,
  now = Date.now()
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const key = (clientKey || "anonymous").slice(0, 128);
  const cutoff = now - windowMs;
  const recent = (rateLimitMap.get(key) || []).filter((ts) => ts > cutoff);

  if (recent.length >= maxRequests) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateLimitMap.set(key, recent);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  recent.push(now);
  if (rateLimitMap.size >= MAX_TRACKED_KEYS && !rateLimitMap.has(key)) {
    const oldestKey = rateLimitMap.keys().next().value;
    if (oldestKey !== undefined) rateLimitMap.delete(oldestKey);
  }
  rateLimitMap.set(key, recent);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - recent.length),
    retryAfterSeconds: 0
  };
}
