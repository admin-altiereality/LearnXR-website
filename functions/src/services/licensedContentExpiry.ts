import * as admin from 'firebase-admin';
import { resolveProviderLicenseStatus } from './licensedContentDomain.js';

const MAX_PROVIDERS_PER_RUN = 100;
const MAX_CONTENT_PER_PROVIDER = 400;

function expiryNoticeMilestone(endsAt: unknown, now: Date): number | null {
  const end = new Date(String(endsAt || ''));
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return null;
  const days = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 7) return 7;
  if (days <= 14) return 14;
  if (days <= 30) return 30;
  return null;
}

export async function enforceLicensedProviderExpiry(now = new Date()): Promise<{
  providersChecked: number;
  providersExpired: number;
  contentSuspended: number;
}> {
  const db = admin.firestore();
  const providers = await db.collection('licensed_content_providers')
    .where('integration_mode', '==', 'external_link')
    .limit(MAX_PROVIDERS_PER_RUN)
    .get();
  let providersExpired = 0;
  let contentSuspended = 0;

  for (const providerSnapshot of providers.docs) {
    const provider = providerSnapshot.data();
    const nextStatus = resolveProviderLicenseStatus(provider, now);
    const milestone = expiryNoticeMilestone(provider.license_ends_at, now);
    const batch = db.batch();
    const providerUpdate: Record<string, unknown> = {
      status: nextStatus,
      lifecycle_checked_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    let hasAuditEvent = false;

    if (milestone && provider.expiry_notice_milestone !== milestone) {
      providerUpdate.expiry_notice_milestone = milestone;
      const auditRef = db.collection('licensed_content_audit_log').doc();
      batch.set(auditRef, {
        action: 'provider_license_expiring',
        actor_uid: 'scheduled-license-lifecycle',
        content_id: null,
        metadata: {
          provider: providerSnapshot.id,
          days_remaining: milestone,
          license_ends_at: provider.license_ends_at || null,
        },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      hasAuditEvent = true;
    }

    let expiredContentCount = 0;
    if (nextStatus === 'expired') {
      if (provider.status !== 'expired') {
        providersExpired += 1;
      }
      const content = await db.collection('licensed_content')
        .where('provider', '==', providerSnapshot.id)
        .where('status', '==', 'published')
        .limit(MAX_CONTENT_PER_PROVIDER)
        .get();
      content.docs.forEach((contentSnapshot) => {
        batch.update(contentSnapshot.ref, {
          status: 'suspended',
          previous_status: 'published',
          suspension_reason: 'provider_license_expired',
          suspended_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_by: 'scheduled-license-lifecycle',
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      contentSuspended += content.size;
      expiredContentCount = content.size;
      if (provider.status !== 'expired' || content.size > 0) {
        const auditRef = db.collection('licensed_content_audit_log').doc();
        batch.set(auditRef, {
          action: provider.status === 'expired'
            ? 'provider_expired_content_suspended'
            : 'provider_license_expired',
          actor_uid: 'scheduled-license-lifecycle',
          content_id: null,
          metadata: {
            provider: providerSnapshot.id,
            suspended_content_count: content.size,
            license_ends_at: provider.license_ends_at || null,
          },
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        hasAuditEvent = true;
      }
    }

    if (provider.status !== nextStatus || hasAuditEvent || expiredContentCount > 0) {
      batch.set(providerSnapshot.ref, providerUpdate, { merge: true });
      await batch.commit();
    }
  }

  return {
    providersChecked: providers.size,
    providersExpired,
    contentSuspended,
  };
}
