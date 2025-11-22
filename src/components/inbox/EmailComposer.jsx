import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Send, Paperclip, Bold, Italic, Underline, Link as LinkIcon, List, ListOrdered } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function EmailComposer({ mode = "compose", thread, message, onClose, onSent }) {
  const [to, setTo] = useState(mode === "reply" ? message?.from_address : "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(
    mode === "reply" ? `Re: ${thread?.subject || ""}` : 
    mode === "forward" ? `Fwd: ${thread?.subject || ""}` : ""
  );
  
  const getInitialBody = () => {
    if (mode === "reply") {
      return `\n\n<br><br>On ${new Date(message?.sent_at).toLocaleString()}, ${message?.from_name || message?.from_address} wrote:<br><blockquote style="margin-left: 10px; padding-left: 10px; border-left: 2px solid #ccc;">${message?.body_html || message?.body_text}</blockquote>`;
    }
    if (mode === "forward") {
      return `\n\n<br><br>---------- Forwarded message ----------<br>From: ${message?.from_name || message?.from_address}<br>Date: ${new Date(message?.sent_at).toLocaleString()}<br>Subject: ${message?.subject}<br><br>${message?.body_html || message?.body_text}`;
    }
    return "";
  };
  
  const [body, setBody] = useState(getInitialBody());
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = await Promise.all(
      files.map(async (file) => {
        const reader = new FileReader();
        return new Promise((resolve) => {
          reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            resolve({
              filename: file.name,
              mimeType: file.type,
              data: base64Data,
              size: file.size
            });
          };
          reader.readAsDataURL(file);
        });
      })
    );
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const insertFormatting = (tag) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    
    let formattedText = "";
    switch(tag) {
      case "bold":
        formattedText = `<strong>${selectedText}</strong>`;
        break;
      case "italic":
        formattedText = `<em>${selectedText}</em>`;
        break;
      case "underline":
        formattedText = `<u>${selectedText}</u>`;
        break;
      case "link":
        const url = prompt("Enter URL:");
        if (url) formattedText = `<a href="${url}">${selectedText || url}</a>`;
        break;
      case "ul":
        formattedText = `<ul><li>${selectedText}</li></ul>`;
        break;
      case "ol":
        formattedText = `<ol><li>${selectedText}</li></ol>`;
        break;
      default:
        formattedText = selectedText;
    }
    
    const newBody = body.substring(0, start) + formattedText + body.substring(end);
    setBody(newBody);
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSending(true);
    try {
      await base44.functions.invoke('gmailSendEmail', {
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        body,
        threadId: mode === "reply" ? thread?.id : undefined,
        inReplyTo: mode === "reply" ? message?.message_id : undefined,
        references: mode === "reply" ? message?.message_id : undefined,
        attachments: attachments.length > 0 ? attachments : undefined
      });

      toast.success("Email sent successfully");
      if (onSent) onSent();
      onClose();
    } catch (error) {
      toast.error(`Failed to send email: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="border-2 border-[#FAE008] shadow-lg">
      <CardHeader className="bg-[#FAE008]/10 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[18px] font-semibold">
            {mode === "compose" && "New Email"}
            {mode === "reply" && "Reply"}
            {mode === "forward" && "Forward"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[14px] font-medium w-12">To:</label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              disabled={mode === "reply"}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCc(!showCc)}
              className="text-[12px]"
            >
              Cc
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBcc(!showBcc)}
              className="text-[12px]"
            >
              Bcc
            </Button>
          </div>

          {showCc && (
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-medium w-12">Cc:</label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1"
              />
            </div>
          )}

          {showBcc && (
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-medium w-12">Bcc:</label>
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
                className="flex-1"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-[14px] font-medium w-12">Subject:</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1 border-b border-[#E5E7EB] pb-2">
            <Button variant="ghost" size="icon" onClick={() => insertFormatting("bold")} title="Bold">
              <Bold className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => insertFormatting("italic")} title="Italic">
              <Italic className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => insertFormatting("underline")} title="Underline">
              <Underline className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => insertFormatting("link")} title="Insert Link">
              <LinkIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => insertFormatting("ul")} title="Bullet List">
              <List className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => insertFormatting("ol")} title="Numbered List">
              <ListOrdered className="w-4 h-4" />
            </Button>
            <div className="flex-1" />
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

          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Compose your email..."
            className="min-h-[250px] font-sans"
          />
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[#4B5563]">Attachments:</label>
            <div className="space-y-1">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#F3F4F6] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-[13px] text-[#111827]">{att.filename}</span>
                    <span className="text-[12px] text-[#6B7280]">
                      ({(att.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttachment(idx)}
                    className="h-6 w-6"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
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