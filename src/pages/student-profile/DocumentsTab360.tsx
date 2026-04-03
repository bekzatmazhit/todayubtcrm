import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileText, Upload, Download, Trash2, Eye, Calendar,
  File, Image, FileArchive, FileSpreadsheet, Shield, AlertTriangle,
  Search, Filter, SortAsc, SortDesc,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = { data: any };

const DOCUMENT_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  contract:  { label: "Договор",    icon: FileText,      color: "text-blue-500 bg-blue-50 border-blue-200" },
  medical:   { label: "Мед. справка", icon: Shield,       color: "text-emerald-500 bg-emerald-50 border-emerald-200" },
  id:        { label: "Уд. личности", icon: File,         color: "text-violet-500 bg-violet-50 border-violet-200" },
  report:    { label: "Отчёт",      icon: FileSpreadsheet, color: "text-amber-500 bg-amber-50 border-amber-200" },
  exam:      { label: "Экзамен",    icon: FileText,      color: "text-indigo-500 bg-indigo-50 border-indigo-200" },
  passport:  { label: "Паспорт",    icon: File,          color: "text-slate-500 bg-slate-50 border-slate-200" },
  photo:     { label: "Фото",       icon: Image,         color: "text-pink-500 bg-pink-50 border-pink-200" },
  other:     { label: "Прочее",     icon: FileArchive,   color: "text-gray-500 bg-gray-50 border-gray-200" },
};

const getFileIcon = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return Image;
  if (["pdf", "doc", "docx"].includes(ext || "")) return FileText;
  if (["xls", "xlsx", "csv"].includes(ext || "")) return FileSpreadsheet;
  if (["zip", "rar", "7z"].includes(ext || "")) return FileArchive;
  return File;
};

const formatFileSize = (size: string) => {
  if (size.includes("MB")) return size;
  if (size.includes("KB")) return size;
  return `${size} B`;
};

export default function DocumentsTab360({ data }: Props) {
  const { documents } = data;
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  const documentTypes = ["all", ...Array.from(new Set(documents.map((d: any) => d.type))) as string[]];

  // Filter and sort documents
  const filteredDocs = documents
    .filter((d: any) => typeFilter === "all" || d.type === typeFilter)
    .filter((d: any) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.uploadedAt.includes(searchQuery)
    )
    .sort((a: any, b: any) => {
      let comparison = 0;
      if (sortBy === "date") comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      else if (sortBy === "name") comparison = a.name.localeCompare(b.name);
      else if (sortBy === "size") comparison = parseInt(a.size) - parseInt(b.size);
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Document stats
  const stats = {
    total: documents.length,
    byType: documents.reduce((acc: Record<string, number>, d: any) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {}),
    recentCount: documents.filter((d: any) => {
      const uploadDate = new Date(d.uploadedAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return uploadDate > thirtyDaysAgo;
    }).length,
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Загрузка документа (demo)");
    setIsUploadOpen(false);
  };

  const handleDelete = (docId: number) => {
    if (confirm("Вы уверены, что хотите удалить этот документ?")) {
      alert(`Документ ${docId} удален (demo)`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Всего документов</span>
              <FileText className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-foreground">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {stats.recentCount} за последние 30 дней
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Договоры</span>
              <FileText className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-foreground">{stats.byType.contract || 0}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Основной документ</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Отчёты</span>
              <FileSpreadsheet className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-foreground">{stats.byType.report || 0}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Прогресс ученика</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Экзамены</span>
              <Shield className="h-4 w-4 text-violet-500" />
            </div>
            <div className="text-2xl font-black text-foreground">{(stats.byType.exam || 0) + (stats.byType.medical || 0)}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Результаты ЕНТ + справки</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск документов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {/* Type Filter */}
              <div className="flex items-center gap-1">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-background"
                >
                  {documentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "all" ? "Все типы" : DOCUMENT_TYPE_CONFIG[type]?.label || type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "date" | "name" | "size")}
                  className="text-sm border rounded-md px-2 py-1 bg-background"
                >
                  <option value="date">По дате</option>
                  <option value="name">По имени</option>
                  <option value="size">По размеру</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="p-1 hover:bg-muted rounded"
                >
                  {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </button>
              </div>

              {/* Upload Button */}
              <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    Загрузить
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Загрузить документ</DialogTitle>
                    <DialogDescription>
                      Загрузите новый документ для ученика. Поддерживаются форматы: PDF, JPG, PNG, DOCX, XLSX.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpload} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="docType">Тип документа</Label>
                      <select
                        id="docType"
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        required
                      >
                        {Object.entries(DOCUMENT_TYPE_CONFIG).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="docName">Название</Label>
                      <Input id="docName" placeholder="Например: Договор 2026" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="docFile">Файл</Label>
                      <Input id="docFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="docComment">Комментарий (опционально)</Label>
                      <Textarea id="docComment" placeholder="Дополнительная информация..." rows={2} />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                        Отмена
                      </Button>
                      <Button type="submit">Загрузить</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc: any) => {
          const config = DOCUMENT_TYPE_CONFIG[doc.type] || DOCUMENT_TYPE_CONFIG.other;
          const Icon = config.icon;
          const FileIcon = getFileIcon(doc.name);

          return (
            <Card
              key={doc.id}
              className={cn(
                "group hover:shadow-md transition-all duration-200 border-2",
                config.color.split(" ").slice(2).join(" ")
              )}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", config.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="p-1.5 hover:bg-muted rounded"
                      title="Просмотр"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={doc.url}
                      download
                      className="p-1.5 hover:bg-muted rounded"
                      title="Скачать"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 hover:bg-red-100 rounded text-red-600"
                      title="Удалить"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm truncate" title={doc.name}>
                    {doc.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className={cn("text-[10px]", config.color)}>
                      {config.label}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {doc.uploadedAt}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileIcon className="h-3 w-3" />
                      {formatFileSize(doc.size)}
                    </span>
                    <span className="text-[10px] uppercase">{doc.type}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredDocs.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <div>
                <p className="font-medium">Документы не найдены</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "Попробуйте изменить поисковый запрос" : "Загрузите первый документ"}
                </p>
              </div>
              {!searchQuery && (
                <Button size="sm" variant="outline" onClick={() => setIsUploadOpen(true)}>
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  Загрузить документ
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{previewDoc.name}</DialogTitle>
              <DialogDescription>
                Тип: {DOCUMENT_TYPE_CONFIG[previewDoc.type]?.label || previewDoc.type} ·
                Загружен: {previewDoc.uploadedAt} ·
                Размер: {previewDoc.size}
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <FileText className="h-16 w-16 text-muted-foreground/30" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDoc(null)}>
                Закрыть
              </Button>
              <a href={previewDoc.url} download>
                <Button>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Скачать
                </Button>
              </a>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Compliance Warning */}
      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Требования к документам
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside">
                <li>Договор должен быть подписан обеими сторонами</li>
                <li>Медицинские справки действительны 6 месяцев</li>
                <li>Копии удостоверения должны быть читаемыми</li>
                <li>Отчёты формируются автоматически ежемесячно</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
