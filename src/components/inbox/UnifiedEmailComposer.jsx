import React, { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import debounce from "lodash/debounce";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

// UI Components
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ReactQuill from "react-quill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Send, Paperclip, Save, Check, ChevronUp, ChevronDown, User, Loader2 } from "lucide-react";

// Utilities
import { renderTemplate, buildTemplateContext } from "@/components/utils/templateHelpers";
import { sanitizeForCompose } from "@/components/utils/emailSanitization";
import { showSyncToast } from "@/components/utils/emailSyncToast";
import SmartComposeHelper, { SmartComposeSuggestionUI } from "./SmartComposeHelper";

// ============================================================================
// Signature Marker & Helpers (Private)
// ============================================================================

const SIGNATURE_MARKER = "<!--kgd_signature-->";

/**
 * Check if a string is non-empty (not null, not "", not whitespace-only)
 */
function isNonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

/**
 * Check if HTML is empty after stripping tags
 */
function isEmptyHtml(html) {
  if (!html) return true;
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  return stripped.length === 0;
}

/**
 * Check if message body is empty-ish
 */
function isEmptyBody(html) {
  return !isNonEmptyString(html) || isEmptyHtml(html);
}

/**
 * Build signature HTML with marker
 */
function buildSignatureHtml(signatureText) {
  if (!signatureText || !isNonEmptyString(signatureText)) return "";
  return `${SIGNATURE_MARKER}<div style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">${signatureText}</div>`;
}

/**
 * Ensure signature is inserted deterministically
 * - If html already contains marker → return as-is
 * - If html is empty → return signature only
 * - Otherwise append signature with spacing
 */
function ensureSignature(html, signatureHtml) {
  if (!signatureHtml) return html || "";
  
  // Already has signature marker
  if ((html || "").includes(SIGNATURE_MARKER)) {
    return html;
  }
  
  // Empty body → add signature
  if (isEmptyBody(html)) {
    return signatureHtml;
  }
  
  // Append signature with spacing
  return html + "<br><br>" + signatureHtml;
}

export default function UnifiedEmailComposer({
  // Presentation
  variant = "inline",
  open = true,
  onOpenChange = null,

  // Content
  mode = "compose",
  thread = null,
  message = null,
  existingDraft = null,
  defaultTo = null,
  linkTarget = null,
  autoOpenAttachments = false,

  // Callbacks
  onClose = () => {},
  onSent = null,
  onDraftSaved = null,
}) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [isReplyAll, setIsReplyAll] = useState(false);
  const [showOriginalMessage, setShowOriginalMessage] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(message || null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // State: Recipients (chip-style array)
  const [toChips, setToChips] = useState([]);
  const [toInput, setToInput] = useState("");
  const [ccChips, setCcChips] = useState([]);
  const [ccInput, setCcInput] = useState("");
  const [bccChips, setBccChips] = useState([]);
  const [bccInput, setBccInput] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  // State: Content
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // State: Draft & Sending
  const [draftId, setDraftId] = useState(existingDraft?.id || null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const toInputRef = useRef(null);
  const unmountedRef = useRef(false);
  const composeInitializedRef = useRef(false);

  // Load user with reliable signature field handling
  useEffect(() => {
    const loadUser = async () => {
      try {
        const authUser = await base44.auth.me();
        if (!authUser) return;

        let fullUser = null;
        
        // Try to get full user by ID first
        if (authUser.id) {
          try {
            fullUser = await base44.entities.User.get(authUser.id);
          } catch (err) {
            // Fall back to filter by email
            const users = await base44.entities.User.filter({ email: authUser.email });
            fullUser = users[0] || null;
          }
        } else {
          // Fallback: filter by email
          const users = await base44.entities.User.filter({ email: authUser.email });
          fullUser = users[0] || null;
        }

        // Merge user objects with signature field name variants
        const merged = { ...authUser, ...(fullUser || {}) };
        merged.email_signature = merged.email_signature || 
                                  merged.emailSignature || 
                                  merged.signature_html || 
                                  merged.signatureHtml || 
                                  "";

        if (!unmountedRef.current) {
          setCurrentUser(merged);
          console.log(`[UnifiedEmailComposer] User loaded:`, {
            email: merged.email,
            hasSignature: !!merged.email_signature,
            signatureLength: merged.email_signature?.length || 0,
            signaturePreview: merged.email_signature?.substring(0, 100) || "(empty)"
          });
        }
      } catch (err) {
        console.error("[UnifiedEmailComposer] Error loading user:", err);
      }
    };

    loadUser();
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // Update selectedMessage when message prop changes
  useEffect(() => {
    setSelectedMessage(message);
  }, [message]);

  // Initialize draft or thread context (non-signature fields)
  useEffect(() => {
    if (!currentUser) return;

    // Priority 1: Use provided draft (no signature auto-insertion)
    if (existingDraft) {
      setToChips(existingDraft.to_addresses || []);
      setCcChips(existingDraft.cc_addresses || []);
      setBccChips(existingDraft.bcc_addresses || []);
      setShowCc((existingDraft.cc_addresses || []).length > 0);
      setShowBcc((existingDraft.bcc_addresses || []).length > 0);
      setSubject(existingDraft.subject || "");
      setBody(existingDraft.body_html || "");
      setDraftId(existingDraft.id);
      composeInitializedRef.current = true;
      return;
    }

    // Priority 2: Initialize from message context (reply/reply_all/forward)
    if (thread && selectedMessage && (mode === "reply" || mode === "reply_all" || mode === "forward")) {
      initializeFromMessage();
      composeInitializedRef.current = true;
      return;
    }

    // Priority 3: Default "to" if provided
    if (defaultTo) {
      setToChips([defaultTo]);
      setCcChips([]);
      setBccChips([]);
      setShowCc(false);
      setShowBcc(false);
      setSubject("");
      setAttachments([]);
      // Don't set initialized yet—signature effect will handle body
      return;
    }

    // Priority 4: Fresh compose → clear all state and RESET signature flag
    if (mode === "compose") {
      setToChips([]);
      setCcChips([]);
      setBccChips([]);
      setShowCc(false);
      setShowBcc(false);
      setSubject("");
      setAttachments([]);
      setDraftId(null);
      composeInitializedRef.current = false; // Reset for fresh compose
    }
  }, [currentUser, existingDraft, thread, selectedMessage, mode, defaultTo]);

  // Step 3: Ensure compose mode auto-inserts signature once
  useEffect(() => {
    console.log("[UnifiedEmailComposer] Signature effect running:", {
      mode,
      currentUser: !!currentUser,
      existingDraft: !!existingDraft,
      refInitialized: composeInitializedRef.current,
      body: body.substring(0, 50)
    });

    // Skip if already initialized or not in fresh compose
    if (composeInitializedRef.current || existingDraft || mode !== "compose") {
      console.log("[UnifiedEmailComposer] Signature effect exiting early (ref/draft/mode check)");
      return;
    }

    // Wait for user to load
    if (!currentUser) {
      console.log("[UnifiedEmailComposer] Signature effect waiting for currentUser");
      return;
    }

    // Body must be empty to insert signature
    if (!isEmptyBody(body)) {
      console.log("[UnifiedEmailComposer] Signature effect: body not empty, skipping");
      composeInitializedRef.current = true;
      return;
    }

    // Build and insert signature
    const rawSignature = currentUser.email_signature || "";
    console.log("[UnifiedEmailComposer] Signature effect: inserting signature", {
      hasSignature: !!rawSignature,
      rawLength: rawSignature.length
    });
    
    if (isNonEmptyString(rawSignature)) {
      const signatureHtml = buildSignatureHtml(rawSignature);
      setBody(signatureHtml);
    }

    composeInitializedRef.current = true;
  }, [currentUser, existingDraft, mode]);

  const initializeFromMessage = () => {
    const userEmail = currentUser?.email?.toLowerCase();
    const msgToUse = selectedMessage;

    // Subject
    if (mode === "reply" || mode === "reply_all") {
      const subject = msgToUse?.subject || thread?.subject || "";
      setSubject(subject.startsWith("Re:") ? subject : `Re: ${subject}`);
    } else if (mode === "forward") {
      setSubject(`Fwd: ${msgToUse?.subject || thread?.subject || ""}`);
    }

    // Recipients for reply
    if (mode === "reply") {
      const replyTo = msgToUse?.from_address || "";
      if (replyTo) setToChips([replyTo]);
    } else if (mode === "reply_all") {
      const toAddrs = [msgToUse?.from_address].filter(Boolean);
      const ccAddrs = [
        ...(msgToUse?.to_addresses || []),
        ...(msgToUse?.cc_addresses || []),
      ].filter((e) => e && e.toLowerCase() !== userEmail);
      setToChips(toAddrs);
      setCcChips(ccAddrs);
      setShowCc(true);
    }

    // Body (quoted/forwarded) with signature
    const signatureHtml = buildSignatureHtml(currentUser?.email_signature);
    let quotedBody = "";

    if (mode === "reply" || mode === "reply_all") {
      let quoted = "";
      if (msgToUse?.body_html) {
        quoted = sanitizeForCompose(msgToUse.body_html);
      } else if (msgToUse?.body_text) {
        quoted = msgToUse.body_text.replace(/\n/g, "<br>");
      }
      const dateStr = msgToUse?.sent_at
        ? format(parseISO(msgToUse.sent_at), "d/M/yyyy 'at' HH:mm")
        : new Date().toLocaleString();
      const sender = msgToUse?.from_name || msgToUse?.from_address;
      quotedBody = `${signatureHtml}<br><br><div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;"><div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">On ${dateStr}, ${sender} wrote:</div><blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #d1d5db; color: #4b5563;">${quoted}</blockquote></div>`;
    } else if (mode === "forward") {
      let forwarded = "";
      if (msgToUse?.body_html) {
        forwarded = sanitizeForCompose(msgToUse.body_html);
      } else if (msgToUse?.body_text) {
        forwarded = msgToUse.body_text.replace(/\n/g, "<br>");
      }
      const dateStr = msgToUse?.sent_at
        ? format(parseISO(msgToUse.sent_at), "d/M/yyyy 'at' HH:mm")
        : new Date().toLocaleString();
      quotedBody = `${signatureHtml}<br><br><div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;"><div style="color: #6b7280; font-size: 13px; font-weight: 600; margin-bottom: 8px;">---------- Forwarded message ----------</div><div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;"><strong>From:</strong> ${msgToUse?.from_name || msgToUse?.from_address}<br><strong>Date:</strong> ${dateStr}<br><strong>Subject:</strong> ${msgToUse?.subject}</div><div style="margin-top: 12px;">${forwarded}</div></div>`;
    }

    if (quotedBody) setBody(ensureSignature(quotedBody, ""));
  };



  // Smart compose helper
  const smartCompose = SmartComposeHelper({
    currentText: body,
    onAcceptSuggestion: (suggestion) => setBody(body + suggestion),
  });

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["messageTemplates", "email"],
    queryFn: () =>
      base44.entities.MessageTemplate.filter({
        channel: "email",
        active: true,
      }),
    staleTime: 120000,
  });

  // Fetch linked project for templates (NO Job context)
  const { data: linkedProject } = useQuery({
    queryKey: ["project", linkTarget?.id],
    queryFn: () => base44.entities.Project.get(linkTarget.id),
    enabled: !!linkTarget?.id && linkTarget?.type === "project",
  });

  // Fetch customers for to/cc suggestions
  const { data: customers = [] } = useQuery({
    queryKey: ["customersForEmail"],
    queryFn: () => base44.entities.Customer.filter({ status: "active" }),
    staleTime: 60000,
  });

  // Chip handlers
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  
  const addChip = (list, setter, input, setSetter) => {
    const emails = input
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    if (emails.length > 0) {
      setter([...list, ...emails]);
      setSetter("");
    }
  };

  const removeChip = (list, setter, email) => {
    setter(list.filter((e) => e !== email));
  };

  // Draft auto-save
  const saveDraft = useCallback(
    async (draftData) => {
      if (!draftData.subject && toChips.length === 0 && !draftData.body) return;

      setIsSavingDraft(true);
      try {
        const draft = {
          thread_id: thread?.id || null,
          to_addresses: draftData.to || [],
          cc_addresses: draftData.cc || [],
          bcc_addresses: draftData.bcc || [],
          subject: draftData.subject,
          body_html: draftData.body,
          mode: mode !== "compose" ? mode : "compose",
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
    },
    [draftId, thread?.id, mode, onDraftSaved]
  );

  const debouncedSave = useCallback(
    debounce((data) => saveDraft(data), 2000),
    [saveDraft]
  );

  useEffect(() => {
    debouncedSave({ to: toChips, cc: ccChips, bcc: bccChips, subject, body });
    return () => debouncedSave.cancel();
  }, [toChips, ccChips, bccChips, subject, body, debouncedSave]);

  // Apply template
  const handleApplyTemplate = async (templateId) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    // Build context: NO Job context
    let customer = null;
    if (toChips.length > 0) {
      customer = customers.find(
        (c) => c.email?.toLowerCase() === toChips[0].toLowerCase()
      );
    }
    if (!customer && linkedProject?.customer_id) {
      try {
        customer = await base44.entities.Customer.get(
          linkedProject.customer_id
        );
      } catch (error) {
        console.log("Could not fetch customer:", error);
      }
    }

    const context = buildTemplateContext({
      project: linkedProject,
      customer,
      user: currentUser,
    });

    const rendered = renderTemplate(template, context);
    if (rendered.subject && !subject) setSubject(rendered.subject);
    if (rendered.body) {
      const signatureHtml = buildSignatureHtml(currentUser?.email_signature);
      setBody(ensureSignature(rendered.body, signatureHtml));
    }

    setSelectedTemplate("");
    toast.success(`Template "${template.name}" applied`);
  };

  // File handling
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                filename: file.name,
                mimeType: file.type,
                data: reader.result.split(",")[1],
                size: file.size,
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Calculate total attachment size
  const totalAttachmentSize = attachments.reduce((sum, att) => sum + (att.size || 0), 0);
  const attachmentSizeWarning = totalAttachmentSize > 20 * 1024 * 1024;

  // Auto-open attachments on mount
  useEffect(() => {
    if (autoOpenAttachments && variant === "inline") {
      setTimeout(() => {
        try {
          fileInputRef.current?.click();
        } catch (error) {
          console.error("Could not auto-open file picker:", error);
        }
      }, 100);
    }
  }, [autoOpenAttachments, variant]);

  // Send email
  const handleSend = async () => {
    const textBody = body.replace(/<[^>]*>/g, "");
    if (toChips.length === 0 || !subject || !textBody.trim()) {
      toast.error("Please fill in recipients, subject, and message");
      return;
    }

    // Guardrail: reply/forward needs gmail context OR message
    const needsGmailContext =
      (mode === "reply" || mode === "reply_all" || mode === "forward") &&
      !thread?.gmail_thread_id;
    if (needsGmailContext && !message) {
      toast.warning(
        "Message history not available. Reply will use thread headers only."
      );
    }

    setIsSending(true);
    try {
      const payload = {
        to: toChips,
        cc: ccChips.length > 0 ? ccChips : undefined,
        bcc: bccChips.length > 0 ? bccChips : undefined,
        subject,
        body_html: body,
        attachments: attachments.length > 0 ? attachments : undefined,
        thread_id: thread?.id || null,
        gmail_thread_id: thread?.gmail_thread_id || undefined,

        // Linking: Project or Contract ONLY (NO Job)
        project_id:
          linkTarget?.type === "project"
            ? linkTarget.id
            : thread?.project_id || undefined,
        contract_id:
          linkTarget?.type === "contract"
            ? linkTarget.id
            : thread?.contract_id || undefined,
      };

      // Reply headers
      if ((mode === "reply" || mode === "reply_all") && selectedMessage?.gmail_message_id) {
        payload.reply_to_gmail_message_id = selectedMessage.gmail_message_id;
        if (selectedMessage.references || selectedMessage.in_reply_to) {
          payload.references = selectedMessage.references
            ? `${selectedMessage.references} ${selectedMessage.in_reply_to || ""}`
            : selectedMessage.in_reply_to;
        }
      }

      const response = await base44.functions.invoke("gmailSendEmail", payload);

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Failed to send email");
      }

      // Mark draft as sent
      if (draftId) {
        try {
          await base44.entities.EmailDraft.update(draftId, {
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Failed to mark draft as sent:", err);
        }
      }

      toast.success("Email sent successfully");
      if (onSent) await onSent(response.data?.baseThreadId || thread?.id);

      handleClose();
    } catch (error) {
      toast.error(error.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (variant === "drawer" && onOpenChange) {
      onOpenChange(false);
    } else {
      onClose();
    }
  };

  // Compute valid reply context dynamically (non-sticky)
  const hasValidReplyContext = !!(
    thread?.gmail_thread_id &&
    selectedMessage &&
    (selectedMessage.gmail_message_id || selectedMessage.message_id)
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl+Enter sends
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isSending && toChips.length > 0 && subject && body) {
        e.preventDefault();
        handleSend();
      }
      // Esc closes
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSending, toChips.length, subject, body]);

  // Content (shared between drawer and inline)
  const renderContent = () => (
    <>
      {/* Recipients */}
      <div className="space-y-2">
        {/* To field with chips */}
        <div>
          <label className="text-[13px] font-semibold text-[#4B5563] block mb-1">
            To
          </label>
          <div className="flex flex-wrap gap-1 mb-1 p-2 bg-white border border-[#E5E7EB] rounded-lg min-h-[40px]">
            {toChips.map((email) => (
              <Badge key={email} variant="secondary" className="flex items-center gap-1">
                {email}
                <button
                  onClick={() => removeChip(toChips, setToChips, email)}
                  className="ml-1 hover:text-red-600"
                >
                  ×
                </button>
              </Badge>
            ))}
            <input
              ref={toInputRef}
              type="text"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onBlur={() => {
                if (toInput.trim()) {
                  addChip(toChips, setToChips, toInput, setToInput);
                }
              }}
              onKeyDown={(e) => {
                if ([",", ";", "Enter"].includes(e.key)) {
                  e.preventDefault();
                  addChip(toChips, setToChips, toInput, setToInput);
                }
              }}
              placeholder="Add recipients... (comma or semicolon separated)"
              className="flex-1 outline-none text-[14px] min-w-[100px]"
            />
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setShowCc(!showCc)}
              className="text-[12px] text-[#6B7280] hover:text-[#111827]"
            >
              {showCc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />} Cc
            </button>
            <button
              onClick={() => setShowBcc(!showBcc)}
              className="text-[12px] text-[#6B7280] hover:text-[#111827]"
            >
              {showBcc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />} Bcc
            </button>
          </div>
        </div>

        {/* Cc field */}
        {showCc && (
          <div>
            <label className="text-[13px] font-semibold text-[#4B5563] block mb-1">
              Cc
            </label>
            <div className="flex flex-wrap gap-1 p-2 bg-white border border-[#E5E7EB] rounded-lg min-h-[40px]">
              {ccChips.map((email) => (
                <Badge key={email} variant="secondary" className="flex items-center gap-1">
                  {email}
                  <button
                    onClick={() => removeChip(ccChips, setCcChips, email)}
                    className="ml-1 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ))}
              <input
                type="text"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onBlur={() => {
                  if (ccInput.trim()) {
                    addChip(ccChips, setCcChips, ccInput, setCcInput);
                  }
                }}
                onKeyDown={(e) => {
                  if ([",", ";", "Enter"].includes(e.key)) {
                    e.preventDefault();
                    addChip(ccChips, setCcChips, ccInput, setCcInput);
                  }
                }}
                placeholder="Add Cc recipients... (comma or semicolon separated)"
                className="flex-1 outline-none text-[14px] min-w-[100px]"
              />
            </div>
          </div>
        )}

        {/* Bcc field */}
        {showBcc && (
          <div>
            <label className="text-[13px] font-semibold text-[#4B5563] block mb-1">
              Bcc
            </label>
            <div className="flex flex-wrap gap-1 p-2 bg-white border border-[#E5E7EB] rounded-lg min-h-[40px]">
              {bccChips.map((email) => (
                <Badge key={email} variant="secondary" className="flex items-center gap-1">
                  {email}
                  <button
                    onClick={() => removeChip(bccChips, setBccChips, email)}
                    className="ml-1 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ))}
              <input
                type="text"
                value={bccInput}
                onChange={(e) => setBccInput(e.target.value)}
                onBlur={() => {
                  if (bccInput.trim()) {
                    addChip(bccChips, setBccChips, bccInput, setBccInput);
                  }
                }}
                onKeyDown={(e) => {
                  if ([",", ";", "Enter"].includes(e.key)) {
                    e.preventDefault();
                    addChip(bccChips, setBccChips, bccInput, setBccInput);
                  }
                }}
                placeholder="Add Bcc recipients... (comma or semicolon separated)"
                className="flex-1 outline-none text-[14px] min-w-[100px]"
              />
            </div>
          </div>
        )}

        {/* Subject */}
        <div>
          <label className="text-[13px] font-semibold text-[#4B5563] block mb-1">
            Subject
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject..."
            className="text-[14px]"
          />
        </div>

        {/* Templates */}
        {templates.length > 0 && (
          <div>
            <label className="text-[13px] font-semibold text-[#4B5563] block mb-1">
              Template
            </label>
            <Select
              value={selectedTemplate}
              onValueChange={handleApplyTemplate}
            >
              <SelectTrigger className="text-[14px]">
                <SelectValue placeholder="Use template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Original Message (reply/forward) */}
      {(mode === "reply" || mode === "reply_all" || mode === "forward") &&
        selectedMessage && (
          <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
            <button
              onClick={() => setShowOriginalMessage(!showOriginalMessage)}
              className="w-full flex items-center justify-between p-3 bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[#6B7280]">
                  Original message from{" "}
                  {selectedMessage.from_name || selectedMessage.from_address}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">
                  {selectedMessage.sent_at
                    ? format(parseISO(selectedMessage.sent_at), "MMM d, yyyy")
                    : ""}
                </span>
              </div>
              <div
                className={`text-[#6B7280] transform transition-transform ${
                  showOriginalMessage ? "rotate-180" : ""
                }`}
              >
                ▼
              </div>
            </button>
            {showOriginalMessage && (
              <div className="p-4 bg-white border-t border-[#E5E7EB] max-h-[300px] overflow-y-auto">
                <div className="text-[12px] text-[#6B7280] mb-2">
                  <strong>From:</strong> {selectedMessage.from_name || selectedMessage.from_address}
                  <br />
                  <strong>Date:</strong>{" "}
                  {selectedMessage.sent_at
                    ? format(parseISO(selectedMessage.sent_at), "PPpp")
                    : ""}
                  <br />
                  <strong>Subject:</strong> {selectedMessage.subject}
                </div>
                <div
                  className="text-[13px] text-[#111827] prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedMessage.body_html ||
                      selectedMessage.body_text?.replace(/\n/g, "<br>") ||
                      "",
                  }}
                />
              </div>
            )}
          </div>
        )}

      {/* Reply context guardrail */}
      {(mode === "reply" || mode === "reply_all" || mode === "forward") &&
        !hasValidReplyContext && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="text-[12px] text-amber-800">
              <strong>⚠ Message context not available</strong> — reply will use thread headers only. Thread history may be limited.
            </div>
            {thread?.gmail_thread_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsSyncing(true);
                  setSyncError(null);
                  try {
                    const response = await base44.functions.invoke('gmailSyncThreadMessages', {
                      thread_id: thread.id,
                    });
                    if (response.data?.success) {
                       showSyncToast(response.data);
                       // Invalidate and refetch queries
                       await queryClient.invalidateQueries({ queryKey: ['emailMessages', thread.id] });
                       await queryClient.invalidateQueries({ queryKey: ['emailThread', thread.id] });

                       // Refetch to get latest data
                       const refetchResult = await queryClient.refetchQueries({ queryKey: ['emailMessages', thread.id] });
                       await queryClient.refetchQueries({ queryKey: ['emailThread', thread.id] });

                       // Update selectedMessage with latest from refetch
                       const messages = queryClient.getQueryData(['emailMessages', thread.id]);
                       if (messages && messages.length > 0) {
                         // Get the most recent message
                         const latestMsg = messages[messages.length - 1];
                         if (latestMsg?.body_html || latestMsg?.body_text) {
                           setSelectedMessage(latestMsg);
                         } else {
                           setSyncError('Messages synced, but content is still unavailable. Try running a full sync.');
                         }
                       } else {
                         setSyncError('No messages found after sync.');
                       }
                     } else {
                       setSyncError(response.data?.error || 'Sync failed');
                       toast.error('Failed to sync messages');
                     }
                  } catch (err) {
                    setSyncError(err.message);
                    toast.error('Failed to sync messages');
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                disabled={isSyncing}
                className="h-7 text-[11px]"
              >
                {isSyncing ? 'Syncing...' : 'Sync messages'}
              </Button>
            )}
            {syncError && (
              <div className="text-[11px] text-amber-700 bg-amber-100 px-2 py-1 rounded">
                {syncError}
              </div>
            )}
          </div>
        )}

      {/* Body */}
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
          onChange={(html) => {
            setBody(html);
            smartCompose.handleTextChange(html.replace(/<[^>]*>/g, ""));
          }}
          placeholder="Write your message..."
          className="bg-white rounded-lg [&_.ql-container]:min-h-[200px] [&_.ql-editor]:min-h-[200px]"
          modules={{
            toolbar: [
              [{ header: [1, 2, 3, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ color: [] }, { background: [] }],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ indent: "-1" }, { indent: "+1" }],
              ["link"],
              ["clean"],
            ],
          }}
        />

        <SmartComposeSuggestionUI
          suggestion={smartCompose.suggestion}
          loading={smartCompose.loading}
          visible={smartCompose.visible}
          onAccept={smartCompose.onAcceptSuggestion}
          onReject={smartCompose.onRejectSuggestion}
        />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className={`space-y-2 bg-[#F9FAFB] rounded-lg p-3 border ${attachmentSizeWarning ? "border-amber-300 bg-amber-50" : "border-[#E5E7EB]"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-[#6B7280]" />
              <label className="text-[13px] font-semibold text-[#4B5563]">
                {attachments.length} Attachment
                {attachments.length !== 1 ? "s" : ""} ({(totalAttachmentSize / 1024 / 1024).toFixed(1)} MB)
              </label>
            </div>
            {attachmentSizeWarning && (
              <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                ⚠ Large attachment
              </span>
            )}
          </div>
          <div className="space-y-2">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-[#E5E7EB]"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Paperclip className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-[#111827] block truncate">
                      {att.filename}
                    </span>
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
    </>
  );

  // Draft status with relative time
  const getRelativeTime = (date) => {
    if (!date) return "";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const draftStatus = (
    <div className="text-[12px] text-[#9CA3AF] flex items-center gap-1.5">
      {isSavingDraft && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {!isSavingDraft && lastSaved && (
        <>
          <Check className="w-3 h-3 text-green-600" />
          <span className="text-green-600">Saved {getRelativeTime(lastSaved)}</span>
        </>
      )}
    </div>
  );

  // Drawer variant
  if (variant === "drawer") {
    const drawerTitle =
      {
        compose: "Compose Email",
        reply: "Reply",
        reply_all: "Reply All",
        forward: "Forward",
      }[mode] || "Email";

    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[90vh] max-h-[90vh]">
          <DrawerHeader className="border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <DrawerTitle>{drawerTitle}</DrawerTitle>
              <div className="flex items-center gap-2">{draftStatus}</div>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {renderContent()}
          </div>

          <DrawerFooter className="border-t border-[#E5E7EB]">
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={isSending || toChips.length === 0 || !subject || !body}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] gap-2 font-semibold"
              >
                <Send className="w-4 h-4" />
                {isSending ? "Sending..." : "Send"}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  // Inline variant (card)
  return (
    <Card className="border-2 border-[#FAE008] shadow-lg flex flex-col max-h-[90vh]">
      <CardHeader className="bg-[#FAE008]/10 border-b border-[#E5E7EB] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-[18px] font-semibold">
              {
                {
                  compose: "New Email",
                  reply: "Reply",
                  reply_all: "Reply All",
                  forward: "Forward",
                }[mode]
              }
            </CardTitle>
            {mode === "reply" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReplyAll(!isReplyAll)}
                className="h-7 text-[12px]"
              >
                {isReplyAll ? "Reply to Sender Only" : "Reply All"}
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
        {renderContent()}
      </CardContent>

      <div className="border-t border-[#E5E7EB] px-4 py-3 flex items-center justify-between flex-shrink-0 bg-[#F9FAFB]">
        <div>{draftStatus}</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || toChips.length === 0 || !subject || !body}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] gap-2 font-semibold"
          >
            <Send className="w-4 h-4" />
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </Card>
  );
}