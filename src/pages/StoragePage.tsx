import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Folder, FileText, FileSpreadsheet, FileImage, FileVideo, FileAudio, FileArchive,
  File, Link as LinkIcon, Presentation, Plus, Trash2, ChevronRight, Home, Upload,
  ExternalLink, FolderPlus, Pencil, MoreVertical, BookOpen, Star, Heart,
  Briefcase, GraduationCap, Users, Settings, Code, Globe, Camera,
  Music, Film, Database, Shield, Zap, Award, Target, Bookmark,
  FolderOpen, FolderHeart, FolderCog, Download, Table2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import TablesPage from "@/pages/TablesPage";
import {
  fetchStorageFolders, fetchStorageItems, createStorageFolder, deleteStorageFolder,
  createStorageLink, uploadStorageFile, deleteStorageItem, updateStorageFolder, updateStorageItem,
  type StorageFolder, type StorageItem,
} from "@/lib/api";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

// Icon registry
const FOLDER_ICONS: Record<string, LucideIcon> = {
  folder: Folder, "folder-open": FolderOpen, "folder-heart": FolderHeart, "folder-cog": FolderCog,
  star: Star, heart: Heart, briefcase: Briefcase, "graduation-cap": GraduationCap,
  users: Users, settings: Settings, code: Code, globe: Globe,
  camera: Camera, music: Music, film: Film, database: Database,
  shield: Shield, zap: Zap, award: Award, target: Target,
  bookmark: Bookmark, "book-open": BookOpen,
};

const FOLDER_ICON_LIST = Object.keys(FOLDER_ICONS);

const FOLDER_COLORS: Record<string, string> = {
  folder: "text-amber-500", "folder-open": "text-amber-500", "folder-heart": "text-rose-500",
  "folder-cog": "text-zinc-500", star: "text-yellow-500", heart: "text-rose-500",
  briefcase: "text-blue-600", "graduation-cap": "text-violet-500", users: "text-sky-500",
  settings: "text-zinc-500", code: "text-emerald-500", globe: "text-blue-500",
  camera: "text-pink-500", music: "text-purple-500", film: "text-red-500",
  database: "text-teal-500", shield: "text-green-600", zap: "text-yellow-500",
  award: "text-amber-600", target: "text-red-500", bookmark: "text-blue-500",
  "book-open": "text-indigo-500",
};

