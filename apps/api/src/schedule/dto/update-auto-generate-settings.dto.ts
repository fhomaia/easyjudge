import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpecialEventDto } from './special-event.dto';
import {
  AutoGenerateLevelDirection,
  AutoGenerateOrderPrimary,
} from '../enums/auto-generate-order.enum';

export class UpdateAutoGenerateSettingsDto {
  @IsEnum(AutoGenerateOrderPrimary)
  orderPrimary: AutoGenerateOrderPrimary;

  @IsEnum(AutoGenerateLevelDirection)
  levelDirection: AutoGenerateLevelDirection;

  // Chaves de autoFormatKey (formato fixo ou `custom:<rótulo>`), sem
  // repetir. Só os formatos do evento entram, então pode ser vazio
  // (evento sem categorias) — quem não estiver na lista cai no fim.
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @Matches(/^(team_cheer|group_stunt|coed|partner|custom|custom:.{1,100})$/, {
    each: true,
  })
  formatOrder: string[];

  // Eventos especiais (Almoço, Abertura...) — todos opcionais, pode ser
  // vazio. Consistência entre eles (referências) é checada no service.
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SpecialEventDto)
  specialEvents: SpecialEventDto[];
}
