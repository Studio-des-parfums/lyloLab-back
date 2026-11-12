import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BASE_CODES, CONDITION_CODES } from '../stability-knowledge.js';

const GRADES = ['conform', 'slight', 'altered'];
const APPEARANCES = ['clear', 'hazy', 'deposit', 'separation'];

export class CampaignConditionDto {
  @IsIn(CONDITION_CODES)
  condition!: string;

  @IsOptional()
  @IsString()
  conditionLabel?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(3650, { each: true })
  checkpoints!: number[];
}

/** Launches one test per condition on a formula. */
export class CreateCampaignDto {
  @IsUUID()
  formulaId!: string;

  @IsOptional()
  @IsIn(BASE_CODES)
  base?: string;

  @IsOptional()
  @IsString()
  container?: string;

  @IsDateString()
  startDate!: string;

  /** Optional end of the test (countdown in the UI). */
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Team members who also receive the reminders (the creator always does). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  watcherIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CampaignConditionDto)
  conditions!: CampaignConditionDto[];
}

export class UpdateTestDto {
  @IsOptional()
  @IsIn(['in_progress', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsIn(['conform', 'minor', 'non_conform', null])
  conclusion?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  container?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  checkpoints?: number[];

  /** ISO date, or null to remove the deadline. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  deadline?: string | null;
}

/** Replaces the reminder recipients of a whole campaign. */
export class WatchersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  userIds!: string[];
}

/** Daily follow-up note; one per test and day (upsert). */
export class DailyNoteDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}

export class ObservationDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  day?: number | null;

  @IsDateString()
  observedAt!: string;

  @IsIn(GRADES)
  odor!: string;

  @IsIn(GRADES)
  color!: string;

  @IsIn(APPEARANCES)
  appearance!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(14)
  ph?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  viscosity?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  peroxideValue?: number | null;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class RisksDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RiskLineDto)
  lines!: RiskLineDto[];
}

export class RiskLineDto {
  @IsUUID()
  materialId!: string;

  @IsOptional()
  @IsNumber()
  percent?: number | null;
}
