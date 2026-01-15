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
import RecipientAutocomplete from "./RecipientAutocomplete";
import MergeFieldsHelper from "./MergeFieldsHelper";

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
 * Check if message context is available (strict check)
 * Requires at least one message with gmail_message_id AND (body_html OR body_text)
 */
function isMessageContextAvailable(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  
  return messages.some((msg) => 
    msg?.gmail_message_id && 
    (
      (msg.body_html && msg.body_html.trim().length > 0) ||
      (msg.body_text && msg.body_text.trim().length > 0)
    )
  );
}

/**
 * Pick best context message for reply/forward
 * - reply/reply_all: prefer latest inbound message with body
 * - forward: prefer latest message with body
 * - fallback: latest message with body (any direction)
 */
function pickBestContextMessage(messages, mode) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  
  const withBody = messages.filter(m => 
    m?.gmail_message_id && (m.body_html?.trim() || m.body_text?.trim())
  );
  
  if (withBody.length === 0) return null;
  
  // For reply/reply_all, prefer inbound (received) messages
  if (mode === 'reply' || mode === 'reply_all') {
    const inbound = withBody.filter(m => !m.is_outbound);
    if (inbound.length > 0) {
      return inbound.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
    }
  }
  
  // Fallback: latest with body (any direction)
  return withBody.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
}

/**
 * Compute initial body HTML based on compose mode and available data
 * Priority:
 * A) existingDraft.body_html
 * B) reply/forward computed quotedBody (signature + quote)
 * C) compose signature only
 * D) empty string
 */
