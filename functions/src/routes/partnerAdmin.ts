/**
 * Authenticated partner admin APIs:
 * - Admin: approve / reject partners from CRM leads
 * - Superadmin: approve / reject / suspend partners from CRM leads
 * - Partner: me, schools, invites, demo sessions (quota-enforced), activity
 */

import { Request, Response, Router } from 'express';
import * as admin from 'firebase-admin';
import { requireRole } from '../middleware/rbac';
import { syncUserRoleClaim } from '../utils/syncUserRoleClaim';
import * as crypto from 'crypto';

const router = Router();

const TRIAL_MONTHS = 6;
const TRIAL_LAUNCH_LIMIT = 100;
const APP_ORIGIN = process.env.APP_ORIGIN || process.env.CLIENT_ORIGIN || 'https://learnxr.ai';

const requirePartnerAdmin = requireRole(['admin', 'superadmin']);
const requireSuperadmin = requireRole(['superadmin']);
const requirePartner = requireRole(['partner']);
const requirePartnerOrSuperadmin = requireRole(['partner', 'superadmin']);

function generateSchoolCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateSessionCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function addMonthsIso(date: Date, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

async function sendPartnerApprovalNotification(params: {
  requestId: string;
  email: string;
  contactName: string;
  organizationName: string;
  partnerId: string;
  inviteLink: string | null;
  trial: unknown;
}): Promise<void> {
  const webhookUrl = process.env.N8N_PARTNER_APPROVE_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'partner_approved',
        email: params.email,
        contactName: params.contactName,
        organizationName: params.organizationName,
        partnerId: params.partnerId,
        inviteLink: params.inviteLink,
        trial: params.trial,
        notification: {
          template: 'partner_approved',
          recipient: params.email,
        },
      }),
    });
  } catch (error) {
    console.error(`[${params.requestId}] Approve webhook failed (non-fatal):`, error);
  }
}

