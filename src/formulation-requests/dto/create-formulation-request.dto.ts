import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateFormulationRequestDto {
  /** Identifiant de la tâche côté plateforme appelante, renvoyé dans les webhooks. */
  @IsOptional()
  @IsString()
  @MaxLength(191)
  externalRef?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  requesterName!: string;

  @IsEmail()
  requesterEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  perfumeName?: string;

  /** Tout ce que le parfumeur doit savoir : ambiance, notes, contraintes, budget... */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  description!: string;

  @IsOptional()
  @IsBoolean()
  forClient?: boolean;

  // Pour un client, il faut au moins une société ou un nom de contact.
  @ValidateIf((o: CreateFormulationRequestDto) => o.forClient === true && !o.clientLastName)
  @IsString()
  @IsNotEmpty({ message: 'clientCompany ou clientLastName est requis quand forClient est true' })
  @MaxLength(191)
  clientCompany?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  clientFirstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  clientLastName?: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  clientPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  projectName?: string;
}
