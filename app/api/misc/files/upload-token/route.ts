import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  createPendingMiscFile,
  isBlobStorageConfigured,
  MAX_MISC_FILE_SIZE_BYTES,
  normalizeFileName,
} from "@/lib/misc-files";

function parseSize(value: unknown) {
  const size = typeof value === "number" ? value : Number(value);
  return Number.isFinite(size) ? Math.trunc(size) : null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  if (!isBlobStorageConfigured()) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not configured" },
      { status: 503 }
    );
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const fileName = normalizeFileName(payload.fileName);
    const contentType =
      typeof payload.contentType === "string" && payload.contentType.trim()
        ? payload.contentType.trim()
        : "application/octet-stream";
    const sizeBytes = parseSize(payload.sizeBytes);

    if (!fileName || sizeBytes === null || sizeBytes <= 0) {
      return NextResponse.json(
        { error: "Invalid file metadata" },
        { status: 400 }
      );
    }

    if (sizeBytes > MAX_MISC_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds the 50MB limit" },
        { status: 413 }
      );
    }

    const pending = await createPendingMiscFile({
      userId: user.id,
      fileName,
      contentType,
      sizeBytes,
    });
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname: pending.pathname,
      maximumSizeInBytes: MAX_MISC_FILE_SIZE_BYTES,
      addRandomSuffix: false,
      allowOverwrite: false,
      validUntil: Date.now() + 10 * 60 * 1000,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({
      fileId: pending.id,
      pathname: pending.pathname,
      clientToken,
      maxFileSizeBytes: MAX_MISC_FILE_SIZE_BYTES,
    });
  } catch (error) {
    console.error("Misc file upload token error:", error);
    return NextResponse.json(
      { error: "Failed to prepare file upload" },
      { status: 500 }
    );
  }
}
