import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
