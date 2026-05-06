import { Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  async register(registerDto: RegisterDto): Promise<any> {
    // Simulate saving to the database
    const user = {
      id: Date.now(),
      ...registerDto,
    };
    return user;
  }
}
