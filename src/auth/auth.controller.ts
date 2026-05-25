import { Controller, Post,Headers, ClassSerializerInterceptor, UseInterceptors ,Request, UseGuards, Query, Get} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorator/public.decorator';
import { LocalAuthGuard } from './strategy/local.strategy';
import { JwtAuthGuard } from './strategy/jwt.strategy';

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

  @Public()
  @UseGuards(JwtAuthGuard)
  @Get('private')
  async private(@Request() req){
    return req.user;
  } 
}
