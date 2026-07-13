import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

// Regras: mínimo 8 caracteres, ao menos 1 letra maiúscula,
// ao menos 1 número e ao menos 1 caractere especial.
const STRONG_PASSWORD_REGEX =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          return typeof value === 'string' && STRONG_PASSWORD_REGEX.test(value);
        },
        defaultMessage(_args: ValidationArguments) {
          return 'A senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, número e caractere especial.';
        },
      },
    });
  };
}
