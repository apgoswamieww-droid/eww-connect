"use client";

import { useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "../../lib/tokenManager";

type StoredUser = {
  id: string;
  name: string;
  email: string;
};

type FileItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  message: {
    id: string;
    content: string;
    createdAt: string;
    sender: { id: string; name: string };
  };
};

type UploadResult = {
  id?: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(type: string): string {
  if (type.startsWith("image/")) return "\uD83D\uDDBC";
  if (type === "application/pdf") return "\uD83D\uDCC4";
  if (type.startsWith("text/")) return "\uD83D\uDCDD";
  if (type.includes("spreadsheet") || type.includes("excel")) return "\uD83D\uDCCA";
  if (type.includes("document") || type.includes("word")) return "\uD83D\uDCC3";
  if (type.includes("zip") || type.includes("gzip")) return "\uD83D\uDCE6";
  return "\uD83D\uDCC1";
}

function isPreviewable(type: string): boolean {
  return type.startsWith("image/") || type === "application/pdf";
}

export default function FilesPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch {}
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) { setLoading(false); return; }
    fetch("/api/v1/files?recent=true", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => { if (j.success) { setFiles(j.data); setHasMoreFiles(j.hasMore ?? false); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mounted, user]);

  async function loadMoreFiles() {
    if (files.length === 0) return;
    const cursor = files[files.length - 1].id;
    const res = await fetch(`/api/v1/files?recent=true&cursor=${cursor}`, { headers: getAuthHeaders() });
    const j = await res.json();
    if (j.success) { setFiles((prev) => [...prev, ...j.data]); setHasMoreFiles(j.hasMore ?? false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/files/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      const j = await res.json();
      if (j.success) {
        const result = j.data as UploadResult;
        setFiles((prev) => [
          {
            id: result.id ?? `upload-${Date.now()}`,
            fileName: result.fileName,
            fileUrl: result.fileUrl,
            fileType: result.fileType,
            fileSize: result.fileSize,
            createdAt: new Date().toISOString(),
            message: {
              id: "",
              content: "",
              createdAt: new Date().toISOString(),
              sender: user ? { id: user.id, name: user.name } : { id: "", name: "Unknown" },
            },
          },
          ...prev,
        ]);
      }
    } catch {}
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!mounted || loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-300">Loading files...</p>
      </main>
    );
  }



  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-white">Files</h1>
        <label className="cursor-pointer rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:bg-slate-600"
          style={{ opacity: uploading ? 0.6 : 1 }}
        >
          {uploading ? "Uploading..." : "+ Upload file"}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {files.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-4xl mb-3">\uD83D\uDCC1</p>
          <p className="text-slate-400 mb-4">No files uploaded yet</p>
          <p className="text-sm text-slate-500">Upload a file to get started</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="rounded-lg border border-slate-700 bg-slate-900 p-4 hover:border-sky-600 transition cursor-pointer"
              onClick={() => isPreviewable(file.fileType) && setPreviewFile(file)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getFileIcon(file.fileType)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{file.fileName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatSize(file.fileSize)}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(file.createdAt)}</p>
                  {file.message?.sender && (
                    <p className="text-xs text-slate-500 mt-0.5">by {file.message.sender.name}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  href={file.fileUrl}
                  download={file.fileName}
                  className="text-xs rounded bg-slate-700 px-2.5 py-1 text-slate-200 hover:bg-slate-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  Download
                </a>
                {isPreviewable(file.fileType) && (
                  <button
                    className="text-xs rounded bg-sky-700 px-2.5 py-1 text-white hover:bg-sky-600"
                    onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                  >
                    Preview
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMoreFiles && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button onClick={loadMoreFiles} style={{ padding: "8px 20px", background: "#1e293b", color: "#93c5fd", border: "1px solid #334155", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            Load more files
          </button>
        </div>
      )}

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewFile(null)}>
          <div className="max-w-4xl max-h-[90vh] w-full rounded-lg border border-slate-700 bg-slate-900 p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white truncate">{previewFile.fileName}</h3>
              <button onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            {previewFile.fileType.startsWith("image/") ? (
              <img src={previewFile.fileUrl} alt={previewFile.fileName} className="max-w-full max-h-[70vh] mx-auto rounded" />
            ) : previewFile.fileType === "application/pdf" ? (
              <iframe src={previewFile.fileUrl} className="w-full h-[70vh] rounded" title={previewFile.fileName} />
            ) : (
              <p className="text-slate-400 text-center py-8">Preview not available</p>
            )}
            <div className="mt-3 text-center">
              <a href={previewFile.fileUrl} download={previewFile.fileName}
                className="inline-block rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
