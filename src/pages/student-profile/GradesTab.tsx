import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const GradesTab = ({ data }) => {
    const getStatusVariant = (status) => {
        if (status === 'Сдано') return 'default';
        if (status === 'Просрочено') return 'destructive';
        return 'secondary';
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Результаты пробных ЕНТ</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Дата</TableHead>
                                <TableHead>Предмет</TableHead>
                                <TableHead className="text-right">Балл</TableHead>
                                <TableHead>Комментарий</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.entResults.map((result) => (
                                <TableRow key={result.id}>
                                    <TableCell>{new Date(result.date).toLocaleDateString('ru-RU')}</TableCell>
                                    <TableCell>{result.subject}</TableCell>
                                    <TableCell className="text-right font-medium">{result.score} / {result.total}</TableCell>
                                    <TableCell>{result.details}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Домашние задания</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Дата</TableHead>
                                <TableHead>Предмет</TableHead>
                                <TableHead>Задание</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead className="text-right">Оценка</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.homework.map((hw) => (
                                <TableRow key={hw.id}>
                                    <TableCell>{new Date(hw.date).toLocaleDateString('ru-RU')}</TableCell>
                                    <TableCell>{hw.subject}</TableCell>
                                    <TableCell className="max-w-[300px] truncate">{hw.task}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(hw.status)}>{hw.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{hw.grade}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default GradesTab;
