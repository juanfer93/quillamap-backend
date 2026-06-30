import * as net from 'net';
import { AddressInfo } from 'net';
import { Logger } from '@nestjs/common';
import { EmailService } from '@/features/email/email.service';

const decodeMimeSubject = (message: string): string | undefined => {
  const subjectLine = message.split('\n').find((line) => line.startsWith('Subject: '));
  const encodedSubject = subjectLine?.match(/=\?UTF-8\?B\?([^?]+)\?=/)?.[1];

  if (encodedSubject) {
    return Buffer.from(encodedSubject, 'base64').toString('utf8');
  }

  return subjectLine?.replace('Subject: ', '');
};

const createMockSmtpServer = () => {
  let receivedMessage = '';
  let buffer = '';
  let inData = false;

  const server = net.createServer((socket) => {
    socket.write('220 mock-quillamap-smtp ready\r\n');

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      while (buffer.includes('\r\n')) {
        const index = buffer.indexOf('\r\n');
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);

        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write('250 message accepted\r\n');
          } else {
            receivedMessage += `${line}\n`;
          }
          continue;
        }

        const command = line.toUpperCase();

        if (command.startsWith('EHLO')) {
          socket.write('250 mock-quillamap-smtp\r\n');
        } else if (command.startsWith('MAIL FROM')) {
          socket.write('250 sender ok\r\n');
        } else if (command.startsWith('RCPT TO')) {
          socket.write('250 recipient ok\r\n');
        } else if (command === 'DATA') {
          inData = true;
          socket.write('354 end with dot\r\n');
        } else if (command === 'QUIT') {
          socket.write('221 bye\r\n');
          socket.end();
        } else {
          socket.write('250 ok\r\n');
        }
      }
    });
  });

  return {
    server,
    getReceivedMessage: () => receivedMessage,
  };
};

describe('EmailService', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should skip welcome email when SMTP is not configured', async () => {
    const service = new EmailService({
      get: jest.fn().mockReturnValue(undefined),
    } as any);

    await expect(
      service.sendWelcomeEmail({
        to: 'usuario-prueba@quillamap.test',
        fullName: 'Juan Prueba',
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith('SMTP no esta configurado. Se omite el correo de bienvenida.');
  });

  it('should send a friendly welcome email through SMTP', async () => {
    const mockSmtp = createMockSmtpServer();

    await new Promise<void>((resolve) => mockSmtp.server.listen(0, '127.0.0.1', resolve));

    const port = (mockSmtp.server.address() as AddressInfo).port;
    const config: Record<string, string> = {
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(port),
      SMTP_SECURE: 'false',
      SMTP_STARTTLS: 'false',
      SMTP_FROM: 'QuillaMap <quillamap@gmail.com>',
      QUILLAMAP_LOGO_URL: 'https://quillamap.test/logo-quillamap.png',
    };

    const service = new EmailService({
      get: jest.fn((key: string) => config[key]),
    } as any);

    try {
      await service.sendWelcomeEmail({
        to: 'usuario-prueba@quillamap.test',
        fullName: 'Juan Prueba',
      });

      const receivedMessage = mockSmtp.getReceivedMessage();

      expect(receivedMessage).toContain('From: QuillaMap <quillamap@gmail.com>');
      expect(receivedMessage).toContain('To: usuario-prueba@quillamap.test');
      expect(decodeMimeSubject(receivedMessage)).toBe('Bienvenido a QuillaMap');
      expect(receivedMessage).toContain('Hola Juan');
      expect(receivedMessage).toContain('QuillaMap nacio para ayudarte');
      expect(receivedMessage).toContain('https://quillamap.test/logo-quillamap.png');
    } finally {
      await new Promise<void>((resolve) => mockSmtp.server.close(() => resolve()));
    }
  });
});
