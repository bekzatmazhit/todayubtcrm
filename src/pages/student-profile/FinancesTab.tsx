import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DollarSign, CreditCard, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Calendar, Download,
} from "lucide-react";

type Props = { data: any };

const statusConfig: Record<string, { label: string; cls: string; icon: any }> = {
  paid: { label: "Оплачено", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  pending: { label: "Ожидается", cls: "bg-slate-100 text-slate-600 border-slate-200", icon: Calendar },
  due: { label: "Долг", cls: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  partial: { label: "Частично", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: CreditCard },
};

export default function FinancesTab({ data }: Props) {
  const { transactions, balance, currency } = data;

  const totalPaid = transactions
    .filter((t: any) => t.status === "paid")
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const totalDue = transactions
    .filter((t: any) => t.status === "due")
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Баланс</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", balance >= 0 ? "text-emerald-600" : "text-red-600")}>
              {balance.toLocaleString("ru-RU")} {currency}
            </div>
            <p className="text-xs text-muted-foreground">
              {balance >= 0 ? "Переплата" : "Задолженность"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Оплачено</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {totalPaid.toLocaleString("ru-RU")} {currency}
            </div>
            <p className="text-xs text-muted-foreground">Всего оплачено</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">К оплате</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {totalDue.toLocaleString("ru-RU")} {currency}
            </div>
            <p className="text-xs text-muted-foreground">Ожидаемые платежи</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Транзакций</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="text-xs text-muted-foreground">Всего записей</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">История транзакций</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Экспорт
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-2 text-muted-foreground font-medium">Дата</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Описание</th>
                  <th className="text-right p-2 text-muted-foreground font-medium">Сумма</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t: any) => {
                  const cfg = statusConfig[t.status] || statusConfig.pending;
                  const Icon = cfg.icon;
                  return (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="p-2 font-medium">{t.date}</td>
                      <td className="p-2">{t.description}</td>
                      <td className={cn("p-2 text-right font-semibold", t.amount < 0 ? "text-red-600" : "text-emerald-600")}>
                        {t.amount.toLocaleString("ru-RU")} {currency}
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className={cn("text-[10px]", cfg.cls)}>
                          <Icon className="h-3 w-3 mr-1 inline" />
                          {cfg.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Tips */}
      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Информация об оплате
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside">
                <li>Оплата производится до 5 числа каждого месяца</li>
                <li>При возникновении финансовых трудностей свяжитесь с куратором</li>
                <li>Все платежи отображаются в личном кабинете</li>
                <li>Для вопросов по оплате: finance@today-ubt.kz</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
