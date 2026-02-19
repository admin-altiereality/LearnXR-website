declare module '@emailjs/nodejs' {
  function send(
    serviceID: string,
    templateID: string,
    templateParams?: Record<string, unknown>,
    options?: { publicKey: string; privateKey?: string }
  ): Promise<{ status: number; text: string }>;
}
