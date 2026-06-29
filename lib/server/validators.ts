import { z } from "zod";

export function normalizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}


export const productSchema = z.object({
  sku: z.string().trim().optional().or(z.literal("")),
  name: z.string().min(2),
  price: z.coerce.number().int().min(0),
  costPrice: z.coerce.number().int().min(0).default(0),
  stock: z.coerce.number().int().min(0).optional().nullable(),
  photoUrl: z.string().max(2_000_000).optional().or(z.literal("")),
});

export const updateProductSchema = productSchema.partial();

export const cartItemSchema = z.object({
  productId: z.string().optional(),
  sku: z.string().trim().optional().or(z.literal("")),
  name: z.string().min(1),
  price: z.coerce.number().int().min(0),
  quantity: z.coerce.number().int().min(1),
});

export const checkoutSchema = z.object({
  paymentMethod: z.enum(["cash", "qris_static", "qris_pakasir", "debt"]),
  paidAmount: z.coerce.number().int().min(0).optional(),
  note: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  debtDueDate: z.string().optional(),
  items: z.array(cartItemSchema).min(1),
});

export const adminCreateSchema = z.object({
  name: z.string().trim().min(2, "Nama admin minimal 2 karakter"),
  username: z.preprocess(normalizeUsername, z.string().min(3, "Username minimal 3 karakter").regex(/^[a-z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore")),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  shopName: z.string().trim().min(2, "Nama UMKM minimal 2 karakter"),
  shopAddress: z.string().trim().optional(),
});

export const adminUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  username: z.preprocess(normalizeUsername, z.string().min(3).regex(/^[a-z0-9_]+$/)).optional(),
  shopName: z.string().trim().min(2).optional(),
  shopAddress: z.string().trim().optional(),
  qrisStaticImageUrl: z.string().max(2_000_000).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const paymentConfigSchema = z.object({
  pakasirSlug: z.string().trim().min(1, "Slug Pakasir wajib diisi").optional().or(z.literal("")),
  pakasirApiKey: z.string().trim().min(1, "API Key Pakasir wajib diisi").optional().or(z.literal("")),
});

export const withdrawalRequestSchema = z.object({
  amount: z.coerce.number().int().positive(),
  bankName: z.string().min(2),
  accountNumber: z.string().min(3),
  accountName: z.string().min(2),
  adminPassword: z.string().min(1, "Password admin wajib diisi"),
});

export const debtCreateSchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().optional(),
  amount: z.coerce.number().int().positive(),
  dueDate: z.string().optional(),
  note: z.string().optional(),
});

export const debtPaymentSchema = z.object({
  amount: z.coerce.number().int().positive(),
  note: z.string().optional(),
});
