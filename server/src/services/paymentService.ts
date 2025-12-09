import { getFirestore } from 'firebase-admin/firestore';

export interface PaymentTransaction {
  id: string;
  userId?: string;
  orderId: string;
  paymentId?: string;
  planId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  method: 'razorpay' | 'manual';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

export class PaymentService {
  private db = getFirestore();
  private transactionsCollection = 'payment_transactions';

  /**
   * Log a payment transaction
   */
  async logTransaction(transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const transactionData: PaymentTransaction = {
        ...transaction,
        id: transactionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.db.collection(this.transactionsCollection).doc(transactionId).set(transactionData);

      console.log(`💰 Payment transaction logged: ${transactionId}`, {
        orderId: transaction.orderId,
        status: transaction.status,
        amount: transaction.amount
      });

      return transactionId;
    } catch (error) {
      console.error('Error logging payment transaction:', error);
      throw error;
    }
  }

  /**
   * Update an existing transaction
   */
  async updateTransaction(transactionId: string, updates: Partial<PaymentTransaction>): Promise<void> {
    try {
      await this.db.collection(this.transactionsCollection).doc(transactionId).update({
        ...updates,
        updatedAt: new Date().toISOString()
      });

      console.log(`📝 Payment transaction updated: ${transactionId}`, updates);
    } catch (error) {
      console.error('Error updating payment transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction by order ID
   */
  async getTransactionByOrderId(orderId: string): Promise<PaymentTransaction | null> {
    try {
      const snapshot = await this.db.collection(this.transactionsCollection)
        .where('orderId', '==', orderId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0].data() as PaymentTransaction;
    } catch (error) {
      console.error('Error getting transaction by order ID:', error);
      throw error;
    }
  }

  /**
   * Get transaction by payment ID
   */
  async getTransactionByPaymentId(paymentId: string): Promise<PaymentTransaction | null> {
    try {
      const snapshot = await this.db.collection(this.transactionsCollection)
        .where('paymentId', '==', paymentId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0].data() as PaymentTransaction;
    } catch (error) {
      console.error('Error getting transaction by payment ID:', error);
      throw error;
    }
  }

  /**
   * Check if order has been processed (idempotency check)
   */
  async isOrderProcessed(orderId: string): Promise<boolean> {
    try {
      const transaction = await this.getTransactionByOrderId(orderId);
      return transaction ? transaction.status === 'success' : false;
    } catch (error) {
      console.error('Error checking if order is processed:', error);
      return false;
    }
  }

  /**
   * Get user's payment history
   */
  async getUserPaymentHistory(userId: string, limit: number = 20): Promise<PaymentTransaction[]> {
    try {
      const snapshot = await this.db.collection(this.transactionsCollection)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data() as PaymentTransaction);
    } catch (error) {
      console.error('Error getting user payment history:', error);
      throw error;
    }
  }

  /**
   * Log order creation
   */
  async logOrderCreation(orderId: string, amount: number, currency: string, planId?: string, userId?: string): Promise<string> {
    return this.logTransaction({
      orderId,
      amount,
      currency,
      status: 'pending',
      method: 'razorpay',
      planId,
      userId,
      metadata: { type: 'order_creation' }
    });
  }

  /**
   * Log payment success
   */
  async logPaymentSuccess(orderId: string, paymentId: string, amount: number, currency: string, planId?: string, userId?: string): Promise<void> {
    const existingTransaction = await this.getTransactionByOrderId(orderId);
    if (existingTransaction) {
      await this.updateTransaction(existingTransaction.id, {
        paymentId,
        status: 'success',
        userId,
        planId,
        amount
      });
    } else {
      await this.logTransaction({
        orderId,
        paymentId,
        amount,
        currency,
        status: 'success',
        method: 'razorpay',
        planId,
        userId,
        metadata: { type: 'payment_success' }
      });
    }
  }

  /**
   * Log payment failure
   */
  async logPaymentFailure(orderId: string, errorMessage: string, userId?: string, planId?: string): Promise<void> {
    const existingTransaction = await this.getTransactionByOrderId(orderId);
    if (existingTransaction) {
      await this.updateTransaction(existingTransaction.id, {
        status: 'failed',
        errorMessage,
        userId,
        planId
      });
    } else {
      await this.logTransaction({
        orderId,
        amount: 0,
        currency: 'INR',
        status: 'failed',
        method: 'razorpay',
        userId,
        planId,
        errorMessage,
        metadata: { type: 'payment_failure' }
      });
    }
  }
}

export const paymentService = new PaymentService();
