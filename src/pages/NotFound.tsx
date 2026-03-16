import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Home, ArrowLeft, CircleHelp } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.warn("404: attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CircleHelp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Страница не найдена</CardTitle>
                <p className="text-xs text-muted-foreground">Ошибка 404</p>
              </div>
            </div>
            <Badge variant="outline" className="max-w-[220px] truncate">{location.pathname}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              Похоже, ссылка ведёт на страницу, которой нет. Проверьте адрес или вернитесь на главную.
            </p>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild className="gap-2">
              <Link to="/">
                <Home className="h-4 w-4" />
                На главную
              </Link>
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
