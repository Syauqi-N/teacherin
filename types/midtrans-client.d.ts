declare module "midtrans-client" {
  export class Snap {
    constructor(options: {
      isProduction: boolean;
      serverKey: string | undefined;
      clientKey: string | undefined;
    });
    
    createTransaction(parameter: any): Promise<{
      redirect_url: string;
      token: string;
      order_id: string;
    }>;
    
    transaction: {
      status(transactionId: string): Promise<any>;
    };
  }
}