const fs = require('fs');
const p = 'c:/Users/bekza/OneDrive/Рабочий стол/today_ubt_attendance/today_crm/src/pages/EntResultsPage.tsx';
let content = fs.readFileSync(p, 'utf8');

// 1. Remove matrix state
content = content.replace(
  /  \/\/ Matrix specific state\n  const \[showMatrixSubjects, setShowMatrixSubjects\] = useState\(false\);\n  const \[hiddenMatrixMonths, setHiddenMatrixMonths\] = useState<Set<string>>\(new Set\(\)\);/,
  ""
);
content = content.replace(
  /  const \[matrixSortCol, setMatrixSortCol\] = useState<string>\("name"\);\n  const \[matrixSortDir, setMatrixSortDir\] = useState<"asc" | "desc">\("asc"\);\n/,
  ""
);

// 2. Remove matrix Data (from `// ── Matrix Table Data (All Months & All Exam Types) ──` up to `// Summary averages`)
content = content.replace(
  /  \/\/ ── Matrix Table Data \(All Months & All Exam Types\) ──[\s\S]*?const monthsWithData = useMemo\(\(\) => \{[\s\S]*?\}, \[matrixData\]\);\n/,
  ""
);

// 3. Replace the TabsContent value="table" content
const tabReplacement = `        {/* ══════ MATRIX TABLE TAB ══════ */}
        <TabsContent value="table" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <EntMatrixTab
            allData={allData}
            search={search}
            setSearch={setSearch}
            profileFilter={profileFilter}
            setProfileFilter={setProfileFilter}
            isAllGroups={isAllGroups}
            groupProfileMap={groupProfileMap}
            scoreRange={scoreRange}
            setScoreRange={setScoreRange}
            performanceFilter={performanceFilter}
            setPerformanceFilter={setPerformanceFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            groups={groups}
            isAdmin={isAdmin}
            dataMode={dataMode}
            setXlsxImportOpen={setXlsxImportOpen}
            setRealEntImportOpen={setRealEntImportOpen}
            setEditStudent={setEditStudent}
            loading={loading}
          />
        </TabsContent>`;

content = content.replace(
  /        \{\/\* ══════ MATRIX TABLE TAB ══════ \*\/\}[\s\S]*?<\/TabsContent>/,
  tabReplacement
);

// 4. Add import
if (!content.includes('import { EntMatrixTab }')) {
  content = content.replace(
    /import \{ EntAnalyticsTab \} from "\.\/ent-results\/tabs\/EntAnalyticsTab";/,
    'import { EntAnalyticsTab } from "./ent-results/tabs/EntAnalyticsTab";\nimport { EntMatrixTab } from "./ent-results/tabs/EntMatrixTab";'
  );
}

fs.writeFileSync(p, content, 'utf8');
console.log('EntResultsPage updated');
