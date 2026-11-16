import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

@Entity('tables')
@Index(['restaurantId'])
export class TableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column()
  name: string;

  @Column({ default: 'default' })
  section: string;

  @Column({ default: 'empty' })
  status: string;

  /** Waiter is working this table on the terminal — persistent like register checkout; other waiters cannot enter via API. */
  @Column({ name: 'session_staff_id', type: 'uuid', nullable: true })
  sessionStaffId: string | null;

  @Column({ name: 'session_staff_name', type: 'varchar', length: 120, nullable: true })
  sessionStaffName: string | null;

  @Column({ name: 'session_locked_at', type: 'timestamptz', nullable: true })
  sessionLockedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  hasActiveLock(staleThresholdMs: number, now: Date = new Date()): boolean {
    if (!this.sessionStaffId || !this.sessionLockedAt) {
      return false;
    }
    const staleBefore = new Date(now.getTime() - staleThresholdMs);
    return this.sessionLockedAt >= staleBefore;
  }

  isLockedByOther(
    staffId: string | null | undefined,
    staleThresholdMs: number,
    now: Date = new Date(),
  ): boolean {
    if (!this.hasActiveLock(staleThresholdMs, now)) {
      return false;
    }
    const sid = (staffId ?? '').trim();
    return !sid || this.sessionStaffId !== sid;
  }

  lockSession(staffId: string, staffName: string, now: Date = new Date()): void {
    this.sessionStaffId = staffId;
    this.sessionStaffName = staffName.trim() || 'Waiter';
    this.sessionLockedAt = now;
  }

  releaseSession(): void {
    this.sessionStaffId = null;
    this.sessionStaffName = null;
    this.sessionLockedAt = null;
  }

  markEmpty(): void {
    this.status = 'empty';
    this.releaseSession();
  }
}
