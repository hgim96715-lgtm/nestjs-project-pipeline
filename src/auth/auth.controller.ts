import { Controller, Post,Headers, ClassSerializerInterceptor, UseInterceptors ,Request, UseGuards, Query} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorator/public.decorator';
import { LocalAuthGuard } from './strategy/local.strategy';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  registrUser(@Headers('authorization') token:string){
    return this.authService.register(token)
  }

  
  @Public()
  @Post('login')
  loginUser(@Headers('authorization') token:string){
    return this.authService.login(token)
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login/passport')
  async loginUserPassport(@Request() req){
    return req.user;
  }
  
}
