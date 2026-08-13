const fs = require('fs');
const sourcePath = 'c:/Users/bekza/OneDrive/Рабочий стол/today_ubt_attendance/today_crm/src/pages/EntResultsPage.tsx';
const targetPath = 'c:/Users/bekza/OneDrive/Рабочий стол/today_ubt_attendance/today_crm/src/pages/ent-results/tabs/EntMatrixTab.tsx';

const lines = fs.readFileSync(sourcePath, 'utf8').split('\n');

const matrixDataLogic = lines.slice(827, 931).join('\n'); // ── Matrix Table Data
const matrixStateLogic = lines.slice(670, 673).join('\n');
const matrixSortState = lines.slice(658, 661).join('\n');
const tableTabJSX = lines.slice(1324, 1646).join('\n');

const code = `import React, { useState, useMemo, Fragment } from "react";
import { GroupPersonAvatar } from "@/components/GroupPersonAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, Upload, PenLine, ChevronUp, ChevronDown, ChevronsUpDown, BarChart3 } from "lucide-react";
import { ACADEMIC_MONTHS, REAL_EXAM_TYPES, ENT_PROFILE_SUBJECTS, TOTAL_MAX, MONTH_LABELS, getScoreColor, getScoreBg, DeltaBadge, getMatrixCellBg, getGroupRowColor } from "../constants";

export function EntMatrixTab({
  allData,
  search,
  setSearch,
  profileFilter,
  setProfileFilter,
  isAllGroups,
  groupProfileMap,
  scoreRange,
  setScoreRange,
  performanceFilter,
  setPerformanceFilter,
  statusFilter,
  setStatusFilter,
  groups,
  isAdmin,
  dataMode,
  setXlsxImportOpen,
  setRealEntImportOpen,
  setEditStudent,
  loading
}: any) {
  const [showFilters, setShowFilters] = useState(false);
${matrixSortState}
${matrixStateLogic}
${matrixDataLogic}

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
${tableTabJSX}
    </div>
  );
}
`;

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Success rewrite');
