import type { Metadata } from "next";
import { SearchInterface } from "./_components/search-interface";

export const metadata: Metadata = {
  title: "البحث عن المستفيدين | نظام توزيع المساعدات",
  description: "البحث عن المستفيدين والتحقق من حالة الصرف الشهري وتأكيد صرف المساعدات الخيرية.",
};

export default function SearchPage() {
  return (
    <div className="w-full">
      <SearchInterface />
    </div>
  );
}
