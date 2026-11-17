import { IsDateString, ValidateIf, ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDescriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}

export class UpdateScheduleDto {
  /** AAAA-MM-JJ, ou null pour effacer. */
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsDateString()
  startDate?: string | null;

  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsDateString()
  endDate?: string | null;
}

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;

  /** Membres de l'équipe à notifier (choisis via @Nom). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  mentionUserIds?: string[];
}
