import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}

export class FormulaSnapshotLineDto {
  @IsString()
  material!: string;

  @IsNumber()
  percent!: number;

  @IsNumber()
  ml!: number;

  @IsOptional()
  @IsNumber()
  ifraLimitPercent?: number | null;

  @IsBoolean()
  cappedByIfra!: boolean;
}

/** State of the formula currently open in the builder, as seen by the user. */
export class FormulaSnapshotDto {
  /** Saved formula: the server loads its project and notes from the database. */
  @IsOptional()
  @IsUUID()
  formulaId?: string | null;

  @IsString()
  name!: string;

  /** Target result, sent for formulas not saved yet. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsNumber()
  totalVolumeMl!: number;

  @IsObject()
  facets!: Record<string, number>;

  @IsObject()
  adjustments!: Record<string, number>;

  @IsBoolean()
  manualDistribution!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormulaSnapshotLineDto)
  lines!: FormulaSnapshotLineDto[];

  @IsArray()
  @IsString({ each: true })
  overlappingAllergens!: string[];
}

export class ChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @ValidateNested()
  @Type(() => FormulaSnapshotDto)
  formula!: FormulaSnapshotDto;
}
