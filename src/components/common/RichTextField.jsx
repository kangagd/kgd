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
      ['bold', 'italic'],
      [{ 'list': 'bullet' }, { 'list': 'ordered' }],
      ['link'],
      ['clean']
    ]
  }), [readOnly]);

  const formats = [
    'bold', 'italic',
    'list', 'bullet',
    'link'
  ];

  return (
    <div className={`text-field-container ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563]">
            {label}
          </label>
          {helperText && (
            <span className="text-[12px] md:text-[13px] text-[#6B7280]">
              {helperText}
            </span>
          )}
        </div>
      )}
      <div className={`rich-text-wrapper ${readOnly ? 'read-only' : ''}`}>
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
        .text-field-container {
          margin-bottom: 1rem;
        }

        .rich-text-wrapper {
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          overflow: hidden;
          transition: all 200ms;
        }

        .rich-text-wrapper:focus-within {
          border-color: #111827;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }

        .rich-text-wrapper.read-only {
          background: #F8F9FA;
          border-color: #E5E7EB;
        }

        .rich-text-wrapper .ql-toolbar {
          border: 0;
          border-bottom: 1px solid #E5E7EB;
          background-color: #FAFAFA;
          padding: 6px 8px;
          display: flex;
          gap: 2px;
        }

        .rich-text-wrapper .ql-container {
          border: 0;
          font-family: inherit;
        }

        .rich-text-wrapper .ql-editor {
          padding: 10px 12px;
          font-size: 14px;
          line-height: 1.5;
          color: #111827;
          min-height: 96px;
        }

        @media (min-width: 768px) {
          .rich-text-wrapper .ql-editor {
            padding: 12px 14px;
            font-size: 15px;
            min-height: 120px;
          }
        }

        @media (max-width: 768px) {
          .rich-text-wrapper .ql-toolbar {
            overflow-x: auto;
            white-space: nowrap;
            -webkit-overflow-scrolling: touch;
          }
        }

        .rich-text-wrapper .ql-editor.ql-blank::before {
          color: #9CA3AF;
          font-style: normal;
          font-size: 14px;
        }

        @media (min-width: 768px) {
          .rich-text-wrapper .ql-editor.ql-blank::before {
            font-size: 15px;
          }
        }

        .rich-text-wrapper .ql-editor ul,
        .rich-text-wrapper .ql-editor ol {
          padding-left: 1.5em;
        }

        .rich-text-wrapper .ql-editor li {
          margin-bottom: 0.25em;
          line-height: 1.5;
        }

        .rich-text-wrapper .ql-editor p {
          line-height: 1.5;
        }

        /* Toolbar button styling - icons only */
        .rich-text-wrapper .ql-toolbar button {
          width: 28px;
          height: 28px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .rich-text-wrapper .ql-toolbar button:hover {
          background-color: #F3F4F6;
        }

        .rich-text-wrapper .ql-toolbar button.ql-active {
          background-color: #111827;
          color: white;
        }

        .rich-text-wrapper .ql-toolbar button.ql-active .ql-stroke {
          stroke: white;
        }

        .rich-text-wrapper .ql-toolbar button.ql-active .ql-fill {
          fill: white;
        }

        .rich-text-wrapper .ql-toolbar button svg {
          width: 14px;
          height: 14px;
        }

        .rich-text-wrapper .ql-toolbar .ql-stroke {
          stroke: #6B7280;
        }

        .rich-text-wrapper .ql-toolbar .ql-fill {
          fill: #6B7280;
        }

        /* Hide toolbar in read-only mode */
        .rich-text-wrapper.read-only .ql-toolbar {
          display: none;
        }

        .rich-text-wrapper.read-only .ql-editor {
          background: transparent;
          padding: 0;
          min-height: auto;
        }

        /* Remove picker labels - icons only */
        .rich-text-wrapper .ql-toolbar .ql-picker-label::before {
          content: none;
        }
      `}</style>
    </div>
  );
}