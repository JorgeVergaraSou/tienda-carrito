// Dobles de prueba globales: nada sale al mundo real (mails, Mercado Pago).
// Ver guia-seguridad-proyectos.md, 11.5.

export interface SentMail {
  to: string;
  from?: string;
  replyTo?: string;
  subject?: string;
  html: string;
}

// se guarda en `global` para compartirlo con los helpers de los tests sin
// depender del orden en que jest evalúa los módulos mockeados.
(global as any).__sentMails = [] as SentMail[];

jest.mock('@/config/mailer', () => ({
  getTransporter: () => ({
    sendMail: (mail: SentMail) => {
      (global as any).__sentMails.push(mail);
      return Promise.resolve();
    },
  }),
}));