async function writePartnerEvent(params: {
  partnerId: string;
  type: string;
  actorUid: string;
  schoolId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const db = admin.firestore();
  await db.collection('partner_events').add({
    partnerId: params.partnerId,
    type: params.type,
    actorUid: params.actorUid,
    schoolId: params.schoolId || null,
    meta: params.meta || {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function isTrialActive(trial: {
  endsAt?: string;
  classLaunchesRemaining?: number;
} | undefined): { ok: boolean; reason?: string } {
  if (!trial?.endsAt) return { ok: false, reason: 'Trial not configured' };
  if (new Date(trial.endsAt).getTime() < Date.now()) {
    return { ok: false, reason: 'Partner trial has expired (6 months)' };
  }
  if ((trial.classLaunchesRemaining ?? 0) <= 0) {
    return { ok: false, reason: 'Class launch quota exhausted (100 launches)' };
  }
  return { ok: true };
}

async function getPartnerByUserId(uid: string): Promise<{ id: string; data: admin.firestore.DocumentData } | null> {
  const db = admin.firestore();
  const snap = await db.collection('partners').where('userId', '==', uid).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() };
}

/**
 * POST /partners/registrations/:registrationId/approve
 * Admin or superadmin — provision Auth user + partner tenant + trial + invite email.
 */
router.post(
  ['/registrations/:registrationId/approve', '/registrations/:registrationId/approve/'],
  requirePartnerAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { registrationId } = req.params;
    const requestId = (req as any).requestId || `partner-approve-${Date.now()}`;
    const db = admin.firestore();
    const reviewerUid = req.user!.uid;

    try {
      const regRef = db.collection('partner_registrations').doc(registrationId);
      const regSnap = await regRef.get();
      if (!regSnap.exists) {
        res.status(404).json({ success: false, message: 'Registration not found' });
        return;
      }

      const reg = regSnap.data()!;
      if (reg.status === 'approved' && reg.partnerId && reg.userId) {
        const email = String(reg.email || '').toLowerCase().trim();
        let inviteLink: string | null = null;
        if (email) {
          try {
            inviteLink = await admin.auth().generatePasswordResetLink(email);
          } catch (error) {
            console.error(`[${requestId}] Failed to generate password reset link:`, error);
          }
          await sendPartnerApprovalNotification({
            requestId,
            email,
            contactName: reg.contactName || '',
            organizationName: reg.organizationName || '',
            partnerId: reg.partnerId,
            inviteLink,
            trial: null,
          });
        }
        res.json({
          success: true,
          message: 'Partner already approved. A new password setup email has been sent.',
          partnerId: reg.partnerId,
          userId: reg.userId,
          inviteLink,
          alreadyApproved: true,
        });
        return;
      }
      if (reg.status === 'rejected') {
        res.status(400).json({ success: false, message: 'Registration was rejected. Create a new application.' });
        return;
      }

      const email = String(reg.email || '').toLowerCase().trim();
      if (!email) {
        res.status(400).json({ success: false, message: 'Registration has no email' });
        return;
      }

      // Create or reuse Auth user
      let userRecord: admin.auth.UserRecord;
      let createdNewUser = false;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
      } catch (error: unknown) {
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code
          : undefined;
        if (code !== 'auth/user-not-found') throw error;

        const tempPassword = crypto.randomBytes(24).toString('base64url');
        userRecord = await admin.auth().createUser({
          email,
          password: tempPassword,
          displayName: reg.contactName || reg.organizationName || email,
          emailVerified: false,
        });
        createdNewUser = true;
      }

      // Do not overwrite non-partner staff/school accounts without explicit conversion
      const existingUserSnap = await db.collection('users').doc(userRecord.uid).get();
      const existingRole = existingUserSnap.exists ? existingUserSnap.data()?.role : null;
      if (
        existingRole &&
        existingRole !== 'partner' &&
        existingRole !== 'student' &&
        !['', null].includes(existingRole)
      ) {
        // Allow converting a bare student account; block school/teacher/admin takeover
        if (['teacher', 'school', 'principal', 'admin', 'superadmin', 'associate'].includes(existingRole)) {
          res.status(409).json({
            success: false,
            message: `Email already registered as ${existingRole}. Use a different partner email.`,
          });
          return;
        }
      }

      const now = new Date();
      const trial = {
        startsAt: now.toISOString(),
        endsAt: addMonthsIso(now, TRIAL_MONTHS),
        classLaunchesLimit: TRIAL_LAUNCH_LIMIT,
        classLaunchesUsed: 0,
        classLaunchesRemaining: TRIAL_LAUNCH_LIMIT,
      };

      const partnerRef = db.collection('partners').doc();
      const partnerId = partnerRef.id;

      await partnerRef.set({
        organizationName: reg.organizationName || '',
        contactName: reg.contactName || '',
        email,
        phone: reg.phone || '',
        country: reg.country || '',
        region: reg.region || '',
        partnerType: reg.partnerType || '',
        orgType: reg.orgType || '',
        status: 'active',
        registrationId,
        userId: userRecord.uid,
        trial,
        schoolIds: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedAt: now.toISOString(),
        approvedBy: reviewerUid,
      });

      await db.collection('users').doc(userRecord.uid).set(
        {
          email,
          name: reg.contactName || '',
          displayName: reg.contactName || reg.organizationName || email,
          role: 'partner',
          partner_id: partnerId,
          approvalStatus: 'approved',
          onboardingCompleted: true,
          onboardingCompletedAt: now.toISOString(),
          approvedBy: reviewerUid,
          approvedAt: now.toISOString(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: existingUserSnap.exists
            ? existingUserSnap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()
            : admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await syncUserRoleClaim(userRecord.uid);

      await regRef.update({
        status: 'approved',
        partnerId,
        userId: userRecord.uid,
        reviewedAt: now.toISOString(),
        reviewedBy: reviewerUid,
      });

      await writePartnerEvent({
        partnerId,
        type: 'partner_approved',
        actorUid: reviewerUid,
        meta: { registrationId, email, createdNewUser },
      });

      let inviteLink: string | null = null;
      try {
        inviteLink = await admin.auth().generatePasswordResetLink(email);
      } catch (err) {
        console.error(`[${requestId}] Failed to generate password reset link:`, err);
      }

      await sendPartnerApprovalNotification({
        requestId,
        email,
        contactName: reg.contactName || '',
        organizationName: reg.organizationName || '',
        partnerId,
        inviteLink,
        trial,
      });

      res.json({
        success: true,
        message: createdNewUser
          ? 'Partner approved. Invite link generated for account setup.'
          : 'Partner approved and linked to existing Auth user.',
        partnerId,
        userId: userRecord.uid,
        trial,
        inviteLink,
        createdNewUser,
      });
    } catch (error: any) {
      console.error(`[${requestId}] Partner approve failed:`, error);
      res.status(500).json({
        success: false,
        message: error?.message || 'Failed to approve partner',
      });
    }
  }
);

/**
 * POST /partners/registrations/:registrationId/reject
 */
router.post(
  ['/registrations/:registrationId/reject', '/registrations/:registrationId/reject/'],
  requirePartnerAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { registrationId } = req.params;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : '';
    const db = admin.firestore();
    const reviewerUid = req.user!.uid;

    try {
      const regRef = db.collection('partner_registrations').doc(registrationId);
      const regSnap = await regRef.get();
      if (!regSnap.exists) {
        res.status(404).json({ success: false, message: 'Registration not found' });
        return;
      }
      const reg = regSnap.data()!;
      if (reg.status === 'approved') {
        res.status(400).json({ success: false, message: 'Cannot reject an approved partner. Suspend instead.' });
        return;
      }

      const now = new Date().toISOString();
      await regRef.update({
        status: 'rejected',
        rejectionReason: reason || null,
        reviewedAt: now,
        reviewedBy: reviewerUid,
      });

      res.json({ success: true, message: 'Registration rejected' });
    } catch (error: any) {
      console.error('Partner reject failed:', error);
      res.status(500).json({ success: false, message: error?.message || 'Failed to reject' });
    }
  }
);

/**
 * POST /partners/:partnerId/suspend
 */
router.post(
  ['/:partnerId/suspend', '/:partnerId/suspend/'],
  requireSuperadmin,
  async (req: Request, res: Response): Promise<void> => {
    const { partnerId } = req.params;
    const db = admin.firestore();
    try {
      const ref = db.collection('partners').doc(partnerId);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ success: false, message: 'Partner not found' });
        return;
      }
      await ref.update({
        status: 'suspended',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await writePartnerEvent({
        partnerId,
        type: 'partner_suspended',
        actorUid: req.user!.uid,
      });
      res.json({ success: true, message: 'Partner suspended' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to suspend' });
    }
  }
);

/**
 * GET /partners/me
 */
router.get(['/me', '/me/'], requirePartner, async (req: Request, res: Response): Promise<void> => {
  try {
    const partner = await getPartnerByUserId(req.user!.uid);
    if (!partner) {
      res.status(404).json({ success: false, message: 'Partner profile not found' });
      return;
    }
    const trialCheck = isTrialActive(partner.data.trial);
    res.json({
      success: true,
      partner: { id: partner.id, ...partner.data },
      trialActive: trialCheck.ok,
      trialBlockReason: trialCheck.reason || null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to load partner' });
  }
});

/**
 * GET /partners/:partnerId/activity
 */
router.get(
  ['/:partnerId/activity', '/:partnerId/activity/'],
  requirePartnerOrSuperadmin,
  async (req: Request, res: Response): Promise<void> => {
    const { partnerId } = req.params;
    const db = admin.firestore();
    try {
      if (req.userProfile!.role === 'partner' && req.userProfile!.partner_id !== partnerId) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }
      const snap = await db
        .collection('partner_events')
        .where('partnerId', '==', partnerId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({ success: true, events });
    } catch (error: any) {
      // Missing composite index fallback
      console.error('Partner activity query failed:', error);
      try {
        const snap = await db
          .collection('partner_events')
          .where('partnerId', '==', partnerId)
          .limit(50)
          .get();
        const events = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            const at = a.createdAt?.toMillis?.() || 0;
            const bt = b.createdAt?.toMillis?.() || 0;
            return bt - at;
          });
        res.json({ success: true, events });
      } catch (err2: any) {
        res.status(500).json({ success: false, message: err2?.message || 'Failed to load activity' });
      }
    }
  }
);

/**
 * POST /partners/schools — partner creates a demo school
 */
router.post(['/schools', '/schools/'], requirePartner, async (req: Request, res: Response): Promise<void> => {
  const db = admin.firestore();
  const uid = req.user!.uid;
  try {
    const partner = await getPartnerByUserId(uid);
    if (!partner) {
      res.status(404).json({ success: false, message: 'Partner profile not found' });
      return;
    }
    if (partner.data.status === 'suspended') {
      res.status(403).json({ success: false, message: 'Partner account is suspended' });
      return;
    }

    const name = String(req.body?.name || '').trim().slice(0, 200);
    if (!name) {
      res.status(400).json({ success: false, message: 'School name is required' });
      return;
    }

    const schoolCode = generateSchoolCode();
    const schoolRef = db.collection('schools').doc();
    const schoolDoc = {
      name,
      address: String(req.body?.address || '').slice(0, 300),
      city: String(req.body?.city || '').slice(0, 100),
      state: String(req.body?.state || '').slice(0, 100),
      pincode: String(req.body?.pincode || '').slice(0, 20),
      contactPerson: String(req.body?.contactPerson || '').slice(0, 120),
      contactPhone: String(req.body?.contactPhone || '').slice(0, 60),
      website: String(req.body?.website || '').slice(0, 200),
      boardAffiliation: String(req.body?.boardAffiliation || '').slice(0, 80),
      establishedYear: String(req.body?.establishedYear || '').slice(0, 10),
      schoolType: String(req.body?.schoolType || '').slice(0, 60),
      approvalStatus: 'approved',
      schoolCode,
      partner_id: partner.id,
      source: 'partner_demo',
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await schoolRef.set(schoolDoc);
    await db.collection('partners').doc(partner.id).update({
      schoolIds: admin.firestore.FieldValue.arrayUnion(schoolRef.id),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await writePartnerEvent({
      partnerId: partner.id,
      type: 'school_created',
      actorUid: uid,
      schoolId: schoolRef.id,
      meta: { name, schoolCode },
    });

    res.json({
      success: true,
      school: { id: schoolRef.id, ...schoolDoc, createdAt: undefined, updatedAt: undefined },
      schoolCode,
    });
  } catch (error: any) {
    console.error('Partner create school failed:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to create school' });
  }
});

/**
 * GET /partners/schools — list partner schools
 */
router.get(['/schools', '/schools/'], requirePartner, async (req: Request, res: Response): Promise<void> => {
  const db = admin.firestore();
  try {
    const partner = await getPartnerByUserId(req.user!.uid);
    if (!partner) {
      res.status(404).json({ success: false, message: 'Partner profile not found' });
      return;
    }
    const snap = await db.collection('schools').where('partner_id', '==', partner.id).get();
    const schools = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, schools });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to list schools' });
  }
});

/**
 * POST /partners/schools/:schoolId/invite — create school-admin invite link
 */
router.post(
  ['/schools/:schoolId/invite', '/schools/:schoolId/invite/'],
  requirePartner,
  async (req: Request, res: Response): Promise<void> => {
    const { schoolId } = req.params;
    const db = admin.firestore();
    const uid = req.user!.uid;
    try {
      const partner = await getPartnerByUserId(uid);
      if (!partner) {
        res.status(404).json({ success: false, message: 'Partner profile not found' });
        return;
      }
      const schoolSnap = await db.collection('schools').doc(schoolId).get();
      if (!schoolSnap.exists || schoolSnap.data()?.partner_id !== partner.id) {
        res.status(403).json({ success: false, message: 'School not in your portfolio' });
        return;
      }

      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';

      await db.collection('school_invites').doc(token).set({
        schoolId,
        partnerId: partner.id,
        email: email || null,
        role: 'school',
        expiresAt,
        usedAt: null,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const inviteUrl = `${APP_ORIGIN}/invite/school?token=${token}`;
      await writePartnerEvent({
        partnerId: partner.id,
        type: 'school_invite_sent',
        actorUid: uid,
        schoolId,
        meta: { email: email || null },
      });

      res.json({ success: true, token, inviteUrl, expiresAt });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to create invite' });
    }
  }
);

/**
 * POST /partners/invites/:token/claim — authenticated user becomes school admin for invited school
 */
router.post(
  ['/invites/:token/claim', '/invites/:token/claim/'],
  async (req: Request, res: Response): Promise<void> => {
    // Any authenticated user (middleware already applied when mounted after auth)
    if (!req.user?.uid) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const { token } = req.params;
    const db = admin.firestore();
    const uid = req.user.uid;

    try {
      const inviteRef = db.collection('school_invites').doc(token);
      const inviteSnap = await inviteRef.get();
      if (!inviteSnap.exists) {
        res.status(404).json({ success: false, message: 'Invite not found' });
        return;
      }
      const invite = inviteSnap.data()!;
      if (invite.usedAt) {
        res.status(400).json({ success: false, message: 'Invite already used' });
        return;
      }
      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        res.status(400).json({ success: false, message: 'Invite expired' });
        return;
      }

      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      const currentRole = userSnap.exists ? userSnap.data()?.role : null;
      if (currentRole && ['admin', 'superadmin', 'partner', 'associate'].includes(currentRole)) {
        res.status(409).json({
          success: false,
          message: 'This account cannot become a school administrator. Sign in with a different email.',
        });
        return;
      }

      const now = new Date().toISOString();
      await userRef.set(
        {
          role: 'school',
          school_id: invite.schoolId,
          managed_school_id: invite.schoolId,
          approvalStatus: 'approved',
          onboardingCompleted: true,
          onboardingCompletedAt: now,
          approvedAt: now,
          approvedBy: invite.createdBy,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: userSnap.exists
            ? userSnap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()
            : admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await syncUserRoleClaim(uid);
      await inviteRef.update({ usedAt: now });

      res.json({
        success: true,
        message: 'School admin access granted',
        schoolId: invite.schoolId,
      });
    } catch (error: any) {
      console.error('Claim invite failed:', error);
      res.status(500).json({ success: false, message: error?.message || 'Failed to claim invite' });
    }
  }
);

/**
 * POST /partners/sessions — partner-hosted demo session (quota enforced)
 */
router.post(['/sessions', '/sessions/'], requirePartner, async (req: Request, res: Response): Promise<void> => {
  const db = admin.firestore();
  const uid = req.user!.uid;
  const schoolId = String(req.body?.schoolId || '');
  const classId = String(req.body?.classId || '');

  if (!schoolId || !classId) {
    res.status(400).json({ success: false, message: 'schoolId and classId are required' });
    return;
  }

  try {
    const partner = await getPartnerByUserId(uid);
    if (!partner) {
      res.status(404).json({ success: false, message: 'Partner profile not found' });
      return;
    }
    if (partner.data.status === 'suspended') {
      res.status(403).json({ success: false, message: 'Partner account is suspended' });
      return;
    }

    const schoolSnap = await db.collection('schools').doc(schoolId).get();
    if (!schoolSnap.exists || schoolSnap.data()?.partner_id !== partner.id) {
      res.status(403).json({ success: false, message: 'School not in your portfolio' });
      return;
    }

    const classSnap = await db.collection('classes').doc(classId).get();
    if (!classSnap.exists || classSnap.data()?.school_id !== schoolId) {
      res.status(400).json({ success: false, message: 'Class not found for this school' });
      return;
    }

    const partnerRef = db.collection('partners').doc(partner.id);
    const result = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(partnerRef);
      if (!fresh.exists) throw new Error('Partner not found');
      const data = fresh.data()!;
      const trial = data.trial || {};
      const check = isTrialActive(trial);
      if (!check.ok) {
        const err: any = new Error(check.reason || 'Trial inactive');
        err.code = 'TRIAL_INACTIVE';
        throw err;
      }

      const remaining = (trial.classLaunchesRemaining ?? 0) - 1;
      const used = (trial.classLaunchesUsed ?? 0) + 1;
      const updates: Record<string, unknown> = {
        'trial.classLaunchesRemaining': remaining,
        'trial.classLaunchesUsed': used,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (remaining <= 0) {
        updates.status = 'expired';
      }

      tx.update(partnerRef, updates);

      const sessionRef = db.collection('class_sessions').doc();
      const sessionCode = generateSessionCode(6);
      tx.set(sessionRef, {
        teacher_uid: uid,
        school_id: schoolId,
        class_id: classId,
        status: 'waiting',
        session_code: sessionCode,
        launched_lesson: null,
        launched_scene: null,
        partner_id: partner.id,
        hosted_by_partner: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        sessionId: sessionRef.id,
        sessionCode,
        remaining,
        used,
      };
    });

    await writePartnerEvent({
      partnerId: partner.id,
      type: 'demo_started',
      actorUid: uid,
      schoolId,
      meta: {
        classId,
        sessionId: result.sessionId,
        sessionCode: result.sessionCode,
        launchesRemaining: result.remaining,
      },
    });

    if (result.remaining <= 0) {
      await writePartnerEvent({
        partnerId: partner.id,
        type: 'quota_exhausted',
        actorUid: uid,
        schoolId,
      });
    }

    res.json({
      success: true,
      sessionId: result.sessionId,
      sessionCode: result.sessionCode,
      classLaunchesRemaining: result.remaining,
      classLaunchesUsed: result.used,
    });
  } catch (error: any) {
    if (error?.code === 'TRIAL_INACTIVE') {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    console.error('Partner create session failed:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to start demo session' });
  }
});

/**
 * POST /partners/teachers/:teacherUid/approve
 */
router.post(
  ['/teachers/:teacherUid/approve', '/teachers/:teacherUid/approve/'],
  requirePartner,
  async (req: Request, res: Response): Promise<void> => {
    const { teacherUid } = req.params;
    const db = admin.firestore();
    const uid = req.user!.uid;
    try {
      const partner = await getPartnerByUserId(uid);
      if (!partner) {
        res.status(404).json({ success: false, message: 'Partner profile not found' });
        return;
      }
      const teacherRef = db.collection('users').doc(teacherUid);
      const teacherSnap = await teacherRef.get();
      if (!teacherSnap.exists || teacherSnap.data()?.role !== 'teacher') {
        res.status(404).json({ success: false, message: 'Teacher not found' });
        return;
      }
      const schoolId = teacherSnap.data()?.school_id;
      if (!schoolId) {
        res.status(400).json({ success: false, message: 'Teacher has no school_id' });
        return;
      }
      const schoolSnap = await db.collection('schools').doc(schoolId).get();
      if (!schoolSnap.exists || schoolSnap.data()?.partner_id !== partner.id) {
        res.status(403).json({ success: false, message: 'Teacher is not in your schools' });
        return;
      }

      const approve = req.body?.approve !== false;
      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        approvalStatus: approve ? 'approved' : 'rejected',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (approve) {
        update.approvedBy = uid;
        update.approvedAt = now;
      } else {
        update.rejectedBy = uid;
        update.rejectedAt = now;
      }
      await teacherRef.update(update);

      await writePartnerEvent({
        partnerId: partner.id,
        type: approve ? 'teacher_approved' : 'teacher_rejected',
        actorUid: uid,
        schoolId,
        meta: { teacherUid },
      });

      res.json({ success: true, approvalStatus: approve ? 'approved' : 'rejected' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to update teacher' });
    }
  }
);

/**
 * GET /partners/registrations/:registrationId/detail — superadmin detail with partner + schools
 */
router.get(
  ['/registrations/:registrationId/detail', '/registrations/:registrationId/detail/'],
  requireSuperadmin,
  async (req: Request, res: Response): Promise<void> => {
    const db = admin.firestore();
    try {
      const regSnap = await db.collection('partner_registrations').doc(req.params.registrationId).get();
      if (!regSnap.exists) {
        res.status(404).json({ success: false, message: 'Not found' });
        return;
      }
      const reg = { id: regSnap.id, ...regSnap.data() } as any;
      let partner = null;
      let schools: any[] = [];
      let events: any[] = [];
      if (reg.partnerId) {
        const pSnap = await db.collection('partners').doc(reg.partnerId).get();
        if (pSnap.exists) partner = { id: pSnap.id, ...pSnap.data() };
        const sSnap = await db.collection('schools').where('partner_id', '==', reg.partnerId).get();
        schools = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const eSnap = await db.collection('partner_events').where('partnerId', '==', reg.partnerId).limit(30).get();
        events = eSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      res.json({ success: true, registration: reg, partner, schools, events });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to load detail' });
    }
  }
);

export default router;
