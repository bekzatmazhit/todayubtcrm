import React, { Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/UserAvatar'; // Assuming this component exists
import { ArrowUpRight, BookCopy, DollarSign, FileArchive, MessageCircle, TrendingUp, UserCheck, UserX, WhatsApp } from 'lucide-react';

// --- LAZY LOADED TABS ---
const AnalyticsTab = lazy(() => import('./student-profile/AnalyticsTab'));
const GradesTab = lazy(() => import('./student-profile/GradesTab'));
const FinancesTab = lazy(() => import('./student-profile/FinancesTab'));
const CommsLogTab = lazy(() => import('./student-profile/CommsLogTab'));
const DocumentsTab = lazy(() => import('./student-profile/DocumentsTab'));


// --- MOCK DATA ---
// This giant object simulates the result of complex database queries and aggregations
const mockStudentData = {
    id: 123,
    name: 'Аружан Муратова',
    avatarUrl: '/path/to/avatar.jpg', // Replace with a real path or use a placeholder
    age: 17,
    grade: '11 "А"',
    registrationDate: '2025-09-01',
    groups: ['Математическая грамотность (C1)', 'Физика (B2)'],
    heroMetrics: {
        churnRisk: { value: 78, label: 'Риск оттока', trend: 'up', description: 'Высокий риск из-за пропусков и снижения успеваемости' },
        academicDelta: { value: 12.5, label: 'Академ. дельта', trend: 'up', description: 'Средний балл вырос на 12.5% с начала года' },
        attendance: { value: 75, label: 'Посещаемость', trend: 'down', description: '3 пропущенных занятия в этом месяце' },
        financialStatus: { value: -15000, label: 'Баланс', currency: '₸', description: 'Долг за текущий месяц' },
        curatorPulse: 'Проконтролировать оплату до 25.03',
        nextLesson: 'Физика, 20.03.2026 18:00',
    },
    analytics: {
        scoreDynamics: [
            { subject: 'Мат. грамотность', date: '2026-01-15', score: 18, groupAvg: 17 },
            { subject: 'Мат. грамотность', date: '2026-02-15', score: 22, groupAvg: 20 },
            { subject: 'Мат. грамотность', date: '2026-03-15', score: 21, groupAvg: 22 },
            { subject: 'Физика', date: '2026-01-15', score: 25, groupAvg: 28 },
            { subject: 'Физика', date: '2026-02-15', score: 30, groupAvg: 31 },
            { subject: 'Физика', date: '2026-03-15', score: 28, groupAvg: 32 },
        ],
        attendanceHeatmap: [
            { date: '2026-03-01', status: 'present' },
            { date: '2026-03-03', status: 'late' },
            { date: '2026-03-05', status: 'absent' },
            // ... more data
        ],
        homeworkCompletionRate: 85, // in percent
        parentalEngagementScore: 65, // out of 100
        ltv: 250000, // Lifetime Value in KZT
    },
    grades: {
        entResults: [
            { id: 1, date: '2026-03-15', subject: 'Математическая грамотность', score: 21, total: 30, details: 'Западает тема "Логарифмы"' },
            { id: 2, date: '2026-03-15', subject: 'Физика', score: 28, total: 40, details: 'Отличный результат по "Кинематике"' },
            { id: 3, date: '2026-02-15', subject: 'Математическая грамотность', score: 22, total: 30, details: '' },
            { id: 4, date: '2026-02-15', subject: 'Физика', score: 30, total: 40, details: '' },
        ],
        homework: [
            { id: 1, date: '2026-03-18', subject: 'Физика', task: 'Задачи №1-5 по теме "Динамика"', status: 'Сдано', grade: '10/10' },
            { id: 2, date: '2026-03-17', subject: 'Мат. грамотность', task: 'Тест по "Тригонометрии"', status: 'Просрочено', grade: '5/10' },
        ]
    },
    finances: {
        transactions: [
            { id: 'trx_1', date: '2026-03-05', amount: 50000, status: 'paid', description: 'Оплата за март' },
            { id: 'trx_2', date: '2026-02-05', amount: 50000, status: 'paid', description: 'Оплата за февраль' },
            { id: 'inv_3', date: '2026-04-01', amount: 65000, status: 'due', description: 'Счет за апрель (с учетом доп. занятий)' },
        ],
        balance: -15000,
        currency: '₸',
    },
    commsLogs: [
        { id: 1, date: '2026-03-18T10:00:00', type: 'task', author: 'Куратор Алия', text: 'Проконтролировать оплату до 25.03', status: 'В работе' },
        { id: 2, date: '2026-03-17T15:30:00', type: 'call', author: 'Мама', text: 'Обсуждали снижение успеваемости по мат. грамотности. Рекомендовано доп. занятие.', status: 'Завершено' },
        { id: 3, date: '2026-03-16T12:00:00', type: 'system', author: 'Система', text: 'Автоматическое уведомление об отсутствии на уроке Физики.', status: '' },
    ],
    documents: [
        { id: 1, name: 'Договор на оказание услуг.pdf', size: '1.2MB', date: '2025-09-01', category: 'Юридические' },
        { id: 2, name: 'Удостоверение личности.jpg', size: '680KB', date: '2025-09-01', category: 'Личные данные' },
    ]
};


const MetricCard = ({ title, value, description, trend, currency }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {trend === 'up' ? <ArrowUpRight className="h-4 w-4 text-green-500" /> : <TrendingUp className="h-4 w-4 text-red-500" />}
        </CardHeader>
        <CardContent>
            <div className={`text-2xl font-bold ${value < 0 ? 'text-red-500' : ''}`}>
                {value} {currency}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export default function StudentProfilePage() {
    const { studentId } = useParams(); // In a real app, you'd use this ID to fetch data
    const student = mockStudentData; // Using mock data for this example

    const getRiskColor = (risk) => {
        if (risk > 70) return 'bg-red-500';
        if (risk > 40) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="flex flex-col h-full p-4 md:p-6">
            {/* Breadcrumbs and Global Actions */}
            <header className="flex items-center justify-between pb-4 border-b">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem><BreadcrumbLink href="/students">Ученики</BreadcrumbLink></BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem><BreadcrumbPage>{student.name}</BreadcrumbPage></BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm"><MessageCircle className="mr-2 h-4 w-4" />Написать</Button>
                    <Button variant="outline" size="sm"><FileArchive className="mr-2 h-4 w-4" />Экспорт</Button>
                    <Button variant="destructive" size="sm"><UserX className="mr-2 h-4 w-4" />Архивировать</Button>
                </div>
            </header>

            {/* Student Hero Block */}
            <div className="py-6">
                <div className="flex items-start gap-6">
                    <UserAvatar userName={student.name} src={student.avatarUrl} className="w-24 h-24 text-4xl" />
                    <div className="flex-1">
                        <div className="flex items-center gap-4">
                            <h1 className="text-3xl font-bold">{student.name}</h1>
                            <Badge variant="secondary">{student.grade}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            На курсе с {new Date(student.registrationDate).toLocaleDateString('ru-RU')}, Возраст: {student.age}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {student.groups.map(g => <Badge key={g} variant="outline">{g}</Badge>)}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                           <div className={`text-lg font-bold ${getRiskColor(student.heroMetrics.churnRisk.value)} text-white px-2 py-1 rounded`}>
                               {student.heroMetrics.churnRisk.value}%
                           </div>
                           <div className="text-xs text-muted-foreground">Риск оттока</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hero Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
                <MetricCard title="Академ. дельта" value={`${student.heroMetrics.academicDelta.value}%`} description={student.heroMetrics.academicDelta.description} trend={student.heroMetrics.academicDelta.trend} />
                <MetricCard title="Посещаемость" value={`${student.heroMetrics.attendance.value}%`} description={student.heroMetrics.attendance.description} trend={student.heroMetrics.attendance.trend} />
                <MetricCard title="Финансовый баланс" value={student.heroMetrics.financialStatus.value.toLocaleString('ru-RU')} currency="₸" description={student.heroMetrics.financialStatus.description} trend="down" />
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="text-sm font-medium">Пульс куратора</CardTitle></CardHeader>
                    <CardContent>
                        <p className="font-semibold">{student.heroMetrics.curatorPulse}</p>
                        <p className="text-sm text-muted-foreground mt-2">Следующий урок: {student.heroMetrics.nextLesson}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content with Tabs */}
            <Tabs defaultValue="analytics" className="flex-1 flex flex-col">
                <TabsList>
                    <TabsTrigger value="analytics"><TrendingUp className="mr-2 h-4 w-4"/>Аналитика</TabsTrigger>
                    <TabsTrigger value="grades"><BookCopy className="mr-2 h-4 w-4"/>Успеваемость</TabsTrigger>
                    <TabsTrigger value="finances"><DollarSign className="mr-2 h-4 w-4"/>Финансы</TabsTrigger>
                    <TabsTrigger value="logs"><MessageCircle className="mr-2 h-4 w-4"/>Связь и Логи</TabsTrigger>
                    <TabsTrigger value="documents"><FileArchive className="mr-2 h-4 w-4"/>Документы</TabsTrigger>
                </TabsList>
                <Suspense fallback={<div className="flex-1 flex items-center justify-center">Загрузка...</div>}>
                    <TabsContent value="analytics" className="flex-1 mt-4"><AnalyticsTab data={student.analytics} /></TabsContent>
                    <TabsContent value="grades" className="flex-1 mt-4"><GradesTab data={student.grades} /></TabsContent>
                    <TabsContent value="finances" className="flex-1 mt-4"><FinancesTab data={student.finances} /></TabsContent>
                    <TabsContent value="logs" className="flex-1 mt-4"><CommsLogTab data={student.commsLogs} /></TabsContent>
                    <TabsContent value="documents" className="flex-1 mt-4"><DocumentsTab data={student.documents} /></TabsContent>
                </Suspense>
            </Tabs>
        </div>
    );
}

// NOTE FOR INTEGRATION:
// 1. Place this file in `src/pages/StudentProfilePage.tsx`.
// 2. In your main router (`App.tsx` or similar), add the route:
//    `<Route path="/students/:studentId" element={<StudentProfilePage />} />`
// 3. Ensure you have a UserAvatar component or replace it with a placeholder.
// 4. Ensure all used icons are available from `lucide-react`.
// 5. This component uses `react-router-dom`'s `useParams`. Make sure your project is set up with it.
