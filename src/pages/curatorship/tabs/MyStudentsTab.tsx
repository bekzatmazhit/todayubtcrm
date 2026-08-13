import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronRight, MoreHorizontal, ExternalLink } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { formatPhone } from "@/lib/utils";
import { getWhatsAppLink } from "../index";

export function MyStudentsTab({ 
  students, 
  onSelectStudent 
}: { 
  students: any[];
  onSelectStudent: (student: any) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredStudents = useMemo(
    () => students.filter((s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.group_name || "").toLowerCase().includes(search.toLowerCase())
    ),
    [students, search]
  );

  return (
    <>
      <div className="mb-4">
        <Input
          placeholder="Поиск по ФИО или группе..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>ФИО</TableHead>
              <TableHead>Группа</TableHead>
              <TableHead>Общий балл ЕНТ</TableHead>
              <TableHead>Имя родителя</TableHead>
              <TableHead>Тел. родителя</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">Нет учеников</TableCell>
              </TableRow>
            ) : filteredStudents.map((s: any, i: number) => {
              const waLink = getWhatsAppLink(s.parent_phone, s.full_name, s.group_name);
              return (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onSelectStudent(s)}
                >
                  <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                  <TableCell className="font-medium flex items-center gap-2">
                    <UserAvatar user={s} size="sm" />
                    {s.full_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs flex w-max items-center gap-1.5 px-2 py-0.5">
                      <GroupPersonAvatar groupName={s.group_name} avatarUrl={s.group_avatar} size={14} showTooltip={false} />
                      {s.group_name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.last_ent_score != null ? (
                      <span className={`font-semibold text-sm ${
                        s.last_ent_score >= 100 ? "text-green-600" :
                        s.last_ent_score >= 80 ? "text-yellow-600" : "text-red-600"
                      }`}>{s.last_ent_score}</span>
                    ) : <span className="text-muted-foreground text-xs">нет данных</span>}
                  </TableCell>
                  <TableCell className="text-sm">{s.parent_name || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell className="text-sm">{s.parent_phone ? formatPhone(s.parent_phone) : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSelectStudent(s)}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      {waLink && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <ExternalLink className="h-3.5 w-3.5 text-green-600" /> WhatsApp родителю
                              </a>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
