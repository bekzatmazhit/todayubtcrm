import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { bulkImportStudents, fetchGroups } from "@/lib/api";
import { Download, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkImportModal({ open, onOpenChange, onSuccess }: BulkImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ existingCount: number, toImport: any[] } | null>(null);
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      fetchGroups().then(setGroups).catch(console.error);
    }
  }, [open]);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      "ID (опционально)": "",
      "ФИО": "",
      "Телефон": "",
      "Имя родителя": "",
      "Телефон родителя": "",
      "ID Группы": ""
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Шаблон");
    XLSX.writeFile(wb, "шаблон_учеников.xlsx");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws);
      const toImport = rows.map(r => ({
        id: r["ID (опционально)"] || r["ID"] || r["id"] || null,
        full_name: r["ФИО"] || r["Имя"] || r["full_name"],
        phone: r["Телефон"] || r["phone"] ? String(r["Телефон"] || r["phone"]) : "",
        parent_name: r["Имя родителя"] || r["parent_name"] || "",
        parent_phone: r["Телефон родителя"] || r["parent_phone"] ? String(r["Телефон родителя"] || r["parent_phone"]) : "",
        group_id: r["ID Группы"] || r["group_id"] || null
      })).filter(s => s.full_name);
      
      if (!toImport.length) throw new Error("Не найдено валидных данных. Убедитесь что есть колонка 'ФИО'.");
      
      // Step 1: Preview
      const res = await bulkImportStudents(toImport, true);
      
      if (res.existingCount > 0) {
        // Ask for confirmation
        setPreviewResult({ existingCount: res.existingCount, toImport });
      } else {
        // No conflicts, just import
        const finalRes = await bulkImportStudents(toImport, false, false);
        toast({ title: "Успех", description: `Добавлено новых учеников: ${finalRes.importedCount}` });
        onSuccess();
        handleClose();
      }
    } catch (err: any) { 
      toast({ title: "Ошибка импорта", description: err.message, variant: "destructive" }); 
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = async (overwrite: boolean) => {
    if (!previewResult) return;
    setLoading(true);
    try {
      const finalRes = await bulkImportStudents(previewResult.toImport, false, overwrite);
      toast({ 
        title: "Успех", 
        description: `Добавлено новых: ${finalRes.importedCount}, Обновлено старых: ${finalRes.updatedCount || 0}` 
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast({ title: "Ошибка импорта", description: err.message, variant: "destructive" }); 
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPreviewResult(null);
    onOpenChange(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        {previewResult ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Найдены совпадения
              </DialogTitle>
              <DialogDescription className="pt-3 text-base text-foreground">
                В загруженном файле найдено <b>{previewResult.existingCount}</b> учеников, чьи ID уже существуют в базе данных.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 text-sm text-muted-foreground">
              Вы хотите перезаписать их текущие данные новыми данными из Excel файла? 
              (Те, кого нет в базе, в любом случае будут добавлены как новые).
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleConfirmImport(false)} disabled={loading}>
                Нет, пропустить их
              </Button>
              <Button onClick={() => handleConfirmImport(true)} disabled={loading}>
                Да, перезаписать данные
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Импорт учеников из Excel</DialogTitle>
              <DialogDescription>
                Загрузите файл Excel. Чтобы избежать ошибок, рекомендуем использовать наш готовый шаблон.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <Button variant="secondary" onClick={downloadTemplate} className="w-full flex items-center gap-2">
                <Download className="h-4 w-4" />
                Скачать шаблон Excel
              </Button>
              
              <div className="bg-muted/50 p-3 rounded-lg border text-sm">
                <div className="font-semibold mb-2 text-foreground text-xs uppercase tracking-wider">Справочник ID Групп:</div>
                {groups.length === 0 ? (
                  <div className="text-muted-foreground text-xs">Загрузка...</div>
                ) : (
                  <ScrollArea className="h-[100px] pr-3">
                    <table className="w-full text-xs">
                      <tbody>
                        {groups.map(g => (
                          <tr key={g.id} className="border-b last:border-0">
                            <td className="py-1.5 font-medium truncate max-w-[150px]">{g.name}</td>
                            <td className="py-1.5 text-right font-mono text-muted-foreground">{g.id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">или загрузите готовый</span></div>
              </div>
              <Input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleImportExcel} disabled={loading} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>Отмена</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
