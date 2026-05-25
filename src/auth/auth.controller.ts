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

  // @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login/passport')
  async loginUserPassport(@Request() req){
    return {
      refeshToken: await this.authService.issueToken(req.user,true),
      accessToken: await this.authService.issueToken(req.user,false)
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('private')
  async private(@Request() req){
    return req.user;
  }

  @Public()
  @Post('token/access')
  async rotateAccessToken(@Request() req){
    
    const payload= await this.authService.parseBearerToken(req.headers.authorization,true);

    return{
      accessToken: await this.authService.issueToken(payload,false)
    }
  }
}
