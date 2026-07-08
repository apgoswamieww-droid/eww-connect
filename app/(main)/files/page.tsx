"use client";
/* eslint-disable react-hooks/set-state-in-effect */

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
  if (type.startsWith("image/")) return "🖼";
  if (type === "application/pdf") return "📄";
  if (type.startsWith("text/")) return "📝";
  if (type.includes("spreadsheet") || type.includes("excel")) return "📊";
  if (type.includes("document") || type.includes("word")) return "📃";
  if (type.includes("zip") || type.includes("gzip")) return "📦";
  return "📁";
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
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-6">
          <div className="h-8 w-24 skeleton" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-32 rounded-2xl skeleton" />)}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Files</h1>
          <p className="text-sm text-slate-400 mt-1">{files.length} file{files.length !== 1 ? "s" : ""}</p>
        </div>
        <label className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 cursor-pointer">
          {uploading ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <span>📤</span>
              <span>Upload file</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Files grid */}
      {files.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{
            background: "rgba(28, 35, 51, 0.6)",
            border: "1px solid rgba(45, 55, 71, 0.4)",
          }}
        >
          <p className="text-5xl mb-4">📁</p>
          <p className="text-slate-400 mb-2">No files uploaded yet</p>
          <p className="text-sm text-slate-500">Upload a file to get started</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="rounded-2xl p-5 transition-all duration-200 cursor-pointer group"
                style={{
                  background: "rgba(28, 35, 51, 0.6)",
                  border: "1px solid rgba(45, 55, 71, 0.4)",
                }}
                onClick={() => isPreviewable(file.fileType) && setPreviewFile(file)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.3)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(124, 58, 237, 0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(45, 55, 71, 0.4)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0 text-xl"
                    style={{ background: `linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(236, 72, 153, 0.1))` }}
                  >
                    {getFileIcon(file.fileType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{formatSize(file.fileSize)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{formatDate(file.createdAt)}</p>
                    {file.message?.sender && (
                      <p className="text-xs text-slate-500 mt-0.5">by {file.message.sender.name}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <a
                    href={file.fileUrl}
                    download={file.fileName}
                    className="btn-secondary text-xs px-3 py-1.5 no-underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Download
                  </a>
                  {isPreviewable(file.fileType) && (
                    <button
                      className="btn-primary text-xs px-3 py-1.5"
                      onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                    >
                      Preview
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMoreFiles && (
            <div className="text-center mt-8">
              <button onClick={loadMoreFiles} className="btn-secondary px-6 py-2.5">
                Load more files
              </button>
            </div>
          )}
        </>
      )}

      {/* Preview modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setPreviewFile(null)}
        >
          <div className="max-w-4xl max-h-[90vh] w-full rounded-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(28, 35, 51, 0.98)",
              border: "1px solid rgba(124, 58, 237, 0.2)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(45, 55, 71, 0.4)" }}
            >
              <h3 className="text-lg font-semibold text-white truncate">{previewFile.fileName}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {previewFile.fileType.startsWith("image/") ? (
                <img src={previewFile.fileUrl} alt={previewFile.fileName} className="max-w-full max-h-[65vh] mx-auto rounded-xl" />
              ) : previewFile.fileType === "application/pdf" ? (
                <iframe src={previewFile.fileUrl} className="w-full h-[65vh] rounded-xl" title={previewFile.fileName} />
              ) : (
                <p className="text-slate-400 text-center py-8">Preview not available</p>
              )}
            </div>
            <div className="px-6 py-4 text-center"
              style={{ borderTop: "1px solid rgba(45, 55, 71, 0.4)" }}
            >
              <a href={previewFile.fileUrl} download={previewFile.fileName}
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 no-underline"
              >
                <span>⬇</span> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
