import { createPaymentOrder, getPaymentGatewayConfig, verifyPaymentOrder } from './api';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let razorpayScriptPromise = null;

const loadRazorpayScript = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Payment checkout is available only in the browser.');
  }

  if (window.Razorpay) {
    return true;
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Unable to load Razorpay checkout script.'));
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
};

const normalizeContact = (value) => String(value || '').replace(/\D/g, '').slice(-10);

const buildPaymentMethodConfig = (preferredMethod = 'ONLINE') => {
  const normalizedMethod = String(preferredMethod || 'ONLINE').toUpperCase();
  const upiOnly = normalizedMethod === 'UPI';

  return {
    upi: true,
    card: !upiOnly,
    netbanking: !upiOnly,
    wallet: !upiOnly,
    emi: !upiOnly,
    paylater: false,
  };
};

const buildCheckoutDisplayConfig = (preferredMethod = 'ONLINE') => {
  const normalizedMethod = String(preferredMethod || 'ONLINE').toUpperCase();
  const upiOnly = normalizedMethod === 'UPI';

  const upiBlock = {
    name: 'Pay using UPI',
    instruments: [
      {
        method: 'upi',
        flows: ['collect', 'intent'],
      },
    ],
  };

  if (upiOnly) {
    return {
      display: {
        blocks: {
          upi: upiBlock,
        },
        sequence: ['block.upi'],
        preferences: {
          show_default_blocks: false,
        },
        hide: [{ method: 'paylater' }],
      },
    };
  }

  return {
    display: {
      blocks: {
        upi: upiBlock,
        other: {
          name: 'Other payment methods',
          instruments: [
            { method: 'card' },
            { method: 'netbanking' },
            { method: 'wallet' },
            { method: 'emi' },
          ],
        },
      },
      sequence: ['block.upi', 'block.other'],
      preferences: {
        show_default_blocks: false,
      },
      hide: [{ method: 'paylater' }],
    },
  };
};

export const startOnlinePayment = async ({ amount, customer = {}, description = 'HomeXpert Checkout', notes = {}, preferredMethod = 'ONLINE' }) => {
  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    throw new Error('A valid amount is required to initiate payment.');
  }

  const paymentConfig = await getPaymentGatewayConfig();
  if (!paymentConfig?.enabled || !paymentConfig?.keyId) {
    throw new Error('Online payment is not configured right now. Please use Cash on Delivery.');
  }

  await loadRazorpayScript();

  const paymentOrder = await createPaymentOrder({
    amount: amountNumber,
    currency: 'INR',
    receipt: `homeexpert_${Date.now()}`,
    notes,
  });

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: paymentConfig.keyId,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: 'HomeXpert',
      description,
      order_id: paymentOrder.id,
      prefill: {
        name: customer.name || 'HomeXpert Customer',
        email: customer.email || '',
        contact: normalizeContact(customer.contact),
      },
      notes,
      method: buildPaymentMethodConfig(preferredMethod),
      config: buildCheckoutDisplayConfig(preferredMethod),
      theme: {
        color: '#8a4af3',
      },
      modal: {
        ondismiss: () => reject(new Error('Payment was cancelled.')),
      },
      handler: async (paymentResponse) => {
        try {
          const verification = await verifyPaymentOrder(paymentResponse);
          resolve({
            ...paymentResponse,
            ...verification,
          });
        } catch (error) {
          reject(error);
        }
      },
    });

    checkout.on('payment.failed', (failureEvent) => {
      const failureReason = failureEvent?.error?.description || 'Payment failed. Please try again.';
      reject(new Error(failureReason));
    });

    checkout.open();
  });
};
