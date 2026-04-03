import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  CreditCard, TrendingUp, AlertTriangle, CheckCircle2,
  Calendar, DollarSign, Clock, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from "recharts";

type Props = { data: any };

const statusConfig: Record<string, { label: string; cls: string }> = {
  paid:         { label: "Оплачено",   cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  partial:      { label: "Частично",   cls: "bg-amber-100  text-amber-700  border-amber-200"  },
  pending:      { label: "Ожидается",  cls: "bg-slate-100  text-slate-600  border-slate-200"  },
  overdue:      { label: "Просрочено", cls: "bg-red-100    text-red-700    border-red-200"    },
};

export default function FinanceTab360({ data }: Props) {
  const { finances, hero } = data;

  // Paid vs total per month for chart
  const payChartData = finances.paymentHistory.map((p: any) => ({
    month: p.month.slice(5),
    "Оплачено": p.amount,
    "Норма": finances.monthlyFee,
  }));

  // Cumulative LTV
  let cumulative = 0;
  const ltvData = finances.paymentHistory.map((p: any) => {
    cumulative += p.amount;
    return { month: p.month.slice(5), "LTV": cumulative };
  });

  const paidPct = Math.round((finances.totalPaid / finances.ltv) * 100);
  const contractProgress = (() => {
    const start = new Date(finances.contractStart).getTime();
    const end   = new Date(finances.contractEnd).getTime();
    const now   = new Date("2026-03-17").getTime();
    return Math.min(100, Math.round(((now - start) / (end - start)) * 100));
  })();

  return (
    <div className="space-y-6">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={cn(hero.debtAmount > 0 ? "border-red-200 bg-red-50/40 dark:bg-red-950/10" : "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">LTV (факт)</span>
              <DollarSign className={cn("h-4 w-4", hero.debtAmount > 0 ? "text-red-500" : "text-emerald-500")} />
            </div>
            <div className={cn("text-2xl font-black", hero.debtAmount > 0 ? "text-red-700" : "text-emerald-700")}>
              {(finances.totalPaid / 1000).toFixed(0)}к ₸
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">из {(finances.ltv / 1000).toFixed(0)}к ₸ начислено</div>
            <Progress value={paidPct} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card className={cn(hero.debtAmount > 0 ? "border-red-200 bg-red-50/40 dark:bg-red-950/10" : "border-muted")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Задолженность</span>
              <AlertTriangle className={cn("h-4 w-4", hero.debtAmount > 0 ? "text-red-500" : "text-emerald-500")} />
            </div>
            <div className={cn("text-2xl font-black", hero.debtAmount > 0 ? "text-red-700" : "text-emerald-700")}>
              {hero.debtAmount > 0 ? `${hero.debtAmount.toLocaleString()} ₸` : "0 ₸"}
            </div>
            <div className="text-[10px] mt-1">
              {hero.debtAmount > 0 ? (
                <span className="text-red-600 font-medium">⚠ Требует внимания</span>
              ) : (
                <span className="text-emerald-600 font-medium">Долгов нет ✓</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Прогноз LTV</span>
              <TrendingUp className="h-4 w-4 text-violet-500" />
            </div>
            <div className="text-2xl font-black text-violet-700">
              {(finances.projectedLTV / 1000).toFixed(0)}к ₸
            </div>
            <div className="text-[10px] text-emerald-600 font-medium mt-1">{finances.ltvVsAvg} vs средний</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Риск возврата</span>
              <ArrowUpRight className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-700">
              {Math.round(finances.refundRisk * 100)}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Вероятность отказа</div>
            <Progress value={finances.refundRisk * 100} className="mt-2 h-1.5 [&>div]:bg-amber-400" />
          </CardContent>
        </Card>
      </div>

      {/* Contract info + progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Договор
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Тип договора",     value: finances.contractType },
              { label: "Дата начала",       value: finances.contractStart },
              { label: "Дата окончания",    value: finances.contractEnd },
              { label: "Ежемесячный взнос", value: `${finances.monthlyFee.toLocaleString()} ₸` },
            ].map((item, i) => (
              <div key={i}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-semibold mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Прогресс по договору</span>
              <span className="font-semibold">{contractProgress}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                style={{ width: `${contractProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{finances.contractStart}</span>
              <span>{finances.contractEnd}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly payments bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              Платежи по месяцам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={payChartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v/1000}к`} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(val: any) => [`${val.toLocaleString()} ₸`]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={finances.monthlyFee} stroke="#6366f1" strokeDasharray="4 4" label={{ value: "Норма", fontSize: 9, fill: "#6366f1" }} />
                <Bar dataKey="Оплачено" radius={[4, 4, 0, 0]}>
                  {payChartData.map((_: any, i: number) => {
                    const pay = finances.paymentHistory[i];
                    const fill = pay?.status === "paid" ? "#10b981" : pay?.status === "partial" ? "#f59e0b" : "#cbd5e1";
                    return <rect key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cumulative LTV line chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              Накопленный LTV (₸)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ltvData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v/1000}к`} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(val: any) => [`${val.toLocaleString()} ₸`, "LTV"]}
                />
                <Line
                  type="monotone"
                  dataKey="LTV"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#6366f1" }}
                  activeDot={{ r: 7 }}
                />
                <ReferenceLine
                  y={finances.projectedLTV}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: `Прогноз: ${(finances.projectedLTV/1000).toFixed(0)}к`, fontSize: 9, fill: "#10b981", position: "insideTopLeft" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Payment history table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              История платежей
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Последний: <strong>{finances.lastPayment.date}</strong> — {finances.lastPayment.amount.toLocaleString()} ₸ ({finances.lastPayment.method})
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Месяц</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden md:table-cell">Дата оплаты</th>
                  <th className="text-right p-2.5 font-medium text-muted-foreground">Сумма</th>
                  <th className="text-center p-2.5 font-medium text-muted-foreground">Статус</th>
                  <th className="text-center p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Метод</th>
                  <th className="text-right p-2.5 font-medium text-muted-foreground">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {finances.paymentHistory.map((p: any, i: number) => {
                  const cfg = statusConfig[p.status] || statusConfig.pending;
                  return (
                    <tr
                      key={i}
                      className={cn(
                        "border-b",
                        p.status === "overdue" && "bg-red-50/30 dark:bg-red-950/10",
                        p.status === "partial" && "bg-amber-50/30 dark:bg-amber-950/10",
                      )}
                    >
                      <td className="p-2.5 font-medium">{p.month}</td>
                      <td className="p-2.5 text-muted-foreground hidden md:table-cell">{p.date || "—"}</td>
                      <td className="p-2.5 text-right font-semibold">
                        {p.amount > 0 ? `${p.amount.toLocaleString()} ₸` : "—"}
                      </td>
                      <td className="p-2.5 text-center">
                        <Badge variant="outline" className={cn("text-[10px]", cfg.cls)}>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-center text-muted-foreground hidden sm:table-cell">
                        {p.method || "—"}
                      </td>
                      <td className="p-2.5 text-right">
                        {p.remaining ? (
                          <span className="text-red-600 font-semibold">{p.remaining.toLocaleString()} ₸</span>
                        ) : p.status === "paid" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="p-2.5" colSpan={2}>ИТОГО</td>
                  <td className="p-2.5 text-right">{finances.totalPaid.toLocaleString()} ₸</td>
                  <td className="p-2.5 text-center text-xs text-muted-foreground" colSpan={2}>из {finances.ltv.toLocaleString()} ₸</td>
                  <td className="p-2.5 text-right text-red-600">{finances.debt > 0 ? `${finances.debt.toLocaleString()} ₸` : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
