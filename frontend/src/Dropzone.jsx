// src/DropZone.jsx
// Requires: npm install react-dropzone
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

/**
 * DropZone — replaces the standard <input type="file"> for XLSX uploads.
 *
 * Props:
 *   onFileAccepted  (file: File) => void   — called when a valid .xlsx is dropped/selected
 *   currentFile     File | null            — currently selected file (to show filename)
 */
const DropZone = ({ onFileAccepted, currentFile }) => {
  const [rejected, setRejected] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      setRejected(false);
      if (rejectedFiles.length > 0) {
        setRejected(true);
        return;
      }
      if (acceptedFiles.length > 0) {
        onFileAccepted(acceptedFiles[0]);
      }
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
    maxSize: 50 * 1024 * 1024, // 50 MB
  });

  const isError = isDragReject || rejected;

  let borderColor = '#d1d5db';
  let bg = '#fafafa';
  let textColor = '#6b7280';

  if (isDragActive && !isError) {
    borderColor = '#3b82f6';
    bg = '#eff6ff';
    textColor = '#1d4ed8';
  } else if (isError) {
    borderColor = '#ef4444';
    bg = '#fef2f2';
    textColor = '#dc2626';
  } else if (currentFile) {
    borderColor = '#22c55e';
    bg = '#f0fdf4';
    textColor = '#15803d';
  }

  return (
    <div
      {...getRootProps()}
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: '10px',
        padding: '28px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        background: bg,
        transition: 'all 0.2s ease',
        outline: 'none',
        userSelect: 'none',
      }}
    >
      <input {...getInputProps()} />

      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
        {isError ? '❌' : currentFile ? '✅' : isDragActive ? '📂' : '📊'}
      </div>

      {isError ? (
        <p style={{ color: textColor, fontWeight: 600, margin: 0 }}>
          Only <strong>.xlsx</strong> files are supported. Please try again.
        </p>
      ) : currentFile ? (
        <>
          <p style={{ color: textColor, fontWeight: 600, margin: '0 0 4px' }}>
            {currentFile.name}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: 0 }}>
            {(currentFile.size / 1024).toFixed(1)} KB — Click or drop to replace
          </p>
        </>
      ) : isDragActive ? (
        <p style={{ color: textColor, fontWeight: 600, margin: 0 }}>
          Release to upload this file…
        </p>
      ) : (
        <>
          <p style={{ color: textColor, fontWeight: 600, margin: '0 0 4px' }}>
            Drag &amp; drop your <strong>.xlsx</strong> file here
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>
            or click to browse — max 50 MB
          </p>
        </>
      )}
    </div>
  );
};

export default DropZone;