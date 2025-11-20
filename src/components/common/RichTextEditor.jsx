import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function RichTextEditor({ value, onChange, onBlur, placeholder, className = "" }) {
  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  }), []);

  const formats = [
    'bold', 'italic', 'underline',
    'list', 'bullet'
  ];

  return (
    <ReactQuill
      theme="snow"
      value={value || ''}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      modules={modules}
      formats={formats}
      className={`rich-text-editor ${className}`}
    />
  );
}