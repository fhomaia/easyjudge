import { IsString } from 'class-validator';

// Usado por desativar/excluir conta (POST /users/me/deactivate|delete)
// — ambos exigem a senha atual como confirmação, mesmo padrão de
// segurança já usado em ChangePasswordDto pra currentPassword.
export class PasswordConfirmationDto {
  @IsString()
  password: string;
}
