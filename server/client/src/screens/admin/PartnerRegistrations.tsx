import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FaHandshake, FaGlobe, FaPhone, FaEnvelope, FaUser } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '../../Components/ui/card';
import { Button } from '../../Components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../Components/ui/dialog';
import { Badge } from '../../Components/ui/badge';
import { toast } from 'react-toastify';
import {
  approvePartnerRegistration,
  rejectPartnerRegistration,
  fetchPartnerRegistrationDetail,
  suspendPartner,
} from '../../services/partnerService';

interface PartnerRegistration {
  id: string;
  organizationName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  region?: string;
  website?: string;
  partnerType: string;
  orgType: string;
  yearsInBusiness: string;
  schoolsReach: string;
  currentPortfolio: string;
  message: string;
  leadScore: number;
  tier: string;
  status: string;
  submittedAt: string;
  createdAt?: any;
  partnerId?: string;
  userId?: string;
  rejectionReason?: string;
}

const tierBadgeVariant = (tier: string): 'default' | 'secondary' | 'outline' => {
  const normalized = tier?.toUpperCase();
  if (normalized === 'A' || normalized === 'TIER-1') return 'default';
  if (normalized === 'B' || normalized === 'TIER-2') return 'secondary';
  return 'outline';
};

const formatTierLabel = (tier: string): string => {
  const labels: Record<string, string> = {
    A: 'Tier A',
    B: 'Tier B',
    C: 'Tier C',
    'tier-1': 'Tier 1',
    'tier-2': 'Tier 2',
    'tier-3': 'Tier 3',
  };
  return labels[tier] ?? tier.replace('-', ' ').toUpperCase();
};

const statusVariant = (status: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (status === 'approved') return 'default';
  if (status === 'rejected') return 'destructive';
  return 'outline';
};

