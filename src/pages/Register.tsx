import { useState } from "react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import logo from "@/assets/logo.png";
import { useTranslation } from "react-i18next";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "teacher" as UserRole });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await register(form.email, form.password, form.full_name, form.role);
    navigate("/");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-card">
        <CardHeader className="text-center pb-2">
          <img src={logo} alt="TODAY CRM" className="w-16 h-16 mx-auto mb-3" />
          <h1 className="text-2xl font-heading font-bold text-foreground">{t("Create Account")}</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Full Name")}</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("Email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("Password")}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("Role")}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">{t("Teacher (Ustaz)")}</SelectItem>
                  <SelectItem value="umo_head">{t("UMO Head")}</SelectItem>
                  <SelectItem value="admin">{t("Admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? t("Creating...") : t("Create Account")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("Already have an account?")}{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">{t("Sign In")}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
