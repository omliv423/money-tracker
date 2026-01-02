import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zudzysospgrhkznhjfce.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZHp5c29zcGdyaGt6bmhqZmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MTMxNDMsImV4cCI6MjA4MjE4OTE0M30.KNacHqOO6ERPdRE5PJbISAtvAUBy6JCcPHT1muL7iFQ'
);

async function main() {
  // ゆうちょ銀行の情報取得
  const { data: yucho } = await supabase
    .from('accounts')
    .select('*')
    .eq('name', 'ゆうちょ銀行')
    .single();

  console.log('=== ゆうちょ銀行 ===');
  console.log('ID:', yucho?.id);
  console.log('opening_balance:', yucho?.opening_balance);
  console.log('current_balance:', yucho?.current_balance);

  const yuchoId = yucho?.id;

  // account_id = ゆうちょ銀行 の取引
  const { data: txByAccount } = await supabase
    .from('transactions')
    .select('id, date, description, total_amount, is_cash_settled, settlement_account_id, settlement_date')
    .eq('account_id', yuchoId)
    .order('date');

  console.log('\n=== account_id = ゆうちょ銀行 の取引 ===');
  console.log('件数:', txByAccount?.length);
  txByAccount?.forEach((tx: any) => {
    console.log(`  ${tx.date} | ${tx.description} | ¥${tx.total_amount} | is_cash_settled=${tx.is_cash_settled}`);
  });

  // settlement_account_id = ゆうちょ銀行 の取引
  const { data: txBySettlement } = await supabase
    .from('transactions')
    .select('id, date, description, total_amount, is_cash_settled, settlement_account_id, settlement_date, account_id')
    .eq('settlement_account_id', yuchoId)
    .order('date');

  console.log('\n=== settlement_account_id = ゆうちょ銀行 の取引 ===');
  console.log('件数:', txBySettlement?.length);
  txBySettlement?.forEach((tx: any) => {
    console.log(`  ${tx.date} | settlement_date=${tx.settlement_date} | ${tx.description} | ¥${tx.total_amount}`);
  });

  // is_cash_settled=true でゆうちょ銀行に関連する取引の transaction_lines を確認
  console.log('\n=== 取引明細の確認 ===');
  for (const tx of (txByAccount || []).filter((t: any) => t.is_cash_settled)) {
    const { data: lines } = await supabase
      .from('transaction_lines')
      .select('amount, line_type')
      .eq('transaction_id', tx.id);
    console.log(`${tx.description}:`, lines);
  }
}

main();
