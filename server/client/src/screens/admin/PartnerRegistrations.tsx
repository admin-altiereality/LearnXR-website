import { useState, useEffect } from 'react';
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

const PartnerRegistrations = () => {
  const { profile } = useAuth();
  const [registrations, setRegistrations] = useState<PartnerRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReg, setSelectedReg] = useState<PartnerRegistration | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    // Only admin/superadmin can access
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      setLoading(false);
      return;
    }

    const loadRegistrations = async () => {
      try {
        const q = query(
          collection(db, 'partner_registrations'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PartnerRegistration[];
        setRegistrations(data);
      } catch (error) {
        console.error("Error loading partner registrations:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRegistrations();
  }, [profile]);

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
            Manage channel partner applications and inquiries.
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
                    <Badge variant={tierBadgeVariant(reg.tier)}>
                      {formatTierLabel(reg.tier)}
                    </Badge>
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
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedReg(reg);
                        setShowModal(true);
                      }}
                    >
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
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Contact Person</div>
                  <div className="font-medium">{selectedReg.contactName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Status</div>
                  <Badge variant="outline" className="capitalize">{selectedReg.status || 'New'}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Email Address</div>
                  <div className="font-medium flex items-center gap-2">
                    <FaEnvelope className="text-muted-foreground/50" />
                    <a href={`mailto:${selectedReg.email}`} className="text-primary hover:underline">{selectedReg.email}</a>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Phone Number</div>
                  <div className="font-medium flex items-center gap-2">
                    <FaPhone className="text-muted-foreground/50" />
                    <a href={`tel:${selectedReg.phone}`} className="text-primary hover:underline">{selectedReg.phone}</a>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Location</div>
                  <div className="font-medium">{selectedReg.country} {selectedReg.region ? `(${selectedReg.region})` : ''}</div>
                </div>
                {selectedReg.website && (
                  <div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Website</div>
                    <div className="font-medium flex items-center gap-2">
                      <FaGlobe className="text-muted-foreground/50" />
                      <a href={selectedReg.website.startsWith('http') ? selectedReg.website : `https://${selectedReg.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {selectedReg.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border p-4 rounded-lg">
                  <div className="text-sm font-medium mb-2 border-b border-border pb-2">Business Profile</div>
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
                  <h4 className="text-sm font-medium border-b border-border pb-2 mb-2">Current Portfolio</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded-md">
                    {selectedReg.currentPortfolio || <span className="italic">Not provided</span>}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium border-b border-border pb-2 mb-2">Message / Inquiry</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded-md">
                    {selectedReg.message || <span className="italic">Not provided</span>}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t border-border mt-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerRegistrations;
