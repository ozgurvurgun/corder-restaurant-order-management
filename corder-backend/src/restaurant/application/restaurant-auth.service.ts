import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { RootAdminEntity } from '../../platform/domain/root-admin.entity';
import { BossRestaurantEntity } from '../../platform/domain/boss-restaurant.entity';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { PlatformBillingConfigEntity } from '../../platform/domain/platform-billing-config.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import {
  AuthenticatedRestaurantUserDto,
  BranchSummaryDto,
  buildBossUserDto,
  buildPaymentSuspendedErrorMessage,
  buildStaffUserDto,
  buildTerminalUserDto,
  isRestaurantPaymentSuspended,
  LoginSessionResultDto,
  RestaurantJwtRole,
  RestaurantLoginDto,
  RestaurantTokenPayload,
  toBranchSummaryDto,
} from '../domain/services/billing-suspension.policy';
import { RolesService } from './roles.service';
import {
  DEFAULT_JWT_EXPIRES_IN,
  requireConfigSecret,
} from '../../common/security/env.validation';

export {
  AuthenticatedRestaurantUserDto,
  BranchSummaryDto,
  buildPaymentSuspendedErrorMessage,
  isRestaurantPaymentSuspended,
  LoginSessionResultDto,
  RestaurantJwtRole,
  RestaurantLoginDto,
  RestaurantTokenPayload,
} from '../domain/services/billing-suspension.policy';

@Injectable()
export class RestaurantAuthService {
  constructor(
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(BossRestaurantEntity)
    private readonly bossRestaurantRepo: Repository<BossRestaurantEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    @InjectRepository(PlatformBillingConfigEntity)
    private readonly billingConfigRepo: Repository<PlatformBillingConfigEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    private readonly rolesService: RolesService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async loadBillingConfig(): Promise<PlatformBillingConfigEntity | null> {
    const list = await this.billingConfigRepo.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    return list[0] ?? null;
  }

  async getBossOwnedRestaurants(
    bossId: string,
    fallbackRestaurantId?: string | null,
    preloadedAdmin?: RootAdminEntity | null,
  ): Promise<RestaurantEntity[]> {
    const admin =
      preloadedAdmin ?? (await this.rootAdminRepo.findOne({ where: { id: bossId } }));
    const links = await this.bossRestaurantRepo.find({
      where: { bossId },
      order: { createdAt: 'ASC' },
    });
    const ids = new Set<string>(links.map((l) => l.restaurantId));
    if (fallbackRestaurantId) ids.add(fallbackRestaurantId);
    if (admin?.restaurantId) ids.add(admin.restaurantId);

    const allRestaurants = await this.restaurantRepo.find({
      order: { createdAt: 'ASC' },
    });

    if (admin?.bossTier === 'brand_owner' && admin.brandName) {
      const brandNorm = admin.brandName.trim().toLowerCase();
      for (const r of allRestaurants) {
        if (r.brandName && r.brandName.trim().toLowerCase() === brandNorm) {
          ids.add(r.id);
        }
      }
    }

    if (ids.size === 0) return [];
    return allRestaurants.filter((r) => ids.has(r.id));
  }

  async assertBossOwnsRestaurant(
    bossId: string,
    restaurantId: string,
  ): Promise<RestaurantEntity> {
    const admin = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!admin || admin.isActive === false) {
      throw new UnauthorizedException('Boss account is not active');
    }
    const owned = await this.getBossOwnedRestaurants(bossId, admin.restaurantId, admin);
    const target = owned.find((r) => r.id === restaurantId);
    if (!target) {
      throw new ForbiddenException('You do not have access to this branch');
    }
    return target;
  }

  async login(dto: RestaurantLoginDto): Promise<LoginSessionResultDto> {
    const email = dto.email.toLowerCase().trim();
    const bossLogin = await this.tryBossLogin(email, dto.password, dto.restaurantId);
    if (bossLogin) return bossLogin;

    const staffLogin = await this.tryStaffLogin(email, dto.password);
    if (staffLogin) return staffLogin;

    const terminalLogin = await this.tryTerminalLogin(email, dto.password);
    if (terminalLogin) return terminalLogin;

    throw new UnauthorizedException('Invalid email or password');
  }

