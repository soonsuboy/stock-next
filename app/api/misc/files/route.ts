import { del, head } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import {
  completeMiscFileUpload,
  deleteMiscFileRecord,
  getMiscFileForUser,
  isBlobStorageConfigured,
  listMiscFiles,
  MAX_MISC_FILE_SIZE_BYTES,
} from "@/lib/misc-files";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const files = await listMiscFiles(user.id);
    return NextResponse.json({
      files,
      storageConfigured: isBlobStorageConfigured(),
      maxFileSizeBytes: MAX_MISC_FILE_SIZE_BYTES,
    });
  } catch (error) {
    console.error("Misc files fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
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
    const payload = (await request.json()) as { fileId?: string };
    const fileId = typeof payload.fileId === "string" ? payload.fileId : "";
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    const file = await getMiscFileForUser(user.id, fileId);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const blob = await head(file.pathname);
    if (blob.size > MAX_MISC_FILE_SIZE_BYTES) {
      await del(file.pathname).catch((error) => {
        console.error("Oversized blob cleanup failed:", error);
      });
      await deleteMiscFileRecord(user.id, file.id);
      return NextResponse.json(
        { error: "File size exceeds the 50MB limit" },
        { status: 413 }
      );
    }

    await completeMiscFileUpload({
      userId: user.id,
      fileId: file.id,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      contentType: blob.contentType,
      sizeBytes: blob.size,
    });

    const files = await listMiscFiles(user.id);
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Misc file complete error:", error);
    return NextResponse.json(
      { error: "Failed to complete file upload" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  if (!isBlobStorageConfigured()) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not configured" },
      { status: 503 }
    );
  }

  try {
    const fileId = request.nextUrl.searchParams.get("id") || "";
    if (!fileId) {
      return NextResponse.json({ error: "Missing file id" }, { status: 400 });
    }

    const file = await getMiscFileForUser(user.id, fileId);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await del(file.pathname);
    await deleteMiscFileRecord(user.id, file.id);

    const files = await listMiscFiles(user.id);
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Misc file delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
