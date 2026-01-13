import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LinkIcon, Mail, X, User, Loader2 } from "lucide-react";
import { useState } from "react";

export default function BulkActionsToolbar({ selectedCount, onLinkToProject, onMarkAsRead, onClose, onAssign, users, onClearSelection }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action) => {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-3 py-2 bg-[#FAE008]/10 border-b border-[#FAE008]/30 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-sm font-medium text-[#111827]">
          {selectedCount} selected
        </span>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction(onMarkAsRead)}
          disabled={loading}
          className="h-7 px-2 text-xs"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
          <span className="ml-1">Mark Read</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction(onClose)}
          disabled={loading}
          className="h-7 px-2 text-xs"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          <span className="ml-1">Close</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction(onLinkToProject)}
          disabled={loading}
          className="h-7 px-2 text-xs"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
          <span className="ml-1">Link to Project</span>
        </Button>

        <Select onValueChange={(email) => handleAction(() => onAssign(email))} disabled={loading}>
          <SelectTrigger className="h-7 w-[140px] text-xs">
            <User className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Assign to..." />
          </SelectTrigger>
          <SelectContent>
            {users.map(user => (
              <SelectItem key={user.email} value={user.email} className="text-xs">
                {user.full_name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={onClearSelection}
        className="h-7 px-2 text-xs text-[#6B7280]"
      >
        Clear
      </Button>
    </div>
  );
}