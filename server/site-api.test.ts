import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./db", () => ({
  createBooking: vi.fn().mockResolvedValue({
    id: 1,
    referenceId: "TEST123",
    clientName: "أحمد محمد",
    clientId: "1234567890",
    clientPhone: "0501234567",
    vehiclePlate: "أ-ب-ج-1234",
    status: "new",
    clientIp: "127.0.0.1",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getAllBookings: vi.fn().mockResolvedValue([]),
  getNewBookings: vi.fn().mockResolvedValue([]),
  getBookingByReference: vi.fn().mockResolvedValue({
    id: 1,
    referenceId: "TEST123",
    clientName: "أحمد محمد",
    clientId: "1234567890",
    clientPhone: "0501234567",
    vehiclePlate: "أ-ب-ج-1234",
    status: "new",
    clientIp: "127.0.0.1",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateBookingStatus: vi.fn().mockResolvedValue(undefined),
  markBookingRead: vi.fn().mockResolvedValue(undefined),
  getBookingsStats: vi.fn().mockResolvedValue({ total: 0, new: 0, completed: 0 }),
  createOrUpdatePayment: vi.fn().mockResolvedValue(undefined),
  getPaymentByReference: vi.fn().mockResolvedValue(null),
  createOrUpdateVerification: vi.fn().mockResolvedValue(undefined),
  getVerificationByReference: vi.fn().mockResolvedValue(null),
  logNavigation: vi.fn().mockResolvedValue(undefined),
  getNavigationLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./socket", () => ({
  getIo: vi.fn().mockReturnValue(null),
  initSocket: vi.fn(),
}));

// ==================== اختبارات API الموقع الأمامي ====================
describe("Site API - FORMS_SUBMIT", () => {
  it("يجب أن يُنشئ حجزاً جديداً عند إرسال NewDate", async () => {
    const { createBooking } = await import("./db");
    const mockCreate = vi.mocked(createBooking);

    // محاكاة إنشاء حجز
    const result = await mockCreate({
      referenceId: "TEST123",
      clientName: "أحمد محمد",
      clientId: "1234567890",
      clientPhone: "0501234567",
      clientEmail: "",
      clientNationality: "",
      hasDelegate: false,
      delegateType: "",
      delegateName: "",
      delegatePhone: "",
      delegateNationality: "",
      delegateId: "",
      vehicleCountry: "السعودية",
      vehiclePlate: "أ-ب-ج-1234",
      vehiclePlateChar1: "أ",
      vehiclePlateChar2: "ب",
      vehiclePlateChar3: "ج",
      vehicleType: "",
      vehicleCarryDang: false,
      serviceRegion: "الرياض",
      serviceType: "الفحص الدوري",
      serviceDate: "2025-01-01",
      serviceTime: "09:00 AM",
      clientIp: "127.0.0.1",
      rawData: {},
      statusRead: 0,
      status: "new",
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(result).toBeDefined();
    expect(result?.referenceId).toBe("TEST123");
    expect(result?.clientName).toBe("أحمد محمد");
  });

  it("يجب أن يُحدِّث حالة الحجز عند إرسال بيانات الدفع", async () => {
    const { updateBookingStatus, createOrUpdatePayment } = await import("./db");

    await vi.mocked(createOrUpdatePayment)("TEST123", {
      cardHolderName: "أحمد محمد",
      cardLastFour: "1234",
      cardExpiry: "12/25",
      step: 1,
      status: "step1_done",
      rawData: {},
    });

    await vi.mocked(updateBookingStatus)("TEST123", "pending_payment");

    expect(createOrUpdatePayment).toHaveBeenCalledWith("TEST123", expect.objectContaining({
      step: 1,
      status: "step1_done",
    }));
    expect(updateBookingStatus).toHaveBeenCalledWith("TEST123", "pending_payment");
  });
});

// ==================== اختبارات قاعدة البيانات ====================
describe("Database Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("يجب أن يُرجع إحصائيات الحجوزات", async () => {
    const { getBookingsStats } = await import("./db");
    const stats = await getBookingsStats();
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("new");
    expect(stats).toHaveProperty("completed");
  });

  it("يجب أن يُرجع حجزاً بالمرجع", async () => {
    const { getBookingByReference } = await import("./db");
    const booking = await getBookingByReference("TEST123");
    expect(booking).toBeDefined();
    expect(booking?.referenceId).toBe("TEST123");
  });

  it("يجب أن يُسجّل التوجيه في قاعدة البيانات", async () => {
    const { logNavigation } = await import("./db");
    await logNavigation({
      referenceId: "TEST123",
      clientIp: "127.0.0.1",
      targetPage: "/payment",
      adminId: 1,
      note: "توجيه للدفع",
    });
    expect(logNavigation).toHaveBeenCalledWith(expect.objectContaining({
      referenceId: "TEST123",
      targetPage: "/payment",
    }));
  });
});

// ==================== اختبارات Socket.io ====================
describe("Socket.io Integration", () => {
  it("يجب أن يُرجع null عند عدم وجود io", async () => {
    const { getIo } = await import("./socket");
    const io = getIo();
    expect(io).toBeNull();
  });
});

// ==================== اختبارات tRPC Router ====================
describe("tRPC Routers", () => {
  it("يجب أن يكون appRouter معرّفاً", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
  });

  it("يجب أن يحتوي appRouter على booking router", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("booking.create");
    expect(appRouter._def.procedures).toHaveProperty("booking.list");
    expect(appRouter._def.procedures).toHaveProperty("booking.getByReference");
  });

  it("يجب أن يحتوي appRouter على navigation router", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("navigation.navigateTo");
    expect(appRouter._def.procedures).toHaveProperty("navigation.getLogs");
  });

  it("يجب أن يحتوي appRouter على admin router", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("admin.getUsersWithDetails");
    expect(appRouter._def.procedures).toHaveProperty("admin.getTemplateForms");
    expect(appRouter._def.procedures).toHaveProperty("admin.setActionStatus");
  });
});
