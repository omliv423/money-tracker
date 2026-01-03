"use client";

import { useState, useMemo } from "react";
import { Search, X, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Tables } from "@/lib/supabase";

type Category = Tables<"categories">;

interface CategoryPickerProps {
  categories: Category[];
  selectedId: string;
  onSelect: (categoryId: string) => void;
  type: "income" | "expense";
}

export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  type,
}: CategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter categories by type
  const filteredByType = useMemo(
    () => categories.filter((cat) => cat.type === type),
    [categories, type]
  );

  // Get selected category name
  const selectedCategory = categories.find((c) => c.id === selectedId);

  // Filter by search query
  const searchFiltered = useMemo(() => {
    if (!searchQuery) return filteredByType;
    const query = searchQuery.toLowerCase();
    return filteredByType.filter((cat) =>
      cat.name.toLowerCase().includes(query)
    );
  }, [filteredByType, searchQuery]);

  // Build hierarchical structure with proper sorting
  const parentCategories = useMemo(
    () => searchFiltered
      .filter((cat) => cat.parent_id === null)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [searchFiltered]
  );

  const getChildren = (parentId: string) =>
    searchFiltered
      .filter((cat) => cat.parent_id === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  // Get orphaned children (children whose parent is filtered out)
  const orphanedChildren = useMemo(() => {
    if (!searchQuery) return [];
    return searchFiltered
      .filter(
        (cat) =>
          cat.parent_id !== null &&
          !searchFiltered.some((p) => p.id === cat.parent_id)
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [searchFiltered, searchQuery]);

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="w-full justify-between font-normal"
      >
        <span className={selectedCategory ? "" : "text-muted-foreground"}>
          {selectedCategory?.name || "カテゴリを選択"}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>カテゴリを選択</DialogTitle>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="カテゴリを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category List */}
          <div className="max-h-[50vh] overflow-y-auto -mx-6 px-6 py-2 space-y-4">
            {parentCategories.length === 0 && orphanedChildren.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                該当するカテゴリがありません
              </p>
            ) : (
              <>
                {/* Parent categories and their children */}
                {parentCategories.map((parent) => {
                  const children = getChildren(parent.id);
                  const hasChildren = children.length > 0;

                  return (
                    <div key={parent.id}>
                      {hasChildren ? (
                        <>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            {parent.name}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {children.map((child) => (
                              <button
                                key={child.id}
                                onClick={() => handleSelect(child.id)}
                                className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                                  child.id === selectedId
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary hover:bg-accent"
                                }`}
                              >
                                {child.id === selectedId && (
                                  <Check className="w-3 h-3" />
                                )}
                                {child.name}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => handleSelect(parent.id)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                            parent.id === selectedId
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary hover:bg-accent"
                          }`}
                        >
                          {parent.id === selectedId && (
                            <Check className="w-3 h-3" />
                          )}
                          {parent.name}
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Orphaned children (when search matches child but not parent) */}
                {orphanedChildren.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      検索結果
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {orphanedChildren.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleSelect(cat.id)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                            cat.id === selectedId
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary hover:bg-accent"
                          }`}
                        >
                          {cat.id === selectedId && (
                            <Check className="w-3 h-3" />
                          )}
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
