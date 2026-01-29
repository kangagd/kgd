import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { isDiscoveryEnabled, isDiscoveryAllowedUser, setDiscoveryFlagEnabled } from "@/components/lib/discoveryGate";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Direction inference (copied from Inbox logic, not imported)
const ORG_EMAILS = ["kangaroogd.com.au", "admin@kangaroogd.com.au"];

function inferDirection(message) {
  if (!message?.from_address) return "unknown";
  const fromLower = message.from_address.toLowerCase();
  return ORG_EMAILS.some(org => fromLower.includes(org)) ? "sent" : "received";
}

export default function DiscoveryPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        if (!isDiscoveryEnabled(currentUser)) {
          setNotFound(true);
        }
      } catch (error) {
        setNotFound(true);
      }
    };
    loadUser();
  }, []);

  // Access guard
  if (notFound || (user && !isDiscoveryEnabled(user))) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#111827]">Not Found</h1>
        <p className="text-[#6B7280] mt-2">This page is not available.</p>
      </div>
    );
  }

  // Fetch threads with React Query
  const { data: threadsData, isLoading, refetch } = useQuery({
    queryKey: ["discoveryThreads"],
    queryFn: async () => {
      const response = await base44.functions.invoke("getMyEmailThreadsPaged", {
        limit: 300,
        beforeDate: null,
      });
      return response.data?.threads || [];
    },
    enabled: !!user && isDiscoveryEnabled(user),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  // Compute metrics client-side
  const metrics = React.useMemo(() => {
    const threads = threadsData || [];

    // Unprocessed: no project link and not archived
    const unprocessedCount = threads.filter(t => !t.project_id && !t.is_archived).length;

    // Needs attention: linked threads where direction="received" and newer than last internal message
    const needsAttentionCount = threads.filter(t => {
      if (!t.project_id) return false;

      // Infer direction from last message
      const direction = t.lastMessageDirection || "unknown";
      if (direction !== "received") return false;

      // Compare timestamps safely
      const lastMsgDate = t.last_message_date ? new Date(t.last_message_date) : null;
      const lastInternalDate = t.lastInternalMessageAt ? new Date(t.lastInternalMessageAt) : null;

      if (!lastMsgDate || !lastInternalDate) return false;
      return lastMsgDate > lastInternalDate;
    }).length;

    return { unprocessedCount, needsAttentionCount };
  }, [threadsData]);

  const handleDiscover = () => {
    setDiscoveryFlagEnabled(false);
    navigate("/");
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h1 className="text-3xl font-bold text-[#111827] mb-6">Discovery (Private Preview)</h1>

        {isLoading ? (
          <p className="text-[#6B7280]">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#F9FAFB] rounded-lg p-4">
              <p className="text-[14px] text-[#111827]">
                <strong>Unprocessed:</strong> {metrics.unprocessedCount}
              </p>
              <p className="text-[14px] text-[#111827] mt-2">
                <strong>Needs attention:</strong> {metrics.needsAttentionCount}
              </p>
              {refreshedAt && (
                <p className="text-[12px] text-[#6B7280] mt-3">
                  Last refreshed: {new Date(refreshedAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  refetch();
                  setRefreshedAt(Date.now());
                }}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>

            {isDiscoveryAllowedUser(user) && (
              <div className="mt-6 p-4 bg-[#FEF3C7] border border-[#FCD34D] rounded-lg">
                <p className="text-[13px] text-[#92400E] mb-3">
                  <strong>Local Controls:</strong> Enabling discovery requires console access.
                </p>
                <code className="block text-[11px] bg-white p-2 rounded border border-[#D97706] mb-3 text-[#111827]">
                  localStorage.setItem("kgd_ff_DISCOVERY_LAYER_V1","1")
                </code>
                <Button
                  onClick={handleDiscover}
                  variant="destructive"
                  size="sm"
                >
                  Disable Discovery (local)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}