import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  buildCorderEmailDomain,
  formatCanonicalCorderEmail,
  sanitizeCorderEmailLocalPart,
  toCorderEmailTenantSlug,
} from './corder-email.policy';

describe('corder-email.policy', () => {
  it('converts Turkish restaurant and brand names into DNS-safe tenant slugs', () => {
    assert.equal(toCorderEmailTenantSlug('Moscow'), 'moscow');
    assert.equal(
      toCorderEmailTenantSlug('Burger House Kadıköy & Şişli'),
      'burger-house-kadikoy-sisli',
    );
    assert.equal(toCorderEmailTenantSlug('  Çınaraltı İskender  '), 'cinaralti-iskender');
    assert.equal(toCorderEmailTenantSlug(''), '');
    assert.equal(toCorderEmailTenantSlug(null), '');
  });

  it('builds tenant-scoped corder.app domains and falls back to corder.app', () => {
    assert.equal(buildCorderEmailDomain('moscow'), 'moscow.corder.app');
    assert.equal(
      buildCorderEmailDomain('Burger House Türkiye'),
      'burger-house-turkiye.corder.app',
    );
    assert.equal(buildCorderEmailDomain(''), 'corder.app');
    assert.equal(buildCorderEmailDomain(undefined), 'corder.app');
  });

  it('extracts and sanitizes local parts from either usernames or legacy full emails', () => {
    assert.equal(sanitizeCorderEmailLocalPart('sehmus'), 'sehmus');
    assert.equal(sanitizeCorderEmailLocalPart('Şehmus Yıldırım'), 'sehmus.yildirim');
    assert.equal(sanitizeCorderEmailLocalPart('sehmus@moscow.com'), 'sehmus');
    assert.equal(sanitizeCorderEmailLocalPart('  Ayşe..Demir@eski.com '), 'ayse.demir');
    assert.equal(sanitizeCorderEmailLocalPart(''), '');
  });

  it('formats canonical <local>@<tenant>.corder.app addresses consistently', () => {
    assert.equal(
      formatCanonicalCorderEmail('sehmus', 'moscow'),
      'sehmus@moscow.corder.app',
    );
    assert.equal(
      formatCanonicalCorderEmail('sehmus@moscow.com', 'moscow'),
      'sehmus@moscow.corder.app',
    );
    assert.equal(
      formatCanonicalCorderEmail('terminal', 'Burger House Kadıköy'),
      'terminal@burger-house-kadikoy.corder.app',
    );
    assert.equal(
      formatCanonicalCorderEmail('patron', 'Burger House Türkiye'),
      'patron@burger-house-turkiye.corder.app',
    );
    assert.equal(formatCanonicalCorderEmail('   ', 'moscow'), null);
  });
});