// File extension to Lucide icon + label
function getFileTypeInfo(name: string): { Icon: LucideIcon; label: string; color: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg","jpeg","png","gif","webp","svg","bmp","ico","tiff"].includes(ext))
    return { Icon: FileImage, label: ext.toUpperCase(), color: "text-pink-500 bg-pink-50 dark:bg-pink-950/30" };
  if (["pdf"].includes(ext))
    return { Icon: FileText, label: "PDF", color: "text-red-500 bg-red-50 dark:bg-red-950/30" };
  if (["doc","docx","odt","rtf"].includes(ext))
    return { Icon: FileText, label: ext === "docx" ? "DOCX" : ext.toUpperCase(), color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" };
  if (["xls","xlsx","csv","ods"].includes(ext))
    return { Icon: FileSpreadsheet, label: ext === "xlsx" ? "XLSX" : ext.toUpperCase(), color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" };
  if (["ppt","pptx","odp"].includes(ext))
    return { Icon: Presentation, label: ext === "pptx" ? "PPTX" : ext.toUpperCase(), color: "text-orange-500 bg-orange-50 dark:bg-orange-950/30" };
  if (["zip","rar","7z","tar","gz"].includes(ext))
    return { Icon: FileArchive, label: ext.toUpperCase(), color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" };
  if (["mp4","avi","mov","mkv","webm","flv"].includes(ext))
    return { Icon: FileVideo, label: ext.toUpperCase(), color: "text-purple-500 bg-purple-50 dark:bg-purple-950/30" };
  if (["mp3","wav","ogg","flac","aac","wma"].includes(ext))
    return { Icon: FileAudio, label: ext.toUpperCase(), color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30" };
  if (["js","ts","jsx","tsx","py","java","c","cpp","html","css","json","xml","yaml","yml","md"].includes(ext))
    return { Icon: Code, label: ext.toUpperCase(), color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" };
  if (["txt","log"].includes(ext))
    return { Icon: FileText, label: ext.toUpperCase(), color: "text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50" };
  return { Icon: File, label: ext ? ext.toUpperCase() : "FILE", color: "text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50" };
}

interface Crumb { id: number | null; name: string }

export default function StoragePage() {
  const { user } = useAuth();
  const userId = user ? Number(user.id) : null;

  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([{ id: null, name: "Хранилище" }]);
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // New folder
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderIcon, setNewFolderIcon] = useState("folder");

  // New link
  const [showNewLink, setShowNewLink] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<{ type: "folder" | "item"; id: number; name: string; icon: string | null } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameIcon, setRenameIcon] = useState("folder");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, _setActiveTab] = useState<"files" | "tables">(() => {
    try { const v = localStorage.getItem("today_storage_tab"); if (v === "files" || v === "tables") return v; } catch {} return "files";
  });
  const setActiveTab = (v: "files" | "tables") => { _setActiveTab(v); try { localStorage.setItem("today_storage_tab", v); } catch {} };

  const loadContents = useCallback(async (folderId: number | null) => {
    setLoading(true);
    const [f, i] = await Promise.all([fetchStorageFolders(folderId), fetchStorageItems(folderId)]);
    setFolders(f);
    setItems(i);
    setLoading(false);
  }, []);

  useEffect(() => { loadContents(currentFolderId); }, [currentFolderId, loadContents]);

  function openFolder(folder: StorageFolder) {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  }

  function navigateCrumb(crumb: Crumb) {
    setCurrentFolderId(crumb.id);
    const idx = breadcrumbs.findIndex(c => c.id === crumb.id);
    setBreadcrumbs(prev => prev.slice(0, idx + 1));
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      await createStorageFolder({ name: newFolderName.trim(), parent_id: currentFolderId, creator_id: userId });
      // Set icon if not default
      if (newFolderIcon !== "folder") {
        const fList = await fetchStorageFolders(currentFolderId);
        const created = fList.find(f => f.name === newFolderName.trim());
        if (created) await updateStorageFolder(created.id, { icon: newFolderIcon });
      }
      setNewFolderName(""); setNewFolderIcon("folder"); setShowNewFolder(false);
      loadContents(currentFolderId);
      toast.success("Папка создана");
    } catch { toast.error("Ошибка создания папки"); }
  }

  async function handleDeleteFolder(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    try { await deleteStorageFolder(id); loadContents(currentFolderId); toast("Папка удалена", { duration: 4000 }); }
    catch { toast.error("Ошибка удаления"); }
  }

  async function handleCreateLink() {
    if (!linkName.trim() || !linkUrl.trim()) return;
    try {
      let url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      await createStorageLink({ folder_id: currentFolderId, name: linkName.trim(), url_or_path: url, uploaded_by: userId });
      setLinkName(""); setLinkUrl(""); setShowNewLink(false);
      loadContents(currentFolderId);
      toast.success("Ссылка добавлена");
    } catch { toast.error("Ошибка добавления ссылки"); }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      await Promise.all(Array.from(files).map(f => uploadStorageFile(currentFolderId, f, userId)));
      loadContents(currentFolderId);
      toast.success("Файлы загружены: " + files.length);
    } catch { toast.error("Ошибка загрузки файла"); }
  }

  async function handleDeleteItem(id: number) {
    try { await deleteStorageItem(id); loadContents(currentFolderId); toast("Удалено", { duration: 4000 }); }
    catch { toast.error("Ошибка удаления"); }
  }

  function openRename(type: "folder" | "item", id: number, name: string, icon: string | null) {
    setRenameTarget({ type, id, name, icon });
    setRenameName(name);
    setRenameIcon(icon || (type === "folder" ? "folder" : ""));
  }

  async function handleRename() {
    if (!renameTarget || !renameName.trim()) return;
    try {
      if (renameTarget.type === "folder") {
        await updateStorageFolder(renameTarget.id, { name: renameName.trim(), icon: renameIcon || null });
      } else {
        await updateStorageItem(renameTarget.id, { name: renameName.trim(), icon: renameIcon || null });
      }
      setRenameTarget(null);
      loadContents(currentFolderId);
      toast.success("Переименовано");
    } catch { toast.error("Ошибка переименования"); }
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function onDragLeave(e: React.DragEvent) { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }

  function renderFolderIcon(iconKey: string | null, size: string = "h-10 w-10") {
    const key = iconKey || "folder";
    const IconComp = FOLDER_ICONS[key] || Folder;
    const color = FOLDER_COLORS[key] || "text-amber-500";
    return <IconComp className={`${size} ${color}`} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-2xl font-bold">Хранилище</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Файлы, ссылки, таблицы для всей команды</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab switcher */}
          <div className="flex bg-muted rounded-lg p-1">
            <button onClick={() => setActiveTab("files")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "files" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <FolderOpen className="h-4 w-4" /> Файлы
            </button>
            <button onClick={() => setActiveTab("tables")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "tables" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Table2 className="h-4 w-4" /> Таблицы
            </button>
          </div>
          {activeTab === "files" && (
            <>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-1" /> Добавить</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowNewFolder(true)}>
                    <FolderPlus className="h-4 w-4 mr-2" /> Новая папка
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Загрузить файлы
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowNewLink(true)}>
                    <LinkIcon className="h-4 w-4 mr-2" /> Добавить ссылку
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {activeTab === "tables" ? (
        <TablesPage />
      ) : (
    <div
      className={`space-y-5 min-h-full transition-colors rounded-xl ${isDragging ? "bg-primary/5 ring-2 ring-primary ring-inset" : ""}`}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm flex-wrap">
        {breadcrumbs.map((crumb, idx) => (
          <span key={crumb.id ?? "root"} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <button
              onClick={() => navigateCrumb(crumb)}
              className={`flex items-center gap-1 hover:text-primary transition-colors rounded px-1 py-0.5 ${
                idx === breadcrumbs.length - 1 ? "font-medium text-foreground pointer-events-none" : "text-muted-foreground"
              }`}
            >
              {idx === 0 && <Home className="h-3.5 w-3.5" />}
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      {isDragging && (
        <div className="flex items-center justify-center h-24 border-2 border-dashed border-primary rounded-xl text-primary font-medium">
          <Upload className="h-5 w-5 mr-2" /> Отпустите файлы для загрузки
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Folders */}
          {folders.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Папки</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {folders.map(folder => (
                  <Card
                    key={folder.id}
                    onClick={() => openFolder(folder)}
                    className="p-3 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors group relative"
                  >
                    <div className="flex flex-col items-center gap-2">
                      {renderFolderIcon(folder.icon)}
                      <span className="text-sm font-medium text-center leading-tight line-clamp-2 break-all">{folder.name}</span>
                    </div>
                    {/* Actions menu */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <button className="p-1 rounded hover:bg-accent"><MoreVertical className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => openRename("folder", folder.id, folder.name, folder.icon)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Переименовать
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={e => handleDeleteFolder(folder.id, e as unknown as React.MouseEvent)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Files & Links */}
          {items.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Файлы и ссылки</h2>
              <div className="space-y-1.5">
                {items.map(item => {
                  const isLink = item.type === "link";
                  const { Icon, label, color } = isLink
                    ? { Icon: Globe, label: "LINK", color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30" }
                    : getFileTypeInfo(item.name);
                  // Use custom icon if set
                  const customIcon = item.icon && FOLDER_ICONS[item.icon];
                  const DisplayIcon = customIcon || Icon;
                  const displayColor = customIcon ? (FOLDER_COLORS[item.icon!] || "text-zinc-500") : color.split(" ")[0];

                  return (
                    <Card key={item.id} className="px-3 py-2.5 flex items-center gap-3 group hover:bg-accent/20 transition-colors">
                      {/* File type icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${customIcon ? "" : color.split(" ").slice(1).join(" ")}`}>
                        <DisplayIcon className={`h-5 w-5 ${displayColor}`} />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={isLink ? item.url_or_path : `http://localhost:3001${item.url_or_path}`}
                            target="_blank" rel="noopener noreferrer"
                            className="font-medium text-sm hover:text-primary truncate"
                          >
                            {item.name}
                          </a>
                          {isLink && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>{label}</span>
                          <span className="text-xs text-muted-foreground" title={new Date(item.created_at).toLocaleString("ru-RU")}>{(() => {
                            const diff = Date.now() - new Date(item.created_at).getTime();
                            const min = Math.floor(diff / 60000);
                            if (min < 60) return "только что";
                            const hr = Math.floor(min / 60);
                            if (hr < 24) return `${hr} ч. назад`;
                            const d = Math.floor(hr / 24);
                            if (d === 1) return "Вчера";
                            if (d < 7) return `${d} дн. назад`;
                            return new Date(item.created_at).toLocaleDateString("ru-RU");
                          })()}</span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {!isLink && (
                          <a
                            href={`http://localhost:3001${item.url_or_path}`}
                            download
                            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded hover:bg-accent text-muted-foreground"><MoreVertical className="h-4 w-4" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openRename("item", item.id, item.name, item.icon)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Переименовать
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteItem(item.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty state */}
          {folders.length === 0 && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Folder className="h-12 w-12 opacity-30" />
              <p className="text-sm">Папка пуста</p>
              <p className="text-xs">Перетащите файлы сюда или нажмите Добавить</p>
            </div>
          )}
        </>
      )}
    </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новая папка</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Название папки"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Иконка</p>
              <div className="flex flex-wrap gap-1.5">
                {FOLDER_ICON_LIST.map(key => {
                  const IC = FOLDER_ICONS[key];
                  const clr = FOLDER_COLORS[key] || "text-zinc-400";
                  return (
                    <button
                      key={key} onClick={() => setNewFolderIcon(key)}
                      className={`p-2 rounded-lg border transition-all ${newFolderIcon === key ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-transparent hover:bg-accent"}`}
                    >
                      <IC className={`h-5 w-5 ${clr}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>Отмена</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Link Dialog */}
      <Dialog open={showNewLink} onOpenChange={setShowNewLink}>
        <DialogContent>
          <DialogHeader><DialogTitle>Добавить ссылку</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Название ссылки" value={linkName} onChange={e => setLinkName(e.target.value)} autoFocus />
            <Input
              placeholder="URL (например: https://drive.google.com/...)"
              value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateLink()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewLink(false)}>Отмена</Button>
            <Button onClick={handleCreateLink} disabled={!linkName.trim() || !linkUrl.trim()}>Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={open => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Переименовать</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Новое название"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRename()}
              autoFocus
            />
            {renameTarget?.type === "folder" && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Иконка</p>
                <div className="flex flex-wrap gap-1.5">
                  {FOLDER_ICON_LIST.map(key => {
                    const IC = FOLDER_ICONS[key];
                    const clr = FOLDER_COLORS[key] || "text-zinc-400";
                    return (
                      <button
                        key={key} onClick={() => setRenameIcon(key)}
                        className={`p-2 rounded-lg border transition-all ${renameIcon === key ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-transparent hover:bg-accent"}`}
                      >
                        <IC className={`h-5 w-5 ${clr}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Отмена</Button>
            <Button onClick={handleRename} disabled={!renameName.trim()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}