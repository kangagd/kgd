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
import { inboxKeys } from "@/components/api/queryKeys";
import SmartComposeHelper, { SmartComposeSuggestionUI } from "./SmartComposeHelper";
import RecipientAutocomplete from "./RecipientAutocomplete";
import MergeFieldsHelper from "./MergeFieldsHelper";
import { devLog } from "@/components/utils/devLog";

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

  // Build signature: check if it's already HTML or plain text
  let signatureHtml = '';
  if (currentUser?.email_signature) {
    if (currentUser.email_signature.includes('<')) {
      // Already HTML (from rich text editor): wrap with marker and styling
      signatureHtml = `${SIGNATURE_MARKER}<div data-email-signature="true" style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">${currentUser.email_signature}</div>`;
    } else {
      // Plain text: use buildSignatureHtml to convert newlines and wrap
      signatureHtml = buildSignatureHtml(currentUser.email_signature, currentUser?.email_signature_image_url);
    }
  }

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
 * Supports: plain text (with \n to <br> conversion) + optional image/logo
 */
function buildSignatureHtml(signatureText, signatureImageUrl = null) {
  if (!signatureText || !isNonEmptyString(signatureText)) {
    // Still render image-only signature if provided
    if (signatureImageUrl) {
      return `${SIGNATURE_MARKER}<div data-email-signature="true" style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;"><img src="${signatureImageUrl}" alt="Logo" style="max-width: 200px; height: auto;"></div>`;
    }
    return "";
  }

  // Convert newlines in plain text to <br> tags for proper formatting
  const signatureWithBr = signatureText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('<br>');

  // Build signature with optional image
  let signatureHtml = `<div data-email-signature="true" style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">`;
  
  if (signatureImageUrl) {
    signatureHtml += `<div style="margin-bottom: 8px;"><img src="${signatureImageUrl}" alt="Logo" style="max-width: 200px; height: auto;"></div>`;
  }

  signatureHtml += `<div>${signatureWithBr}</div></div>`;

  return `${SIGNATURE_MARKER}${signatureHtml}`;
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

// ============================================================================
// CRITICAL: Thread-Level Isolation (DO NOT REMOVE)
// ============================================================================
// This composer is designed to isolate state per thread to prevent drafts,
// recipients, and message context from bleeding between threads when the user
// switches threads. The following guarantees MUST be maintained:
//
// 1. When thread?.id changes → reset ALL state (body, to/cc/bcc, subject, attachments, selectedMessage)
// 2. selectedMessage is only set if message.thread_id === thread?.id (reject stale props)
// 3. initializeRecipientsFromMessage() validates thread ownership before using selectedMessage
// 4. NEVER add a simple useEffect that sets selectedMessage from message prop unconditionally
//
// If these break, drafts from one thread will appear in another thread's composer.
// ============================================================================

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
  onDirtyStateChange = null, // NEW: expose dirty state to parent
}) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [showOriginalMessage, setShowOriginalMessage] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(message || null);
  const replyAllToggleRef = useRef(false); // Track toggle state to re-init recipients
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // State: Recipients (chip-style array)
  const [toChips, setToChips] = useState([]);
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
  const [saveError, setSaveError] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmedLargeRecipients, setConfirmedLargeRecipients] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const bodyEditorRef = useRef(null);
  const subjectInputRef = useRef(null);
  // NOTE: `toInputRef` removed (GUARDRAIL: not needed for chip-based recipient input)
  // NOTE: `isReplyAll` state removed (GUARDRAIL: reply/reply_all mode set directly from parent Inbox.js - see onReply/onReplyAll handlers)
  const unmountedRef = useRef(false);
  const composeInitializedRef = useRef(false);
  const syncInFlightRef = useRef(new Set()); // Track in-flight syncs per thread
  const lastAutoSyncRef = useRef(new Map()); // Track last auto-sync timestamp per thread
  const didInitBodyRef = useRef(false); // Track if body has been initialized once
  const userHasTypedRef = useRef(false); // Track if user has typed to prevent background overwrites
  const isTypingRef = useRef(false); // Track active typing (prevent autosave state mutations)
  const lastUserEditAtRef = useRef(0); // Track last keystroke timestamp
  const typingTimeoutRef = useRef(null); // Timeout for resetting isTypingRef
  const lastSavedSnapshotRef = useRef(null); // Track last saved state for dirty detection
  const editorFocusedRef = useRef(false); // GUARDRAIL: Track if Quill editor is focused (prevent state updates while focused)
  const lastKeystrokeAtRef = useRef(0); // GUARDRAIL: Track timestamp of last keystroke for idle detection
  const lastSavedComposeKeyRef = useRef(null); // Track compose context to prevent cross-thread draft migration

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

        devLog("[UnifiedEmailComposer] Loaded user signature:", { 
                   hasSignature: !!signature, 
                   signatureLength: signature?.length || 0,
                   availableFields: {
                     email_signature: authUser?.email_signature,
                     emailSignature: authUser?.emailSignature,
                     signature: authUser?.signature
                   }
                 });

        if (!unmountedRef.current) {
          setCurrentUser(user);
        }
      } catch (err) {
        devLog("[UnifiedEmailComposer] Error loading user:", err);
      }
    };

    loadUser();
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // Single initialization effect: runs ONCE per composer session
  // GUARDRAIL: Include thread?.id in dependencies so body reinitializes when switching threads
  // PROBLEM PREVENTED: Without thread?.id, switching threads kept previous thread's body/quote (persistence bug)
  useEffect(() => {
    if (!currentUser) return;
    if (didInitBodyRef.current) return; // Already initialized
    
    const signatureBuilder = (sig) => buildSignatureHtml(sig, currentUser?.email_signature_image_url);
    const initialBody = computeInitialBody(
      existingDraft,
      mode,
      currentUser,
      selectedMessage || message,
      thread,
      signatureBuilder,
      ensureSignature,
      sanitizeForCompose,
      format,
      parseISO
    );

    devLog("[UnifiedEmailComposer] Init body for mode='" + mode + "':", {
           initialBodyLength: initialBody?.length,
           initialBodyPreview: initialBody?.substring(0, 100),
           hasSignatureMarker: (initialBody || '').includes(SIGNATURE_MARKER),
           userSignatureLength: currentUser?.email_signature?.length || 0
         });

    setBody(initialBody);
    didInitBodyRef.current = true;
  }, [currentUser, existingDraft?.id, mode, thread?.id]);





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
        devLog("Failed to fetch draft:", err);
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

  // GUARDRAIL: Reset ALL state when thread changes (thread-level isolation)
  // Prevents draft/recipients/subject from previous thread bleeding into new thread
  useEffect(() => {
    if (!thread?.id) return; // Don't reset if no thread
    
    // Reset body init and type tracking refs
    didInitBodyRef.current = false;
    userHasTypedRef.current = false;
    
    // Reset all composer fields to clean state when switching threads
    // UNLESS there's an existingDraft being loaded for this thread
    if (!existingDraft?.id) {
      setToChips([]);
      setCcChips([]);
      setBccChips([]);
      setShowCc(false);
      setShowBcc(false);
      setSubject("");
      setBody("");
      setAttachments([]);
      setDraftId(null);
      // CRITICAL: Clear selectedMessage immediately to prevent recipient init from using old message
      setSelectedMessage(null);
      lastSavedSnapshotRef.current = null;
      lastSavedComposeKeyRef.current = null;
    }
  }, [thread?.id]);

  // GUARDRAIL: Ignore stale message props from previous thread
  // Only update selectedMessage if it belongs to current thread
  useEffect(() => {
    if (!message || !thread?.id) return;
    // Reject if message doesn't have thread_id (incomplete data)
    // or if it doesn't match current thread
    if (message.thread_id && message.thread_id !== thread.id) {
      return; // Ignore message from different thread
    }
    setSelectedMessage(message);
  }, [message?.id, thread?.id]);



  const initializeRecipientsFromMessage = useCallback(() => {
      // GUARDRAIL: Do not initialize if selectedMessage doesn't belong to current thread
      if (!selectedMessage || selectedMessage.thread_id !== thread?.id) {
        return;
      }

      const userEmail = currentUser?.email?.toLowerCase();
      const msgToUse = selectedMessage;

      // Use mode as-is (reply/reply_all set directly from Inbox)
      let effectiveMode = mode;

      // Subject
      if (effectiveMode === "reply" || effectiveMode === "reply_all") {
        const subject = msgToUse?.subject || thread?.subject || "";
        setSubject(subject.startsWith("Re:") ? subject : `Re: ${subject}`);
      } else if (effectiveMode === "forward") {
        setSubject(`Fwd: ${msgToUse?.subject || thread?.subject || ""}`);
      }

      // Recipients based on effective mode
      if (effectiveMode === "reply") {
        const replyTo = msgToUse?.from_address || "";
        if (replyTo) setToChips([replyTo]);
        setCcChips([]);
        setShowCc(false);
      } else if (effectiveMode === "reply_all") {
        const toAddrs = [msgToUse?.from_address].filter(Boolean);
        const ccAddrs = [
          ...(msgToUse?.to_addresses || []),
          ...(msgToUse?.cc_addresses || []),
        ].filter((e) => e && e.toLowerCase() !== userEmail);
        setToChips(toAddrs);
        setCcChips(ccAddrs);
        setShowCc(true);
      }
    }, [mode, selectedMessage, currentUser?.email, thread?.subject]);



  // Smart compose helper
  const smartCompose = SmartComposeHelper({
    currentText: body,
    onAcceptSuggestion: (suggestion) => setBody(body + suggestion),
  });

  // Fetch messages (needed for context check and auto-sync)
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: inboxKeys.messages(thread?.id),
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

  // Compute draft_key for deterministic draft identity (one draft per context per user)
  const computeDraftKey = () => {
    const userEmail = currentUser?.email?.toLowerCase() || "";
    
    // Determine scope and context_id
    let scope = "standalone";
    let contextId = null;
    
    if (thread?.id) {
      scope = "thread";
      contextId = thread.id;
    } else if (linkTarget?.type === "project" && linkTarget?.id) {
      scope = "project";
      contextId = linkTarget.id;
    } else if (linkTarget?.type === "job" && linkTarget?.id) {
      scope = "job";
      contextId = linkTarget.id;
    }
    
    // Draft key: scope:contextId:user
    const key = `${scope}:${contextId || "none"}:${userEmail}`;
    return { scope, contextId, key };
  };

  // Check if current state differs from last saved
  const isDirty = () => {
    const current = { to: toChips, cc: ccChips, bcc: bccChips, subject, body };
    if (!lastSavedSnapshotRef.current) return true;
    return JSON.stringify(current) !== JSON.stringify(lastSavedSnapshotRef.current);
  };

  // Draft auto-save: one draft per context using draft_key
  const saveDraft = useCallback(
    async (draftData) => {
      if (!draftData.subject && draftData.to.length === 0 && !draftData.body) return;

      // GUARDRAIL: Only set isSavingDraft state if editor is NOT focused
      if (!editorFocusedRef.current) {
        setIsSavingDraft(true);
        setSaveError(false);
      }

      try {
        const now = new Date().toISOString();
        const { scope, contextId, key: draftKey } = computeDraftKey();
        
        const draft = {
          thread_id: thread?.id || null,
          to_addresses: draftData.to || [],
          cc_addresses: draftData.cc || [],
          bcc_addresses: draftData.bcc || [],
          subject: draftData.subject,
          body_html: draftData.body,
          mode: mode !== "compose" ? mode : "compose",
          status: "active",
          last_saved_at: now,
          draft_key: draftKey,
          draft_scope: scope,
          draft_context_id: contextId,
          // Link to project/contract if provided
          ...(linkTarget?.type === "project" && { project_id: linkTarget.id }),
          ...(linkTarget?.type === "contract" && { contract_id: linkTarget.id }),
        };

        // Try to find existing draft by draft_key (one draft per context per user)
        let existingDraft = null;
        if (!draftId) {
          try {
            const matches = await base44.entities.EmailDraft.filter(
              { draft_key: draftKey, status: "active" },
              "-updated_date",
              1
            );
            existingDraft = matches?.[0];
          } catch (err) {
            devLog('[UnifiedEmailComposer] Could not query for existing draft:', err);
          }
        }

        // Update existing draft if found, otherwise create new
        if (draftId) {
          await base44.entities.EmailDraft.update(draftId, draft);
        } else if (existingDraft?.id) {
          await base44.entities.EmailDraft.update(existingDraft.id, draft);
          setDraftId(existingDraft.id);
          devLog('[UnifiedEmailComposer] Found existing draft by draft_key, updating instead of creating');
        } else {
          const newDraft = await base44.entities.EmailDraft.create(draft);
          setDraftId(newDraft.id);
        }
        
        // Update snapshot after successful save
        lastSavedSnapshotRef.current = { to: draftData.to, cc: draftData.cc, bcc: draftData.bcc, subject: draftData.subject, body: draftData.body };
        
        // GUARDRAIL: Only update lastSaved UI state if editor not focused
        if (!editorFocusedRef.current) {
          setLastSaved(new Date());
          setSaveError(false);
        }
        if (onDraftSaved) onDraftSaved();
      } catch (error) {
        devLog("Failed to save draft:", error);
        if (!editorFocusedRef.current) {
          setSaveError(true);
        }
      } finally {
        if (!editorFocusedRef.current) {
          setIsSavingDraft(false);
        }
      }
    },
    [draftId, thread?.id, mode, linkTarget, currentUser?.email, onDraftSaved]
  );

  const debouncedSave = useCallback(
    debounce((data) => {
      // Only save if user is not actively typing (prevent state mutations during typing)
      if (!isTypingRef.current) {
        saveDraft(data);
      }
    }, 4000),
    [saveDraft]
  );

  useEffect(() => {
    debouncedSave({ to: toChips, cc: ccChips, bcc: bccChips, subject, body });
    return () => debouncedSave.cancel();
  }, [toChips, ccChips, bccChips, subject, body, debouncedSave]);

  // Cleanup typing timeout and final save on unmount
  useEffect(() => {
    return async () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // On unmount, flush debounce and do final save if dirty (max 800ms)
      debouncedSave.flush();

      if (isDirty() && (toChips.length > 0 || subject || body)) {
        try {
          const finalSavePromise = saveDraft({ to: toChips, cc: ccChips, bcc: bccChips, subject, body });
          await Promise.race([
            finalSavePromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 800))
          ]);
        } catch (err) {
          devLog('[UnifiedEmailComposer] Unmount final save timeout or failed:', err.message);
        }
      }
    };
  }, [debouncedSave, saveDraft]);

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
      devLog("Could not fetch customer:", error);
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
    const signatureHtml = buildSignatureHtml(currentUser?.email_signature, currentUser?.email_signature_image_url);
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

  // Calculate total attachment size and enforce hard limit
  const totalAttachmentSize = attachments.reduce((sum, att) => sum + (att.size || 0), 0);
  const ATTACHMENT_SIZE_LIMIT = 20 * 1024 * 1024; // 20MB
  const attachmentSizeExceeded = totalAttachmentSize > ATTACHMENT_SIZE_LIMIT;

  // Clear attachments when opening fresh compose or switching threads (drawer variant reuse)
  // GUARDRAIL: Include thread?.id in dependencies so attachments clear when switching threads
  // PROBLEM PREVENTED: Without thread?.id, switching threads carried over previous attachments (carryover bug)
  useEffect(() => {
    if (variant === "drawer" && open && !existingDraft) {
      setAttachments([]);
    }
  }, [variant, open, existingDraft, thread?.id]);

  // Auto-open attachments on mount
  useEffect(() => {
    if (autoOpenAttachments && variant === "inline") {
      setTimeout(() => {
        try {
          fileInputRef.current?.click();
        } catch (error) {
          devLog("Could not auto-open file picker:", error);
        }
      }, 100);
    }
  }, [autoOpenAttachments, variant]);

  // Compute content hash for idempotency
  const computeContentHash = (to, cc, bcc, subject, body, attachments) => {
    const content = JSON.stringify({
      to: to.sort(),
      cc: cc.sort(),
      bcc: bcc.sort(),
      subject,
      body,
      attachments: attachments.map(a => ({ filename: a.filename, size: a.size }))
    });
    // Simple hash (SHA-256 would be better but this is sufficient)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  };

  // Send email
  const handleSend = async () => {
    const textBody = body.replace(/<[^>]*>/g, "");
    if (toChips.length === 0 || !subject || !textBody.trim()) {
      toast.error("Please fill in recipients, subject, and message");
      return;
    }

    // Check recipient count (warn if > 10, but allow override)
    const totalRecipients = toChips.length + ccChips.length + bccChips.length;
    if (totalRecipients > 10 && !confirmedLargeRecipients) {
      toast.warning(
        `You're about to email ${totalRecipients} recipients. Click send again to confirm.`,
        { duration: 4000 }
      );
      setConfirmedLargeRecipients(true);
      return;
    }

    // Reset confirmation flag for next send
    setConfirmedLargeRecipients(false);

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

      // PART A: Convert pasted inline data-url images to CID attachments
      let processedAttachments = [...cleanAttachments];
      let processedBodyHtml = body;
      
      // Scan for data:image URLs in body
      const dataImageRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/gi;
      const inlineImages = [];
      let match;
      let index = 0;
      
      while ((match = dataImageRegex.exec(body)) !== null) {
        const [fullMatch, imageType, base64Data] = match;
        const contentId = `kgd-inline-${Date.now()}-${Math.random().toString(16).slice(2)}@kangaroogd`;
        const ext = imageType === 'jpeg' ? 'jpg' : imageType;
        
        inlineImages.push({
          originalSrc: `data:image/${imageType};base64,${base64Data}`,
          contentId,
          attachment: {
            filename: `inline-image-${index + 1}.${ext}`,
            mimeType: `image/${imageType}`,
            data: base64Data,
            size: Math.ceil(base64Data.length * 0.75), // Approximate bytes from base64
            is_inline: true,
            contentId
          }
        });
        index++;
      }
      
      // Replace data URLs with cid: references
      inlineImages.forEach(img => {
        processedBodyHtml = processedBodyHtml.replace(img.originalSrc, `cid:${img.contentId}`);
        processedAttachments.push(img.attachment);
      });

      // Render merge fields at send time
      let renderedSubject = subject;
      let renderedBodyHtml = processedBodyHtml;
      let unresolvedTokens = [];

      try {
        // Build template context from current state
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
            devLog("Could not fetch customer for merge fields:", error);
          }
        }

        const context = buildTemplateContext({
          project: linkedProject,
          customer,
          user: currentUser,
        });

        // Create a mock template object to use renderTemplate
        const mockTemplate = { subject, body };
        const rendered = renderTemplate(mockTemplate, context);
        
        renderedSubject = rendered.subject || subject;
        renderedBodyHtml = rendered.body || body;

        // Detect unresolved tokens (simple check for {field_name} pattern)
        const tokenRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
        const subjectTokens = (renderedSubject.match(tokenRegex) || []).map(t => t.slice(1, -1));
        const bodyTokens = (renderedBodyHtml.match(tokenRegex) || []).map(t => t.slice(1, -1));
        unresolvedTokens = [...new Set([...subjectTokens, ...bodyTokens])];
      } catch (err) {
        devLog('Merge field rendering error:', err);
        // Gracefully fallback to original content on error
        renderedSubject = subject;
        renderedBodyHtml = body;
      }

      // Warn if unresolved tokens remain
      if (unresolvedTokens.length > 0) {
        toast.warning(
          `Some merge fields could not be resolved: ${unresolvedTokens.join(', ')}. Email will be sent with tokens as-is.`,
          { duration: 5000 }
        );
      }

      // Compute content hash for idempotency
      const contentHash = computeContentHash(toChips, ccChips, bccChips, renderedSubject, renderedBodyHtml, processedAttachments);

      const payload = {
        to: toChips,
        cc: ccChips.length > 0 ? ccChips : undefined,
        bcc: bccChips.length > 0 ? bccChips : undefined,
        subject: renderedSubject,
        body_html: renderedBodyHtml,
        attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
        thread_id: thread?.id || null,
        gmail_thread_id: thread?.gmail_thread_id || undefined,

        // Idempotency
        draft_id: draftId || undefined,
        content_hash: contentHash,

        // Linking: Project or Contract ONLY (NO Job)
        project_id:
          linkTarget?.type === "project"
            ? linkTarget.id
            : thread?.project_id || undefined,
        project_name: linkTarget?.type === "project" ? linkedProject?.title : undefined,
        contract_id:
          linkTarget?.type === "contract"
            ? linkTarget.id
            : thread?.contract_id || undefined,

        // Source context for linking logic
        source_context: linkTarget?.type === "project" ? "project" : linkTarget?.type === "contract" ? "contract" : undefined,

        // Project-sent email context (for immediate linking at send time)
        origin: linkTarget?.type === "project" ? "project" : undefined,
        project_customer_id: linkedProject?.customer_id || undefined,
        project_address: linkedProject?.address_full || undefined,
        email_thread_id: thread?.id || null,
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

      // Warn if thread link conflict detected
      if (response.data?.thread_link_conflict) {
        toast.warning(
          "This thread is linked to another project. Ask admin to relink if needed.",
          { duration: 6000 }
        );
      }

      // Mark draft as sent after successful send
      if (draftId) {
        try {
          await base44.entities.EmailDraft.update(draftId, {
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        } catch (err) {
          devLog("Failed to update draft status:", err);
        }
      }

      // Immediately refetch thread messages to show sent email
      const baseThreadId = response.data?.baseThreadId || thread?.id;
      if (baseThreadId) {
        try {
          await queryClient.invalidateQueries({ queryKey: inboxKeys.messages(baseThreadId) });
          await queryClient.refetchQueries({ queryKey: inboxKeys.messages(baseThreadId) });
        } catch (err) {
          devLog("[UnifiedEmailComposer] Failed to refetch messages:", err);
        }

        // STEP 3: Optimistic UI update - if sent from project, immediately show thread link
        const projId = linkTarget?.type === "project" ? linkTarget.id : thread?.project_id;
        if (projId && linkTarget?.type === "project" && baseThreadId) {
          try {
            // Optimistically update thread to show project link
            await queryClient.invalidateQueries({ queryKey: inboxKeys.thread(baseThreadId) });
            await queryClient.invalidateQueries({ queryKey: inboxKeys.list() });
            
            // Refetch project emails to show sent message immediately
            await queryClient.invalidateQueries({ queryKey: ["project", projId] });
            await queryClient.refetchQueries({ queryKey: ["projectActivity", projId] });
            await queryClient.refetchQueries({ queryKey: ["projectEmails", projId] });
          } catch (err) {
            devLog("[UnifiedEmailComposer] Failed to refetch project activity:", err);
          }
        } else if (projId) {
          // Thread already linked to project - just refetch activity
          try {
            await queryClient.invalidateQueries({ queryKey: ["project", projId] });
            await queryClient.refetchQueries({ queryKey: ["projectActivity", projId] });
          } catch (err) {
            devLog("[UnifiedEmailComposer] Failed to refetch project activity:", err);
          }
        }
      }

      toast.success("Email sent successfully");
      if (onSent) await onSent(baseThreadId);

      handleClose();
    } catch (error) {
      const errorMsg = error.message || "Failed to send email";
      if (errorMsg.includes("ATTACHMENTS_TOO_LARGE")) {
        toast.error("Attachments exceed 20MB limit. Please remove or compress files before sending.", { duration: 5000 });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = async () => {
    // Flush debounced save immediately
    await debouncedSave.flush();

    // Final save with proper timeout (3-5s instead of 800ms for reliability)
    if (isDirty() && (toChips.length > 0 || subject || body)) {
      try {
        const finalSavePromise = saveDraft({ to: toChips, cc: ccChips, bcc: bccChips, subject, body });
        await Promise.race([
          finalSavePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 5000))
        ]);
      } catch (err) {
        // If save is still pending, keep composer open and warn user
        if (err.message === 'Save timeout') {
          toast.warning('Draft save is taking longer than expected. Please keep this tab open.', {
            duration: 6000
          });
          devLog('[UnifiedEmailComposer] Final save timed out, keeping composer open');
          return; // Do NOT close
        }
        devLog('[UnifiedEmailComposer] Final save failed:', err.message);
      }
    }

    // Reset init/typing refs so next compose session initializes correctly
    didInitBodyRef.current = false;
    userHasTypedRef.current = false;
    lastSavedComposeKeyRef.current = null;

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
          await queryClient.invalidateQueries({ queryKey: inboxKeys.messages(tid) });
          await queryClient.refetchQueries({ queryKey: inboxKeys.messages(tid) });
          
          // Attempt to upgrade selectedMessage with synced content
           // BUT: Do NOT update body if user has already started typing
           const fresh = queryClient.getQueryData(inboxKeys.messages(tid)) || [];
          const best = pickBestContextMessage(fresh, mode);
          if (best && (best.body_html || best.body_text)) {
            setSelectedMessage(best);
            // Body will be populated by init effect if not already typed
            // Check if synced content is still partial
            if (best.sync_status === "partial") {
              setSyncError('Messages synced, but some content is still unavailable (partial). Reply will use available content.');
            }
          } else {
            setSyncError('Messages synced but body content still unavailable. Header-only reply will be used.');
          }
        }
      })
      .catch((err) => {
        if (!unmountedRef.current) {
          setSyncError(err.message || 'Failed to sync messages');
          devLog('[UnifiedEmailComposer] Auto-sync error:', err);
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
                        await queryClient.invalidateQueries({ queryKey: inboxKeys.messages(thread.id) });
                        await queryClient.refetchQueries({ queryKey: inboxKeys.messages(thread.id) });

                        // Get latest messages and pick best context
                        const fresh = queryClient.getQueryData(inboxKeys.messages(thread.id)) || [];
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

            // Mark active typing to prevent autosave from mutating state
            isTypingRef.current = true;
            lastUserEditAtRef.current = Date.now();
            lastKeystrokeAtRef.current = Date.now();

            // Clear previous timeout and set new one (1500ms grace period for safer idle detection)
            // GUARDRAIL: Longer grace period prevents cursor jumps from rapid state updates
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
              isTypingRef.current = false;
            }, 1500);

            setBody(html);
            smartCompose.handleTextChange(html.replace(/<[^>]*>/g, ""));
          }}
          onFocus={() => {
            editorFocusedRef.current = true;
          }}
          onBlur={() => {
            editorFocusedRef.current = false;
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
        <div className={`space-y-2 bg-[#F9FAFB] rounded-lg p-3 border ${attachmentSizeExceeded ? "border-red-300 bg-red-50" : "border-[#E5E7EB]"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-[#6B7280]" />
              <label className="text-[13px] font-semibold text-[#4B5563]">
                {attachments.length} Attachment
                {attachments.length !== 1 ? "s" : ""} ({(totalAttachmentSize / 1024 / 1024).toFixed(1)} MB)
              </label>
            </div>
            {attachmentSizeExceeded && (
              <span className="text-[11px] font-medium text-red-700 bg-red-100 px-2 py-1 rounded">
                ⚠ Attachments exceed 20MB limit
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

  // Compute time elapsed since last save for banner
  const getTimeSinceLastSave = () => {
    if (!lastSaved) return null;
    const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
  };

  const draftStatus = (
    <div className="text-[12px] flex items-center gap-1.5">
      {isSavingDraft && (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          <span className="text-blue-600">Saving…</span>
        </>
      )}
      {!isSavingDraft && saveError && (
        <>
          <X className="w-3 h-3 text-red-500" />
          <span className="text-red-600">Save failed</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSaveError(false);
              saveDraft({ to: toChips, cc: ccChips, bcc: bccChips, subject, body });
            }}
            className="h-5 px-1.5 text-[11px] text-red-600 hover:bg-red-50"
          >
            Retry
          </Button>
        </>
      )}
      {!isSavingDraft && !saveError && lastSaved && (
        <>
          <Check className="w-3 h-3 text-green-600" />
          <span className="text-[#6B7280]">
            Saved • {getTimeSinceLastSave()}
          </span>
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
                disabled={isSending || toChips.length === 0 || !subject || !body || attachmentSizeExceeded}
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
            disabled={isSending || toChips.length === 0 || !subject || !body || attachmentSizeExceeded}
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