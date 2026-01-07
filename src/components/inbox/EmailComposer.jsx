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
import { sanitizeForCompose } from "@/components/utils/emailSanitization";

export default function EmailComposer({ mode = "compose", thread, message, onClose, onSent, onDraftSaved, existingDraft = null, projectId = null, jobId = null, defaultTo = null }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isReplyAll, setIsReplyAll] = useState(false);
  const [showOriginalMessage, setShowOriginalMessage] = useState(false);
  
  // A) Enforce reply contract: validate required props
  const isReplyMode = mode === "reply";
  const hasValidThreadContext = thread?.id && thread?.gmail_thread_id && message?.message_id;
  const isReplyContextMissing = isReplyMode && !hasValidThreadContext;
  
  // Smart recipient calculation for replies
  const getReplyRecipients = (replyAll = false) => {
    if (mode !== "reply" || !message) return { to: defaultTo || "", cc: "" };
    
    const userEmail = currentUser?.email?.toLowerCase();
    const fromAddress = message.from_address;
    const toAddresses = message.to_addresses || [];
    const ccAddresses = message.cc_addresses || [];
    
    // If we sent the original message, reply to the first recipient
    if (fromAddress?.toLowerCase() === userEmail) {
      return {
        to: toAddresses[0] || "",
        cc: replyAll ? [...toAddresses.slice(1), ...ccAddresses].filter(e => e.toLowerCase() !== userEmail).join(', ') : ""
      };
    }
    
    // Reply to sender
    const replyTo = fromAddress;
    
    if (replyAll) {
      // Include all recipients except ourselves
      const allRecipients = [...toAddresses, ...ccAddresses]
        .filter(e => e.toLowerCase() !== userEmail && e.toLowerCase() !== fromAddress?.toLowerCase());
      return {
        to: replyTo,
        cc: allRecipients.join(', ')
      };
    }
    
    return { to: replyTo, cc: "" };
  };
  
  const initialRecipients = existingDraft ? {
    to: existingDraft?.to_addresses?.join(', ') || existingDraft?.to || "",
    cc: existingDraft?.cc_addresses?.join(', ') || existingDraft?.cc || ""
  } : getReplyRecipients(false);
  
  const [to, setTo] = useState(initialRecipients.to);
  const [toSearchTerm, setToSearchTerm] = useState("");
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [cc, setCc] = useState(initialRecipients.cc);
  const [bcc, setBcc] = useState(existingDraft?.bcc_addresses?.join(', ') || existingDraft?.bcc || "");
  
  const getInitialSubject = () => {
    if (existingDraft?.subject) return existingDraft.subject;
    if (mode === "reply") {
      const threadSubject = thread?.subject || "";
      const cleanSubject = threadSubject.replace(/^Re:\s*/i, '');
      return cleanSubject ? `Re: ${cleanSubject}` : "";
    }
    if (mode === "forward") return `Fwd: ${thread?.subject || ""}`;
    return "";
  };
  
  const [subject, setSubject] = useState(getInitialSubject());

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
  
  // Handle reply all toggle
  const handleToggleReplyAll = () => {
    const newReplyAll = !isReplyAll;
    setIsReplyAll(newReplyAll);
    const recipients = getReplyRecipients(newReplyAll);
    setTo(recipients.to);
    setCc(recipients.cc);
    if (recipients.cc) setShowCc(true);
  };
  
  const getSignature = () => {
    if (!currentUser?.email_signature) return '';
    return `<br><br><div style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">${currentUser.email_signature}</div>`;
  };

  const getInitialBody = () => {
    const signature = getSignature();
    
    if (mode === "reply") {
      let quotedContent = "";
      if (message?.body_html) {
        quotedContent = sanitizeForCompose(message.body_html);
      } else if (message?.body_text) {
        quotedContent = message.body_text.replace(/\n/g, '<br>');
      }
      
      const dateStr = message?.sent_at 
        ? format(parseISO(message.sent_at), "d/M/yyyy 'at' HH:mm")
        : new Date().toLocaleString();
      
      const sender = message?.from_name || message?.from_address;
      
      return `${signature}<br><br><div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;"><div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">On ${dateStr}, ${sender} wrote:</div><blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #d1d5db; color: #4b5563;">${quotedContent}</blockquote></div>`;
    }
    if (mode === "forward") {
      let forwardedContent = "";
      if (message?.body_html) {
        forwardedContent = sanitizeForCompose(message.body_html);
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
    if (existingDraft?.body_html || existingDraft?.body) {
      return existingDraft.body_html || existingDraft.body;
    }
    return "";
  });
  
  const [initialBodySet, setInitialBodySet] = useState(false);
  
  useEffect(() => {
    if (currentUser && !existingDraft && !initialBodySet) {
      const initialBody = getInitialBody();
      setBody(initialBody);
      setInitialBodySet(true);
    }
  }, [currentUser, mode, message, thread, existingDraft, initialBodySet]);
  
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

  const { data: customers = [] } = useQuery({
    queryKey: ['customersForEmail'],
    queryFn: () => base44.entities.Customer.filter({ status: 'active' }),
    staleTime: 60000
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['messageTemplates', 'email'],
    queryFn: () => base44.entities.MessageTemplate.filter({ channel: 'email', active: true }),
    staleTime: 120000
  });

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

    const context = buildTemplateContext({
      project: linkedProject,
      job: linkedJob,
      customer: customers.find(c => c.email === to)
    });

    const rendered = renderTemplate(template, context);
    
    if (rendered.subject && !subject) {
      setSubject(rendered.subject);
    }
    if (rendered.body) {
      setBody(rendered.body);
    }

    setSelectedTemplate("");
    toast.success(`Template "${template.name}" applied`);
  };

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

  const saveDraft = useCallback(async (draftData) => {
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

  const debouncedSave = useCallback(
    debounce((data) => saveDraft(data), 2000),
    [saveDraft]
  );

  useEffect(() => {
    debouncedSave({ to, cc, bcc, subject, body });
    return () => debouncedSave.cancel();
  }, [to, cc, bcc, subject, body, debouncedSave]);

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
    
    if (isReplyContextMissing) {
      toast.error("Cannot reply — thread context missing");
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        body,
        attachments: attachments.length > 0 ? attachments : undefined,
        projectId: projectId || thread?.project_id || undefined,
        jobId: jobId || thread?.linked_job_id || undefined
      };
      
      // Pass separate Base44 and Gmail thread IDs for replies
      if (mode === "reply" && thread?.id && thread?.gmail_thread_id && message?.message_id) {
        payload.base44_thread_id = thread.id;
        payload.gmail_thread_id = thread.gmail_thread_id;
        payload.inReplyTo = message.message_id;
        
        // Build references chain from existing references
        const existingReferences = message.in_reply_to 
          ? (message.references ? `${message.references} ${message.in_reply_to}` : message.in_reply_to)
          : (message.references || '');
        
        payload.references = existingReferences;
      }
      
      const response = await base44.functions.invoke('gmailSendEmail', payload);

      toast.success("Email sent successfully");
      await deleteDraft();
      
      // Pass threadId back to parent for cache invalidation
      if (onSent) {
        await onSent(response.data?.threadId);
      }
      onClose();
    } catch (error) {
      toast.error(`Failed to send email: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="border-2 border-[#FAE008] shadow-lg flex flex-col max-h-[90vh]">
      <CardHeader className="bg-[#FAE008]/10 border-b border-[#E5E7EB] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-[18px] font-semibold">
              {mode === "compose" && "New Email"}
              {mode === "reply" && (isReplyAll ? "Reply All" : "Reply")}
              {mode === "forward" && "Forward"}
            </CardTitle>
            {mode === "reply" && !existingDraft && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleReplyAll}
                className="h-7 text-[12px]"
              >
                {isReplyAll ? "Reply to Sender Only" : "Reply All"}
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
                <label className="text-[13px] font-semibold text-[#4B5563] w-12 flex-shrink-0">To:</label>
                <div className="flex-1 relative">
                  <Input
                    ref={toInputRef}
                    value={to}
                    onChange={handleToInputChange}
                    onFocus={() => toSearchTerm.length >= 2 && setShowToDropdown(true)}
                    onBlur={() => setTimeout(() => setShowToDropdown(false), 200)}
                    placeholder="recipient@example.com"
                    className="text-[14px]"
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
              <label className="text-[13px] font-semibold text-[#4B5563] w-12 flex-shrink-0">Cc:</label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1 text-[14px]"
              />
            </div>
          )}

          {showBcc && (
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-semibold text-[#4B5563] w-12 flex-shrink-0">Bcc:</label>
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
                className="flex-1 text-[14px]"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-[13px] font-semibold text-[#4B5563] w-12 flex-shrink-0">Subject:</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="flex-1 text-[14px] font-medium"
            />
          </div>

          {templates.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-semibold text-[#4B5563] w-12 flex-shrink-0">Template:</label>
              <Select value={selectedTemplate} onValueChange={handleApplyTemplate}>
                <SelectTrigger className="flex-1 text-[14px]">
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

        {(mode === "reply" || mode === "forward") && message && (
          <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
            <button
              onClick={() => setShowOriginalMessage(!showOriginalMessage)}
              className="w-full flex items-center justify-between p-3 bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[#6B7280]">
                  Original message from {message.from_name || message.from_address}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">
                  {message.sent_at ? format(parseISO(message.sent_at), "MMM d, yyyy") : ""}
                </span>
              </div>
              <div className={`text-[#6B7280] transform transition-transform ${showOriginalMessage ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </button>
            {showOriginalMessage && (
              <div className="p-4 bg-white border-t border-[#E5E7EB] max-h-[300px] overflow-y-auto">
                <div className="text-[12px] text-[#6B7280] mb-2">
                  <strong>From:</strong> {message.from_name || message.from_address}
                  <br />
                  <strong>Date:</strong> {message.sent_at ? format(parseISO(message.sent_at), "PPpp") : ""}
                  <br />
                  <strong>Subject:</strong> {message.subject}
                </div>
                <div 
                  className="text-[13px] text-[#111827] prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: message.body_html || message.body_text?.replace(/\n/g, '<br>') || '' }}
                />
              </div>
            )}
          </div>
        )}

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
          <div className="space-y-2 bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
            <div className="flex items-center gap-2 mb-2">
              <Paperclip className="w-4 h-4 text-[#6B7280]" />
              <label className="text-[13px] font-semibold text-[#4B5563]">{attachments.length} Attachment{attachments.length !== 1 ? 's' : ''}</label>
            </div>
            <div className="space-y-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-[#E5E7EB] hover:border-[#D1D5DB] transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Paperclip className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-[#111827] block truncate">{att.filename}</span>
                      <span className="text-[11px] text-[#9CA3AF]">
                        {(att.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttachment(idx)}
                    className="h-8 w-8 flex-shrink-0 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isReplyContextMissing && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[13px] text-red-700">
            <strong>Cannot reply:</strong> Thread context missing. Please ensure the original email is properly loaded.
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
          <div className="text-[12px] text-[#9CA3AF] flex items-center gap-1.5">
            {isSavingDraft && (
              <>
                <div className="w-3 h-3 border-2 border-[#FAE008] border-t-transparent rounded-full animate-spin" />
                <span>Saving draft...</span>
              </>
            )}
            {!isSavingDraft && lastSaved && (
              <>
                <Save className="w-3 h-3 text-green-600" />
                <span className="text-green-600">Draft saved</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="min-w-[80px]">
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !to || !subject || !body || isReplyContextMissing}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] gap-2 min-w-[100px] font-semibold"
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