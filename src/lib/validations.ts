import { z } from "zod";

// Common validation schemas

/** Account creation/update */
export const accountSchema = z.object({
  name: z
    .string()
    .min(1, "口座名は必須です")
    .max(50, "口座名は50文字以内で入力してください"),
  type: z.enum(["bank", "credit", "cash", "emoney"], {
    error: "無効な口座タイプです",
  }),
  balance: z.number().optional(),
  display_order: z.number().int().optional(),
});

/** Category creation/update */
export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "カテゴリ名は必須です")
    .max(50, "カテゴリ名は50文字以内で入力してください"),
  type: z.enum(["income", "expense"], {
    error: "無効なカテゴリタイプです",
  }),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "無効な色コードです")
    .optional(),
  icon: z.string().max(50).optional(),
});

/** Transaction creation */
export const transactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "無効な日付形式です"),
  description: z
    .string()
    .min(1, "説明は必須です")
    .max(200, "説明は200文字以内で入力してください"),
  total_amount: z.number().min(0, "金額は0以上で入力してください"),
  account_id: z.string().uuid("無効な口座IDです").optional(),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "無効な日付形式です")
    .optional()
    .nullable(),
  is_cash_settled: z.boolean().optional(),
  paid_by_other: z.boolean().optional(),
  counterparty_id: z.string().uuid("無効な相手先IDです").optional().nullable(),
});

/** Transaction line */
export const transactionLineSchema = z.object({
  amount: z.number().min(0, "金額は0以上で入力してください"),
  line_type: z.enum(["income", "expense", "advance", "loan", "asset", "liability"], {
    error: "無効な明細タイプです",
  }),
  category_id: z.string().uuid("無効なカテゴリIDです").optional().nullable(),
  note: z.string().max(500, "メモは500文字以内で入力してください").optional().nullable(),
  counterparty: z.string().max(100).optional().nullable(),
});

/** Counterparty creation/update */
export const counterpartySchema = z.object({
  name: z
    .string()
    .min(1, "相手先名は必須です")
    .max(100, "相手先名は100文字以内で入力してください"),
});

/** Budget creation/update */
export const budgetSchema = z.object({
  category_id: z.string().uuid("無効なカテゴリIDです"),
  amount: z.number().min(0, "予算額は0以上で入力してください"),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "無効な月形式です（YYYY-MM）"),
});

/** Recurring transaction */
export const recurringTransactionSchema = z.object({
  name: z
    .string()
    .min(1, "名前は必須です")
    .max(100, "名前は100文字以内で入力してください"),
  amount: z.number().min(0, "金額は0以上で入力してください"),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"], {
    error: "無効な頻度です",
  }),
  category_id: z.string().uuid("無効なカテゴリIDです").optional().nullable(),
  account_id: z.string().uuid("無効な口座IDです").optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "無効な日付形式です"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "無効な日付形式です")
    .optional()
    .nullable(),
});

/** Email validation */
export const emailSchema = z
  .string()
  .email("有効なメールアドレスを入力してください")
  .max(254, "メールアドレスが長すぎます");

/** Household invitation */
export const inviteSchema = z.object({
  email: emailSchema,
});

/** Helper to validate and parse data */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Return first error message (Zod 4 uses issues instead of errors)
  const firstIssue = result.error.issues[0];
  return {
    success: false,
    error: firstIssue?.message || "入力が無効です",
  };
}
