import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTeamDto {
  @IsString()
  @MinLength(1, { message: "Indiquez le nom de l'équipe." })
  @MaxLength(120)
  name!: string;
}

export class UpdateMemberRoleDto {
  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}
