import { IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  name?: string;

  /** null pour retirer le webhook. */
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsUrl({ require_tld: false, require_protocol: true })
  webhookUrl?: string | null;
}
