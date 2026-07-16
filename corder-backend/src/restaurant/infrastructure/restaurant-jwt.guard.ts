import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RestaurantJwtGuard extends AuthGuard('restaurant-jwt') {}
