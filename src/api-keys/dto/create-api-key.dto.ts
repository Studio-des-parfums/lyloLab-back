import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  webhookUrl?: string;
}
