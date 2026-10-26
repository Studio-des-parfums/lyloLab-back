import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const MIN_PASSWORD_LENGTH = 8;

export class LoginDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

/** Sign up either by creating a team (teamName) or by joining one (inviteCode). */
export class RegisterDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email!: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  })
  @MaxLength(200)
  password!: string;

  @IsString()
  @MinLength(1, { message: 'Indiquez votre nom.' })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  teamName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  inviteCode?: string;
}
