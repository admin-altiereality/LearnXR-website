declare module 'firebase-functions' {
  import { Request, Response } from 'express';

  interface HttpsFunction {
    (req: Request, res: Response): void | Promise<void>;
  }

  interface CallableContext {
    auth?: {
      uid: string;
      token: {
        email?: string;
        [key: string]: any;
      };
    };
    rawRequest: Request;
  }

  namespace https {
    function onRequest(handler: HttpsFunction): HttpsFunction;
    function onCall(handler: (data: any, context: CallableContext) => any): HttpsFunction;
    class HttpsError extends Error {
      constructor(code: string, message: string, details?: any);
    }
  }
} 