"use client";

import { QRCodeSVG } from "qrcode.react";
import { Printer, QrCode } from "lucide-react";

interface QRCardProps {
  identifier: string;
  phone?: string | null;
  fullName: string;
  familySize: number;
}

export function QRCard({ identifier, phone, fullName, familySize }: QRCardProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide all page content during print */
          body * {
            visibility: hidden !important;
          }
          /* Show only our specific card */
          #id-card-to-print,
          #id-card-to-print * {
            visibility: visible !important;
          }
          /* Adjust layout for print rendering to standard ID card size */
          #id-card-to-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            width: 85.6mm !important;
            height: 53.98mm !important;
            border: 1.5px solid #059669 !important;
            border-radius: 8px !important;
            padding: 12px !important;
            box-shadow: none !important;
            background: white !important;
            color: #0f172a !important;
            display: flex !important;
            flex-direction: row-reverse !important;
            align-items: center !important;
            justify-content: space-between !important;
            direction: rtl !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <QrCode className="size-5 text-emerald-700" />
          <h2 className="text-lg font-extrabold text-slate-800 font-sans">البطاقة التعريفية الذكية</h2>
        </div>

        <div className="flex flex-col items-center justify-center gap-6 md:flex-row md:justify-around">
          {/* Card Preview Container */}
          <div
            id="id-card-to-print"
            className="relative flex h-[180px] w-[320px] flex-row-reverse items-center justify-between rounded-xl border-2 border-emerald-600 bg-gradient-to-br from-white to-emerald-50/20 p-4 shadow-md transition-all hover:shadow-lg"
            style={{ direction: "rtl" }}
          >
            {/* Design Watermark */}
            <div className="absolute top-0 right-0 size-16 -translate-y-4 translate-x-4 rounded-full bg-emerald-500/5 pointer-events-none" />

            {/* Left side: QR Code */}
            <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm shrink-0">
              <QRCodeSVG
                value={identifier}
                size={90}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Right side: Details */}
            <div className="flex flex-1 flex-col justify-between h-full pr-3 text-right">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="inline-block size-2 rounded-full bg-emerald-600"></span>
                  <span className="text-[10px] font-extrabold text-emerald-800 tracking-wider">بطاقة مستفيد المساعدات</span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-800 line-clamp-2 leading-tight">
                  {fullName}
                </h3>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 font-bold">
                  رقم الهوية: <span className="font-mono font-extrabold text-slate-800 text-xs">{identifier}</span>
                </div>
                {phone && (
                  <div className="text-[10px] text-slate-500 font-bold">
                    رقم الهاتف: <span className="font-mono font-extrabold text-slate-800 text-xs">{phone}</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] font-bold text-slate-500">
                أفراد العائلة: <span className="font-extrabold text-emerald-700">{familySize}</span>
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex flex-col justify-center space-y-3 no-print">
            <p className="text-xs text-slate-500 max-w-[200px] text-center md:text-right font-medium leading-relaxed">
              قم بطباعة هذه البطاقة وتقديمها للمستفيد. يمكن للموزع مسح رمز الاستجابة السريعة (QR Code) لتسجيل الصرف فوراً دون إدخال البيانات يدوياً.
            </p>
            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 active:bg-emerald-900 cursor-pointer"
            >
              <Printer className="size-4" />
              <span>طباعة الكارت</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
