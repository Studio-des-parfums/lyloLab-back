import { IsIn } from 'class-validator';

export class UpdateFormulaStatusDto {
  @IsIn(['draft', 'completed'])
  status!: 'draft' | 'completed';
}
