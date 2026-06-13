import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseExcelFile } from "../excel-utils";

// Mock xlsx library
let mockRows: any[] = [];
vi.mock("xlsx", () => {
  return {
    read: vi.fn(() => ({
      SheetNames: ["Sheet1"],
      Sheets: {
        Sheet1: {},
      },
    })),
    utils: {
      sheet_to_json: vi.fn(() => mockRows),
    },
  };
});

describe("excel-utils parseExcelFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockFile = () => {
    return new File([""], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  };

  it("successfully parses rows with exact matching Arabic column names", async () => {
    mockRows = [
      {
        "الاسم الكامل": "محمد علي أحمد",
        "رقم الهوية": "2910302919",
        "رقم الهاتف": "01012345678",
        "عدد الأفراد": 5,
      },
    ];

    const file = createMockFile();
    const result = await parseExcelFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      full_name: "محمد علي أحمد",
      identifier: "2910302919",
      phone: "01012345678",
      family_size: 5,
    });
  });

  it("successfully parses rows with hamza, ta-marbuta, and casing variations in column names", async () => {
    mockRows = [
      {
        "أسم المستفيد": "أحمد محمود سليم",
        "رقم الهويه": "01029301920",
        "الهاتف": "01187654321",
        "الافراد": "4",
      },
    ];

    const file = createMockFile();
    const result = await parseExcelFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      full_name: "أحمد محمود سليم",
      identifier: "01029301920",
      phone: "01187654321",
      family_size: 4,
    });
  });

  it("successfully parses rows with English and mixed casing headers", async () => {
    mockRows = [
      {
        "Full Name": "Jane Doe",
        "ID": "ID-9920",
        "Phone": "01234567890",
        "Family Size": "2",
      },
    ];

    const file = createMockFile();
    const result = await parseExcelFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      full_name: "Jane Doe",
      identifier: "ID-9920",
      phone: "01234567890",
      family_size: 2,
    });
  });

  it("reports validation errors for missing name or identifier", async () => {
    mockRows = [
      {
        "الاسم الكامل": "",
        "رقم الهوية": "123456",
        "رقم الهاتف": "01000000000",
        "عدد الأفراد": "3",
      },
      {
        "الاسم الكامل": "صالح سعيد",
        "رقم الهوية": "",
        "رقم الهاتف": "01000000000",
        "عدد الأفراد": "3",
      },
      {
        "الاسم الكامل": "خالد وليد",
        "رقم الهوية": "78910",
        "رقم الهاتف": "01000000000",
        "عدد الأفراد": "-2", // invalid
      },
    ];

    const file = createMockFile();
    const result = await parseExcelFile(file);

    expect(result.data).toHaveLength(0);
    expect(result.errors).toContain("صف 2: الاسم الكامل مطلوب.");
    expect(result.errors).toContain("صف 3: رقم الهوية مطلوب.");
    expect(result.errors).toContain("صف 4: عدد الأفراد يجب أن يكون رقماً صحيحاً أكبر من 0.");
  });
});
