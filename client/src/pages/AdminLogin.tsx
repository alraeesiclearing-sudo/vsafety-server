import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Car, Lock } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role === "admin") {
      navigate("/admin/dashboard");
    }
  }, [loading, isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">نظام الفحص الفني</h1>
          <p className="text-blue-300 text-sm mt-1">لوحة التحكم الإدارية</p>
        </div>

        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mx-auto mb-3">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-xl text-slate-800">تسجيل الدخول</CardTitle>
            <CardDescription className="text-slate-500">
              يرجى تسجيل الدخول للوصول إلى لوحة التحكم
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Button
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-base"
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
            >
              <Lock className="w-5 h-5 ml-2" />
              تسجيل الدخول بحساب Manus
            </Button>
            <p className="text-center text-xs text-slate-400 mt-4">
              مخصص للمسؤولين المعتمدين فقط
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
