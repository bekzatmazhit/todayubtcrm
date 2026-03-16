import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { saveDraft, loadDraft, clearDraft } from "@/lib/drafts";

interface MentionUser {
  id: number;
  name: string;
  surname: string;
  avatar_url?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  users: MentionUser[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  draftKey?: string;
}

export function MentionInput({ value, onChange, onKeyDown, users, placeholder, className, disabled, draftKey }: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load draft on mount
  useEffect(() => {
    if (draftKey) {
      const saved = loadDraft(draftKey);
      if (saved && !value) onChange(saved);
    }
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save draft on change (debounced)
  useEffect(() => {
    if (!draftKey) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (value.trim()) saveDraft(draftKey, value);
      else clearDraft(draftKey);
    }, 500);
  }, [value, draftKey]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(val);

    // Find @ before cursor
    const textBeforeCursor = val.substring(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    if (atIdx >= 0 && (atIdx === 0 || textBeforeCursor[atIdx - 1] === " ")) {
      const query = textBeforeCursor.substring(atIdx + 1).toLowerCase();
      if (!query.includes(" ")) {
        const matched = users.filter(u => {
          const full = `${u.name} ${u.surname}`.toLowerCase();
          const nameL = u.name.toLowerCase();
          const surnameL = u.surname.toLowerCase();
          return nameL.startsWith(query) || surnameL.startsWith(query) || full.startsWith(query);
        }).slice(0, 6);
        setSuggestions(matched);
        setShowSuggestions(matched.length > 0);
        setMentionStart(atIdx);
        setSelectedIdx(0);
        return;
      }
    }
    setShowSuggestions(false);
  }, [onChange, users]);

  const insertMention = useCallback((user: MentionUser) => {
    const before = value.substring(0, mentionStart);
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const after = value.substring(cursorPos);
    const tag = `@${user.name}${user.surname}`;
    const newVal = `${before}${tag} ${after}`;
    onChange(newVal);
    setShowSuggestions(false);
    setTimeout(() => {
      const pos = before.length + tag.length + 1;
      inputRef.current?.setSelectionRange(pos, pos);
      inputRef.current?.focus();
    }, 0);
  }, [value, mentionStart, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx(i => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(i => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[selectedIdx]);
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }
    onKeyDown?.(e);
  }, [showSuggestions, suggestions, selectedIdx, insertMention, onKeyDown]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={className}
        disabled={disabled}
      />
      {showSuggestions && (
        <div ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-md shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
          {suggestions.map((u, i) => (
            <button key={u.id} type="button"
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer text-left ${i === selectedIdx ? "bg-accent" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}>
              <UserAvatar user={{ full_name: `${u.name} ${u.surname}`, avatar_url: u.avatar_url }} size="xs" />
              <span>{u.name} {u.surname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders comment text with highlighted @mentions */
export function RenderMentionText({ text }: { text: string }) {
  const parts = text.split(/(@\S+)/g);
  return (
    <p className="text-sm">
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}
