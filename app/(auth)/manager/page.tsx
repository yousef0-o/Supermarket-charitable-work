"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type FormErrors = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
};

export default function ManagerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"addUser" | "settings">("addUser");

  // Tab 1: User Creation States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "cashier">("cashier");
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [successUser, setSuccessUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  // Tab 2: Profile Settings States
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [profileGeneralError, setProfileGeneralError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Load current logged-in manager's details
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const uName = user.user_metadata?.name || "";
          const uEmail = user.email || "";
          setCurrentUser({ name: uName, email: uEmail });
          setProfileName(uName);
          setProfileEmail(uEmail);
        }
      } catch (err) {
        console.error("Error fetching current user on mount:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  const validateUserCreation = () => {
    const errors: FormErrors = {};
    if (!name.trim() || name.trim().length < 2) {
      errors.name = "الاسم الكامل مطلوب (ثنائي على الأقل).";
    }
    if (!email.trim() || !email.includes("@")) {
      errors.email = "يرجى إدخال بريد إلكتروني صحيح.";
    }
    if (!password || password.length < 6) {
      errors.password = "يجب أن تكون كلمة المرور 6 أحرف على الأقل.";
    }
    if (role !== "manager" && role !== "cashier") {
      errors.role = "يرجى اختيار صلاحية صحيحة.";
    }
    return errors;
  };

  const handleUserCreationSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormErrors({});
    setGeneralError("");
    setSuccessUser(null);

    const errors = validateUserCreation();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 422 && data.errors) {
          setFormErrors(data.errors);
        } else {
          setGeneralError(data.error || "حدث خطأ غير متوقع أثناء إضافة المستخدم.");
        }
        setIsLoading(false);
        return;
      }

      setSuccessUser({
        name: name.trim(),
        email: email.trim(),
        role: role === "manager" ? "مدير نظام" : "كاشير (صرف وبحث)",
      });

      setName("");
      setEmail("");
      setPassword("");
      setRole("cashier");
    } catch (err) {
      setGeneralError("فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileErrors({});
    setProfileSuccess(false);
    setProfileGeneralError("");

    const errors: typeof profileErrors = {};
    if (!profileName.trim() || profileName.trim().length < 2) {
      errors.name = "الاسم الكامل مطلوب (ثنائي على الأقل).";
    }
    if (!profileEmail.trim() || !profileEmail.includes("@")) {
      errors.email = "يرجى إدخال بريد إلكتروني صحيح.";
    }
    if (profilePassword && profilePassword.length < 6) {
      errors.password = "يجب أن تكون كلمة المرور 6 أحرف على الأقل.";
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    setIsSavingProfile(true);

    try {
      const supabase = createClient();
      const updates: any = {};

      if (profileName.trim() !== currentUser?.name) {
        updates.data = { name: profileName.trim() };
      }
      if (profileEmail.trim() !== currentUser?.email) {
        updates.email = profileEmail.trim();
      }
      if (profilePassword) {
        updates.password = profilePassword;
      }

      if (Object.keys(updates).length === 0) {
        setProfileGeneralError("لم تقم بإجراء أي تغييرات لحفظها.");
        setIsSavingProfile(false);
        return;
      }

      const { data, error } = await supabase.auth.updateUser(updates);

      if (error) {
        setProfileGeneralError(error.message || "حدث خطأ أثناء تحديث الحساب.");
        setIsSavingProfile(false);
        return;
      }

      const updatedName = data.user?.user_metadata?.name || profileName;
      const updatedEmail = data.user?.email || profileEmail;
      setCurrentUser({ name: updatedName, email: updatedEmail });
      setProfileName(updatedName);
      setProfileEmail(updatedEmail);
      setProfilePassword("");

      setProfileSuccess(true);
      router.refresh();
    } catch (err) {
      setProfileGeneralError("حدث خطأ غير متوقع أثناء حفظ الإعدادات.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
            {activeTab === "addUser" ? (
              <UserPlus className="size-4.5" />
            ) : (
              <Settings className="size-4.5" />
            )}
          </span>
          <h1 className="text-lg font-extrabold text-slate-800">
            {activeTab === "addUser" ? "صفحة المدير - إدارة المستخدمين" : "صفحة المدير - إعدادات حسابي"}
          </h1>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          {activeTab === "addUser"
            ? "إضافة حسابات مستخدمين جديدة وتعيين صلاحياتهم التشغيلية على النظام."
            : "تحديث معلوماتك الشخصية مثل اسم العرض، البريد الإلكتروني، أو كلمة المرور."}
        </p>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("addUser")}
          className={`pb-2.5 px-4 text-sm font-bold border-b-2 transition-all outline-none ${
            activeTab === "addUser"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-350"
          }`}
        >
          إضافة مستخدم
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("settings");
            setProfileSuccess(false);
            setProfileGeneralError("");
          }}
          className={`pb-2.5 px-4 text-sm font-bold border-b-2 transition-all outline-none ${
            activeTab === "settings"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-855 hover:border-slate-350"
          }`}
        >
          إعدادات حسابي
        </button>
      </div>

      {/* TAB 1: ADD USER FORM */}
      {activeTab === "addUser" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {successUser && (
            <div className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-emerald-900 shadow-sm">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold">تمت إضافة الحساب بنجاح!</h3>
                <p className="text-xs font-medium text-emerald-700">
                  يمكن للمستخدم الآن تسجيل الدخول مباشرة باستخدام بريده الإلكتروني وكلمة المرور.
                </p>
                <div className="mt-2 text-xs space-y-0.5 border-t border-emerald-100/50 pt-2 font-mono">
                  <div><span className="font-semibold font-sans">الاسم:</span> {successUser.name}</div>
                  <div><span className="font-semibold font-sans">البريد:</span> {successUser.email}</div>
                  <div><span className="font-semibold font-sans">الصلاحية:</span> {successUser.role}</div>
                </div>
              </div>
            </div>
          )}

          {generalError && (
            <div className="flex gap-3 rounded-xl border border-rose-100 bg-rose-50/70 p-4 text-rose-900 shadow-sm">
              <AlertCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold">خطأ في إنشاء الحساب</h3>
                <p className="text-xs font-semibold text-rose-700">{generalError}</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <form onSubmit={handleUserCreationSubmit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-xs font-bold text-slate-600">
                  الاسم الكامل
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <User className="size-4.5 text-slate-400" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                    placeholder="الاسم الثنائي أو الثلاثي للموظف"
                    className={`block w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm outline-none transition-colors ${
                      formErrors.name
                        ? "border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    }`}
                  />
                </div>
                {formErrors.name && (
                  <p className="text-xxs font-bold text-rose-600 mr-1">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-bold text-slate-600">
                  البريد الإلكتروني
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Mail className="size-4.5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    placeholder="example@domain.com"
                    className={`block w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm outline-none transition-colors font-mono ${
                      formErrors.email
                        ? "border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    }`}
                  />
                </div>
                {formErrors.email && (
                  <p className="text-xxs font-bold text-rose-600 mr-1">{formErrors.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-bold text-slate-600">
                  كلمة المرور للمستخدم الجديد
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Lock className="size-4.5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="••••••••"
                    className={`block w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm outline-none transition-colors font-mono ${
                      formErrors.password
                        ? "border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    }`}
                  />
                </div>
                {formErrors.password && (
                  <p className="text-xxs font-bold text-rose-600 mr-1">{formErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  الصلاحية ونوع الحساب
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:bg-slate-50/50 ${
                      role === "cashier"
                        ? "border-emerald-600 bg-emerald-50/20 ring-1 ring-emerald-600"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="cashier"
                      checked={role === "cashier"}
                      onChange={() => setRole("cashier")}
                      disabled={isLoading}
                      className="mt-1 size-4 accent-emerald-700 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800">حساب كاشير (صرف وبحث)</span>
                      <p className="text-xxs font-medium text-slate-500 leading-normal">
                        يملك صلاحية البحث وصرف المساعدات المالية فقط. لا يمكنه تصفح الإحصائيات أو إدارة المستفيدين.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:bg-slate-50/50 ${
                      role === "manager"
                        ? "border-emerald-600 bg-emerald-50/20 ring-1 ring-emerald-600"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="manager"
                      checked={role === "manager"}
                      onChange={() => setRole("manager")}
                      disabled={isLoading}
                      className="mt-1 size-4 accent-emerald-700 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800">حساب مدير (صلاحية كاملة)</span>
                      <p className="text-xxs font-medium text-slate-500 leading-normal">
                        يملك الصلاحية الكاملة لتصفح التقارير المالية، إضافة وإعداد دورات الصرف، وإدارة حسابات المستخدمين.
                      </p>
                    </div>
                  </label>
                </div>
                {formErrors.role && (
                  <p className="text-xxs font-bold text-rose-600 mr-1">{formErrors.role}</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>جاري إنشاء الحساب...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="size-4 shrink-0" />
                      <span>إضافة حساب المستخدم</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: PROFILE SETTINGS FORM */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {profileSuccess && (
            <div className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-emerald-900 shadow-sm">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold">تم حفظ التغييرات بنجاح!</h3>
                <p className="text-xs font-medium text-emerald-700">
                  تم تحديث بيانات حسابك الشخصية بنجاح على النظام.
                </p>
              </div>
            </div>
          )}

          {profileGeneralError && (
            <div className="flex gap-3 rounded-xl border border-rose-100 bg-rose-50/70 p-4 text-rose-900 shadow-sm">
              <AlertCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold">فشل تعديل البيانات</h3>
                <p className="text-xs font-semibold text-rose-700">{profileGeneralError}</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <form onSubmit={handleProfileSubmit} className="space-y-5" noValidate>
              {/* Profile Name */}
              <div className="space-y-1.5">
                <label htmlFor="profileName" className="text-xs font-bold text-slate-600">
                  اسم العرض (الاسم الكامل)
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <User className="size-4.5 text-slate-400" />
                  </div>
                  <input
                    id="profileName"
                    name="profileName"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    disabled={isSavingProfile}
                    placeholder="الاسم الكامل للمدير"
                    className={`block w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm outline-none transition-colors ${
                      profileErrors.name
                        ? "border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    }`}
                  />
                </div>
                {profileErrors.name && (
                  <p className="text-xxs font-bold text-rose-600 mr-1">{profileErrors.name}</p>
                )}
              </div>

              {/* Profile Email */}
              <div className="space-y-1.5">
                <label htmlFor="profileEmail" className="text-xs font-bold text-slate-600">
                  البريد الإلكتروني الحالي
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Mail className="size-4.5 text-slate-400" />
                  </div>
                  <input
                    id="profileEmail"
                    name="profileEmail"
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    disabled={isSavingProfile}
                    placeholder="example@domain.com"
                    className={`block w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm outline-none transition-colors font-mono ${
                      profileErrors.email
                        ? "border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    }`}
                  />
                </div>
                {profileErrors.email && (
                  <p className="text-xxs font-bold text-rose-600 mr-1">{profileErrors.email}</p>
                )}
                
                {/* Supabase Email Verification Info Banner */}
                {profileEmail !== currentUser?.email && (
                  <div className="flex gap-2 rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-amber-900 mt-2 animate-in fade-in duration-200">
                    <Info className="size-4 shrink-0 text-amber-600 mt-0.5" />
                    <p className="text-xxs font-semibold leading-normal text-amber-800">
                      ملاحظة: عند تغيير البريد الإلكتروني، سيرسل النظام روابط تأكيد إلكترونية للبريد القديم والجديد. لن يتم اعتماد العنوان الجديد في النظام حتى يتم النقر على الروابط.
                    </p>
                  </div>
                )}
              </div>

              {/* Profile Password */}
              <div className="space-y-1.5">
                <label htmlFor="profilePassword" className="text-xs font-bold text-slate-600">
                  تغيير كلمة المرور (اختياري)
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Lock className="size-4.5 text-slate-400" />
                  </div>
                  <input
                    id="profilePassword"
                    name="profilePassword"
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    disabled={isSavingProfile}
                    placeholder="اتركها فارغة إذا كنت لا ترغب بتغييرها"
                    className={`block w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm outline-none transition-colors font-mono ${
                      profileErrors.password
                        ? "border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    }`}
                  />
                </div>
                {profileErrors.password && (
                  <p className="text-xxs font-bold text-rose-600 mr-1">{profileErrors.password}</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>جاري حفظ الإعدادات...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>حفظ التغييرات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