const PartnerRegistrations = () => {
  const { profile } = useAuth();
  const isSuperadmin = profile?.role === 'superadmin';
  const canReviewRegistrations = profile?.role === 'admin' || isSuperadmin;
  const [registrations, setRegistrations] = useState<PartnerRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReg, setSelectedReg] = useState<PartnerRegistration | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [detail, setDetail] = useState<{
    partner: any;
    schools: any[];
    events: any[];
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const loadRegistrations = useCallback(async () => {
    try {
      const q = query(collection(db, 'partner_registrations'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as PartnerRegistration[];
      setRegistrations(data);
    } catch (error) {
      console.error('Error loading partner registrations:', error);
      toast.error('Unable to load partner registrations. Check Firestore rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      setLoading(false);
      return;
    }
    loadRegistrations();
  }, [profile, loadRegistrations]);

  const openDetails = async (reg: PartnerRegistration) => {
    setSelectedReg(reg);
    setShowModal(true);
    setDetail(null);
    setLastInviteLink(null);
    setRejectReason('');
    if (isSuperadmin && (reg.status === 'approved' || reg.partnerId)) {
      try {
        const data = await fetchPartnerRegistrationDetail(reg.id);
        setDetail({
          partner: data.partner,
          schools: data.schools || [],
          events: data.events || [],
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleApprove = async () => {
    if (!selectedReg || !canReviewRegistrations) return;
    setActionLoading(true);
    try {
      const result = await approvePartnerRegistration(selectedReg.id);
      toast.success(result.message || 'Partner approved');
      if (result.inviteLink) setLastInviteLink(result.inviteLink);
      await loadRegistrations();
      const updated = {
        ...selectedReg,
        status: 'approved',
        partnerId: result.partnerId,
        userId: result.userId,
      };
      setSelectedReg(updated);
      if (result.partnerId && isSuperadmin) {
        const data = await fetchPartnerRegistrationDetail(selectedReg.id);
        setDetail({
          partner: data.partner,
          schools: data.schools || [],
          events: data.events || [],
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Approve failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReg || !canReviewRegistrations) return;
    setActionLoading(true);
    try {
      await rejectPartnerRegistration(selectedReg.id, rejectReason);
      toast.success('Registration rejected');
      setSelectedReg({ ...selectedReg, status: 'rejected', rejectionReason: rejectReason });
      await loadRegistrations();
    } catch (err: any) {
      toast.error(err?.message || 'Reject failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedReg?.partnerId || !isSuperadmin) return;
    setActionLoading(true);
    try {
      await suspendPartner(selectedReg.partnerId);
      toast.success('Partner suspended');
      const data = await fetchPartnerRegistrationDetail(selectedReg.id);
      setDetail({
        partner: data.partner,
        schools: data.schools || [],
        events: data.events || [],
      });
    } catch (err: any) {
      toast.error(err?.message || 'Suspend failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FaHandshake className="text-primary" />
            Partner Registrations
          </h2>
          <p className="text-muted-foreground mt-1">
            Review channel partner applications.
            {canReviewRegistrations
              ? ' Approve to provision a partner login with a 6-month / 100 class-launch trial.'
              : ' Only administrators can approve partners.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {registrations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <FaHandshake className="h-12 w-12 mb-4 text-muted-foreground/50" />
              <p>No partner registrations found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {registrations.map((reg) => (
              <Card key={reg.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg line-clamp-1" title={reg.organizationName}>
                        {reg.organizationName}
                      </h3>
                      <p className="text-sm text-muted-foreground">{reg.country}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={tierBadgeVariant(reg.tier)}>{formatTierLabel(reg.tier)}</Badge>
                      <Badge variant={statusVariant(reg.status || 'new')} className="capitalize">
                        {reg.status || 'new'}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <FaUser className="w-4 h-4 shrink-0" />
                      <span className="truncate">{reg.contactName}</span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <FaEnvelope className="w-4 h-4 shrink-0" />
                      <span className="truncate">{reg.email}</span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <FaPhone className="w-4 h-4 shrink-0" />
                      <span className="truncate">{reg.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      Score: <span className="font-medium text-foreground">{reg.leadScore}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openDetails(reg)}>
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FaHandshake className="text-primary" />
              {selectedReg?.organizationName}
            </DialogTitle>
          </DialogHeader>

          {selectedReg && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Contact Person
                  </div>
                  <div className="font-medium">{selectedReg.contactName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Status
                  </div>
                  <Badge variant={statusVariant(selectedReg.status || 'new')} className="capitalize">
                    {selectedReg.status || 'New'}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Email Address
                  </div>
                  <div className="font-medium flex items-center gap-2">
                    <FaEnvelope className="text-muted-foreground/50" />
                    <a href={`mailto:${selectedReg.email}`} className="text-primary hover:underline">
                      {selectedReg.email}
                    </a>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Phone Number
                  </div>
                  <div className="font-medium flex items-center gap-2">
                    <FaPhone className="text-muted-foreground/50" />
                    <a href={`tel:${selectedReg.phone}`} className="text-primary hover:underline">
                      {selectedReg.phone}
                    </a>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Location
                  </div>
                  <div className="font-medium">
                    {selectedReg.country} {selectedReg.region ? `(${selectedReg.region})` : ''}
                  </div>
                </div>
                {selectedReg.website && (
                  <div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                      Website
                    </div>
                    <div className="font-medium flex items-center gap-2">
                      <FaGlobe className="text-muted-foreground/50" />
                      <a
                        href={
                          selectedReg.website.startsWith('http')
                            ? selectedReg.website
                            : `https://${selectedReg.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {selectedReg.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border p-4 rounded-lg">
                  <div className="text-sm font-medium mb-2 border-b border-border pb-2">
                    Business Profile
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Partner Type:</span>
                      <span className="font-medium">{selectedReg.partnerType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Org Type:</span>
                      <span className="font-medium">{selectedReg.orgType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Years in Biz:</span>
                      <span className="font-medium">{selectedReg.yearsInBusiness}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Schools Reach:</span>
                      <span className="font-medium">{selectedReg.schoolsReach}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-card border border-border p-4 rounded-lg">
                  <div className="text-sm font-medium mb-2 border-b border-border pb-2">Lead Scoring</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tier Classification:</span>
                      <Badge variant={tierBadgeVariant(selectedReg.tier)}>
                        {formatTierLabel(selectedReg.tier)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Computed Score:</span>
                      <span className="font-medium">{selectedReg.leadScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Submitted:</span>
                      <span className="font-medium text-xs pt-1">
                        {new Date(selectedReg.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium border-b border-border pb-2 mb-2">
                    Current Portfolio
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded-md">
                    {selectedReg.currentPortfolio || <span className="italic">Not provided</span>}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium border-b border-border pb-2 mb-2">
                    Message / Inquiry
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded-md">
                    {selectedReg.message || <span className="italic">Not provided</span>}
                  </p>
                </div>
              </div>

              {detail?.partner && (
                <div className="space-y-3 border border-border rounded-lg p-4">
                  <h4 className="text-sm font-medium">Partner tenant</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      Status: <span className="font-medium capitalize">{detail.partner.status}</span>
                    </div>
                    <div>
                      Schools: <span className="font-medium">{detail.schools.length}</span>
                    </div>
                    <div>
                      Launches left:{' '}
                      <span className="font-medium">
                        {detail.partner.trial?.classLaunchesRemaining ?? '—'}
                      </span>
                    </div>
                    <div>
                      Trial ends:{' '}
                      <span className="font-medium text-xs">
                        {detail.partner.trial?.endsAt
                          ? new Date(detail.partner.trial.endsAt).toLocaleDateString()
                          : '—'}
                      </span>
                    </div>
                  </div>
                  {detail.schools.length > 0 && (
                    <ul className="text-sm space-y-1 mt-2">
                      {detail.schools.map((s) => (
                        <li key={s.id} className="text-muted-foreground">
                          {s.name}{' '}
                          <span className="font-mono text-xs text-foreground">
                            ({s.schoolCode || 'no code'})
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {detail.events.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs uppercase text-muted-foreground mb-1">Recent activity</div>
                      <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                        {detail.events.slice(0, 15).map((e) => (
                          <li key={e.id}>
                            <span className="font-medium">{e.type}</span>
                            {e.schoolId ? ` · school ${e.schoolId.slice(0, 6)}…` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {lastInviteLink && (
                <div className="bg-muted/40 border border-border rounded-lg p-3 text-sm break-all">
                  <div className="font-medium mb-1">Password setup link (share securely)</div>
                  <a href={lastInviteLink} className="text-primary hover:underline">
                    {lastInviteLink}
                  </a>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-border mt-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Close
                </Button>
                {canReviewRegistrations && selectedReg.status === 'new' && (
                  <>
                    <input
                      type="text"
                      placeholder="Rejection reason (optional)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="flex-1 min-w-[160px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                    <Button
                      variant="destructive"
                      disabled={actionLoading}
                      onClick={handleReject}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                    </Button>
                    <Button disabled={actionLoading} onClick={handleApprove}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve partner'}
                    </Button>
                  </>
                )}
                {canReviewRegistrations && selectedReg.status === 'approved' && (
                  <Button disabled={actionLoading} onClick={handleApprove}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resend setup email'}
                  </Button>
                )}
                {isSuperadmin &&
                  selectedReg.status === 'approved' &&
                  selectedReg.partnerId &&
                  detail?.partner?.status !== 'suspended' && (
                    <Button variant="destructive" disabled={actionLoading} onClick={handleSuspend}>
                      Suspend partner
                    </Button>
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerRegistrations;
