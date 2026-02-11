/**
 * School Management Component
 * 
 * Allows admins and superadmins to:
 * - Create new schools
 * - View all schools
 * - Update school information
 * - Assign principals to schools
 * 
 * Access: Admin/Superadmin only
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  createSchool,
  updateSchool,
  getAllSchools,
} from '../../services/schoolManagementService';
import type { School } from '../../types/lms';
import { FaPlus, FaSchool, FaEdit, FaUsers, FaMapMarkerAlt, FaPhone, FaGlobe, FaGraduationCap, FaBuilding, FaCalendarAlt } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '../../Components/ui/button';
import { Card, CardContent } from '../../Components/ui/card';
import { Input } from '../../Components/ui/input';
import { Label } from '../../Components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../Components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../Components/ui/select';

const SchoolManagement = () => {
  const { profile } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [newSchoolData, setNewSchoolData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactPerson: '',
    contactPhone: '',
    website: '',
    boardAffiliation: '',
    establishedYear: '',
    schoolType: '',
  });

  useEffect(() => {
    if (!profile) return;

    // Only admin/superadmin can access
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      setLoading(false);
      return;
    }

    // Load schools
    const loadSchools = async () => {
      const schoolsData = await getAllSchools(profile);
      setSchools(schoolsData);
      setLoading(false);
    };

    loadSchools();

    // Load all users (for assigning principals)
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
    });

    return () => {
      unsubscribeUsers();
    };
  }, [profile]);

  const handleCreateSchool = async () => {
    if (!profile) return;

    if (!newSchoolData.name.trim()) {
      toast.error('School name is required');
      return;
    }

    const schoolId = await createSchool(profile, newSchoolData);

    if (schoolId) {
      setShowCreateModal(false);
      setNewSchoolData({
        name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        contactPerson: '',
        contactPhone: '',
        website: '',
        boardAffiliation: '',
        establishedYear: '',
        schoolType: '',
      });
    }
  };

  const handleUpdateSchool = async () => {
    if (!profile || !selectedSchool) return;

    const success = await updateSchool(profile, selectedSchool.id, newSchoolData);
    if (success) {
      setShowEditModal(false);
      setSelectedSchool(null);
    }
  };

  const handleAssignPrincipal = async (schoolId: string, principalId: string) => {
    if (!profile) return;

    try {
      // Update school with principal_id
      await updateDoc(doc(db, 'schools', schoolId), {
        principal_id: principalId,
        updatedAt: serverTimestamp(),
      });

      // Update user with managed_school_id and set role to principal
      await updateDoc(doc(db, 'users', principalId), {
        managed_school_id: schoolId,
        school_id: schoolId, // Also set school_id for consistency
        role: 'principal',
        updatedAt: serverTimestamp(),
      });

      toast.success('Principal assigned to school successfully');
    } catch (error: any) {
      console.error('Error assigning principal:', error);
      toast.error(`Failed to assign principal: ${error.message}`);
    }
  };

  const openEditModal = (school: School) => {
    setSelectedSchool(school);
    setNewSchoolData({
      name: school.name || '',
      address: school.address || '',
      city: school.city || '',
      state: school.state || '',
      pincode: school.pincode || '',
      contactPerson: school.contactPerson || '',
      contactPhone: school.contactPhone || '',
      website: school.website || '',
      boardAffiliation: school.boardAffiliation || '',
      establishedYear: school.establishedYear || '',
      schoolType: school.schoolType || '',
    });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading school management...</p>
        </div>
      </div>
    );
  }

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <Card className="max-w-md border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Access denied. Admin or Superadmin role required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const principals = users.filter(u => u.role === 'principal' || u.role === 'teacher');

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <FaSchool className="text-primary" />
              </div>
              School Management
            </h1>
            <p className="text-muted-foreground">Create and manage schools, assign principals</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <FaPlus className="w-4 h-4" />
            Create School
          </Button>
        </div>

        {/* Schools List */}
        <div className="space-y-4">
          {schools.length === 0 ? (
            <Card className="border-border rounded-2xl">
              <CardContent className="p-8 text-center">
                <FaSchool className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No schools created yet</p>
                <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                  Create Your First School
                </Button>
              </CardContent>
            </Card>
          ) : (
            schools.map((school) => {
              const schoolPrincipal = users.find(u => 
                (u.managed_school_id === school.id) || (school.principal_id === u.uid)
              );
              const schoolStudents = users.filter(u => u.school_id === school.id && u.role === 'student');
              const schoolTeachers = users.filter(u => u.school_id === school.id && u.role === 'teacher');

              return (
                <Card key={school.id} className="rounded-xl border-border bg-card">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                          <FaSchool className="text-primary" />
                          {school.name}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                          {school.address && (
                            <div className="flex items-center gap-2">
                              <FaMapMarkerAlt className="text-primary shrink-0" />
                              <span>{school.address}, {school.city}, {school.state} {school.pincode}</span>
                            </div>
                          )}
                          {school.contactPhone && (
                            <div className="flex items-center gap-2">
                              <FaPhone className="text-primary shrink-0" />
                              <span>{school.contactPhone}</span>
                            </div>
                          )}
                          {school.website && (
                            <div className="flex items-center gap-2">
                              <FaGlobe className="text-primary shrink-0" />
                              <a href={school.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                                {school.website}
                              </a>
                            </div>
                          )}
                          {school.boardAffiliation && (
                            <div className="flex items-center gap-2">
                              <FaGraduationCap className="text-primary shrink-0" />
                              <span>{school.boardAffiliation}</span>
                            </div>
                          )}
                          {school.establishedYear && (
                            <div className="flex items-center gap-2">
                              <FaCalendarAlt className="text-primary shrink-0" />
                              <span>Est. {school.establishedYear}</span>
                            </div>
                          )}
                          {school.schoolType && (
                            <div className="flex items-center gap-2">
                              <FaBuilding className="text-primary shrink-0" />
                              <span>{school.schoolType}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openEditModal(school)} className="gap-2">
                        <FaEdit />
                        Edit
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FaUsers className="text-primary" />
                          <span className="text-foreground text-sm font-medium">Principal</span>
                        </div>
                        {schoolPrincipal ? (
                          <p className="text-muted-foreground text-sm">{schoolPrincipal.name || schoolPrincipal.displayName || schoolPrincipal.email}</p>
                        ) : (
                          <Select
                            onValueChange={(value) => value && handleAssignPrincipal(school.id, value)}
                          >
                            <SelectTrigger className="w-full bg-background border-border text-foreground">
                              <SelectValue placeholder="Assign Principal" />
                            </SelectTrigger>
                            <SelectContent>
                              {principals.map(p => (
                                <SelectItem key={p.uid} value={p.uid}>
                                  {p.name || p.displayName || p.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FaUsers className="text-primary" />
                          <span className="text-foreground text-sm font-medium">Teachers ({schoolTeachers.length})</span>
                        </div>
                        <p className="text-muted-foreground text-sm">{schoolTeachers.length} teachers</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FaUsers className="text-primary" />
                          <span className="text-foreground text-sm font-medium">Students ({schoolStudents.length})</span>
                        </div>
                        <p className="text-muted-foreground text-sm">{schoolStudents.length} students</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Create School Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create New School</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label className="text-foreground">School Name *</Label>
                <Input
                  value={newSchoolData.name}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, name: e.target.value })}
                  placeholder="Enter school name"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-foreground">Address</Label>
                <Input
                  value={newSchoolData.address}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, address: e.target.value })}
                  placeholder="Street address"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">City</Label>
                <Input
                  value={newSchoolData.city}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, city: e.target.value })}
                  placeholder="City"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">State</Label>
                <Input
                  value={newSchoolData.state}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, state: e.target.value })}
                  placeholder="State"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Pincode</Label>
                <Input
                  value={newSchoolData.pincode}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, pincode: e.target.value })}
                  placeholder="Pincode"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Contact Person</Label>
                <Input
                  value={newSchoolData.contactPerson}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, contactPerson: e.target.value })}
                  placeholder="Contact person name"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Contact Phone</Label>
                <Input
                  value={newSchoolData.contactPhone}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, contactPhone: e.target.value })}
                  placeholder="Phone number"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Website</Label>
                <Input
                  type="url"
                  value={newSchoolData.website}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, website: e.target.value })}
                  placeholder="https://example.com"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Board Affiliation</Label>
                <Input
                  value={newSchoolData.boardAffiliation}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, boardAffiliation: e.target.value })}
                  placeholder="e.g., CBSE, RBSE, ICSE"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Established Year</Label>
                <Input
                  value={newSchoolData.establishedYear}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, establishedYear: e.target.value })}
                  placeholder="Year"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">School Type</Label>
                <Input
                  value={newSchoolData.schoolType}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, schoolType: e.target.value })}
                  placeholder="e.g., Private, Public, International"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreateSchool}>
                Create School
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit School Modal */}
        <Dialog open={showEditModal && !!selectedSchool} onOpenChange={(open) => { if (!open) { setShowEditModal(false); setSelectedSchool(null); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit School: {selectedSchool?.name}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label className="text-foreground">School Name *</Label>
                <Input
                  value={newSchoolData.name}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, name: e.target.value })}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-foreground">Address</Label>
                <Input
                  value={newSchoolData.address}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, address: e.target.value })}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">City</Label>
                <Input
                  value={newSchoolData.city}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, city: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">State</Label>
                <Input
                  value={newSchoolData.state}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, state: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Pincode</Label>
                <Input
                  value={newSchoolData.pincode}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, pincode: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Contact Person</Label>
                <Input
                  value={newSchoolData.contactPerson}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, contactPerson: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Contact Phone</Label>
                <Input
                  value={newSchoolData.contactPhone}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, contactPhone: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Website</Label>
                <Input
                  type="url"
                  value={newSchoolData.website}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, website: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Board Affiliation</Label>
                <Input
                  value={newSchoolData.boardAffiliation}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, boardAffiliation: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Established Year</Label>
                <Input
                  value={newSchoolData.establishedYear}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, establishedYear: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">School Type</Label>
                <Input
                  value={newSchoolData.schoolType}
                  onChange={(e) => setNewSchoolData({ ...newSchoolData, schoolType: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => { setShowEditModal(false); setSelectedSchool(null); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleUpdateSchool}>
                Update School
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SchoolManagement;
