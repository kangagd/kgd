import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Save, Trash2, ChevronDown, ChevronUp, Check } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

export default function EmailComposerDrawer({
  open,
  onOpenChange,
  mode = "new",
  threadId = null,
  gmail_thread_id = null,
  defaultLinkTarget = null,
  existingDraftId = null,
}) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [draftId, setDraftId] = useState(existingDraftId);
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const autosaveTimer = useRef(null);

  // Load user
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Load existing draft if provided
  const { data: existingDraft } = useQuery({
    queryKey: ["draft", existingDraftId],
    queryFn: () => base44.entities.DraftEmail.get(existingDraftId),
    enabled: !!existingDraftId && open,
  });

  // Load thread messages for reply mode
  const { data: threadMessages = [] } = useQuery({
    queryKey: ["threadMessages", threadId],
    queryFn: async () => {
      if (!threadId) return [];
      const messages = await base44.entities.EmailMessage.filter(
        { thread_id: threadId },
        "-sent_at"
      );
      return messages;
    },
    enabled: !!threadId && mode !== "new" && open,
  });

  // Initialize draft from existing or thread
  useEffect(() => {
    if (!open) return;

    if (existingDraft) {
      setTo(existingDraft.to || []);
      setCc(existingDraft.cc || []);
      setBcc(existingDraft.bcc || []);
      setSubject(existingDraft.subject || "");
      setBodyHtml(existingDraft.bodyHtml || "");
      setShowCc(existingDraft.cc?.length > 0);
      setShowBcc(existingDraft.bcc?.length > 0);
      setLastSavedAt(existingDraft.lastSavedAt);
    } else if (threadMessages.length > 0 && mode !== "new") {
      const latestMessage = threadMessages[0];
      
      // Set recipients based on mode
      if (mode === "reply") {
        setTo([latestMessage.from_address]);
      } else if (mode === "reply_all") {
        const replyTo = [latestMessage.from_address];
        const replyCc = [
          ...(latestMessage.to_addresses || []),
          ...(latestMessage.cc_addresses || []),
        ].filter((addr) => addr !== user?.email);
        setTo(replyTo);
        setCc(replyCc);
        setShowCc(replyCc.length > 0);
      } else if (mode === "forward") {
        setTo([]);
        setSubject(`Fwd: ${latestMessage.subject || ""}`);
        setBodyHtml(`\n\n---------- Forwarded message ---------\nFrom: ${latestMessage.from_address}\nDate: ${new Date(latestMessage.sent_at).toLocaleString()}\nSubject: ${latestMessage.subject}\n\n${latestMessage.body_html || latestMessage.body_text || ""}`);
      }

      // Set subject
      if (mode === "reply" || mode === "reply_all") {
        const subj = latestMessage.subject || "";
        setSubject(subj.startsWith("Re:") ? subj : `Re: ${subj}`);
      }
    }
  }, [existingDraft, threadMessages, mode, open, user?.email]);

  // Autosave draft
  useEffect(() => {
    if (!open || !user) return;

    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveDraft();
    }, 1000);

    return () => clearTimeout(autosaveTimer.current);
  }, [to, cc, bcc, subject, bodyHtml, open, user]);

  const saveDraft = async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      const draftData = {
        threadId: threadId || null,
        gmail_thread_id: gmail_thread_id || null,
        linkedEntityType: defaultLinkTarget?.type || "none",
        linkedEntityId: defaultLinkTarget?.id || null,
        fromEmail: user.email,
        to,
        cc,
        bcc,
        subject,
        bodyHtml,
        bodyText: bodyHtml.replace(/<[^>]*>/g, ""), // Strip HTML for text version
        status: "draft",
        lastSavedAt: new Date().toISOString(),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      };

      let savedDraft;
      if (draftId) {
        savedDraft = await base44.entities.DraftEmail.update(draftId, draftData);
      } else {
        savedDraft = await base44.entities.DraftEmail.create(draftData);
        setDraftId(savedDraft.id);
      }

      setLastSavedAt(savedDraft.lastSavedAt);
    } catch (error) {
      console.error("Failed to save draft:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      if (to.length === 0) throw new Error("Please add at least one recipient");

      // Update draft status to sending
      if (draftId) {
        await base44.entities.DraftEmail.update(draftId, { status: "sending" });
      }

      // Send email via backend function
      const result = await base44.functions.invoke("gmailSendEmail", {
        to,
        cc,
        bcc,
        subject,
        body_html: bodyHtml,
        thread_id: threadId,
        gmail_thread_id: gmail_thread_id,
      });

      // Mark draft as sent
      if (draftId) {
        await base44.entities.DraftEmail.update(draftId, { status: "sent" });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailThreads"] });
      queryClient.invalidateQueries({ queryKey: ["emailThread", threadId] });
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      toast.success("Email sent successfully");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send email");
      if (draftId) {
        base44.entities.DraftEmail.update(draftId, {
          status: "failed",
          errorMessage: error.message,
        });
      }
    },
  });

  const handleAddRecipient = (type) => {
    const input = type === "to" ? toInput : type === "cc" ? ccInput : bccInput;
    const setter = type === "to" ? setTo : type === "cc" ? setCc : setBcc;
    const inputSetter = type === "to" ? setToInput : type === "cc" ? setCcInput : setBccInput;

    if (input && input.includes("@")) {
      setter((prev) => [...prev, input.trim()]);
      inputSetter("");
    }
  };

  const handleRemoveRecipient = (type, email) => {
    const setter = type === "to" ? setTo : type === "cc" ? setCc : setBcc;
    setter((prev) => prev.filter((e) => e !== email));
  };

  const handleDiscard = async () => {
    if (draftId) {
      await base44.entities.DraftEmail.delete(draftId);
    }
    handleClose();
  };

  const handleClose = () => {
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject("");
    setBodyHtml("");
    setShowCc(false);
    setShowBcc(false);
    setDraftId(null);
    setLastSavedAt(null);
    setToInput("");
    setCcInput("");
    setBccInput("");
    onOpenChange(false);
  };

  const modeTitle = {
    new: "Compose Email",
    reply: "Reply",
    reply_all: "Reply All",
    forward: "Forward",
  }[mode];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh] max-h-[90vh]">
        <DrawerHeader className="border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <DrawerTitle>{modeTitle}</DrawerTitle>
            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              {isSaving && <span>Saving...</span>}
              {!isSaving && lastSavedAt && (
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-600" />
                  Saved
                </span>
              )}
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* To Field */}
          <div>
            <Label>To</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {to.map((email) => (
                <Badge key={email} variant="secondary" className="flex items-center gap-1">
                  {email}
                  <button
                    onClick={() => handleRemoveRecipient("to", email)}
                    className="ml-1 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === " ") {
                    e.preventDefault();
                    handleAddRecipient("to");
                  }
                }}
                placeholder="Add recipient email..."
              />
              <Button onClick={() => handleAddRecipient("to")} size="sm">
                Add
              </Button>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowCc(!showCc)}
                className="text-xs text-[#6B7280] hover:text-[#111827]"
              >
                {showCc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />} Cc
              </button>
              <button
                onClick={() => setShowBcc(!showBcc)}
                className="text-xs text-[#6B7280] hover:text-[#111827]"
              >
                {showBcc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />} Bcc
              </button>
            </div>
          </div>

          {/* Cc Field */}
          {showCc && (
            <div>
              <Label>Cc</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {cc.map((email) => (
                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                    {email}
                    <button
                      onClick={() => handleRemoveRecipient("cc", email)}
                      className="ml-1 hover:text-red-600"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      e.preventDefault();
                      handleAddRecipient("cc");
                    }
                  }}
                  placeholder="Add Cc email..."
                />
                <Button onClick={() => handleAddRecipient("cc")} size="sm">
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Bcc Field */}
          {showBcc && (
            <div>
              <Label>Bcc</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {bcc.map((email) => (
                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                    {email}
                    <button
                      onClick={() => handleRemoveRecipient("bcc", email)}
                      className="ml-1 hover:text-red-600"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      e.preventDefault();
                      handleAddRecipient("bcc");
                    }
                  }}
                  placeholder="Add Bcc email..."
                />
                <Button onClick={() => handleAddRecipient("bcc")} size="sm">
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          {/* Link Target Badge */}
          {defaultLinkTarget && (
            <div className="text-xs text-[#6B7280]">
              Linked to: {defaultLinkTarget.type} #{defaultLinkTarget.number || defaultLinkTarget.id}
            </div>
          )}

          {/* Body */}
          <div>
            <Label>Message</Label>
            <ReactQuill
              value={bodyHtml}
              onChange={setBodyHtml}
              theme="snow"
              placeholder="Write your message..."
              className="bg-white"
              style={{ height: "300px", marginBottom: "50px" }}
            />
          </div>
        </div>

        <DrawerFooter className="border-t border-[#E5E7EB]">
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={handleDiscard}
              disabled={sendMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Discard
            </Button>
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={isSaving || sendMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || to.length === 0}
            >
              <Send className="w-4 h-4 mr-2" />
              {sendMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}