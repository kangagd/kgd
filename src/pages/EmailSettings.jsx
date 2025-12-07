import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Signature, Clock, Settings2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function EmailSettings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const queryClient = useQueryClient();

  // Email signature settings
  const [emailSignature, setEmailSignature] = useState("");
  const [signatureImageUrl, setSignatureImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Out of office settings
  const [oooEnabled, setOooEnabled] = useState(false);
  const [oooMessage, setOooMessage] = useState("");
  const [oooStartDate, setOooStartDate] = useState("");
  const [oooEndDate, setOooEndDate] = useState("");

  // Sync settings
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncFrequency, setSyncFrequency] = useState("5");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load existing settings
      setEmailSignature(currentUser.email_signature || "");
      setSignatureImageUrl(currentUser.email_signature_image_url || "");
      setOooEnabled(currentUser.out_of_office_enabled || false);
      setOooMessage(currentUser.out_of_office_message || "");
      setOooStartDate(currentUser.out_of_office_start || "");
      setOooEndDate(currentUser.out_of_office_end || "");
      setAutoSyncEnabled(currentUser.email_auto_sync !== false);
      setSyncFrequency(currentUser.email_sync_frequency || "5");
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error("Failed to load email settings");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    try {
      setUploadingImage(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSignatureImageUrl(file_url);
      toast.success("Image uploaded");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setSignatureImageUrl("");
  };

  const handleSaveSignature = async () => {
    try {
      setSaving(true);
      await base44.auth.updateMe({
        email_signature: emailSignature,
        email_signature_image_url: signatureImageUrl
      });
      toast.success("Email signature saved");
    } catch (error) {
      console.error("Error saving signature:", error);
      toast.error("Failed to save signature");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOutOfOffice = async () => {
    try {
      setSaving(true);
      await base44.auth.updateMe({
        out_of_office_enabled: oooEnabled,
        out_of_office_message: oooMessage,
        out_of_office_start: oooStartDate,
        out_of_office_end: oooEndDate
      });
      toast.success("Out of office settings saved");
    } catch (error) {
      console.error("Error saving out of office:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSyncSettings = async () => {
    try {
      setSaving(true);
      await base44.auth.updateMe({
        email_auto_sync: autoSyncEnabled,
        email_sync_frequency: syncFrequency
      });
      toast.success("Sync settings saved");
    } catch (error) {
      console.error("Error saving sync settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const { data: threads = [] } = useQuery({
    queryKey: ['emailThreads'],
    queryFn: () => base44.entities.EmailThread.list('-last_message_date'),
    enabled: !!user
  });

  const handleAnalyzeAllEmails = async () => {
    const threadsToAnalyze = threads.filter(t => !t.ai_tags || t.ai_tags.length === 0);
    
    if (threadsToAnalyze.length === 0) {
      toast.info('All emails have already been analyzed');
      return;
    }

    setIsAnalyzingAll(true);
    toast.info(`Analyzing ${threadsToAnalyze.length} emails...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < threadsToAnalyze.length; i += 3) {
      const batch = threadsToAnalyze.slice(i, i + 3);
      
      await Promise.all(batch.map(async (thread) => {
        try {
          await base44.functions.invoke('generateEmailThreadInsights', {
            email_thread_id: thread.id
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to analyze thread ${thread.id}:`, error);
          errorCount++;
        }
      }));

      if (i + 3 < threadsToAnalyze.length) {
        toast.info(`Progress: ${Math.min(i + 3, threadsToAnalyze.length)}/${threadsToAnalyze.length} emails analyzed`);
      }
    }

    setIsAnalyzingAll(false);
    queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    
    if (errorCount === 0) {
      toast.success(`Successfully analyzed ${successCount} emails with AI tagging and priority`);
    } else {
      toast.warning(`Analyzed ${successCount} emails. ${errorCount} failed.`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827] mb-2">Email Settings</h1>
          <p className="text-sm text-[#6B7280]">
            Manage your email signature, out of office replies, and sync preferences
          </p>
        </div>

        <Tabs defaultValue="signature" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signature" className="gap-2">
              <Signature className="w-4 h-4" />
              Signature
            </TabsTrigger>
            <TabsTrigger value="ooo" className="gap-2">
              <Clock className="w-4 h-4" />
              Out of Office
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Sync Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signature" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Signature className="w-5 h-5" />
                  Email Signature
                </CardTitle>
                <CardDescription>
                  Create a signature that will be automatically added to your outgoing emails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Signature Image/Logo</Label>
                  <div className="flex items-start gap-4">
                    {signatureImageUrl ? (
                      <div className="relative">
                        <img
                          src={signatureImageUrl}
                          alt="Signature"
                          className="max-w-[200px] max-h-[100px] rounded-lg border border-[#E5E7EB]"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveImage}
                          className="mt-2"
                        >
                          Remove Image
                        </Button>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-[#6B7280] mt-1">
                          Upload your logo or signature image (max 2MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Your Signature</Label>
                  <Textarea
                    value={emailSignature}
                    onChange={(e) => setEmailSignature(e.target.value)}
                    placeholder="Best regards,&#10;John Doe&#10;Senior Technician&#10;KangarooGD&#10;john@kangaroogd.com.au&#10;0400 000 000"
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-[#6B7280]">
                    Tip: Use line breaks to format your signature. This will appear at the bottom of your emails.
                  </p>
                </div>

                {(emailSignature || signatureImageUrl) && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="border border-[#E5E7EB] rounded-lg p-4 bg-[#F9FAFB]">
                      {signatureImageUrl && (
                        <img
                          src={signatureImageUrl}
                          alt="Signature"
                          className="max-w-[200px] max-h-[100px] mb-3"
                        />
                      )}
                      {emailSignature && (
                        <div className="text-sm whitespace-pre-wrap text-[#111827]">
                          {emailSignature}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSaveSignature}
                  disabled={saving}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Signature"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ooo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Out of Office Auto-Reply
                </CardTitle>
                <CardDescription>
                  Automatically send replies when you're away from the office
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-lg">
                  <div>
                    <Label className="text-base">Enable Out of Office</Label>
                    <p className="text-sm text-[#6B7280] mt-1">
                      Automatically send replies to incoming emails
                    </p>
                  </div>
                  <Switch
                    checked={oooEnabled}
                    onCheckedChange={setOooEnabled}
                  />
                </div>

                {oooEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={oooStartDate}
                          onChange={(e) => setOooStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          value={oooEndDate}
                          onChange={(e) => setOooEndDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Auto-Reply Message</Label>
                      <Textarea
                        value={oooMessage}
                        onChange={(e) => setOooMessage(e.target.value)}
                        placeholder="Thank you for your email. I am currently out of the office and will return on [date]. For urgent matters, please contact [alternative contact]."
                        rows={6}
                      />
                      <p className="text-xs text-[#6B7280]">
                        This message will be sent automatically to anyone who emails you during the specified period.
                      </p>
                    </div>

                    {oooMessage && (
                      <div className="space-y-2">
                        <Label>Preview</Label>
                        <div className="border border-[#E5E7EB] rounded-lg p-4 bg-[#F9FAFB]">
                          <div className="text-sm whitespace-pre-wrap text-[#111827]">
                            {oooMessage}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Button
                  onClick={handleSaveOutOfOffice}
                  disabled={saving || (oooEnabled && (!oooMessage || !oooStartDate || !oooEndDate))}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Out of Office Settings"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  Email Sync Settings
                </CardTitle>
                <CardDescription>
                  Configure how often your emails are synchronized
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-lg">
                  <div>
                    <Label className="text-base">Auto-Sync Enabled</Label>
                    <p className="text-sm text-[#6B7280] mt-1">
                      Automatically sync emails in the background
                    </p>
                  </div>
                  <Switch
                    checked={autoSyncEnabled}
                    onCheckedChange={setAutoSyncEnabled}
                  />
                </div>

                {autoSyncEnabled && (
                  <div className="space-y-2">
                    <Label>Sync Frequency (minutes)</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {["1", "5", "15", "30"].map((freq) => (
                        <Button
                          key={freq}
                          variant={syncFrequency === freq ? "default" : "outline"}
                          onClick={() => setSyncFrequency(freq)}
                          className={syncFrequency === freq ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : ""}
                        >
                          {freq} min
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      Emails will be checked every {syncFrequency} minute{syncFrequency !== "1" ? "s" : ""}
                    </p>
                  </div>
                )}

                <div className="p-4 bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg">
                  <div className="flex gap-3">
                    <Mail className="w-5 h-5 text-[#0284C7] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[#0C4A6E]">Gmail Connection Status</p>
                      <p className="text-sm text-[#0369A1] mt-1">
                        {user?.gmail_access_token ? "Connected and syncing" : "Not connected"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-900 mb-2">AI Email Analysis</p>
                      <p className="text-sm text-purple-700 mb-3">
                        Analyze all your emails with AI to automatically add tags, categorize by priority, and extract key information.
                      </p>
                      <Button
                        onClick={handleAnalyzeAllEmails}
                        disabled={isAnalyzingAll}
                        variant="outline"
                        className="border-purple-300 hover:bg-purple-100"
                      >
                        {isAnalyzingAll ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Analyze All Emails
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSaveSyncSettings}
                  disabled={saving}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Sync Settings"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}