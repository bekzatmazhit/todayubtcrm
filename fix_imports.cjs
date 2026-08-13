const fs = require('fs');
const p = 'c:/Users/bekza/OneDrive/Рабочий стол/today_ubt_attendance/today_crm/src/pages/ent-results/tabs/EntMatrixTab.tsx';
let content = fs.readFileSync(p, 'utf8');
content = content.replace(/from "\.\.\/constants";/, 'from "../../EntResultsPage";');
fs.writeFileSync(p, content, 'utf8');
console.log('Fixed imports');
