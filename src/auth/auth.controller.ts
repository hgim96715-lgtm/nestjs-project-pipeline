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
    Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorator/public.decorator';
import { LocalAuthGuard } from './strategy/local.strategy';
import { JwtAuthGuard } from './strategy/jwt.strategy';
import { RBAC } from './decorator/rbac.decorator';
import { Role } from 'src/user/entity/user.entity';
import { minutes, Throttle } from '@nestjs/throttler';
import { ApiBasicAuth, ApiBearerAuth } from '@nestjs/swagger';
import { Authorization } from './decorator/authorization.decorator';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @ApiBasicAuth()
    @Post('register')
    registrUser(@Headers('authorization') token: string) {
        return this.authService.register(token);
    }

    @Public()
    @ApiBasicAuth()
    @Throttle({ default: { ttl: minutes(1), limit: 5 } })
    @Post('login')
    async loginUser(@Authorization() token: string, @Req() request: any) {
        const { user, ...result } = await this.authService.login(token);
        request.session.userId = user.id;
        request.session.role = user.role;
        return result;
    }

    // @RBAC(Role.admin)
    @Public()
    @Post('token/block')
    blockToken(@Body('token') token: string) {
        return this.authService.tokenBlock(token);
    }

    // @Public()
    @UseGuards(LocalAuthGuard)
    @ApiBasicAuth()
    @Post('login/passport')
    async loginUserPassport(@Request() req) {
        return {
            refreshToken: await this.authService.issueToken(req.user, true),
            accessToken: await this.authService.issueToken(req.user, false),
        };
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('private')
    async private(@Request() req) {
        return req.user;
    }

    @Public()
    @ApiBearerAuth()
    @Post('token/access')
    async rotateAccessToken(@Request() req) {
        const payload = await this.authService.parseBearerToken(req.headers.authorization, true);

        return {
            accessToken: await this.authService.issueToken(payload, false),
        };
    }
}
