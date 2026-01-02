import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Send, Paperclip, Save, User } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import debounce from "lodash/debounce";
import ReactQuill from "react-quill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { renderTemplate, buildTemplateContext } from "@/components/utils/templateHelpers";

const sanitizeBodyHtml = (html) => {
  if (!html) return html;
  
  let sanitized = html;
  
  // Remove outer HTML document wrappers
  sanitized = sanitized.replace(/<\!DOCTYPE[^>]*>/gi, '');
  sanitized = sanitized.replace(/<html[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/html>/gi, '');
  sanitized = sanitized.replace(/<head[^>]*>.*?<\/head>/gis, '');
  sanitized = sanitized.replace(/<meta[^>]*>/gi, '');
  
  // Extract body content if wrapped in <body> tags
  const bodyMatch = sanitized.match(/<body[^>]*>(.*?)<\/body>/is);
  if (bodyMatch) {
    sanitized = bodyMatch[1];
  }
  
  // Remove dangerous elements
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*>.*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*>/gi, '');
  sanitized = sanitized.replace(/<form[^>]*>.*?<\/form>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  return sanitized.trim();
};

export default function EmailComposer({ mode = "compose", thread, message, onClose, onSent, onDraftSaved, existingDraft = null, projectId = null, jobId = null, defaultTo = null }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [to, setTo] = useState(existingDraft?.to_addresses?.join(', ') || existingDraft?.to || (mode === "reply" ? message?.from_address : (defaultTo || "")));
  const [toSearchTerm, setToSearchTerm] = useState("");
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [cc, setCc] = useState(existingDraft?.cc_addresses?.join(', ') || existingDraft?.cc || "");
  const [bcc, setBcc] = useState(existingDraft?.bcc_addresses?.join(', ') || existingDraft?.bcc || "");
  const [subject, setSubject] = useState(
    existingDraft?.subject || 
    (mode === "reply" ? `Re: ${thread?.subject || ""}` : 
    mode === "forward" ? `Fwd: ${thread?.subject || ""}` : "")
  );

  // Load current user for signature
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);
  
  const getSignature = () => {
    if (!currentUser?.email_signature) return '';
    return `<br><br><div style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">${currentUser.email_signature}</div>`;
  };

  const getInitialBody = () => {
    const signature = getSignature();
    
    if (mode === "reply") {
      // Get the original message content
      let quotedContent = "";
      if (message?.body_html) {
        // Sanitize and strip outer HTML wrappers
        quotedContent = sanitizeBodyHtml(message.body_html);
      } else if (message?.body_text) {
        // Convert plain text to HTML
        quotedContent = message.body_text.replace(/\n/g, '<br>');
      }
      
      // Format date in Gmail style
      const dateStr = message?.sent_at 
        ? format(parseISO(message.sent_at), "d/M/yyyy 'at' HH:mm")
        : new Date().toLocaleString();
      
      const sender = message?.from_name || message?.from_address;
      
      // Gmail-style quote block with signature before the quote
      return `${signature}<br><br><div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;"><div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">On ${dateStr}, ${sender} wrote:</div><blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #d1d5db; color: #4b5563;">${quotedContent}</blockquote></div>`;
    }
    if (mode === "forward") {
      let forwardedContent = "";
      if (message?.body_html) {
        forwardedContent = sanitizeBodyHtml(message.body_html);
      } else if (message?.body_text) {
        forwardedContent = message.body_text.replace(/\n/g, '<br>');
      }
      
      const dateStr = message?.sent_at 
        ? format(parseISO(message.sent_at), "d/M/yyyy 'at' HH:mm")
        : new Date().toLocaleString();
      
      return `${signature}<br><br><div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;"><div style="color: #6b7280; font-size: 13px; font-weight: 600; margin-bottom: 8px;">---------- Forwarded message ----------</div><div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;"><strong>From:</strong> ${message?.from_name || message?.from_address}<br><strong>Date:</strong> ${dateStr}<br><strong>Subject:</strong> ${message?.subject}</div><div style="margin-top: 12px;">${forwardedContent}</div></div>`;
    }
    return signature;
  };
  
  const [body, setBody] = useState(() => {
    // If there's an existing draft, use it as-is (already has signature)
    if (existingDraft?.body_html || existingDraft?.body) {
      return existingDraft.body_html || existingDraft.body;
    }
    return "";
  });
  
  // Set initial body with signature once user is loaded (for new emails only)
  useEffect(() => {
    if (currentUser && !existingDraft && !body) {
      const initialBody = getInitialBody();
      setBody(initialBody);
    }
  }, [currentUser, mode, message, thread]);
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [showCc, setShowCc] = useState(!!(existingDraft?.cc_addresses?.length || existingDraft?.cc));
  const [showBcc, setShowBcc] = useState(!!(existingDraft?.bcc_addresses?.length || existingDraft?.bcc));
  const [draftId, setDraftId] = useState(existingDraft?.id || null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const toInputRef = useRef(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Fetch customers for email autocomplete
  const { data: customers = [] } = useQuery({
    queryKey: ['customersForEmail'],
    queryFn: () => base44.entities.Customer.filter({ status: 'active' }),
    staleTime: 60000
  });

  // Fetch email templates
  const { data: templates = [] } = useQuery({
    queryKey: ['messageTemplates', 'email'],
    queryFn: () => base44.entities.MessageTemplate.filter({ channel: 'email', active: true }),
    staleTime: 120000
  });

  // Fetch context entities for template rendering
  const { data: linkedProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.get(projectId),
    enabled: !!projectId
  });

  const { data: linkedJob } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => base44.entities.Job.get(jobId),
    enabled: !!jobId
  });

  const handleApplyTemplate = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Build context
    const context = buildTemplateContext({
      project: linkedProject,
      job: linkedJob,
      customer: customers.find(c => c.email === to)
    });

    // Render template
    const rendered = renderTemplate(template, context);
    
    // Apply to form
    if (rendered.subject && !subject) {
      setSubject(rendered.subject);
    }
    if (rendered.body) {
      setBody(rendered.body);
    }

    setSelectedTemplate("");
    toast.success(`Template "${template.name}" applied`);
  };

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer => {
    if (!toSearchTerm || toSearchTerm.length < 2) return false;
    const searchLower = toSearchTerm.toLowerCase();
    return (
      customer.email?.toLowerCase().includes(searchLower) ||
      customer.name?.toLowerCase().includes(searchLower)
    );
  }).slice(0, 8);

  const handleToInputChange = (e) => {
    const value = e.target.value;
    setTo(value);
    setToSearchTerm(value);
    setShowToDropdown(value.length >= 2);
  };

  const handleSelectCustomer = (customer) => {
    setTo(customer.email);
    setToSearchTerm("");
    setShowToDropdown(false);
  };

  // Auto-save draft function
  const saveDraft = useCallback(async (draftData) => {
    // Don't save empty drafts
    if (!draftData.to && !draftData.subject && !draftData.body) return;
    
    setIsSavingDraft(true);
    try {
      const draft = {
        to_addresses: draftData.to ? draftData.to.split(',').map(e => e.trim()).filter(Boolean) : [],
        cc_addresses: draftData.cc ? draftData.cc.split(',').map(e => e.trim()).filter(Boolean) : [],
        bcc_addresses: draftData.bcc ? draftData.bcc.split(',').map(e => e.trim()).filter(Boolean) : [],
        subject: draftData.subject,
        body_html: draftData.body,
        thread_id: thread?.id || null,
        reply_to_message_id: message?.message_id || null,
        mode: mode
      };

      if (draftId) {
        await base44.entities.EmailDraft.update(draftId, draft);
      } else {
        const newDraft = await base44.entities.EmailDraft.create(draft);
        setDraftId(newDraft.id);
      }
      setLastSaved(new Date());
      if (onDraftSaved) onDraftSaved();
    } catch (error) {
      console.error("Failed to save draft:", error);
    } finally {
      setIsSavingDraft(false);
    }
  }, [draftId, thread?.id, message?.message_id, mode, onDraftSaved]);

  // Debounced auto-save (save after 2 seconds of inactivity)
  const debouncedSave = useCallback(
    debounce((data) => saveDraft(data), 2000),
    [saveDraft]
  );

  // Auto-save when content changes
  useEffect(() => {
    debouncedSave({ to, cc, bcc, subject, body });
    return () => debouncedSave.cancel();
  }, [to, cc, bcc, subject, body, debouncedSave]);

  // Delete draft on successful send
  const deleteDraft = async () => {
    if (draftId) {
      try {
        await base44.entities.EmailDraft.delete(draftId);
      } catch (error) {
        console.error("Failed to delete draft:", error);
      }
    }
  };

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
        attachments: attachments.length > 0 ? attachments : undefined,
        projectId: projectId || thread?.linked_project_id || undefined,
        jobId: jobId || thread?.linked_job_id || undefined
      });

      toast.success("Email sent successfully");
      await deleteDraft();
      if (onSent) {
        await onSent();
      }
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
                <div className="flex-1 relative">
                  <Input
                    ref={toInputRef}
                    value={to}
                    onChange={handleToInputChange}
                    onFocus={() => toSearchTerm.length >= 2 && setShowToDropdown(true)}
                    onBlur={() => setTimeout(() => setShowToDropdown(false), 200)}
                    placeholder="recipient@example.com"
                    disabled={mode === "reply"}
                  />
                  {showToDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto">
                      {filteredCustomers.map(customer => (
                        <div
                          key={customer.id}
                          onClick={() => handleSelectCustomer(customer)}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-[#F3F4F6] cursor-pointer"
                        >
                          <User className="w-4 h-4 text-[#6B7280]" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-[#111827] truncate">{customer.name}</div>
                            <div className="text-[12px] text-[#6B7280] truncate">{customer.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

          {templates.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-medium w-12">Template:</label>
              <Select value={selectedTemplate} onValueChange={handleApplyTemplate}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Use template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1 border-b border-[#E5E7EB] pb-2">
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

          <ReactQuill
            theme="snow"
            value={body}
            onChange={setBody}
            placeholder="Write your message here..."
            className="bg-white rounded-lg [&_.ql-container]:min-h-[200px] [&_.ql-editor]:min-h-[200px]"
            modules={{
              toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'indent': '-1'}, { 'indent': '+1' }],
                ['link'],
                ['clean']
              ]
            }}
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

        <div className="flex items-center justify-between pt-2">
          <div className="text-[12px] text-[#9CA3AF] flex items-center gap-1">
            {isSavingDraft && (
              <>
                <Save className="w-3 h-3 animate-pulse" />
                Saving...
              </>
            )}
            {!isSavingDraft && lastSaved && (
              <>
                <Save className="w-3 h-3" />
                Draft saved
              </>
            )}
          </div>
          <div className="flex gap-2">
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
        </div>
      </CardContent>
    </Card>
  );
}