import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  bookings,
  payments,
  verificationCodes,
  navigationLogs,
  serviceCenters,
  InsertBooking,
  InsertPayment,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== Users ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== Bookings ====================
export async function createBooking(data: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(bookings).values(data);
  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.referenceId, data.referenceId!))
    .limit(1);
  return result[0];
}

export async function getBookingByReference(referenceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.referenceId, referenceId))
    .limit(1);
  return result[0];
}

export async function getAllBookings(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(limit).offset(offset);
}

export async function getNewBookings() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.statusRead, 0))
    .orderBy(desc(bookings.createdAt));
}

export async function updateBookingStatus(
  referenceId: string,
  status: string,
  statusRead?: number
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (statusRead !== undefined) updateData.statusRead = statusRead;
  await db
    .update(bookings)
    .set(updateData as any)
    .where(eq(bookings.referenceId, referenceId));
}

export async function markBookingRead(referenceId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookings)
    .set({ statusRead: 1 })
    .where(eq(bookings.referenceId, referenceId));
}

export async function getBookingsStats() {
  const db = await getDb();
  if (!db) return { total: 0, new: 0, pending: 0, completed: 0 };
  const total = await db.select({ count: sql<number>`count(*)` }).from(bookings);
  const newCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(eq(bookings.status, "new"));
  const completed = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(eq(bookings.status, "completed"));
  return {
    total: Number(total[0]?.count ?? 0),
    new: Number(newCount[0]?.count ?? 0),
    completed: Number(completed[0]?.count ?? 0),
  };
}

// ==================== Payments ====================
export async function createOrUpdatePayment(referenceId: string, data: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(payments)
    .where(eq(payments.referenceId, referenceId))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(payments)
      .set(data as any)
      .where(eq(payments.referenceId, referenceId));
  } else {
    await db.insert(payments).values({ referenceId, ...data } as InsertPayment);
  }
  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.referenceId, referenceId))
    .limit(1);
  return result[0];
}

export async function getPaymentByReference(referenceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.referenceId, referenceId))
    .limit(1);
  return result[0];
}

// ==================== Verification Codes ====================
export async function createOrUpdateVerification(
  referenceId: string,
  type: "nafath" | "motasel" | "otp",
  data: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.referenceId, referenceId),
        eq(verificationCodes.type, type)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(verificationCodes)
      .set(data as any)
      .where(
        and(
          eq(verificationCodes.referenceId, referenceId),
          eq(verificationCodes.type, type)
        )
      );
  } else {
    await db.insert(verificationCodes).values({ referenceId, type, ...data } as any);
  }
  const result = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.referenceId, referenceId),
        eq(verificationCodes.type, type)
      )
    )
    .limit(1);
  return result[0];
}

export async function getVerificationByReference(
  referenceId: string,
  type: "nafath" | "motasel" | "otp"
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.referenceId, referenceId),
        eq(verificationCodes.type, type)
      )
    )
    .limit(1);
  return result[0];
}

// ==================== Navigation Logs ====================
export async function logNavigation(data: {
  referenceId?: string;
  clientIp: string;
  targetPage: string;
  adminId?: number;
  note?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(navigationLogs).values(data as any);
}

export async function getNavigationLogs(referenceId?: string) {
  const db = await getDb();
  if (!db) return [];
  if (referenceId) {
    return db
      .select()
      .from(navigationLogs)
      .where(eq(navigationLogs.referenceId, referenceId))
      .orderBy(desc(navigationLogs.createdAt));
  }
  return db.select().from(navigationLogs).orderBy(desc(navigationLogs.createdAt)).limit(50);
}

// ==================== Service Centers ====================
export async function getServiceCenters() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serviceCenters).where(eq(serviceCenters.isActive, true));
}
