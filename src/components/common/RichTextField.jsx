import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function RichTextField({ 
  label, 
  value, 
  onChange, 
  onBlur, 
  placeholder,
  helperText,
  readOnly = false,
  className = "" 
}) {
  const modules = useMemo(() => ({
    toolbar: readOnly ? false : [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  }), [readOnly]);

  const formats = [
    'bold', 'italic', 'underline',
    'list', 'bullet'
  ];

  return (
    <div className={`rich-text-field-container ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="text-[14px] md:text-[15px] font-semibold text-[#111827]">
            {label}
          </label>
          {helperText && (
            <span className="text-[12px] text-[#6B7280]">
              {helperText}
            </span>
          )}
        </div>
      )}
      <div className={`rich-text-field-wrapper ${readOnly ? 'read-only' : ''}`}>
        <ReactQuill
          theme="snow"
          value={value || ''}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          modules={modules}
          formats={formats}
          readOnly={readOnly}
        />
      </div>
      <style jsx global>{`
        .rich-text-field-container {
          margin-bottom: 1rem;
        }

        .rich-text-field-wrapper {
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          overflow: hidden;
          transition: all 200ms;
        }

        .rich-text-field-wrapper:focus-within {
          border-color: #111827;
          box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.05);
        }

        .rich-text-field-wrapper.read-only {
          background: #F8F9FA;
          border-color: #E5E7EB;
        }

        .rich-text-field-wrapper .ql-toolbar {
          border: 0;
          border-bottom: 1px solid #E5E7EB;
          background-color: #F8F9FA;
          padding: 8px 12px;
        }

        .rich-text-field-wrapper .ql-container {
          border: 0;
          font-family: inherit;
        }

        .rich-text-field-wrapper .ql-editor {
          padding: 12px 14px;
          font-size: 14px;
          line-height: 1.5;
          color: #111827;
          min-height: 120px;
        }

        @media (max-width: 768px) {
          .rich-text-field-wrapper .ql-editor {
            min-height: 100px;
            padding: 10px 12px;
          }
          
          .rich-text-field-wrapper .ql-toolbar {
            overflow-x: auto;
            white-space: nowrap;
          }
        }

        .rich-text-field-wrapper .ql-editor.ql-blank::before {
          color: #9CA3AF;
          font-style: normal;
          font-size: 14px;
        }

        .rich-text-field-wrapper .ql-editor ul,
        .rich-text-field-wrapper .ql-editor ol {
          padding-left: 1.5em;
        }

        .rich-text-field-wrapper .ql-editor li {
          margin-bottom: 0.25em;
        }

        .rich-text-field-wrapper .ql-toolbar button {
          width: 32px;
          height: 32px;
          padding: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .rich-text-field-wrapper .ql-toolbar button:hover {
          background-color: #E5E7EB;
          border-radius: 4px;
        }

        .rich-text-field-wrapper .ql-toolbar button.ql-active {
          background-color: #111827;
          color: white;
          border-radius: 4px;
        }

        .rich-text-field-wrapper .ql-toolbar button svg {
          width: 16px;
          height: 16px;
        }

        .rich-text-field-wrapper.read-only .ql-toolbar {
          display: none;
        }

        .rich-text-field-wrapper.read-only .ql-editor {
          background: transparent;
          padding: 0;
          min-height: auto;
        }
      `}</style>
    </div>
  );
}