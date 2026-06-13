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
  Edit2,
  Trash2,
  X,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type FormErrors = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
};

type UserAccount = {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
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
  const [currentUser, setCurrentUser] = useState<{ id?: string; name: string; email: string } | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [profileGeneralError, setProfileGeneralError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Users List States
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  // Edit User Modal States
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"manager" | "cashier">("cashier");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editErrors, setEditErrors] = useState<{ name?: string }>({});
  const [editGeneralError, setEditGeneralError] = useState("");

  // Delete User Modal States
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load current logged-in manager's details and the users list
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const uName = user.user_metadata?.name || "";
          const uEmail = user.email || "";
          setCurrentUser({ id: user.id, name: uName, email: uEmail });
          setProfileName(uName);
          setProfileEmail(uEmail);
        }
      } catch (err) {
        console.error("Error fetching current user on mount:", err);
      }
      
      // Load registered users list
      await fetchUsers();
    };

    fetchInitialData();
  }, []);

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    setUsersError("");
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        throw new Error("فشل تحميل قائمة المستخدمين.");
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setUsersError(err.message || "حدث خطأ غير متوقع أثناء تحميل قائمة المستخدمين.");
    } finally {
      setIsUsersLoading(false);
    }
  };

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
      
      // Refresh the users list dynamically
      await fetchUsers();
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
      setCurrentUser(prev => prev ? { ...prev, name: updatedName, email: updatedEmail } : null);
      setProfileName(updatedName);
      setProfileEmail(updatedEmail);
      setProfilePassword("");

      setProfileSuccess(true);
      router.refresh();
      
      // Refresh the users list dynamically
      await fetchUsers();
    } catch (err) {
      setProfileGeneralError("حدث خطأ غير متوقع أثناء حفظ الإعدادات.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const openEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role as "manager" | "cashier");
    setEditErrors({});
    setEditGeneralError("");
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEditErrors({});
    setEditGeneralError("");

    if (!editName.trim() || editName.trim().length < 2) {
      setEditErrors({ name: "الاسم الكامل مطلوب (ثنائي على الأقل)." });
      return;
    }

    setIsSavingEdit(true);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingUser?.id,
          name: editName.trim(),
          role: editRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "فشل تعديل بيانات المستخدم.");
      }

      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setEditGeneralError(err.message || "حدث خطأ غير متوقع.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openDeleteModal = (user: UserAccount) => {
    if (user.id === currentUser?.id) return; // Cannot delete self
    setDeletingUser(user);
  };

  const handleDeleteSubmit = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/users?id=${deletingUser.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "فشل حذف حساب المستخدم.");
      }

      setDeletingUser(null);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || "حدث خطأ غير متوقع أثناء حذف الحساب.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" dir="rtl">
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
            ? "إضافة حسابات مستخدمين جديدة وتعيين صلاحياتهم، وإدارة الحسابات المسجلة."
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
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          إضافة وإدارة المستخدمين
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
              : "border-transparent text-slate-500 hover:text-slate-805 hover:border-slate-300"
          }`}
        >
          إعدادات حسابي
        </button>
      </div>

      {/* TAB 1: ADD & MANAGE USERS */}
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

          {/* User Registration Form Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-sm font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">
              تسجيل حساب جديد
            </h2>
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

          {/* User List Table Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-700">
                  الحسابات النشطة على النظام
                </h2>
                <p className="text-xxs font-semibold text-slate-400 mt-0.5">
                  عرض وتعديل صلاحيات وحذف حسابات الموظفين المسجلين.
                </p>
              </div>
              <span className="rounded-full bg-slate-50 border border-slate-150 px-2 py-0.5 text-xxs font-extrabold text-slate-600">
                {users.length} مستخدمين
              </span>
            </div>

            {isUsersLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="size-6 animate-spin text-emerald-700" />
                <span className="text-xs font-bold text-slate-500">جاري تحميل قائمة المستخدمين...</span>
              </div>
            ) : usersError ? (
              <div className="flex gap-2 rounded-lg border border-rose-100 bg-rose-50/50 p-4 text-rose-800 text-xs font-semibold">
                <AlertCircle className="size-4 shrink-0 text-rose-600" />
                <span>{usersError}</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-xs font-bold text-slate-400">
                لا يوجد مستخدمون مسجلون حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-450 text-xxs font-extrabold">
                      <th className="py-2.5 font-bold">المستخدم</th>
                      <th className="py-2.5 font-bold">الصلاحية</th>
                      <th className="py-2.5 font-bold">تاريخ الإنشاء</th>
                      <th className="py-2.5 font-bold text-center">العمليات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map((user) => {
                      const isSelf = user.id === currentUser?.id;
                      return (
                        <tr key={user.id} className="text-xs text-slate-700 hover:bg-slate-50/40">
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex size-7.5 items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold border border-slate-150">
                                {user.name ? user.name[0] : <User className="size-3.5" />}
                              </span>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  {user.name || "مستخدم بدون اسم"}
                                  {isSelf && (
                                    <span className="rounded bg-emerald-100 text-emerald-800 px-1 py-0.2 text-[9px] font-extrabold">
                                      أنت
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] font-medium text-slate-450 font-mono">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            {user.role === "manager" ? (
                              <span className="inline-flex items-center gap-1 rounded border border-purple-100 bg-purple-50 px-1.5 py-0.5 text-xxs font-bold text-purple-700">
                                <Shield className="size-3" />
                                مدير نظام
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-xxs font-bold text-emerald-700">
                                <User className="size-3" />
                                كاشير
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-xxs font-medium text-slate-450">
                            {user.created_at
                              ? new Date(user.created_at).toLocaleDateString("ar-EG", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "غير متوفر"}
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(user)}
                                className="inline-flex size-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-550 shadow-sm hover:bg-slate-50 transition-colors"
                                title="تعديل الحساب"
                              >
                                <Edit2 className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteModal(user)}
                                disabled={isSelf}
                                className={`inline-flex size-7 items-center justify-center rounded border shadow-sm transition-colors ${
                                  isSelf
                                    ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                    : "bg-white border-rose-100 text-rose-600 hover:bg-rose-50"
                                }`}
                                title={isSelf ? "لا يمكنك حذف حسابك الحالي" : "حذف الحساب"}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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

      {/* EDIT USER MODAL DIALOG */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Edit2 className="size-4.5 text-emerald-600" />
                <h3 className="text-sm font-bold">تعديل بيانات المستخدم</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-colors"
              >
                <X className="size-4.5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4" noValidate>
              {editGeneralError && (
                <div className="flex gap-2 rounded-lg border border-rose-100 bg-rose-50/50 p-3 text-rose-800 text-xs font-semibold">
                  <AlertCircle className="size-4 shrink-0 text-rose-600" />
                  <span>{editGeneralError}</span>
                </div>
              )}

              {/* Readonly Email field */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-450 uppercase">البريد الإلكتروني (غير قابل للتعديل)</span>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500 font-mono">
                  {editingUser.email}
                </div>
              </div>

              {/* Edit Name */}
              <div className="space-y-1.5">
                <label htmlFor="editName" className="text-xs font-bold text-slate-600">
                  الاسم الكامل للموظف
                </label>
                <input
                  id="editName"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSavingEdit}
                  className={`block w-full rounded-lg border py-2 px-3 text-xs outline-none transition-colors ${
                    editErrors.name
                      ? "border-rose-350 focus:border-rose-500"
                      : "border-slate-200 focus:border-emerald-600"
                  }`}
                />
                {editErrors.name && (
                  <p className="text-[10px] font-bold text-rose-600 mr-0.5">{editErrors.name}</p>
                )}
              </div>

              {/* Edit Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">نوع الصلاحية</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditRole("cashier")}
                    disabled={isSavingEdit}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-bold transition-all ${
                      editRole === "cashier"
                        ? "border-emerald-600 bg-emerald-50/20 text-emerald-800 ring-1 ring-emerald-600"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50/50"
                    }`}
                  >
                    <User className="size-3.5" />
                    كاشير
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditRole("manager")}
                    disabled={isSavingEdit}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-bold transition-all ${
                      editRole === "manager"
                        ? "border-emerald-600 bg-emerald-50/20 text-emerald-800 ring-1 ring-emerald-600"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50/50"
                    }`}
                  >
                    <Shield className="size-3.5" />
                    مدير نظام
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={isSavingEdit}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800 transition-colors"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ التغييرات</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION DIALOG */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Body */}
            <div className="p-5 text-center space-y-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <ShieldAlert className="size-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-800">حذف حساب المستخدم؟</h3>
                <p className="text-xs font-semibold text-slate-500 leading-normal">
                  هل أنت متأكد من رغبتك في حذف حساب <strong className="text-slate-850 font-bold">{deletingUser.name}</strong>؟
                  هذا الإجراء نهائي ولا يمكن التراجع عنه. لن يتمكن الموظف من استخدام هذا البريد الإلكتروني لتسجيل الدخول مجدداً.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={isDeleting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-rose-700 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>نعم، حذف الحساب</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
