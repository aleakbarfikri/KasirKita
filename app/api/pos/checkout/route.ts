import { authError, getAdminScope, requirePosUser } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { applySuccessfulTransactionStock } from "@/lib/server/inventory";
import { createPakasirQris } from "@/lib/server/pakasir";
import { buildReceipt } from "@/lib/server/receipt";
import { checkoutSchema } from "@/lib/server/validators";
import { addAuditLog, now, readDb, writeDb, type Debt, type Transaction, type TransactionItem } from "@/lib/server/data-store";

export async function POST(request: Request) {
  try {
    const session = await requirePosUser();
    const scope = await getAdminScope(session.user.id);
    const body = checkoutSchema.parse(await readJson(request));

    const total = body.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const paidAmount = body.paidAmount ?? 0;
    const transactionId = createId("trx");
    const receiptToken = createId("rcpt");

    if (body.paymentMethod === "cash" && paidAmount < total) return fail("Cash paid amount cannot be lower than total", 422);
    if (body.paymentMethod === "debt" && !body.customerName) return fail("Customer name is required for debt transaction", 422);

    const db = await readDb();
    const pakasirConfig = body.paymentMethod === "qris_pakasir" ? db.paymentConfigs.find((row) => row.ownerId === scope.ownerId) : null;
    if (body.paymentMethod === "qris_pakasir" && (!pakasirConfig?.pakasirSlug || !pakasirConfig?.pakasirApiKey)) {
      return fail("Slug dan API Key Pakasir belum diisi. Buka Owner > API Config terlebih dahulu.", 422);
    }

    const t = now();
    const externalRef = body.paymentMethod === "qris_pakasir" ? transactionId : null;
    const status = body.paymentMethod === "qris_pakasir" ? "pending" : "success";
    const transaction: Transaction = {
      id: transactionId,
      shopId: scope.shopId,
      cashierId: session.user.id,
      paymentMethod: body.paymentMethod,
      total,
      paidAmount: body.paymentMethod === "cash" ? paidAmount : null,
      changeAmount: body.paymentMethod === "cash" ? paidAmount - total : null,
      status,
      externalRef,
      receiptToken,
      note: body.note ?? null,
      createdAt: t,
      updatedAt: t,
    };

    const items: TransactionItem[] = body.items.map((item) => {
      const product = item.productId ? db.products.find((row) => row.id === item.productId && row.shopId === scope.shopId) : null;
      return {
        id: createId("trxi"),
        transactionId,
        productId: item.productId ?? null,
        sku: item.sku?.trim() || `ITEM-${Date.now().toString().slice(-8)}`,
        name: item.name,
        price: item.price,
        costPrice: product?.costPrice ?? 0,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
      };
    });

    if (body.paymentMethod === "qris_pakasir") {
      applySuccessfulTransactionStock(db, scope.shopId, items, { validateOnly: true });
    } else {
      applySuccessfulTransactionStock(db, scope.shopId, items);
    }

    let debt: Debt | null = null;
    if (body.paymentMethod === "debt") {
      debt = {
        id: createId("debt"),
        shopId: scope.shopId,
        adminId: scope.adminId,
        transactionId,
        customerName: body.customerName!,
        customerPhone: body.customerPhone ?? null,
        amount: total,
        paidAmount: 0,
        status: "open",
        dueDate: body.debtDueDate ? new Date(body.debtDueDate).toISOString() : null,
        note: body.note ?? null,
        createdAt: t,
        updatedAt: t,
      };
      db.debts.push(debt);
    }

    db.transactions.push(transaction);
    db.transactionItems.push(...items);
    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: session.user.role === "cashier" ? "cashier" : "admin",
      shopId: scope.shopId,
      action: "create_transaction",
      entityType: "transaction",
      entityId: transactionId,
      message: `${session.user.name || session.user.username || "Kasir"} membuat transaksi ${body.paymentMethod} senilai ${total}.`,
      metadata: { paymentMethod: body.paymentMethod, total, itemCount: items.length, status },
    });
    if (debt) {
      addAuditLog(db, {
        actorId: session.user.id,
        actorRole: session.user.role === "cashier" ? "cashier" : "admin",
        shopId: scope.shopId,
        action: "create_debt",
        entityType: "debt",
        entityId: debt.id,
        message: `Hutang baru dicatat untuk ${debt.customerName} senilai ${debt.amount}.`,
        metadata: { transactionId, customerPhone: debt.customerPhone },
      });
    }
    await writeDb(db);
    const result = { transaction, items, debt, receipt: buildReceipt(db, transaction, new URL(request.url).origin) };

    if (body.paymentMethod === "qris_pakasir") {
      try {
        const pakasir = await createPakasirQris({ slug: pakasirConfig!.pakasirSlug!, apiKey: pakasirConfig!.pakasirApiKey!, orderId: transactionId, amount: total });
        return ok({
          ...result,
          payment: {
            provider: "pakasir",
            status: "pending",
            orderId: transactionId,
            reference: externalRef!,
            amount: total,
            totalPayment: pakasir.totalPayment,
            fee: pakasir.fee,
            qrString: pakasir.qrString,
            qrImageDataUrl: pakasir.qrImageDataUrl,
            paymentUrl: pakasir.paymentUrl,
            expiredAt: pakasir.expiredAt,
            pollEveryMs: 3000,
          },
        }, { status: 201 });
      } catch (error) {
        const retryDb = await readDb();
        const row = retryDb.transactions.find((trx) => trx.id === transactionId);
        if (row) {
          row.status = "failed";
          row.note = error instanceof Error ? error.message : "Gagal membuat transaksi Pakasir";
          row.updatedAt = now();
          await writeDb(retryDb);
        }
        return fail(error instanceof Error ? error.message : "Gagal membuat transaksi Pakasir", 502);
      }
    }

    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Invalid checkout payload. SKU item boleh kosong, tetapi nama, harga, dan quantity wajib valid.", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
