import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, X } from "lucide-react";

export default function ProjectTagsSelector({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: allTags = [] } = useQuery({
    queryKey: ['projectTags-active'],
    queryFn: () => base44.entities.ProjectTagDefinition.filter({ is_active: true }, 'name'),
  });

  const selectedTags = allTags.filter(tag => value.includes(tag.id));

  const filteredTags = allTags.filter(tag =>
    !searchTerm || tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleTag = (tagId) => {
    if (value.includes(tagId)) {
      onChange(value.filter(id => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  };

  const removeTag = (tagId) => {
    onChange(value.filter(id => id !== tagId));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {selectedTags.map(tag => (
          <Badge
            key={tag.id}
            style={{ backgroundColor: tag.color }}
            className="text-white font-medium pl-2 pr-1 py-1 flex items-center gap-1"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              className="h-7 text-[12px]"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <Input
                  placeholder="Search tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>

              <div className="max-h-[240px] overflow-y-auto space-y-1">
                {filteredTags.length === 0 ? (
                  <p className="text-[13px] text-[#9CA3AF] text-center py-4">
                    No tags found
                  </p>
                ) : (
                  filteredTags.map(tag => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={value.includes(tag.id)}
                        onCheckedChange={() => toggleTag(tag.id)}
                      />
                      <Badge
                        style={{ backgroundColor: tag.color }}
                        className="text-white font-medium text-[11px]"
                      >
                        {tag.name}
                      </Badge>
                      {tag.description && (
                        <span className="text-[12px] text-[#6B7280] flex-1 truncate">
                          {tag.description}
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}