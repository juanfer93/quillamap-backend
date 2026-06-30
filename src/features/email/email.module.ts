import { Module } from '@nestjs/common';
import { EmailService } from '@/features/email/email.service';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
