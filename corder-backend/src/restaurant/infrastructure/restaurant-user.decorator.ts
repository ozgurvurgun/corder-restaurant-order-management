import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const RestaurantUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as { sub: string; restaurantId: string; email: string; name: string };
  return { id: user.sub, email: user.email, name: user.name };
});
