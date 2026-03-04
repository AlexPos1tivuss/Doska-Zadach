import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, LogIn } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("преподаватель");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (user) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, displayName, role);
      }
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err.message || "Что-то пошло не так",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #e0f7fa 0%, #e8f5e9 50%, #f3e5f5 100%)" }}>
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl p-8 shadow-lg border border-card-border animate-slide-up">
          <div className="flex gap-2 mb-6">
            <Button
              variant={isLogin ? "default" : "secondary"}
              className="flex-1"
              onClick={() => setIsLogin(true)}
              data-testid="button-login-tab"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Вход
            </Button>
            <Button
              variant={!isLogin ? "default" : "secondary"}
              className="flex-1"
              onClick={() => setIsLogin(false)}
              data-testid="button-register-tab"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Регистрация
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="displayName">Имя</Label>
                  <Input
                    id="displayName"
                    placeholder="Как вас зовут?"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required={!isLogin}
                    data-testid="input-display-name"
                  />
                </div>
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="role">Роль</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="преподаватель">Преподаватель</SelectItem>
                      <SelectItem value="начальник кафедры">Начальник кафедры</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Логин</Label>
              <Input
                id="username"
                placeholder="Введите логин"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="input-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              data-testid="button-submit-auth"
            >
              {isSubmitting ? "Подождите..." : isLogin ? "Войти" : "Зарегистрироваться"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
