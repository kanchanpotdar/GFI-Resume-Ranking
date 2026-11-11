"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react";
import { CandidateRecord } from "@/lib/types";

interface ResumeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCandidateUploaded: (candidate: CandidateRecord, file?: File | null) => void;
  onViewCandidate: (candidate: CandidateRecord) => void;
}

export function ResumeUploadModal({
  isOpen,
  onClose,
  onCandidateUploaded,
  onViewCandidate,
}: ResumeUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ candidate: CandidateRecord; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    setDuplicateInfo(null);
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setError("Only .pdf and .docx resume formats are supported.");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File exceeds the maximum allowable size limit of 5MB.");
      return;
    }
    setFile(selectedFile);
  };

  const handleSubmit = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setDuplicateInfo(null);
    setUploadStatus("Uploading & extracting structured resume text...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setUploadStatus("Generating BGE-small dense embeddings & evaluating scores...");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process resume");
      }

      if (data.isDuplicate) {
        setDuplicateInfo({
          candidate: data.candidate,
          message: data.message || "This exact resume already exists in the system.",
        });
        setIsUploading(false);
        return;
      }

      if (data.success && data.candidate) {
        setUploadStatus("Successfully processed and ranked!");
        setTimeout(() => {
          onCandidateUploaded(data.candidate, file);
          setIsUploading(false);
          setFile(null);
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during resume processing.");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Upload New Candidate Resume</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live ingest .docx or .pdf to extract, embed, and rank in real time.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Body */}
        <div className="mt-5 space-y-4">
          
          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-emerald-500 bg-emerald-50/50"
                : file
                ? "border-emerald-400 bg-slate-50"
                : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-slate-900 max-w-xs truncate">{file.name}</span>
                <span className="text-xs text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</span>
                <span className="text-xs text-emerald-600 font-medium mt-2">Click or drag another file to replace</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mb-2">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-slate-800">
                  Drag and drop your resume here, or <span className="text-emerald-700 underline">browse</span>
                </span>
                <span className="text-xs text-slate-400 mt-1">Supports DOCX and PDF (Max 5MB)</span>
              </div>
            )}
          </div>

          {/* Upload Progress Status */}
          {isUploading && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
              <span className="text-xs text-slate-700 font-medium">{uploadStatus}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Duplicate Detection Alert */}
          {duplicateInfo && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Duplicate Resume Detected
              </div>
              <p>{duplicateInfo.message}</p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onViewCandidate(duplicateInfo.candidate);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-xs transition-colors"
                >
                  View Existing Candidate Record
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || isUploading}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isUploading ? "Processing..." : "Process & Rank Candidate"}
          </button>
        </div>

      </div>
    </div>
  );
}