function computeInitialBody(existingDraft, mode, currentUser, selectedMessage, thread, buildSignatureHtml, ensureSignature, sanitizeForCompose, format, parseISO) {
  // A) Use existing draft body if available
  if (existingDraft?.body_html) {
    return existingDraft.body_html;
  }

  const signatureHtml = buildSignatureHtml(currentUser?.email_signature);

  // B) For reply/forward, build quoted message
  if ((mode === "reply" || mode === "reply_all" || mode === "forward") && selectedMessage) {
    const userEmail = currentUser?.email?.toLowerCase();
    let quotedBody = "";

    if (mode === "reply" || mode === "reply_all") {
      let quoted = "";
      if (selectedMessage?.body_html) {
        quoted = sanitizeForCompose(selectedMessage.body_html);
      } else if (selectedMessage?.body_text) {
        quoted = selectedMessage.body_text.replace(/\n/g, "<br>");
      }
      const dateStr = selectedMessage?.sent_at
        ? format(parseISO(selectedMessage.sent_at), "d/M/yyyy 'at' HH:mm")
        : new Date().toLocaleString();
      const sender = selectedMessage?.from_name || selectedMessage?.from_address;
      quotedBody = `<div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;"><div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">On ${dateStr}, ${sender} wrote:</div><blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #d1d5db; color: #4b5563;">${quoted}</blockquote></div>`;
    } else if (mode === "forward") {
      let forwarded = "";
      if (selectedMessage?.body_html) {
        forwarded = sanitizeForCompose(selectedMessage.body_html);
      } else if (selectedMessage?.body_text) {
        forwarded = selectedMessage.body_text.replace(/\n/g, "<br>");
      }
      const dateStr = selectedMessage?.sent_at
        ? format(parseISO(selectedMessage.sent_at), "d/M/yyyy 'at' HH:mm")
        : new Date().toLocaleString();
      quotedBody = `<div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;"><div style="color: #6b7280; font-size: 13px; font-weight: 600; margin-bottom: 8px;">---------- Forwarded message ----------</div><div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;"><strong>From:</strong> ${selectedMessage?.from_name || selectedMessage?.from_address}<br><strong>Date:</strong> ${dateStr}<br><strong>Subject:</strong> ${selectedMessage?.subject}</div><div style="margin-top: 12px;">${forwarded}</div></div>`;
    }

    return ensureSignature(quotedBody, signatureHtml);
  }

  // C) Fresh compose - signature only
  if (mode === "compose") {
    return signatureHtml;
  }

  // D) Fallback
  return "";
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
 * Build signature HTML with marker and data attribute for idempotency
 */
function buildSignatureHtml(signatureText) {
  if (!signatureText || !isNonEmptyString(signatureText)) return "";
  return `${SIGNATURE_MARKER}<div data-email-signature="true" style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">${signatureText}</div>`;
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
  const bodyEditorRef = useRef(null);
  const subjectInputRef = useRef(null);
  const unmountedRef = useRef(false);
  const composeInitializedRef = useRef(false);
  const syncInFlightRef = useRef(new Set()); // Track in-flight syncs per thread
  const lastAutoSyncRef = useRef(new Map()); // Track last auto-sync timestamp per thread
  const didInitBodyRef = useRef(false); // Track if body has been initialized once
  const userHasTypedRef = useRef(false); // Track if user has typed to prevent background overwrites

  // Load user from auth (most reliable source for signature)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const authUser = await base44.auth.me();
        if (!authUser || unmountedRef.current) return;

        // Normalize signature field (check multiple field names)
        const signature = authUser?.email_signature || 
                         authUser?.emailSignature || 
                         authUser?.signature || 
                         "";

        const user = { ...authUser, email_signature: signature };

        if (!unmountedRef.current) {
          setCurrentUser(user);
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

  // Single initialization effect: runs ONCE per composer session
  useEffect(() => {
    if (!currentUser) return;
    if (didInitBodyRef.current) return; // Already initialized
    
    const initialBody = computeInitialBody(
      existingDraft,
      mode,
      currentUser,
      selectedMessage || message,
      thread,
      buildSignatureHtml,
      ensureSignature,
      sanitizeForCompose,
      format,
      parseISO
    );

    setBody(initialBody);
    didInitBodyRef.current = true;
  }, [currentUser, existingDraft?.id, mode]);

  // Update selectedMessage when message prop changes (but don't overwrite body)
  useEffect(() => {
    setSelectedMessage(message);
  }, [message]);

  // Initialize non-body fields (recipients, subject, draft ID)
  useEffect(() => {
    if (!currentUser) return;

    // Priority 1: Use provided draft (restore as-is)
    if (existingDraft?.id) {
      // Fetch full draft data from database
      base44.entities.EmailDraft.get(existingDraft.id).then(fullDraft => {
        if (unmountedRef.current) return;
        setToChips(fullDraft.to_addresses || []);
        setCcChips(fullDraft.cc_addresses || []);
        setBccChips(fullDraft.bcc_addresses || []);
        setShowCc((fullDraft.cc_addresses || []).length > 0);
        setShowBcc((fullDraft.bcc_addresses || []).length > 0);
        setSubject(fullDraft.subject || "");
        setDraftId(fullDraft.id);
        composeInitializedRef.current = true;
      }).catch(err => {
        console.error("Failed to fetch draft:", err);
      });
      return;
    }

    // Priority 2: Fresh compose mode - init state
    if (mode === "compose") {
      setToChips([]);
      setCcChips([]);
      setBccChips([]);
      setShowCc(false);
      setShowBcc(false);
      setSubject("");
      setAttachments([]);
      setDraftId(null);

      // Default "to" if provided
      if (defaultTo) {
        setToChips([defaultTo]);
      }

      composeInitializedRef.current = true;
      return;
    }

    // Priority 3: Initialize recipients for reply/reply_all/forward
    if (thread && selectedMessage && (mode === "reply" || mode === "reply_all" || mode === "forward")) {
      initializeRecipientsFromMessage();
      return;
    }
  }, [currentUser, existingDraft, thread, selectedMessage, mode, defaultTo]);

  // Reset body init flag when thread/message context changes (but not when just opening the composer)
  useEffect(() => {
    if (existingDraft?.id) {
      // Fresh draft being loaded, reset init flag
      didInitBodyRef.current = false;
    } else if (thread?.id || selectedMessage?.id) {
      // Switching threads/messages, reset init flag
      didInitBodyRef.current = false;
    }
  }, [thread?.id, selectedMessage?.id, existingDraft?.id]);



  const initializeRecipientsFromMessage = () => {
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
  };



  // Smart compose helper
  const smartCompose = SmartComposeHelper({
    currentText: body,
    onAcceptSuggestion: (suggestion) => setBody(body + suggestion),
  });

  // Fetch messages (needed for context check and auto-sync)
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['emailMessages', thread?.id],
    queryFn: () => base44.entities.EmailMessage.filter({ thread_id: thread.id }),
    enabled: !!thread?.id,
    staleTime: 30000,
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
      if (!draftData.subject && draftData.to.length === 0 && !draftData.body) return;

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
          status: "draft",
          // Link to project/contract if provided
          ...(linkTarget?.type === "project" && { project_id: linkTarget.id }),
          ...(linkTarget?.type === "contract" && { contract_id: linkTarget.id }),
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
    [draftId, thread?.id, mode, linkTarget, onDraftSaved]
  );

  const debouncedSave = useCallback(
    debounce((data) => saveDraft(data), 2000),
    [saveDraft]
  );

  useEffect(() => {
    debouncedSave({ to: toChips, cc: ccChips, bcc: bccChips, subject, body });
    return () => debouncedSave.cancel();
  }, [toChips, ccChips, bccChips, subject, body, debouncedSave]);

  // Apply template (explicit user action - allowed to overwrite body)
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
      // Allow this explicit user action, even if userHasTyped
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

  // Clear attachments when opening fresh compose (drawer variant reuse)
  useEffect(() => {
    if (variant === "drawer" && mode === "compose" && open && !existingDraft) {
      setAttachments([]);
    }
  }, [variant, mode, open, existingDraft]);

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
      // Ensure attachments have clean base64 (strip data: prefix)
      const cleanAttachments = attachments.map(att => ({
        filename: att.filename,
        mimeType: att.mimeType,
        data: att.data && att.data.includes(',') ? att.data.split(',')[1] : att.data,
        size: att.size
      }));

      const payload = {
        to: toChips,
        cc: ccChips.length > 0 ? ccChips : undefined,
        bcc: bccChips.length > 0 ? bccChips : undefined,
        subject,
        body_html: body,
        attachments: cleanAttachments.length > 0 ? cleanAttachments : undefined,
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
    // Reset init/typing refs so next compose session initializes correctly
    didInitBodyRef.current = false;
    userHasTypedRef.current = false;
    
    if (variant === "drawer" && onOpenChange) {
      onOpenChange(false);
    } else {
      onClose();
    }
  };

  // Auto-sync effect: Only in reply/forward modes, triggers once per thread per 60s
  useEffect(() => {
    // Only auto-sync in reply/forward modes
    if (!['reply', 'reply_all', 'forward'].includes(mode)) return;
    if (!thread?.id || !thread?.gmail_thread_id) return;
    if (messagesLoading) return; // Wait for messages to load
    
    // If context is available, upgrade selectedMessage if needed (but don't overwrite body if user typed)
    const hasContext = isMessageContextAvailable(messages);
    if (hasContext) {
      const best = pickBestContextMessage(messages, mode);
      if (best && !selectedMessage?.body_html && !selectedMessage?.body_text) {
        setSelectedMessage(best);
      }
      return; // No need to sync
    }
    
    // No context → attempt auto-sync (best-effort, rate-limited, with locking)
    const tid = thread.id;
    
    // Check if sync already in-flight for this thread
    if (syncInFlightRef.current.has(tid)) return;
    
    // Check if we synced recently (within 60s)
    const lastTs = lastAutoSyncRef.current.get(tid) || 0;
    if (Date.now() - lastTs < 60000) return;
    
    // Proceed with auto-sync
    lastAutoSyncRef.current.set(tid, Date.now());
    syncInFlightRef.current.add(tid);
    setIsSyncing(true);
    setSyncError(null);
    
    base44.functions.invoke('gmailSyncThreadMessages', {
      gmail_thread_id: thread.gmail_thread_id,
    })
      .then(async (res) => {
        if (!unmountedRef.current && !res.data?.success) {
          throw new Error(res.data?.error || 'Sync failed');
        }
        
        if (!unmountedRef.current) {
          showSyncToast(res.data);
          
          // Force immediate refresh
          await queryClient.invalidateQueries({ queryKey: ['emailMessages', tid] });
          await queryClient.refetchQueries({ queryKey: ['emailMessages', tid] });
          
          // Attempt to upgrade selectedMessage with synced content
          // BUT: Do NOT update body if user has already started typing
          const fresh = queryClient.getQueryData(['emailMessages', tid]) || [];
          const best = pickBestContextMessage(fresh, mode);
          if (best && (best.body_html || best.body_text)) {
            setSelectedMessage(best);
            // Body will be populated by init effect if not already typed
          } else {
            setSyncError('Messages synced but body content still unavailable. Header-only reply will be used.');
          }
        }
      })
      .catch((err) => {
        if (!unmountedRef.current) {
          setSyncError(err.message || 'Failed to sync messages');
          console.error('[UnifiedEmailComposer] Auto-sync error:', err);
        }
      })
      .finally(() => {
        if (!unmountedRef.current) {
          syncInFlightRef.current.delete(tid);
          setIsSyncing(false);
        }
      });
  }, [mode, thread?.id, thread?.gmail_thread_id, messagesLoading, messages, queryClient]);

  // Compute valid reply context dynamically (non-sticky)
  // Require sync_status to be OK (not partial/failed) for valid context
  const hasValidReplyContext = !!(
    thread?.gmail_thread_id &&
    selectedMessage &&
    (selectedMessage.gmail_message_id || selectedMessage.message_id) &&
    selectedMessage.sync_status !== "partial" &&
    selectedMessage.sync_status !== "failed" &&
    isMessageContextAvailable([selectedMessage])
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
        {/* To field with autocomplete */}
        <RecipientAutocomplete
          chips={toChips}
          onChipsChange={setToChips}
          customers={customers}
          placeholder="Add recipients..."
          label="To"
        />

        <div className="flex gap-2 text-[12px]">
          <button
            onClick={() => setShowCc(!showCc)}
            className="text-[#6B7280] hover:text-[#111827]"
          >
            {showCc ? <ChevronUp className="w-3 h-3 inline mr-1" /> : <ChevronDown className="w-3 h-3 inline mr-1" />} Cc
          </button>
          <button
            onClick={() => setShowBcc(!showBcc)}
            className="text-[#6B7280] hover:text-[#111827]"
          >
            {showBcc ? <ChevronUp className="w-3 h-3 inline mr-1" /> : <ChevronDown className="w-3 h-3 inline mr-1" />} Bcc
          </button>
        </div>

        {/* Cc field */}
        {showCc && (
          <RecipientAutocomplete
            chips={ccChips}
            onChipsChange={setCcChips}
            customers={customers}
            placeholder="Add Cc recipients..."
            label="Cc"
          />
        )}

        {/* Bcc field */}
        {showBcc && (
          <RecipientAutocomplete
            chips={bccChips}
            onChipsChange={setBccChips}
            customers={customers}
            placeholder="Add Bcc recipients..."
            label="Bcc"
          />
        )}

        {/* Subject */}
         <div>
           <label className="text-[13px] font-semibold text-[#4B5563] block mb-1">
             Subject
           </label>
           <Input
             ref={subjectInputRef}
             value={subject}
             onChange={(e) => setSubject(e.target.value)}
             placeholder="Email subject..."
             className="text-[14px]"
           />
         </div>

        {/* Templates + Merge Fields */}
        {templates.length > 0 && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
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
            <MergeFieldsHelper
              onInsert={(field) => {
                // Insert into subject if focused, else body
                const isFocused = document.activeElement === subjectInputRef.current;
                if (isFocused) {
                  setSubject(subject + field);
                } else {
                  setBody(body + field);
                }
              }}
            />
          </div>
        )}

        {/* Merge fields only (if no templates) */}
        {templates.length === 0 && (
          <div className="flex justify-end">
            <MergeFieldsHelper
              onInsert={(field) => {
                const isFocused = document.activeElement === subjectInputRef.current;
                if (isFocused) {
                  setSubject(subject + field);
                } else {
                  setBody(body + field);
                }
              }}
            />
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

      {/* Reply context guardrail - only show if no valid context */}
      {(mode === "reply" || mode === "reply_all" || mode === "forward") &&
        !hasValidReplyContext && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="text-[12px] text-amber-800">
              {isSyncing ? (
                <><strong>⏳ Syncing message context…</strong> you can keep writing.</>
              ) : selectedMessage?.sync_status === "partial" ? (
                <><strong>⚠ Message content is incomplete</strong> (partial sync) — reply will use available content. More details may load soon.</>
              ) : selectedMessage?.sync_status === "failed" ? (
                <><strong>⚠ Message failed to sync</strong> — reply will use thread headers only.</>
              ) : (
                <><strong>⚠ Message context not available</strong> — reply will use thread headers only. Thread history may be limited.</>
              )}
            </div>
            {thread?.gmail_thread_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const tid = thread.id;
                  // Check lock before manual sync
                  if (syncInFlightRef.current.has(tid)) return;

                  const lastTs = lastAutoSyncRef.current.get(tid) || 0;
                  if (Date.now() - lastTs < 60000) {
                    toast.info('Already synced recently, try again in a moment');
                    return;
                  }

                  lastAutoSyncRef.current.set(tid, Date.now());
                  syncInFlightRef.current.add(tid);
                  setIsSyncing(true);
                  setSyncError(null);
                  try {
                    const response = await base44.functions.invoke('gmailSyncThreadMessages', {
                      gmail_thread_id: thread.gmail_thread_id,
                    });
                    if (response.data?.success) {
                       showSyncToast(response.data);
                       // Invalidate and refetch immediately
                       await queryClient.invalidateQueries({ queryKey: ['emailMessages', thread.id] });
                       await queryClient.refetchQueries({ queryKey: ['emailMessages', thread.id] });

                       // Get latest messages and pick best context
                       const fresh = queryClient.getQueryData(['emailMessages', thread.id]) || [];
                       if (fresh.length > 0) {
                         const best = pickBestContextMessage(fresh, mode);
                         if (best && (best.body_html || best.body_text)) {
                           setSelectedMessage(best);
                           // Banner auto-disappears when hasValidReplyContext becomes true
                         } else {
                           setSyncError('Messages synced but body content still unavailable. Header-only reply will be used.');
                         }
                       }
                     } else {
                       setSyncError(response.data?.error || 'Sync failed');
                       toast.error('Failed to sync messages');
                     }
                  } catch (err) {
                    setSyncError(err.message);
                    toast.error('Failed to sync messages');
                  } finally {
                    syncInFlightRef.current.delete(tid);
                    setIsSyncing(false);
                  }
                }}
                disabled={isSyncing || syncInFlightRef.current.has(thread?.id)}
                className="h-7 text-[11px]"
              >
                {isSyncing ? 'Syncing…' : 'Sync messages manually'}
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
          ref={bodyEditorRef}
          theme="snow"
          value={body}
          onChange={(html) => {
            userHasTypedRef.current = true;
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