-- Fix balance for 三井住友銀行
UPDATE accounts SET current_balance = 409056 WHERE name ILIKE '%三井住友%';
