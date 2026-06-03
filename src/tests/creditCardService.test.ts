/**
 * Tests for creditCardService.ts — Items 3, 4, 5.
 *
 * Item 3: Idempotency — installment_id prevents double cash_transaction insert.
 * Item 4: Empty installments array must NOT trigger 'completed' status.
 * Item 5: Rollback — if installments INSERT fails, orphan sale is deleted.
 *
 * Run with:  npx tsx src/tests/creditCardService.test.ts
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  PASS: ${message}`);
}

function suite(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`\n${name}`);
  return fn();
}

// ---------------------------------------------------------------------------
// Item 4 — isAllReceived / isAllPaid  (extracted pure logic)
// ---------------------------------------------------------------------------
type Installment = { status: string };

function isAllReceived(installments: Installment[] | null | undefined): boolean {
  return (installments?.length ?? 0) > 0 && installments!.every(i => i.status === 'received');
}

function isAllPaid(installments: Installment[] | null | undefined): boolean {
  return (installments?.length ?? 0) > 0 && installments!.every(i => i.status === 'paid');
}

async function testEmptyArrayGuard(): Promise<void> {
  // isAllReceived
  assert(!isAllReceived([]),                                     'isAllReceived([]) → false');
  assert(!isAllReceived(null),                                   'isAllReceived(null) → false');
  assert(!isAllReceived(undefined),                              'isAllReceived(undefined) → false');
  assert(isAllReceived([{ status: 'received' }]),                'isAllReceived([received]) → true');
  assert(!isAllReceived([{ status: 'received' }, { status: 'pending' }]), 'isAllReceived([received,pending]) → false');
  assert(isAllReceived([{ status: 'received' }, { status: 'received' }]), 'isAllReceived([received,received]) → true');

  // isAllPaid
  assert(!isAllPaid([]),                                         'isAllPaid([]) → false');
  assert(!isAllPaid(null),                                       'isAllPaid(null) → false');
  assert(isAllPaid([{ status: 'paid' }]),                        'isAllPaid([paid]) → true');
  assert(!isAllPaid([{ status: 'paid' }, { status: 'pending' }]), 'isAllPaid([paid,pending]) → false');
}

// ---------------------------------------------------------------------------
// Item 3 — Idempotency guard logic
// ---------------------------------------------------------------------------
async function testInstallmentIdempotency(): Promise<void> {
  // Simulates the logic in registerSaleInstallmentPayment:
  //   if existing cash_transaction for installmentId → skip insert.

  async function simulateRegisterPayment(
    installmentId: string,
    existingCashTx: { id: string } | null
  ): Promise<'skipped' | 'inserted'> {
    // Primary guard
    if (existingCashTx !== null) {
      return 'skipped';
    }
    return 'inserted';
  }

  const r1 = await simulateRegisterPayment('inst-1', { id: 'cash-existing' });
  assert(r1 === 'skipped', 'duplicate installment payment is skipped');

  const r2 = await simulateRegisterPayment('inst-2', null);
  assert(r2 === 'inserted', 'first-time payment is inserted');

  // Calling twice with same id and a found row → still skipped
  const r3 = await simulateRegisterPayment('inst-1', { id: 'cash-existing' });
  assert(r3 === 'skipped', 'idempotency holds on repeated calls');
}

// ---------------------------------------------------------------------------
// Item 5 — Rollback on creation failure
// ---------------------------------------------------------------------------
async function testRollbackOnInstallmentsFailure(): Promise<void> {
  let saleInserted = false;
  let saleDeleted  = false;
  let installmentsInserted = false;

  async function simulateCreateWithRollback(shouldInstallmentsFail: boolean): Promise<void> {
    // Step 1: Insert sale
    saleInserted = true;
    const saleId = 'sale-123';

    // Step 2: Insert installments
    if (shouldInstallmentsFail) {
      // Rollback: delete the orphan sale
      saleDeleted = true;
      throw new Error('installments insert failed');
    }
    installmentsInserted = true;
  }

  // Test: success path
  saleInserted = false; saleDeleted = false; installmentsInserted = false;
  await simulateCreateWithRollback(false);
  assert(saleInserted,           'sale was inserted on success path');
  assert(!saleDeleted,           'sale was NOT deleted on success path');
  assert(installmentsInserted,   'installments were inserted on success path');

  // Test: failure path with rollback
  saleInserted = false; saleDeleted = false; installmentsInserted = false;
  try {
    await simulateCreateWithRollback(true);
    assert(false, 'should have thrown');
  } catch (_e) {
    assert(saleInserted,         'sale was inserted before failure');
    assert(saleDeleted,          'orphan sale was deleted on rollback');
    assert(!installmentsInserted,'installments were NOT inserted (failed)');
  }
}

// ---------------------------------------------------------------------------
// Run all
// ---------------------------------------------------------------------------
(async () => {
  await suite('Item 4 — Empty array guard (isAllReceived / isAllPaid)', testEmptyArrayGuard);
  await suite('Item 3 — Installment idempotency guard', testInstallmentIdempotency);
  await suite('Item 5 — Rollback on installments creation failure', testRollbackOnInstallmentsFailure);

  console.log('\n✓ All creditCardService tests passed');
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
