"use client";

export interface BeneficiaryImportRow {
  full_name: string;
  identifier: string;
  phone: string;
  family_size: number;
}

export interface ParseResult {
  data: BeneficiaryImportRow[];
  errors: string[];
}

/**
 * Lazily loads the xlsx library only when actually needed.
 * This saves ~500KB from the initial bundle.
 */
async function getXLSX() {
  const XLSX = await import("xlsx");
  return XLSX;
}

function normalizeKey(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/ة/g, "ه");
}

const NAME_KEYS = ["الاسم الكامل", "اسم المستفيد", "الاسم", "name", "fullname", "full name"];
const IDENTIFIER_KEYS = ["رقم الهويه", "الرقم القومي", "رقم البطاقه", "الهويه", "identifier", "national id", "id", "الرقم"];
const PHONE_KEYS = ["رقم الهاتف", "الهاتف", "الجوال", "رقم الجوال", "phone", "mobile", "telephone"];
const FAMILY_SIZE_KEYS = ["عدد الافراد", "عدد افراد الاسره", "الافراد", "family size", "familysize", "family_size", "size", "عدد", "الاسره"];

function findValue(row: Record<string, any>, possibleKeys: string[], defaultValue: string = ""): string {
  const keys = Object.keys(row);
  
  // 1. Try exact normalized match
  for (const candidate of possibleKeys) {
    const foundKey = keys.find(k => normalizeKey(k) === normalizeKey(candidate));
    if (foundKey !== undefined && row[foundKey] !== undefined && row[foundKey] !== null) {
      return row[foundKey].toString().trim();
    }
  }

  // 2. Try substring match (if candidate is contained inside key, or key is contained inside candidate)
  for (const candidate of possibleKeys) {
    const normCandidate = normalizeKey(candidate);
    const foundKey = keys.find(k => {
      const normKey = normalizeKey(k);
      return normKey.includes(normCandidate) || normCandidate.includes(normKey);
    });
    if (foundKey !== undefined && row[foundKey] !== undefined && row[foundKey] !== null) {
      return row[foundKey].toString().trim();
    }
  }

  return defaultValue;
}

/**
 * Parses an uploaded .xlsx file and validates rows.
 * Expected columns: الاسم الكامل (full_name), رقم الهوية (identifier), رقم الهاتف (phone), عدد الأفراد (family_size)
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const XLSX = await getXLSX();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          resolve({ data: [], errors: ["الملف لا يحتوي على أي أوراق عمل."] });
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        });

        if (rawRows.length === 0) {
          resolve({ data: [], errors: ["الملف لا يحتوي على أي بيانات."] });
          return;
        }

        const results: BeneficiaryImportRow[] = [];
        const errors: string[] = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2; // +2 because row 1 is header, 0-indexed

          const fullName = findValue(row, NAME_KEYS);
          const identifier = findValue(row, IDENTIFIER_KEYS);
          const phone = findValue(row, PHONE_KEYS);
          const familySizeRaw = findValue(row, FAMILY_SIZE_KEYS, "1");

          const familySize = parseInt(familySizeRaw, 10);

          // Validate
          if (!fullName) {
            errors.push(`صف ${rowNum}: الاسم الكامل مطلوب.`);
            return;
          }
          if (!identifier) {
            errors.push(`صف ${rowNum}: رقم الهوية مطلوب.`);
            return;
          }
          if (!phone) {
            errors.push(`صف ${rowNum}: رقم الهاتف مطلوب.`);
            return;
          }
          if (isNaN(familySize) || familySize < 1) {
            errors.push(
              `صف ${rowNum}: عدد الأفراد يجب أن يكون رقماً صحيحاً أكبر من 0.`
            );
            return;
          }

          results.push({
            full_name: fullName,
            identifier,
            phone,
            family_size: familySize,
          });
        });

        resolve({ data: results, errors });
      } catch (err) {
        reject(new Error("فشل في قراءة ملف Excel. تأكد من أن الملف بصيغة .xlsx صالحة."));
      }
    };

    reader.onerror = () => {
      reject(new Error("حدث خطأ أثناء قراءة الملف."));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports data to an .xlsx file and triggers browser download.
 * xlsx is loaded lazily to avoid bloating initial bundle.
 */
export async function exportToExcel(
  data: Record<string, any>[],
  filename: string = "report"
) {
  const XLSX = await getXLSX();

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "التقرير");

  // Auto-size columns
  const maxWidths: number[] = [];
  const headerKeys = Object.keys(data[0] || {});
  headerKeys.forEach((key, colIdx) => {
    let maxLen = key.length;
    data.forEach((row) => {
      const cellLen = (row[key]?.toString() || "").length;
      if (cellLen > maxLen) maxLen = cellLen;
    });
    maxWidths[colIdx] = Math.min(maxLen + 4, 40);
  });
  worksheet["!cols"] = maxWidths.map((w) => ({ wch: w }));

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
