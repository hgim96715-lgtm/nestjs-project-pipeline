import {
    Controller,
    Post,
    Headers,
    ClassSerializerInterceptor,
    UseInterceptors,
    Request,
    UseGuards,
    Query,
    Get,
    Body,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorator/public.decorator';
import { LocalAuthGuard } from './strategy/local.strategy';
import { JwtAuthGuard } from './strategy/jwt.strategy';
import { RBAC } from './decorator/rbac.decorator';
import { Role } from 'src/user/entity/user.entity';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('register')
    registrUser(@Headers('authorization') token: string) {
        return this.authService.register(token);
    }

    @Public()
    @Post('login')
    loginUser(@Headers('authorization') token: string) {
        return this.authService.login(token);
    }

    // @RBAC(Role.admin)
    @Public()
    @Post('token/block')
    blockToken(@Body('token') token: string) {
        return this.authService.tokenBlock(token);
    }

    // @Public()
    @UseGuards(LocalAuthGuard)
    @Post('login/passport')
    async loginUserPassport(@Request() req) {
        return {
            refeshToken: await this.authService.issueToken(req.user, true),
            accessToken: await this.authService.issueToken(req.user, false),
        };
    }

    @UseGuards(JwtAuthGuard)
    @Get('private')
    async private(@Request() req) {
        return req.user;
    }

    @Public()
    @Post('token/access')
    async rotateAccessToken(@Request() req) {
        const payload = await this.authService.parseBearerToken(req.headers.authorization, true);

        return {
            accessToken: await this.authService.issueToken(payload, false),
        };
    }
}
