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
/** Demo / Channel Partner Street View class launches (one session start = one credit). */
const TRIAL_LAUNCH_LIMIT = 50;
/** Curriculum demo lesson launches (separate from Street View class launches). */
const TRIAL_LESSON_LAUNCH_LIMIT = 200;
const DEFAULT_DEMO_SCHOOL_CODE = 'HV647R';
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

async function generatePartnerPasswordSetupLink(email: string): Promise<string | null> {
  try {
    return await admin.auth().generatePasswordResetLink(email, {
      url: `${APP_ORIGIN}/partner-login`,
      handleCodeInApp: false,
    });
  } catch (error) {
    console.error('Failed to generate partner password setup link:', error);
    return null;
  }
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
        username: params.email,
        contactName: params.contactName,
        organizationName: params.organizationName,
        partnerId: params.partnerId,
        inviteLink: params.inviteLink,
        passwordSetupLink: params.inviteLink,
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

async function writePartnerAudit(params: {
  action: string;
  targetPartnerId: string;
  actorUid: string;
  actorRole: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}): Promise<void> {
  await admin.firestore().collection('partner_audit_log').add({
    ...params,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function getPartnerDemoSchool(
  db: admin.firestore.Firestore,
  partner: admin.firestore.DocumentData,
): Promise<{ id: string; data: admin.firestore.DocumentData } | null> {
  if (!partner.demoSchoolId) return null;
  const schoolSnap = await db.collection('schools').doc(partner.demoSchoolId).get();
  return schoolSnap.exists ? { id: schoolSnap.id, data: schoolSnap.data()! } : null;
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
          inviteLink = await generatePartnerPasswordSetupLink(email);
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
        lessonLaunchesLimit: TRIAL_LESSON_LAUNCH_LIMIT,
        lessonLaunchesUsed: 0,
        lessonLaunchesRemaining: TRIAL_LESSON_LAUNCH_LIMIT,
      };

      const partnerRef = db.collection('partners').doc();
      const partnerId = partnerRef.id;
      const demoSchoolQuery = await db.collection('schools').where('schoolCode', '==', DEFAULT_DEMO_SCHOOL_CODE).limit(1).get();
      let demoSchoolRef: admin.firestore.DocumentReference;
      if (demoSchoolQuery.empty) {
        demoSchoolRef = db.collection('schools').doc();
        await demoSchoolRef.set({
          name: 'Altie Reality',
          schoolCode: DEFAULT_DEMO_SCHOOL_CODE,
          approvalStatus: 'approved',
          source: 'channel_partner_demo',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        demoSchoolRef = demoSchoolQuery.docs[0].ref;
      }
      const demoClassRef = db.collection('classes').doc();
      await demoClassRef.set({
        class_name: `${reg.organizationName || 'Channel Partner'} Demo`,
        school_id: demoSchoolRef.id,
        partner_id: partnerId,
        teacher_ids: [],
        student_ids: [],
        source: 'channel_partner_demo',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

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
        schoolIds: [demoSchoolRef.id],
        demoSchoolId: demoSchoolRef.id,
        demoClassId: demoClassRef.id,
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

      const inviteLink = await generatePartnerPasswordSetupLink(email);

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
    const schools: Array<Record<string, unknown> & { id: string }> = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const demoSchool = await getPartnerDemoSchool(db, partner.data);
    if (demoSchool && !schools.some((school) => school.id === demoSchool.id)) {
      schools.unshift({ id: demoSchool.id, ...demoSchool.data, isDefaultDemoSchool: true });
    }
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
    const isDefaultDemoSchool = partner.data.demoSchoolId === schoolId;
    if (!schoolSnap.exists || (!isDefaultDemoSchool && schoolSnap.data()?.partner_id !== partner.id)) {
      res.status(403).json({ success: false, message: 'School not in your portfolio' });
      return;
    }

    const classSnap = await db.collection('classes').doc(classId).get();
    if (
      !classSnap.exists ||
      classSnap.data()?.school_id !== schoolId ||
      (isDefaultDemoSchool && classSnap.data()?.partner_id !== partner.id)
    ) {
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
      if (typeof trial.lessonLaunchesLimit !== 'number') {
        updates['trial.lessonLaunchesLimit'] = TRIAL_LESSON_LAUNCH_LIMIT;
        updates['trial.lessonLaunchesUsed'] = 0;
        updates['trial.lessonLaunchesRemaining'] = TRIAL_LESSON_LAUNCH_LIMIT;
      }
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

router.post(
  ['/sessions/:sessionId/launch-lesson', '/sessions/:sessionId/launch-lesson/'],
  requirePartner,
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const chapterId = String(req.body?.chapterId || '').trim();
    const topicId = String(req.body?.topicId || '').trim();
    const sceneId = String(req.body?.sceneId || '').trim();
    const title = String(req.body?.title || '').trim().slice(0, 200);
    const rawLessonType = String(req.body?.lessonType || '').trim();
    const lessonType =
      rawLessonType === 'user_generated'
        ? 'user_generated'
        : rawLessonType === 'vr360_video'
          ? 'vr360_video'
          : 'curriculum';
    const vr360TourId = String(req.body?.vr360TourId || '').trim();
    if (!chapterId || !topicId) {
      res.status(400).json({ success: false, message: 'chapterId and topicId are required' });
      return;
    }

    const db = admin.firestore();
    try {
      const partner = await getPartnerByUserId(req.user!.uid);
      if (!partner) {
        res.status(404).json({ success: false, message: 'Partner profile not found' });
        return;
      }
      const partnerRef = db.collection('partners').doc(partner.id);
      const sessionRef = db.collection('class_sessions').doc(sessionId);
      const result = await db.runTransaction(async (tx) => {
        const [partnerSnap, sessionSnap] = await Promise.all([tx.get(partnerRef), tx.get(sessionRef)]);
        if (!partnerSnap.exists || !sessionSnap.exists) throw new Error('Partner or session not found');
        const freshPartner = partnerSnap.data()!;
        const session = sessionSnap.data()!;
        if (session.partner_id !== partner.id || session.hosted_by_partner !== true) {
          const error: any = new Error('Session is not in your partner portfolio');
          error.code = 'FORBIDDEN';
          throw error;
        }
        const check = isTrialActive(freshPartner.trial);
        if (!check.ok) {
          const error: any = new Error(check.reason || 'Trial inactive');
          error.code = 'TRIAL_INACTIVE';
          throw error;
        }

        // Street View / user-generated tours already consumed one class-launch credit when the
        // demo session started — do not double-count against lesson launches.
        let nextRemaining = Number(freshPartner.trial?.lessonLaunchesRemaining ?? TRIAL_LESSON_LAUNCH_LIMIT);
        let nextUsed = Number(freshPartner.trial?.lessonLaunchesUsed ?? 0);
        if (lessonType !== 'user_generated') {
          const hasLessonEntitlement = typeof freshPartner.trial?.lessonLaunchesRemaining === 'number';
          const remaining = Number(
            hasLessonEntitlement
              ? freshPartner.trial.lessonLaunchesRemaining
              : TRIAL_LESSON_LAUNCH_LIMIT
          );
          if (remaining <= 0) {
            const error: any = new Error('Lesson launch quota exhausted');
            error.code = 'LESSON_QUOTA_EXHAUSTED';
            throw error;
          }
          nextRemaining = remaining - 1;
          nextUsed = Number(freshPartner.trial?.lessonLaunchesUsed ?? 0) + 1;
          tx.update(partnerRef, {
            'trial.lessonLaunchesLimit': Number(freshPartner.trial?.lessonLaunchesLimit ?? TRIAL_LESSON_LAUNCH_LIMIT),
            'trial.lessonLaunchesRemaining': nextRemaining,
            'trial.lessonLaunchesUsed': nextUsed,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        const launchedLesson: Record<string, unknown> = {
          chapter_id: chapterId,
          topic_id: topicId,
          scene_id: sceneId || null,
          title: title || null,
          lesson_type: lessonType,
        };
        if (lessonType === 'vr360_video') {
          // topic_id is usually "tour-<id>"; prefer explicit body field when present
          const fromTopic =
            topicId.startsWith('tour-') ? topicId.slice('tour-'.length) : '';
          launchedLesson.vr360_tour_id = vr360TourId || fromTopic || null;
        }
        tx.update(sessionRef, {
          status: 'active',
          launched_lesson: launchedLesson,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
          remaining: nextRemaining,
          used: nextUsed,
          schoolId: session.school_id,
          classId: session.class_id,
          countedLessonQuota: lessonType !== 'user_generated',
          classLaunchesRemaining: Number(freshPartner.trial?.classLaunchesRemaining ?? 0),
        };
      });

      await writePartnerEvent({
        partnerId: partner.id,
        type: 'lesson_launched',
        actorUid: req.user!.uid,
        schoolId: result.schoolId,
        meta: {
          sessionId,
          classId: result.classId,
          chapterId,
          topicId,
          lessonType,
          countedLessonQuota: result.countedLessonQuota,
          lessonLaunchesRemaining: result.remaining,
          classLaunchesRemaining: result.classLaunchesRemaining,
        },
      });
      res.json({
        success: true,
        lessonLaunchesRemaining: result.remaining,
        lessonLaunchesUsed: result.used,
        countedLessonQuota: result.countedLessonQuota,
        classLaunchesRemaining: result.classLaunchesRemaining,
      });
    } catch (error: any) {
      const status = ['FORBIDDEN', 'TRIAL_INACTIVE', 'LESSON_QUOTA_EXHAUSTED'].includes(error?.code) ? 403 : 500;
      res.status(status).json({ success: false, message: error?.message || 'Failed to launch demo lesson' });
    }
  }
);

router.post(
  ['/sessions/:sessionId/telemetry', '/sessions/:sessionId/telemetry/'],
  requirePartner,
  async (req: Request, res: Response): Promise<void> => {
    const location = req.body?.location;
    if (req.body?.consentTelemetry !== true || typeof location?.latitude !== 'number' || typeof location?.longitude !== 'number') {
      res.status(400).json({ success: false, message: 'Explicit telemetry consent and location are required' });
      return;
    }
    const db = admin.firestore();
    try {
      const partner = await getPartnerByUserId(req.user!.uid);
      const sessionSnap = await db.collection('class_sessions').doc(req.params.sessionId).get();
      if (!partner || !sessionSnap.exists || sessionSnap.data()?.partner_id !== partner.id) {
        res.status(403).json({ success: false, message: 'Session is not in your partner portfolio' });
        return;
      }
      let city = '';
      let country = partner.data.country || '';
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.latitude}&lon=${location.longitude}`,
          { headers: { 'User-Agent': 'LearnXR partner telemetry (privacy@altiereality.com)' } }
        );
        if (response.ok) {
          const result = await response.json() as { address?: Record<string, string> };
          city = result.address?.city || result.address?.town || result.address?.village || '';
          country = result.address?.country || country;
        }
      } catch {
        // Telemetry remains useful with the partner's declared country fallback.
      }
      await db.collection('partner_telemetry_events').add({
        partnerId: partner.id,
        schoolId: sessionSnap.data()?.school_id || null,
        sessionId: req.params.sessionId,
        eventType: 'demo_session_started',
        city: city || null,
        country: country || null,
        consentTelemetry: true,
        consentVersion: 'partner-telemetry-v1',
        source: 'partner_portal',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      res.json({ success: true, city: city || null, country: country || null });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to record launch telemetry' });
    }
  }
);

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

router.get(['/admin/list', '/admin/list/'], requireSuperadmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = admin.firestore();
    const [partnersSnap, sessionsSnap] = await Promise.all([
      db.collection('partners').get(),
      db.collection('class_sessions').where('hosted_by_partner', '==', true).get(),
    ]);
    const sessionCounts = new Map<string, number>();
    sessionsSnap.docs.forEach((doc) => {
      const partnerId = doc.data().partner_id;
      if (partnerId) sessionCounts.set(partnerId, (sessionCounts.get(partnerId) || 0) + 1);
    });
    const partners = await Promise.all(partnersSnap.docs.map(async (doc) => {
      const data = doc.data();
      const schools = data.schoolIds?.length || 0;
      const daysRemaining = data.trial?.endsAt
        ? Math.max(0, Math.ceil((new Date(data.trial.endsAt).getTime() - Date.now()) / 86_400_000))
        : 0;
      return { id: doc.id, ...data, schoolCount: schools, sessionCount: sessionCounts.get(doc.id) || 0, daysRemaining };
    }));
    res.json({ success: true, partners });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to list partners' });
  }
});

router.post(
  ['/:partnerId/provision-demo', '/:partnerId/provision-demo/'],
  requirePartnerOrSuperadmin,
  async (req: Request, res: Response): Promise<void> => {
  const db = admin.firestore();
  const partnerRef = db.collection('partners').doc(req.params.partnerId);
  try {
    if (req.userProfile!.role === 'partner') {
      const own = await getPartnerByUserId(req.user!.uid);
      if (!own || own.id !== req.params.partnerId) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }
    }
    const partnerSnap = await partnerRef.get();
    if (!partnerSnap.exists) {
      res.status(404).json({ success: false, message: 'Partner not found' });
      return;
    }
    const partner = partnerSnap.data()!;
    if (partner.demoSchoolId && partner.demoClassId) {
      res.json({ success: true, demoSchoolId: partner.demoSchoolId, demoClassId: partner.demoClassId, existing: true });
      return;
    }
    const schoolQuery = await db.collection('schools').where('schoolCode', '==', DEFAULT_DEMO_SCHOOL_CODE).limit(1).get();
    if (schoolQuery.empty) {
      res.status(400).json({ success: false, message: `Default demo school ${DEFAULT_DEMO_SCHOOL_CODE} was not found` });
      return;
    }
    const schoolRef = schoolQuery.docs[0].ref;
    const classRef = db.collection('classes').doc();
    await classRef.set({
      class_name: `${partner.organizationName || 'Channel Partner'} Demo`,
      school_id: schoolRef.id,
      partner_id: partnerRef.id,
      teacher_ids: [],
      student_ids: [],
      source: 'channel_partner_demo',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    await partnerRef.update({
      demoSchoolId: schoolRef.id,
      demoClassId: classRef.id,
      schoolIds: admin.firestore.FieldValue.arrayUnion(schoolRef.id),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await writePartnerEvent({ partnerId: partnerRef.id, type: 'school_created', actorUid: req.user!.uid, schoolId: schoolRef.id, meta: { demoClassId: classRef.id, defaultDemoSchool: true } });
    await writePartnerAudit({ action: 'provision_demo_class', targetPartnerId: partnerRef.id, actorUid: req.user!.uid, actorRole: req.userProfile!.role, after: { demoSchoolId: schoolRef.id, demoClassId: classRef.id } });
    res.json({ success: true, demoSchoolId: schoolRef.id, demoClassId: classRef.id });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to provision demo class' });
  }
});

router.get(['/admin/:partnerId/telemetry', '/admin/:partnerId/telemetry/'], requireSuperadmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await admin.firestore()
      .collection('partner_telemetry_events')
      .where('partnerId', '==', req.params.partnerId)
      .limit(500)
      .get();
    const locations = new Map<string, number>();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const label = [data.city, data.country].filter(Boolean).join(', ') || 'Unknown';
      locations.set(label, (locations.get(label) || 0) + 1);
    });
    res.json({ success: true, locations: Array.from(locations, ([label, launches]) => ({ label, launches })) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to load partner telemetry' });
  }
});

router.post(['/:partnerId/trial/quota', '/:partnerId/trial/quota/'], requireSuperadmin, async (req: Request, res: Response): Promise<void> => {
  const classLimit = Number(req.body?.classLaunchesLimit);
  const lessonLimit = Number(req.body?.lessonLaunchesLimit);
  if (!Number.isInteger(classLimit) || !Number.isInteger(lessonLimit) || classLimit < 0 || lessonLimit < 0) {
    res.status(400).json({ success: false, message: 'Launch limits must be non-negative integers' });
    return;
  }
  const ref = admin.firestore().collection('partners').doc(req.params.partnerId);
  try {
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ success: false, message: 'Partner not found' });
      return;
    }
    const trial = snap.data()?.trial || {};
    const usedClasses = Number(trial.classLaunchesUsed || 0);
    const usedLessons = Number(trial.lessonLaunchesUsed || 0);
    const update = {
      'trial.classLaunchesLimit': classLimit,
      'trial.classLaunchesRemaining': Math.max(0, classLimit - usedClasses),
      'trial.lessonLaunchesLimit': lessonLimit,
      'trial.lessonLaunchesRemaining': Math.max(0, lessonLimit - usedLessons),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.update(update);
    await writePartnerEvent({ partnerId: ref.id, type: 'quota_adjusted', actorUid: req.user!.uid, meta: update });
    await writePartnerAudit({
      action: 'quota_adjust',
      targetPartnerId: ref.id,
      actorUid: req.user!.uid,
      actorRole: req.userProfile!.role,
      before: { trial },
      after: update,
      reason: typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : undefined,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to update quota' });
  }
});

router.post(['/:partnerId/trial/extend', '/:partnerId/trial/extend/'], requireSuperadmin, async (req: Request, res: Response): Promise<void> => {
  const months = Number(req.body?.months);
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    res.status(400).json({ success: false, message: 'months must be between 1 and 24' });
    return;
  }
  const ref = admin.firestore().collection('partners').doc(req.params.partnerId);
  try {
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ success: false, message: 'Partner not found' });
      return;
    }
    const trial = snap.data()?.trial || {};
    const base = new Date(Math.max(Date.now(), new Date(trial.endsAt || Date.now()).getTime()));
    const endsAt = addMonthsIso(base, months);
    await ref.update({ 'trial.endsAt': endsAt, status: 'active', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await writePartnerEvent({ partnerId: ref.id, type: 'trial_extended', actorUid: req.user!.uid, meta: { months, endsAt } });
    await writePartnerAudit({ action: 'trial_extend', targetPartnerId: ref.id, actorUid: req.user!.uid, actorRole: req.userProfile!.role, before: { trial }, after: { endsAt } });
    res.json({ success: true, endsAt });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to extend trial' });
  }
});

router.post(['/:partnerId/reactivate', '/:partnerId/reactivate/'], requireSuperadmin, async (req: Request, res: Response): Promise<void> => {
  const ref = admin.firestore().collection('partners').doc(req.params.partnerId);
  try {
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ success: false, message: 'Partner not found' });
      return;
    }
    await ref.update({ status: 'active', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await writePartnerEvent({ partnerId: ref.id, type: 'partner_reactivated', actorUid: req.user!.uid });
    await writePartnerAudit({ action: 'reactivate', targetPartnerId: ref.id, actorUid: req.user!.uid, actorRole: req.userProfile!.role, before: { status: snap.data()?.status }, after: { status: 'active' } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to reactivate partner' });
  }
});

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
