import * as bodyParser from 'body-parser';
import express, { NextFunction, Request, Response } from 'express';

const app = express();

// Add raw body handling middleware
const rawBodyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST') {
    let rawBody = '';
    req.setEncoding('utf8');

    req.on('data', (chunk: string) => {
      rawBody += chunk;
    });

    req.on('end', () => {
      (req as any).rawBody = Buffer.from(rawBody);
      next();
    });
  } else {
    next();
  }
};

app.use(
  bodyParser.json(),
  rawBodyMiddleware
);

export { createCheckoutSession, handleSubscriptionUpdated } from './subscriptions';
