import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET() {
  // 1. Authorize caller (must be manager)
  const callerClient = await createClient();
  const { data: { user: caller } } = await callerClient.auth.getUser();

  if (!caller) {
    return NextResponse.json(
      { error: "غير مصرح. يرجى تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const callerRole = caller.user_metadata?.role || "manager";
  if (callerRole === "cashier") {
    return NextResponse.json(
      { error: "غير مصرح. لا تملك صلاحية إدارة المستخدمين." },
      { status: 403 }
    );
  }

  // 2. Fetch users using RPC list_users
  const { data, error } = await callerClient.rpc("list_users");

  if (error) {
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء جلب قائمة المستخدمين." },
      { status: 400 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  // 1. Authorize caller (must be manager)
  const callerClient = await createClient();
  const { data: { user: caller } } = await callerClient.auth.getUser();

  if (!caller) {
    return NextResponse.json(
      { error: "غير مصرح. يرجى تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const callerRole = caller.user_metadata?.role || "manager";
  if (callerRole === "cashier") {
    return NextResponse.json(
      { error: "غير مصرح. لا تملك صلاحية إضافة مستخدمين." },
      { status: 403 }
    );
  }

  // 2. Parse request body
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: "طلب غير صالح. يرجى إرسال بيانات JSON صحيحة." },
      { status: 400 }
    );
  }

  const { email, password, name, role } = body;

  // 3. Whitelist & Validate fields strictly (payload purity)
  const errors: Record<string, string> = {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    errors.email = "يرجى إدخال بريد إلكتروني صحيح.";
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    errors.password = "يجب أن تكون كلمة المرور 6 أحرف على الأقل.";
  }
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.name = "يرجى إدخال اسم صحيح ثنائي على الأقل.";
  }
  if (!role || (role !== "manager" && role !== "cashier")) {
    errors.role = "نوع الحساب غير صحيح. يجب أن يكون مدير أو كاشير.";
  }

  // Check additionalProperties: false behavior
  const allowedKeys = ["email", "password", "name", "role"];
  const extraKeys = Object.keys(body).filter((k) => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return NextResponse.json(
      { error: "طلب غير صالح. يحتوي على حقول غير مسموح بها." },
      { status: 400 }
    );
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // 4. Create a non-persistent server Supabase client using anonymized env helper
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const tempSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // Mock setAll to do nothing.
      },
    },
  });

  // 5. Register user
  const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        name: name.trim(),
      },
    },
  });

  if (signUpError) {
    return NextResponse.json(
      { error: signUpError.message || "حدث خطأ أثناء إنشاء الحساب." },
      { status: signUpError.status || 400 }
    );
  }

  if (!signUpData.user) {
    return NextResponse.json(
      { error: "فشل إنشاء الحساب." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      user: {
        id: signUpData.user.id,
        email: signUpData.user.email,
        name: signUpData.user.user_metadata?.name,
        role: signUpData.user.user_metadata?.role,
      },
    },
    { status: 201 }
  );
}

export async function PUT(request: Request) {
  // 1. Authorize caller (must be manager)
  const callerClient = await createClient();
  const { data: { user: caller } } = await callerClient.auth.getUser();

  if (!caller) {
    return NextResponse.json(
      { error: "غير مصرح. يرجى تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const callerRole = caller.user_metadata?.role || "manager";
  if (callerRole === "cashier") {
    return NextResponse.json(
      { error: "غير مصرح. لا تملك صلاحية تعديل المستخدمين." },
      { status: 403 }
    );
  }

  // 2. Parse request body
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: "طلب غير صالح. يرجى إرسال بيانات JSON صحيحة." },
      { status: 400 }
    );
  }

  const { id, name, role } = body;

  // 3. Whitelist & Validate fields strictly (payload purity)
  const errors: Record<string, string> = {};

  if (!id || typeof id !== "string") {
    errors.id = "معرف المستخدم مطلوب.";
  }
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.name = "يرجى إدخال اسم صحيح ثنائي على الأقل.";
  }
  if (!role || (role !== "manager" && role !== "cashier")) {
    errors.role = "نوع الحساب غير صحيح. يجب أن يكون مدير أو كاشير.";
  }

  // Check additionalProperties: false behavior
  const allowedKeys = ["id", "name", "role"];
  const extraKeys = Object.keys(body).filter((k) => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return NextResponse.json(
      { error: "طلب غير صالح. يحتوي على حقول غير مسموح بها." },
      { status: 400 }
    );
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // 4. Update user metadata via RPC
  const { error: updateError } = await callerClient.rpc("update_user_meta", {
    p_user_id: id,
    p_name: name.trim(),
    p_role: role,
  });

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "حدث خطأ أثناء تعديل بيانات المستخدم." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  // 1. Authorize caller (must be manager)
  const callerClient = await createClient();
  const { data: { user: caller } } = await callerClient.auth.getUser();

  if (!caller) {
    return NextResponse.json(
      { error: "غير مصرح. يرجى تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const callerRole = caller.user_metadata?.role || "manager";
  if (callerRole === "cashier") {
    return NextResponse.json(
      { error: "غير مصرح. لا تملك صلاحية حذف المستخدمين." },
      { status: 403 }
    );
  }

  // 2. Get target user ID from query params
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "معرف المستخدم مطلوب لحذف الحساب." },
      { status: 400 }
    );
  }

  // 3. Prevent self-deletion
  if (id === caller.id) {
    return NextResponse.json(
      { error: "لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول." },
      { status: 400 }
    );
  }

  // 4. Delete user via RPC
  const { error: deleteError } = await callerClient.rpc("delete_user", {
    p_user_id: id,
  });

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "حدث خطأ أثناء حذف الحساب." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
