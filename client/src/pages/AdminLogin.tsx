import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: async () => {
      toast.success("تم تسجيل الدخول بنجاح");
      await refresh();
      navigate("/admin/dashboard");
    },
    onError: (error) => {
      toast.error(error.message || "اسم المستخدم أو كلمة المرور غير صحيحة");
      setIsLoading(false);
    },
  });

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role === "admin") {
      navigate("/admin/dashboard");
    }
  }, [loading, isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    setIsLoading(true);
    loginMutation.mutate({ username, password });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fa" }}>
        <div style={{ width: 40, height: 40, border: "4px solid #04aa6d", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1B8354 0%, #0a5c38 50%, #233f48 100%)",
        fontFamily: "'Cairo', sans-serif",
        padding: 20,
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 16, padding: "16px 24px", display: "inline-block", marginBottom: 16, backdropFilter: "blur(10px)" }}>
            <img src="/logo.svg" alt="شعار سلامة المركبات" style={{ height: 50, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          </div>
          <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, margin: 0 }}>مركز سلامة المركبات</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 6 }}>لوحة إدارة الحجوزات</p>
        </div>

        {/* Login Card */}
        <div style={{ background: "white", borderRadius: 16, padding: "32px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          {/* Card Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, background: "#e8f5ee", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1B8354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#233f48" }}>تسجيل الدخول</h2>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6c757d" }}>يرجى تسجيل الدخول للوصول إلى لوحة التحكم</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 6 }}>
                اسم المستخدم
              </label>
              <input
                type="text"
                placeholder="أدخل اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                style={{
                  width: "100%",
                  height: 44,
                  padding: "0 14px",
                  border: "1px solid #dee2e6",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "'Cairo', sans-serif",
                  transition: "border-color 0.2s",
                  background: isLoading ? "#f8f9fa" : "white",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#1B8354")}
                onBlur={(e) => (e.target.style.borderColor = "#dee2e6")}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#495057", marginBottom: 6 }}>
                كلمة المرور
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="أدخل كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    height: 44,
                    padding: "0 14px",
                    paddingLeft: 44,
                    border: "1px solid #dee2e6",
                    borderRadius: 8,
                    fontSize: 14,
                    outline: "none",
                    fontFamily: "'Cairo', sans-serif",
                    background: isLoading ? "#f8f9fa" : "white",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#1B8354")}
                  onBlur={(e) => (e.target.style.borderColor = "#dee2e6")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                height: 46,
                background: isLoading ? "#6c757d" : "#1B8354",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                cursor: isLoading ? "not-allowed" : "pointer",
                fontFamily: "'Cairo', sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => !isLoading && ((e.currentTarget as HTMLButtonElement).style.background = "#146c43")}
              onMouseLeave={(e) => !isLoading && ((e.currentTarget as HTMLButtonElement).style.background = "#1B8354")}
            >
              {isLoading ? (
                <>
                  <div style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  جاري الدخول...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  تسجيل الدخول
                </>
              )}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
            مخصص للمسؤولين المعتمدين فقط
          </p>
        </div>

        {/* SASO Footer */}
        <div style={{ textAlign: "center", marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <img src="/SASO.svg" alt="SASO" style={{ height: 30, filter: "brightness(0) invert(1)", opacity: 0.7 }} />
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>تحت إشراف هيئة المواصفات والمقاييس والجودة</span>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
