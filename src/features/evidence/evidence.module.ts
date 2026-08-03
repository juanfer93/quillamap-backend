import { Module } from '@nestjs/common';
import { SupabaseStorageService } from '@/features/evidence/supabase-storage.service';

@Module({
  providers: [SupabaseStorageService],
  exports: [SupabaseStorageService],
})
export class EvidenceModule {}
