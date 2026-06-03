/**
 * AcertoPaymentService — thin orchestration wrapper.
 *
 * All financial writes (cash transactions, sale status updates, acerto balance)
 * are delegated to financialCoreService, which is the single authority for
 * these operations.
 */
import { Acerto } from '../types';
import { processAcertoClientPayment } from '../services/financialCoreService';

export class AcertoPaymentService {
  /**
   * Processa o pagamento de acerto de cliente.
   *
   * Delegates entirely to financialCoreService.processAcertoClientPayment which:
   *  - Distributes the payment proportionally across selected sales (no blanket 'pago').
   *  - Registers cash transactions with idempotency guards.
   *  - Updates the acerto balance.
   *  - Never swallows errors.
   */
  static async processClientPayment(
    acerto: Acerto,
    selectedSaleIds: string[],
    paymentAmount: number,
    paymentMethods: any[]
  ): Promise<void> {
    await processAcertoClientPayment(
      {
        id:          acerto.id,
        clientName:  acerto.clientName,
        totalAmount: acerto.totalAmount,
        paidAmount:  acerto.paidAmount,
        type:        acerto.type,
      },
      selectedSaleIds,
      paymentAmount,
      paymentMethods
    );
  }
}
