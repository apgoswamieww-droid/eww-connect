import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { errorResponse, requireAuth } from "../../../../lib/apiAuth";
import { createAttachmentRecord } from "../../../../lib/data/files";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/gzip",
];

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const messageId = formData.get("messageId") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "File type not allowed" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "File too large (max 50MB)" }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const ext = (file.name.split(".").pop() ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 10) || "file";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const fileUrl = `/uploads/${safeName}`;

    if (messageId) {
      const attachment = await createAttachmentRecord({
        messageId,
        fileName: file.name,
        fileUrl,
        fileType: file.type,
        fileSize: file.size,
      });
      return NextResponse.json({ success: true, data: attachment });
    }

    return NextResponse.json({ success: true, data: { fileName: file.name, fileUrl, fileType: file.type, fileSize: file.size } });
  } catch (error) {
    return errorResponse(error, "Failed to upload file");
  }
}