  async loginPrintAgent(usernameInput: string, password: string) {
    const username = usernameInput.toLowerCase().trim();
    const restaurant = await this.restaurantRepo.findOne({
      where: { printAgentUsername: username },
    });
    if (
      !restaurant?.printAgentPasswordHash ||
      !(await bcrypt.compare(password, restaurant.printAgentPasswordHash))
    ) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (isRestaurantPaymentSuspended(restaurant)) {
      const cfg = await this.loadBillingConfig();
      throw new UnauthorizedException(buildPaymentSuspendedErrorMessage(restaurant.name, cfg));
    }
    if (restaurant.status !== 'active') {
      throw new UnauthorizedException('Restaurant account is not active');
    }
    return this.issuePrintAgentTokens(restaurant);
  }

  async refreshPrintAgentSession(rawRefreshToken: string) {
    const jwtSecret = requireConfigSecret(this.config, 'JWT_SECRET');
    let payload: RestaurantTokenPayload;
    try {
      payload = this.jwt.verify<RestaurantTokenPayload>(rawRefreshToken.trim(), {
        secret: jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired Print Agent refresh token');
    }
    if (
      payload.type !== 'restaurant' ||
      payload.role !== 'print_agent_refresh' ||
      !payload.restaurantId ||
      !payload.email
    ) {
      throw new UnauthorizedException('Invalid Print Agent refresh token');
    }
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: payload.restaurantId },
    });
    if (!restaurant) {
      throw new UnauthorizedException('Print Agent account is no longer active');
    }
    if (isRestaurantPaymentSuspended(restaurant)) {
      const cfg = await this.loadBillingConfig();
      throw new UnauthorizedException(buildPaymentSuspendedErrorMessage(restaurant.name, cfg));
    }
    if (
      restaurant.status !== 'active' ||
      !restaurant.printAgentUsername ||
      !restaurant.printAgentPasswordHash ||
      restaurant.printAgentUsername !== payload.email
    ) {
      throw new UnauthorizedException('Print Agent account is no longer active');
    }
    const expectedFp = this.computePasswordFingerprint(restaurant.printAgentPasswordHash);
    if (payload.pwdFp && payload.pwdFp !== expectedFp) {
      throw new UnauthorizedException('Print Agent password has been changed');
    }
    return this.issuePrintAgentTokens(restaurant);
  }

  private issuePrintAgentTokens(restaurant: RestaurantEntity) {
    const jwtSecret = requireConfigSecret(this.config, 'JWT_SECRET');
    const pwdFp = this.computePasswordFingerprint(restaurant.printAgentPasswordHash || '');
    const basePayload = {
      sub: restaurant.id,
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      email: restaurant.printAgentUsername!,
      name: 'Corder Print Agent',
      type: 'restaurant' as const,
      pwdFp,
    };
    const accessToken = this.jwt.sign(
      { ...basePayload, role: 'print_agent' as const },
      { secret: jwtSecret, expiresIn: '30d' },
    );
    const refreshToken = this.jwt.sign(
      { ...basePayload, role: 'print_agent_refresh' as const },
      { secret: jwtSecret, expiresIn: '3650d' },
    );
    return {
      accessToken,
      refreshToken,
      restaurant: toBranchSummaryDto(restaurant),
    };
  }

  private computePasswordFingerprint(hash: string): string {
    return createHash('sha256').update(hash).digest('hex').slice(0, 16);
  }

  async getSessionProfile(user: {
    sub: string;
    restaurantId: string;
    role: RestaurantJwtRole;
  }): Promise<Omit<LoginSessionResultDto, 'accessToken'>> {
    if (user.role === 'root') return this.getBossSessionProfile(user.sub, user.restaurantId);
    if (user.role === 'staff') return this.getStaffSessionProfile(user.sub, user.restaurantId);
    return this.getTerminalSessionProfile(user.restaurantId);
  }

  async switchBranch(bossId: string, targetRestaurantId: string) {
    const admin = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!admin || admin.isActive === false) {
      throw new UnauthorizedException('Boss account not found');
    }
    const target = await this.assertBossOwnsRestaurant(bossId, targetRestaurantId);
    if (isRestaurantPaymentSuspended(target)) {
      const cfg = await this.loadBillingConfig();
      throw new ForbiddenException(buildPaymentSuspendedErrorMessage(target.name, cfg));
    }
    if (target.status !== 'active') {
      throw new ForbiddenException('Selected branch is not active');
    }
    const owned = await this.getBossOwnedRestaurants(bossId, admin.restaurantId, admin);
    const activeBranches = owned.filter(
      (r) => r.status === 'active' && !isRestaurantPaymentSuspended(r),
    );

    const accessToken = this.signToken({
      sub: admin.id,
      restaurantId: target.id,
      slug: target.slug,
      email: admin.email,
      name: admin.name,
      type: 'restaurant',
      role: 'root',
      staffRole: 'boss',
    });
    return {
      accessToken,
      restaurant: toBranchSummaryDto(target),
      restaurants: activeBranches.map((r) => toBranchSummaryDto(r)),
    };
  }

  private async tryBossLogin(
    email: string,
    password: string,
    requestedBranchId?: string,
  ): Promise<LoginSessionResultDto | null> {
    const admin = await this.rootAdminRepo.findOne({ where: { email } });
    if (!admin || admin.isActive === false) return null;
    if (!(await bcrypt.compare(password, admin.passwordHash))) return null;

    const owned = await this.getBossOwnedRestaurants(admin.id, admin.restaurantId, admin);
    if (requestedBranchId) {
      const requested = owned.find((r) => r.id === requestedBranchId);
      if (requested && isRestaurantPaymentSuspended(requested)) {
        const cfg = await this.loadBillingConfig();
        throw new UnauthorizedException(buildPaymentSuspendedErrorMessage(requested.name, cfg));
      }
    }

    const activeBranches = owned.filter(
      (r) => r.status === 'active' && !isRestaurantPaymentSuspended(r),
    );
    if (activeBranches.length === 0) {
      const suspendedBranch = owned.find((r) => isRestaurantPaymentSuspended(r));
      if (suspendedBranch) {
        const cfg = await this.loadBillingConfig();
        throw new UnauthorizedException(
          buildPaymentSuspendedErrorMessage(owned.length === 1 ? suspendedBranch.name : null, cfg),
        );
      }
      throw new UnauthorizedException('No active restaurant branch assigned to this Boss account');
    }
    const selected =
      (requestedBranchId && activeBranches.find((r) => r.id === requestedBranchId)) ||
      (admin.restaurantId && activeBranches.find((r) => r.id === admin.restaurantId)) ||
      activeBranches[0];

    return {
      accessToken: this.signToken({
        sub: admin.id,
        restaurantId: selected.id,
        slug: selected.slug,
        email: admin.email,
        name: admin.name,
        type: 'restaurant',
        role: 'root',
        staffRole: 'boss',
      }),
      restaurant: toBranchSummaryDto(selected),
      restaurants: activeBranches.map((r) => toBranchSummaryDto(r)),
      user: buildBossUserDto(admin),
    };
  }

  private async tryStaffLogin(
    email: string,
    password: string,
  ): Promise<LoginSessionResultDto | null> {
    const staffCandidates = await this.staffRepo.find({
      where: { email, isActive: true },
      relations: ['restaurant'],
    });
    for (const staff of staffCandidates) {
      if (!staff.passwordHash || !staff.restaurant) continue;
      if (!(await bcrypt.compare(password, staff.passwordHash))) continue;
      if (isRestaurantPaymentSuspended(staff.restaurant)) {
        const cfg = await this.loadBillingConfig();
        throw new UnauthorizedException(buildPaymentSuspendedErrorMessage(staff.restaurant.name, cfg));
      }
      if (staff.restaurant.status !== 'active') {
        throw new UnauthorizedException('Branch account is not active');
      }
      const resolved = await this.rolesService.resolveForStaff(staff);
      if (!resolved.canAccessPanel) {
        throw new UnauthorizedException('This account does not have Merchant Panel access permission');
      }
      const summary = toBranchSummaryDto(staff.restaurant);
      return {
        accessToken: this.signToken({
          sub: staff.id,
          restaurantId: staff.restaurant.id,
          slug: staff.restaurant.slug,
          email: staff.email!,
          name: staff.name,
          type: 'restaurant',
          role: 'staff',
          staffRole: resolved.roleKey,
        }),
        restaurant: summary,
        restaurants: [summary],
        user: buildStaffUserDto(staff, resolved),
      };
    }
    return null;
  }

  private async tryTerminalLogin(
    email: string,
    password: string,
  ): Promise<LoginSessionResultDto | null> {
    const restaurant = await this.restaurantRepo.findOne({ where: { terminalEmail: email } });
    if (
      !restaurant?.terminalPasswordHash ||
      !(await bcrypt.compare(password, restaurant.terminalPasswordHash))
    ) {
      return null;
    }
    if (isRestaurantPaymentSuspended(restaurant)) {
      const cfg = await this.loadBillingConfig();
      throw new UnauthorizedException(buildPaymentSuspendedErrorMessage(restaurant.name, cfg));
    }
    if (restaurant.status !== 'active') {
      throw new UnauthorizedException('Restaurant account is not active');
    }
    const summary = toBranchSummaryDto(restaurant);
    return {
      accessToken: this.signToken({
        sub: restaurant.id,
        restaurantId: restaurant.id,
        slug: restaurant.slug,
        email: restaurant.terminalEmail!,
        name: 'Terminal',
        type: 'restaurant',
        role: 'terminal',
      }),
      restaurant: summary,
      restaurants: [summary],
      user: buildTerminalUserDto(restaurant),
    };
  }

  private async getBossSessionProfile(bossId: string, restaurantId: string) {
    const admin = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!admin || admin.isActive === false) {
      throw new UnauthorizedException('Boss account not found');
    }
    const owned = await this.getBossOwnedRestaurants(admin.id, admin.restaurantId, admin);
    const activeBranches = owned.filter(
      (r) => r.status === 'active' && !isRestaurantPaymentSuspended(r),
    );
    const current = activeBranches.find((r) => r.id === restaurantId) ?? activeBranches[0];
    if (!current) {
      const suspended = owned.find((r) => isRestaurantPaymentSuspended(r));
      if (suspended) {
        const cfg = await this.loadBillingConfig();
        throw new UnauthorizedException(buildPaymentSuspendedErrorMessage(suspended.name, cfg));
      }
      throw new NotFoundException('Active restaurant branch not found');
    }
    return {
      restaurant: toBranchSummaryDto(current),
      restaurants: activeBranches.map((r) => toBranchSummaryDto(r)),
      user: buildBossUserDto(admin),
    };
  }

  private async getStaffSessionProfile(staffId: string, restaurantId: string) {
    const staff = await this.staffRepo.findOne({
      where: { id: staffId, restaurantId, isActive: true },
      relations: ['restaurant'],
    });
    if (!staff || !staff.restaurant) {
      throw new UnauthorizedException('Staff user not found');
    }
    if (isRestaurantPaymentSuspended(staff.restaurant)) {
      const cfg = await this.loadBillingConfig();
      throw new UnauthorizedException(buildPaymentSuspendedErrorMessage(staff.restaurant.name, cfg));
    }
    const resolved = await this.rolesService.resolveForStaff(staff);
    const summary = toBranchSummaryDto(staff.restaurant);
    return {
      restaurant: summary,
      restaurants: [summary],
      user: buildStaffUserDto(staff, resolved),
    };
  }

  private async getTerminalSessionProfile(restaurantId: string) {
    const rest = await this.restaurantRepo.findOne({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Restaurant not found');
    if (isRestaurantPaymentSuspended(rest)) {
      const cfg = await this.loadBillingConfig();
      throw new UnauthorizedException(buildPaymentSuspendedErrorMessage(rest.name, cfg));
    }
    const summary = toBranchSummaryDto(rest);
    return {
      restaurant: summary,
      restaurants: [summary],
      user: buildTerminalUserDto(rest),
    };
  }

  private signToken(payload: RestaurantTokenPayload): string {
    const jwtSecret = requireConfigSecret(this.config, 'JWT_SECRET');
    const expiresIn = this.config.get('JWT_EXPIRES_IN', DEFAULT_JWT_EXPIRES_IN);
    return this.jwt.sign(payload, { secret: jwtSecret, expiresIn });
  }
}
