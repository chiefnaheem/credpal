import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: false,
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.password'),
      },
    });
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    const from = this.configService.get<string>('mail.from');

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: 'FX Trading - Verify Your Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Email Verification</h2>
            <p>Use the code below to verify your account:</p>
            <div style="background: #f4f4f4; padding: 16px; text-align: center; font-size: 28px; letter-spacing: 6px; font-weight: bold; border-radius: 8px;">
              ${otp}
            </div>
            <p style="color: #666; margin-top: 16px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      });

      this.logger.log(`OTP email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error.stack);
      throw error;
    }
  }
}
