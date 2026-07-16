import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const RestaurantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as { restaurantId: string };
  return user.restaurantId;
});
