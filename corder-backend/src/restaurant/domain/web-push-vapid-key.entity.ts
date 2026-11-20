import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('web_push_vapid_keys')
export class WebPushVapidKeyEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey!: string;

  @Column({ name: 'private_jwk', type: 'jsonb' })
  privateJwk!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
