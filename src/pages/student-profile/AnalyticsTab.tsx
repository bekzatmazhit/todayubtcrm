import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // Assuming recharts is used by chart.tsx

const AnalyticsTab = ({ data }) => {
    // This component is intentionally simple. A real-world scenario would have more complex charts and interactions.
    
    // Prepare data for charts
    const mathScores = data.scoreDynamics.filter(d => d.subject === 'Мат. грамотность');
    const physicsScores = data.scoreDynamics.filter(d => d.subject === 'Физика');

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Динамика баллов</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('ru-RU', { month: 'short' })} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="score" name="Мат. грамотность" data={mathScores} stroke="#8884d8" activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="groupAvg" name="Средний по группе" data={mathScores} stroke="#ccc" strokeDasharray="5 5" />
                            <Line type="monotone" dataKey="score" name="Физика" data={physicsScores} stroke="#82ca9d" />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            <div className="grid md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader><CardTitle>LTV (Lifetime Value)</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{data.ltv.toLocaleString('ru-RU')} ₸</p>
                        <p className="text-sm text-muted-foreground">Общая сумма платежей</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Выполнение ДЗ</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{data.homeworkCompletionRate}%</p>
                        <p className="text-sm text-muted-foreground">Процент сданных вовремя работ</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Вовлеченность родителей</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{data.parentalEngagementScore} / 100</p>
                        <p className="text-sm text-muted-foreground">Индекс контактов с куратором</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AnalyticsTab;
