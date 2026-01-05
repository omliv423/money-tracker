import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const adminClient = createAdminClient();

    // Delete user data in order (respecting foreign key constraints)
    // 1. Delete transaction_lines (via transactions)
    const { data: transactions } = await adminClient
      .from("transactions")
      .select("id")
      .eq("user_id", userId);

    if (transactions && transactions.length > 0) {
      const transactionIds = transactions.map((t) => t.id);
      await adminClient
        .from("transaction_lines")
        .delete()
        .in("transaction_id", transactionIds);
    }

    // 2. Delete transactions
    await adminClient.from("transactions").delete().eq("user_id", userId);

    // 3. Delete recurring_transaction_lines (via recurring_transactions)
    const { data: recurringTx } = await adminClient
      .from("recurring_transactions")
      .select("id")
      .eq("user_id", userId);

    if (recurringTx && recurringTx.length > 0) {
      const recurringIds = recurringTx.map((r) => r.id);
      await adminClient
        .from("recurring_transaction_lines")
        .delete()
        .in("recurring_transaction_id", recurringIds);
    }

    // 4. Delete recurring_transactions
    await adminClient
      .from("recurring_transactions")
      .delete()
      .eq("user_id", userId);

    // 5. Delete quick_entries
    await adminClient.from("quick_entries").delete().eq("user_id", userId);

    // 6. Delete budgets
    await adminClient.from("budgets").delete().eq("user_id", userId);

    // 7. Delete balance_items
    await adminClient.from("balance_items").delete().eq("user_id", userId);

    // 8. Delete settlements
    await adminClient.from("settlements").delete().eq("user_id", userId);

    // 9. Delete categories
    await adminClient.from("categories").delete().eq("user_id", userId);

    // 10. Delete counterparties
    await adminClient.from("counterparties").delete().eq("user_id", userId);

    // 11. Delete accounts
    await adminClient.from("accounts").delete().eq("user_id", userId);

    // 12. Delete household memberships
    await adminClient.from("household_members").delete().eq("user_id", userId);

    // 13. Delete households owned by user
    await adminClient.from("households").delete().eq("owner_id", userId);

    // 14. Delete subscription
    await adminClient.from("subscriptions").delete().eq("user_id", userId);

    // 15. Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      userId
    );

    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
