import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  EVIDENCE_IMAGE_EXTENSION_BY_MIME_TYPE,
  EVIDENCE_STORAGE_BUCKET,
} from '@/features/evidence/evidence.constants';

@Injectable()
export class SupabaseStorageService {
  private readonly supabase: ReturnType<typeof createClient>;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new InternalServerErrorException(
        'SUPABASE_URL and SUPABASE_KEY must be defined in .env file',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadReportImage(
    reportId: string,
    file: Buffer,
    contentType: string,
  ): Promise<string> {
    const extension = this.resolveImageExtension(contentType);
    const objectPath = `${reportId}/${randomUUID()}${extension}`;

    const { error } = await this.supabase.storage
      .from(EVIDENCE_STORAGE_BUCKET)
      .upload(objectPath, file, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload evidence image to storage: ${error.message}`,
      );
    }

    const { data } = this.supabase.storage
      .from(EVIDENCE_STORAGE_BUCKET)
      .getPublicUrl(objectPath);

    return data.publicUrl;
  }

  private resolveImageExtension(contentType: string): string {
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(contentType)) {
      throw new BadRequestException(
        `Invalid image content type "${contentType}". Allowed types: ${ALLOWED_EVIDENCE_MIME_TYPES.join(', ')}`,
      );
    }

    return EVIDENCE_IMAGE_EXTENSION_BY_MIME_TYPE[contentType];
  }
}
