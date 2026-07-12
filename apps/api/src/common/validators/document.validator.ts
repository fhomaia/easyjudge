import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { cpf, cnpj } from 'cpf-cnpj-validator';
import { DocumentType } from '../enums/document-type.enum';

/**
 * Valida se documentNumber é um CPF ou CNPJ válido,
 * de acordo com o valor do campo documentType no mesmo DTO.
 *
 * Uso: @IsValidDocument('documentType')
 * no campo documentNumber do DTO.
 */
export function IsValidDocument(
  documentTypeProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isValidDocument',
      target: object.constructor,
      propertyName,
      constraints: [documentTypeProperty],
      options: validationOptions,
      validator: {
        validate(value: string, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const documentType = (args.object as any)[relatedPropertyName];

          if (typeof value !== 'string') return false;

          if (documentType === DocumentType.CPF) {
            return cpf.isValid(value);
          }

          if (documentType === DocumentType.CNPJ) {
            return cnpj.isValid(value);
          }

          return false;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const documentType = (args.object as any)[relatedPropertyName];
          return `documentNumber inválido para o tipo ${documentType}`;
        },
      },
    });
  };
}
