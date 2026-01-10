import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Send, Paperclip } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import debounce from "lodash/debounce";
import ReactQuill from "react-quill";
import { sanitizeForCompose } from "@/components/utils/emailSanitization";

export default function SharedComposer({ 
  mode = "reply", 
  thread, 
  message, 
  currentUser,
  onClose, 
  onSent 
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (thread && mode === 'reply') {
      setSubject(thread.subject?.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`);
      if (message) {
        setTo(message.from_address);
      }
    }
  }, [thread, message, mode]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = await Promise.all(
      files.map(async (file) => {
        const reader = new FileReader();
        return new Promise((resolve) => {
          reader.onload = () => {
            resolve({
              filename: file.name,
              mimeType: file.type,
              data: reader.result.split(',')[1],
              size: file.size
            });
          };
          reader.readAsDataURL(file);
        });
      })
    );
    setAttachments([...attachments, ...newAttachments]);
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSending(true);
    try {
      const response = await base44.functions.invoke('gmailSendEmail', {
        to,
        cc: cc || undefined,
        subject,
        body_html: body,
        attachments: attachments.length > 0 ? attachments : undefined,
        gmail_thread_id: thread?.gmail_thread_id,
        reply_to_gmail_message_id: message?.gmail_message_id,
        references: message?.references || message?.in_reply_to
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to send email');
      }

      toast.success("Email sent successfully");
      if (onSent) {
        await onSent(response.data?.baseThreadId);
      }
      onClose();
    } catch (error) {
      toast.error(`Failed to send: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="border-2 border-[#FAE008] shadow-lg">
      <CardHeader className="bg-[#FAE008]/10 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[16px] font-semibold">
              {mode === "reply" ? "Reply" : "New Email"}
            </CardTitle>
            <p className="text-[12px] text-[#6B7280] mt-1">
              Sent from admin@kangaroogd.com.au by {currentUser?.full_name}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Recipients */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[13px] font-semibold text-[#4B5563] w-10 flex-shrink-0">To:</label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 text-[14px]"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCc(!showCc)}
              className="text-[12px]"
            >
              Cc
            </Button>
          </div>

          {showCc && (
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-semibold text-[#4B5563] w-10 flex-shrink-0">Cc:</label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1 text-[14px]"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-[13px] font-semibold text-[#4B5563] w-10 flex-shrink-0">Subject:</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="flex-1 text-[14px]"
            />
          </div>
        </div>

        {/* Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
            <div />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Paperclip className="w-4 h-4" />
              Attach
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <ReactQuill
            theme="snow"
            value={body}
            onChange={setBody}
            placeholder="Write your reply..."
            className="bg-white rounded-lg [&_.ql-container]:min-h-[150px] [&_.ql-editor]:min-h-[150px]"
            modules={{
              toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link']
              ]
            }}
          />
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2 bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
            <p className="text-[12px] font-semibold text-[#4B5563]">{attachments.length} Attachment{attachments.length !== 1 ? 's' : ''}</p>
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center justify-between text-[13px] bg-white p-2 rounded border border-[#E5E7EB]">
                <span className="truncate">{att.filename}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                  className="h-6 w-6"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !to || !subject || !body}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] gap-2"
          >
            <Send className="w-4 h-4" />
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}