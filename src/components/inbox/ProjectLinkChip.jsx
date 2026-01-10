import { Link, FolderKanban, AlertCircle } from "lucide-react";
import { isLinked, isSuggested, isIgnored } from "@/components/domain/threadLinkingHelpers";

export default function ProjectLinkChip({ thread }) {
  const linked = isLinked(thread);
  const suggested = isSuggested(thread);
  const ignored = isIgnored(thread);

  if (!linked && !suggested && !ignored) return null;

  // Linked state
  if (linked) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-lg text-[11px]">
        <Link className="w-3 h-3 text-green-600 flex-shrink-0" />
        <span className="text-green-700 font-medium truncate max-w-[120px]">
          #{thread.project_number}
        </span>
      </div>
    );
  }

  // Suggested state
  if (suggested) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[11px]">
        <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
        <span className="text-amber-700 font-medium">AI suggested</span>
      </div>
    );
  }

  // Ignored state
  if (ignored) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[11px]">
        <span className="text-gray-500 font-medium">Ignored</span>
      </div>
    );
  }

  return null;
}