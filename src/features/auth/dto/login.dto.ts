import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Ingresa un correo electronico valido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email: string;

  @IsString({ message: 'La contrasena debe ser texto' })
  @IsNotEmpty({ message: 'La contrasena es obligatoria' })
  password: string;
}
