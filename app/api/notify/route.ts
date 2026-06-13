import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_NOTIFICATION_SECRET;
  if (!adminSecret) {
    console.error("ADMIN_NOTIFICATION_SECRET environment variable is not configured.");
    return NextResponse.json(
      { error: "التكوين البرمجي للخادم غير مكتمل" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-admin-secret");

  let isAuthorized = false;

  // Check custom header or Bearer authorization header
  if (secretHeader === adminSecret || (authHeader && authHeader.replace("Bearer ", "") === adminSecret)) {
    isAuthorized = true;
  } else {
    // Fallback: check active Supabase user session
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        isAuthorized = true;
      }
    } catch (err) {
      console.error("Supabase server auth check failed:", err);
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "غير مصرح بالدخول" },
      { status: 401 }
    );
  }

  // 2. Query beneficiaries and simulate bulk notification queuing
  try {
    const supabase = await createClient();
    const { data: beneficiaries, error } = await supabase
      .from("beneficiaries")
      .select("identifier, full_name");

    if (error) {
      console.error("Database query error:", error);
      return NextResponse.json(
        { error: "فشل الاستعلام من قاعدة البيانات" },
        { status: 500 }
      );
    }

    if (!beneficiaries || beneficiaries.length === 0) {
      return NextResponse.json({
        success: true,
        total_beneficiaries: 0,
        queued: 0,
        message: "لا يوجد مستفيدين لإرسال رسائل لهم."
      });
    }

    // Filter valid Egyptian phone numbers: starting with '01' and consisting of 11 digits
    const validBeneficiaries = beneficiaries.filter((b) =>
      /^01[0-9]{9}$/.test(b.identifier)
    );

    let queuedCount = 0;
    for (const beneficiary of validBeneficiaries) {
      // Egyptian formatting logic: if starts with '01', replace '0' with '+20'
      const formattedPhone = "+20" + beneficiary.identifier.substring(1);
      const message = `أهلاً بك يا ${beneficiary.full_name}، تم تجهيز المساعدة الخاصة بك لهذا الشهر من السوبر ماركت الخيري. نتشرف بزيارتك.`;

      // Mock output to represent integration payload sending to a 3rd party API (e.g., Ultramsg or Meta WhatsApp API)
      console.log(`[MOCK WHATSAPP API] Queuing message for beneficiary: ${beneficiary.full_name}`);
      console.log(`[MOCK WHATSAPP API] Payload details:`, {
        recipient: formattedPhone,
        templateMessage: message,
        timestamp: new Date().toISOString()
      });
      queuedCount++;
    }

    return NextResponse.json({
      success: true,
      total_beneficiaries: beneficiaries.length,
      queued: queuedCount,
      message: `تمت جدولة إرسال ${queuedCount} رسالة بنجاح.`
    });
  } catch (err: any) {
    console.error("API error during bulk notification execution:", err);
    return NextResponse.json(
      { error: err.message || "حدث خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
