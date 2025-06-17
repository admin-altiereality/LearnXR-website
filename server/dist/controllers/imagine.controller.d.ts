import { Request, Response } from "express";
export declare const getImagineById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getImagineByObfuscatedId: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getImagineHistory: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const cancelImagine: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const cancelAllPedingImagines: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteImagine: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getGenerators: (_req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const generateImagine: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=imagine.controller.d.ts.map