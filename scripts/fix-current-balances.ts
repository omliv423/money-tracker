import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zudzysospgrhkznhjfce.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZHp5c29zcGdyaGt6bmhqZmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MTMxNDMsImV4cCI6MjA4MjE4OTE0M30.KNacHqOO6ERPdRE5PJbISAtvAUBy6JCcPHT1muL7iFQ'
);

async function main() {
  console.log('=== current_balance 修正スクリプト ===\n');

  // 全口座を取得
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .order('name');

  if (!accounts) {
    console.log('口座が見つかりません');
    return;
  }

  // 消し込み済み取引を取得
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id,
      date,
      total_amount,
      settled_amount,
      account_id,
      is_cash_settled,
      settlement_account_id,
      settlement_date,
      transaction_lines(amount, line_type)
    `)
    .order('date', { ascending: true });

  // 消し込み済みの取引をフィルタ
  const settledTransactions = (transactions || []).filter((tx: any) =>
    tx.is_cash_settled === true ||
    (tx.settlement_account_id && (tx.settled_amount || 0) > 0)
  );

  // 各口座の残高を計算
  for (const account of accounts) {
    const openingBalance = account.opening_balance ?? 0;
    const openingDate = (account as any).opening_date || '1900-01-01';
    let calculatedBalance = openingBalance;

    // この口座に影響する取引を処理
    for (const tx of settledTransactions as any[]) {
      const targetAccountId = tx.settlement_account_id || tx.account_id;
      if (targetAccountId !== account.id) continue;

      const effectiveDate = tx.settlement_date || tx.date;
      if (effectiveDate < openingDate) continue;

      let totalInflow = 0;
      let totalOutflow = 0;

      (tx.transaction_lines || []).forEach((line: any) => {
        if (line.line_type === 'income' || line.line_type === 'liability') {
          totalInflow += line.amount || 0;
        } else if (line.line_type === 'expense' || line.line_type === 'asset') {
          totalOutflow += line.amount || 0;
        }
      });

      if (totalInflow === 0 && totalOutflow === 0) continue;

      let netChange: number;
      if (tx.settlement_account_id) {
        const settleAmount = tx.is_cash_settled ? tx.total_amount : (tx.settled_amount || 0);
        netChange = totalInflow > totalOutflow ? settleAmount : -settleAmount;
      } else {
        netChange = totalInflow - totalOutflow;
      }

      calculatedBalance += netChange;
    }

    // 変更があれば更新
    const currentBalance = account.current_balance;
    if (currentBalance !== calculatedBalance) {
      console.log(`${account.name}:`);
      console.log(`  opening_balance: ${openingBalance}`);
      console.log(`  opening_date: ${openingDate}`);
      console.log(`  current_balance (DB): ${currentBalance}`);
      console.log(`  calculated_balance: ${calculatedBalance}`);
      console.log(`  差分: ${calculatedBalance - (currentBalance ?? 0)}`);

      // 更新実行
      const { error } = await supabase
        .from('accounts')
        .update({ current_balance: calculatedBalance })
        .eq('id', account.id);

      if (error) {
        console.log(`  更新エラー: ${error.message}`);
      } else {
        console.log(`  ✓ 更新完了`);
      }
      console.log('');
    }
  }

  console.log('完了');
}

main();
