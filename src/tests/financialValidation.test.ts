/**
 * Tests for src/utils/financialValidation.ts
 *
 * Run with:  npx tsx src/tests/financialValidation.test.ts
 */
import { validateFinancialAmounts, computeFinalAmount } from '../utils/financialValidation';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  PASS: ${message}`);
}

function suite(name: string, fn: () => void): void {
  console.log(`\n${name}`);
  fn();
}

suite('validateFinancialAmounts', () => {
  assert(
    validateFinancialAmounts(100, 5, 105),
    'exact match: 100 + 5 = 105'
  );
  assert(
    validateFinancialAmounts(100, 0, 100),
    'zero charges: 100 + 0 = 100'
  );
  assert(
    validateFinancialAmounts(100.001, 0, 100),
    'within 0.01 tolerance: 100.001 + 0 ≈ 100'
  );
  assert(
    !validateFinancialAmounts(100, 5, 110),
    'mismatch detected: 100 + 5 ≠ 110'
  );
  assert(
    !validateFinancialAmounts(100, 5, 104.99),
    'just outside tolerance: 100 + 5 ≠ 104.99'
  );
  assert(
    validateFinancialAmounts(99.995, 5, 105),
    'floating-point near boundary: within 0.01'
  );
  assert(
    validateFinancialAmounts(0, 0, 0),
    'all zeros'
  );
  assert(
    validateFinancialAmounts(100, -10, 90),
    'negative charges (discount): 100 + (-10) = 90'
  );
});

suite('computeFinalAmount', () => {
  assert(computeFinalAmount(100, 5) === 105,     'basic addition');
  assert(computeFinalAmount(100, 0) === 100,     'zero charges');
  assert(computeFinalAmount(100, -10) === 90,    'discount');
  assert(computeFinalAmount(0, 0) === 0,         'zero principal');
  assert(computeFinalAmount(99.99, 0.01) === 100, 'float precision');
});

console.log('\n✓ All financialValidation tests passed');
