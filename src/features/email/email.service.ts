import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import * as tls from 'tls';

type MailSocket = net.Socket | tls.TLSSocket;

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  user?: string;
  pass?: string;
  from: string;
  rejectUnauthorized: boolean;
}

interface WelcomeEmailPayload {
  to: string;
  fullName?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
    const smtpConfig = this.getSmtpConfig();

    if (!smtpConfig) {
      this.logger.warn('SMTP no esta configurado. Se omite el correo de bienvenida.');
      return;
    }

    const displayName = this.getFirstName(payload.fullName);
    const logoUrl = this.configService.get<string>('QUILLAMAP_LOGO_URL');
    const subject = 'Bienvenido a QuillaMap';
    const html = this.buildWelcomeHtml(displayName, logoUrl);
    const text = this.buildWelcomeText(displayName);
    const message = this.buildMimeMessage({
      from: smtpConfig.from,
      to: payload.to,
      subject,
      html,
      text,
    });

    await this.sendMail(smtpConfig, payload.to, message);
  }

  private getSmtpConfig(): SmtpConfig | null {
    const host = this.configService.get<string>('SMTP_HOST');
    const portValue = this.configService.get<string>('SMTP_PORT');
    const from = this.configService.get<string>('SMTP_FROM');

    if (!host || !from) {
      return null;
    }

    const port = Number(portValue || 587);
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true' || port === 465;
    const startTls = !secure && this.configService.get<string>('SMTP_STARTTLS') !== 'false';
    const rejectUnauthorized = this.configService.get<string>('SMTP_REJECT_UNAUTHORIZED') !== 'false';

    return {
      host,
      port,
      secure,
      startTls,
      user: this.configService.get<string>('SMTP_USER'),
      pass: this.configService.get<string>('SMTP_PASS'),
      from,
      rejectUnauthorized,
    };
  }

  private async sendMail(config: SmtpConfig, recipient: string, message: string): Promise<void> {
    let socket = await this.createSocket(config);

    try {
      this.expect(await this.readResponse(socket), [220]);
      this.expect(await this.sendCommand(socket, `EHLO ${this.getClientName()}`), [250]);

      if (config.startTls) {
        this.expect(await this.sendCommand(socket, 'STARTTLS'), [220]);
        socket = await this.upgradeToTls(socket, config);
        this.expect(await this.sendCommand(socket, `EHLO ${this.getClientName()}`), [250]);
      }

      if (config.user && config.pass) {
        const token = Buffer.from(`\u0000${config.user}\u0000${config.pass}`).toString('base64');
        this.expect(await this.sendCommand(socket, `AUTH PLAIN ${token}`), [235]);
      }

      this.expect(await this.sendCommand(socket, `MAIL FROM:<${this.extractEmail(config.from)}>`), [250]);
      this.expect(await this.sendCommand(socket, `RCPT TO:<${recipient}>`), [250, 251]);
      this.expect(await this.sendCommand(socket, 'DATA'), [354]);
      this.expect(await this.sendCommand(socket, `${this.escapeMessage(message)}\r\n.`), [250]);
      await this.sendCommand(socket, 'QUIT');
    } finally {
      socket.end();
    }
  }

  private createSocket(config: SmtpConfig): Promise<MailSocket> {
    return new Promise((resolve, reject) => {
      const socket = config.secure
        ? tls.connect({
            host: config.host,
            port: config.port,
            rejectUnauthorized: config.rejectUnauthorized,
          })
        : net.connect({
            host: config.host,
            port: config.port,
          });

      if (config.secure) {
        socket.once('secureConnect', () => resolve(socket));
      } else {
        socket.once('connect', () => resolve(socket));
      }
      socket.once('error', reject);
    });
  }

  private upgradeToTls(socket: MailSocket, config: SmtpConfig): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const tlsSocket = tls.connect({
        socket,
        servername: config.host,
        rejectUnauthorized: config.rejectUnauthorized,
      });

      tlsSocket.once('secureConnect', () => resolve(tlsSocket));
      tlsSocket.once('error', reject);
    });
  }

  private sendCommand(socket: MailSocket, command: string): Promise<string> {
    socket.write(`${command}\r\n`);
    return this.readResponse(socket);
  }

  private readResponse(socket: MailSocket): Promise<string> {
    return new Promise((resolve, reject) => {
      let response = '';

      const cleanup = () => {
        socket.off('data', onData);
        socket.off('error', onError);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onData = (chunk: Buffer) => {
        response += chunk.toString('utf8');
        const lines = response.split(/\r?\n/).filter(Boolean);
        const lastLine = lines[lines.length - 1];

        if (lastLine && /^\d{3} /.test(lastLine)) {
          cleanup();
          resolve(response);
        }
      };

      socket.on('data', onData);
      socket.once('error', onError);
    });
  }

  private expect(response: string, expectedCodes: number[]): void {
    const code = Number(response.slice(0, 3));

    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP respondio con ${code}: ${response.trim()}`);
    }
  }

  private buildMimeMessage(payload: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): string {
    const boundary = `quilla-${Date.now()}`;

    return [
      `From: ${payload.from}`,
      `To: ${payload.to}`,
      `Subject: ${this.encodeHeader(payload.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      payload.text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      payload.html,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');
  }

  private buildWelcomeHtml(name: string, logoUrl?: string): string {
    const safeName = this.escapeHtml(name);
    const logoMarkup = logoUrl
      ? `<img src="${this.escapeHtml(logoUrl)}" alt="QuillaMap" width="128" style="display:block;margin:0 auto 18px;max-width:128px;height:auto;" />`
      : '<div style="font-size:30px;font-weight:800;color:#004574;margin-bottom:18px;">QuillaMap</div>';

    return `
      <div style="margin:0;padding:28px;background:#f4f7f8;font-family:Arial,Helvetica,sans-serif;color:#18313f;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e3eaee;">
          <div style="text-align:center;">
            ${logoMarkup}
          </div>
          <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;color:#004574;">Hola ${safeName}, bienvenido a QuillaMap</h1>
          <p style="font-size:16px;line-height:1.6;margin:0 0 14px;">
            Nos alegra tenerte aqui. QuillaMap nacio para ayudarte a moverte por Barranquilla con mas confianza, usando reportes de la comunidad y rutas pensadas para tu dia a dia.
          </p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 14px;">
            Desde ahora puedes consultar zonas, aportar informacion util y ser parte de una comunidad que se cuida mientras recorre la ciudad.
          </p>
          <p style="font-size:16px;line-height:1.6;margin:0;">
            Gracias por sumarte. Te damos la bienvenida con mucha energia coste&ntilde;a.
          </p>
        </div>
      </div>
    `.trim();
  }

  private buildWelcomeText(name: string): string {
    return [
      `Hola ${name}, bienvenido a QuillaMap.`,
      '',
      'Nos alegra tenerte aqui. QuillaMap nacio para ayudarte a moverte por Barranquilla con mas confianza, usando reportes de la comunidad y rutas pensadas para tu dia a dia.',
      '',
      'Desde ahora puedes consultar zonas, aportar informacion util y ser parte de una comunidad que se cuida mientras recorre la ciudad.',
      '',
      'Gracias por sumarte. Te damos la bienvenida con mucha energia costena.',
    ].join('\n');
  }

  private getFirstName(fullName?: string): string {
    return fullName?.trim().split(/\s+/)[0] || 'viajero';
  }

  private extractEmail(value: string): string {
    return value.match(/<([^>]+)>/)?.[1] || value;
  }

  private encodeHeader(value: string): string {
    return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
  }

  private escapeMessage(message: string): string {
    return message.replace(/^\./gm, '..');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getClientName(): string {
    return this.configService.get<string>('SMTP_CLIENT_NAME') || 'quillamap';
  }
}
